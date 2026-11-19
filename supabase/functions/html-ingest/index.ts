// Edge Function `html-ingest` (A8) : seule porte d'écriture du bucket html.
//  * POST JSON { workspaceId, demoId, html } : utilisateur éditeur ou plus du workspace, démo du
//    workspace ; 10 Mo au plus, refusé avant la lecture du corps (Content-Length) puis pendant la
//    lecture ; second assainissement (lib.ts) ; dépôt sous <ws>/<démo>/<uuid>.html ; renvoie { path }.
// JWT vérifié par la plateforme (config.toml : verify_jwt = true), puis ici l'utilisateur et son rôle.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { MAX_BYTES, inert, sanitizePage } from './lib.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANK: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };
// Enveloppe JSON (échappements) autour de la page : marge de 25 %
const MAX_BODY = Math.ceil(MAX_BYTES * 1.25);

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'access-control-allow-methods': 'POST, OPTIONS',
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

async function readCapped(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return new TextDecoder().decode(all);
}

async function editorOf(req: Request, ws: string): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'METHOD' });
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY) return json(413, { error: 'TOO_BIG' });
  const raw = await readCapped(req);
  if (raw === null) return json(413, { error: 'TOO_BIG' });
  let body: { workspaceId?: unknown; demoId?: unknown; html?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'BAD_REQUEST' });
  }
  const ws = String(body.workspaceId ?? '');
  const demo = String(body.demoId ?? '');
  if (!UUID.test(ws) || !UUID.test(demo) || typeof body.html !== 'string' || !body.html)
    return json(400, { error: 'BAD_REQUEST' });
  if (new TextEncoder().encode(body.html).length > MAX_BYTES) return json(413, { error: 'TOO_BIG' });
  if (!(await editorOf(req, ws))) return json(403, { error: 'FORBIDDEN' });
  const { data: d } = await admin
    .from('demos')
    .select('id')
    .eq('id', demo)
    .eq('workspace_id', ws)
    .is('deleted_at', null)
    .maybeSingle();
  if (!d) return json(404, { error: 'DEMO_NOT_FOUND' });

  const page = sanitizePage(body.html);
  if (!inert(page)) return json(422, { error: 'NOT_INERT' });
  const bytes = new TextEncoder().encode(page);
  if (bytes.length > MAX_BYTES) return json(413, { error: 'TOO_BIG' });
  const path = `${ws}/${demo}/${crypto.randomUUID()}.html`;
  const up = await admin.storage.from('html').upload(path, bytes, {
    contentType: 'text/html',
    cacheControl: '31536000',
    upsert: false,
  });
  if (up.error) return json(400, { error: 'STORAGE' });
  return json(200, { path });
});
