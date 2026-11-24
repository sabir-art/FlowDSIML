// Edge Function `media` (L18) : seule porte d'écriture de la médiathèque.
//  * POST (multipart : file, kind, name, ws) : utilisateur éditeur ou plus du workspace ; type réel lu
//    dans les octets, 5 Mo au plus, SVG assaini (lib.ts), dépôt dans le bucket media sous
//    <ws>/<uuid>.<ext>, puis ligne media_files (taille réelle et quota de 500 Mo vérifiés en base) ;
//    en cas de refus, l'objet déposé est retiré.
//  * DELETE ({ id }) : même contrôle de rôle ; l'objet et la ligne sont supprimés ensemble.
//  * POST JSON ({ action: 'logo', id, target }) : un admin de l'espace prend un fichier de la médiathèque
//    comme logo de l'espace ou du centre de formation. Le fichier est COPIÉ dans le bucket branding,
//    signature relue et mêmes plafonds qu'un téléversement ; aucun lecteur du logo ne change.
// JWT vérifié par la plateforme (config.toml : verify_jwt = true), puis ici l'utilisateur et son rôle (auth.getUser).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  EXT,
  MAX_BYTES,
  MediaError,
  allowed,
  pngSize,
  webpSize,
  logoCopy,
  logoPath,
  sanitizeSvg,
  sniff,
  type Kind,
  type LogoTarget,
} from './lib.ts';

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

/** Rôle du porteur du jeton dans l'espace (0 : aucun). */
async function rankOf(req: Request, ws: string): Promise<number> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !UUID.test(ws)) return 0;
  const { data } = await admin.auth.getUser(token);
  const uid = data.user?.id;
  if (!uid) return 0;
  const { data: m } = await admin
    .from('members')
    .select('role')
    .eq('workspace_id', ws)
    .eq('user_id', uid)
    .maybeSingle();
  return m ? (RANK[m.role as string] ?? 0) : 0;
}

/** Logo de l'espace ou du centre pris dans la médiathèque : copie dans branding (admins de l'espace). */
async function useAsLogo(body: Record<string, unknown>, req: Request) {
  const id = String(body.id ?? '');
  const target = body.target as LogoTarget;
  if (!UUID.test(id) || (target !== 'workspace' && target !== 'center'))
    return json(400, { error: 'BAD_REQUEST' });
  const { data: row } = await admin
    .from('media_files')
    .select('id, workspace_id, path, kind')
    .eq('id', id)
    .maybeSingle();
  // Fichier inexistant, d'un autre espace, ou demandeur non admin : même réponse
  if (!row || (await rankOf(req, row.workspace_id as string)) < RANK.admin!)
    return json(404, { error: 'NOT_FOUND' });
  if (row.kind === 'font') return json(415, { error: 'BAD_TYPE' });
  const ws = row.workspace_id as string;
  const dl = await admin.storage.from('media').download(row.path as string);
  if (dl.error || !dl.data) return json(404, { error: 'NOT_FOUND' });
  if (dl.data.size > MAX_BYTES) return json(413, { error: 'TOO_BIG' });
  let copy;
  try {
    copy = logoCopy(new Uint8Array(await dl.data.arrayBuffer()), target);
  } catch (e) {
    const code = e instanceof MediaError ? e.code : 'BAD_TYPE';
    return json(code === 'TOO_BIG' ? 413 : code === 'SVG_REJECTED' ? 422 : 415, { error: code });
  }
  const path = logoPath(ws, target, copy.ext, () => crypto.randomUUID());
  const up = await admin.storage
    .from('branding')
    .upload(path, copy.bytes, { contentType: copy.mime, upsert: false });
  if (up.error) return json(400, { error: 'STORAGE' });
  if (target === 'workspace') {
    const { data: w } = await admin.from('workspaces').select('logo_path').eq('id', ws).maybeSingle();
    const { error } = await admin.from('workspaces').update({ logo_path: path }).eq('id', ws);
    if (error) {
      await admin.storage.from('branding').remove([path]);
      return json(400, { error: 'REJECTED' });
    }
    const old = w?.logo_path as string | null | undefined;
    if (old && old !== path) await admin.storage.from('branding').remove([old]);
  }
  // Centre de formation : le chemin va dans le brouillon du centre, enregistré par l'app (save_center_draft)
  return json(200, { path });
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
  else if (mime === 'image/webp') dims = webpSize(bytes);

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
  if (req.method === 'POST') {
    if ((req.headers.get('content-type') ?? '').includes('application/json')) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      return body?.action === 'logo' ? useAsLogo(body, req) : json(400, { error: 'BAD_REQUEST' });
    }
    return upload(req);
  }
  if (req.method === 'DELETE') return remove(req);
  return json(405, { error: 'method_not_allowed' });
});
