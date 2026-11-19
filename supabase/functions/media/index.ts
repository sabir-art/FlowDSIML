// Edge Function `media` (L18) : seule porte d'écriture de la médiathèque.
//  * POST (multipart : file, kind, name, ws) : utilisateur éditeur ou plus du workspace ; type réel lu
//    dans les octets, 5 Mo au plus, SVG assaini (lib.ts), dépôt dans le bucket media sous
//    <ws>/<uuid>.<ext>, puis ligne media_files (taille réelle et quota de 500 Mo vérifiés en base) ;
//    en cas de refus, l'objet déposé est retiré.
//  * DELETE ({ id }) : même contrôle de rôle ; l'objet et la ligne sont supprimés ensemble.
// Déployée sans vérification JWT par la plateforme : l'utilisateur est vérifié ici (auth.getUser).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { EXT, MAX_BYTES, MediaError, allowed, pngSize, sanitizeSvg, sniff, type Kind } from './lib.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANK: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'access-control-allow-methods': 'POST, DELETE, OPTIONS',
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

async function editorOf(req: Request, ws: string): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !UUID.test(ws)) return null;
  const { data } = await admin.auth.getUser(token);
  const uid = data.user?.id;
  if (!uid) return null;
  const { data: m } = await admin
    .from('members')
    .select('role')
    .eq('workspace_id', ws)
    .eq('user_id', uid)
    .maybeSingle();
  return m && (RANK[m.role as string] ?? 0) >= RANK.editor! ? uid : null;
}

async function upload(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const ws = String(form?.get('ws') ?? '');
  const kind = String(form?.get('kind') ?? '') as Kind;
  const name = String(form?.get('name') ?? '')
    .trim()
    .slice(0, 120);
  if (!(file instanceof File) || !['logo', 'image', 'font'].includes(kind) || !name)
    return json(400, { error: 'BAD_REQUEST' });
  const uid = await editorOf(req, ws);
  if (!uid) return json(403, { error: 'FORBIDDEN' });
  if (file.size > MAX_BYTES) return json(413, { error: 'TOO_BIG' });

  let bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !allowed(kind, mime)) return json(415, { error: 'BAD_TYPE' });
  let dims: { width: number; height: number } | null = null;
  if (mime === 'image/svg+xml') {
    try {
      bytes = new TextEncoder().encode(sanitizeSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    } catch (e) {
      return json(422, { error: e instanceof MediaError ? e.code : 'SVG_REJECTED' });
    }
  } else if (mime === 'image/png') dims = pngSize(bytes);

  const path = `${ws}/${crypto.randomUUID()}.${EXT[mime]}`;
  const up = await admin.storage.from('media').upload(path, bytes, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (up.error) return json(400, { error: 'STORAGE' });
  const { data, error } = await admin
    .from('media_files')
    .insert({
      workspace_id: ws,
      kind,
      name,
      path,
      mime,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      created_by: uid,
    })
    .select()
    .single();
  if (error) {
    await admin.storage.from('media').remove([path]);
    return json(error.message.includes('MEDIA_QUOTA') ? 413 : 400, {
      error: error.message.includes('MEDIA_QUOTA') ? 'MEDIA_QUOTA' : 'REJECTED',
    });
  }
  return json(200, data);
}

async function remove(req: Request) {
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!UUID.test(id)) return json(400, { error: 'BAD_REQUEST' });
  const { data: row } = await admin
    .from('media_files')
    .select('id, workspace_id, path')
    .eq('id', id)
    .maybeSingle();
  // Fichier inexistant ou d'un autre workspace : même réponse
  if (!row || !(await editorOf(req, row.workspace_id as string))) return json(404, { error: 'NOT_FOUND' });
  const rm = await admin.storage.from('media').remove([row.path as string]);
  if (rm.error) return json(400, { error: 'STORAGE' });
  await admin.from('media_files').delete().eq('id', id);
  return json(200, { deleted: id });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, 'access-control-allow-methods': 'POST, DELETE, OPTIONS' },
    });
  if (req.method === 'POST') return upload(req);
  if (req.method === 'DELETE') return remove(req);
  return json(405, { error: 'method_not_allowed' });
});
