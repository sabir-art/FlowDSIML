// Edge Function `html-recheck` (L49 §4.1) : nouvelle vérification Google Safe Browsing des pages HTML
// d'une démo, appelée par l'éditeur avant la publication.
//  * POST JSON { demoId } : utilisateur éditeur ou plus de l'espace de la démo.
//  * Adresses vérifiées : liens repérés à la capture et liens autorisés (préfixes de hachage seulement).
//  * Lien signalé : ajouté au rapport de la page (html_page_security) ; son autorisation est retirée par
//    le déclencheur steps_extlink_guard. Renvoie { status, blocked: [{ stepId, text }], steps: [{ id, html_meta, html_ops }] }.
//  * Vérification indisponible (panne, quota, délai) : rien ne change, la publication continue.
// Ni la clé ni les adresses ne sont journalisées.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { checkUrls } from '../html-ingest/safebrowsing.ts';
import { type RecheckStep, recheckPlan, recheckUrls } from './lib.ts';

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
      'access-control-allow-methods': 'POST, OPTIONS',
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'METHOD' });
  let body: { demoId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'BAD_REQUEST' });
  }
  const demo = String(body.demoId ?? '');
  if (!UUID.test(demo)) return json(400, { error: 'BAD_REQUEST' });
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!u.user) return json(401, { error: 'UNAUTHORIZED' });
  const { data: d } = await admin
    .from('demos')
    .select('workspace_id')
    .eq('id', demo)
    .is('deleted_at', null)
    .maybeSingle();
  if (!d) return json(404, { error: 'DEMO_NOT_FOUND' });
  const { data: m } = await admin
    .from('members')
    .select('role')
    .eq('workspace_id', d.workspace_id)
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (!m || (RANK[m.role as string] ?? 0) < RANK.editor!) return json(403, { error: 'FORBIDDEN' });

  const { data: rows } = await admin
    .from('steps')
    .select('id, html_path, html_meta, html_ops')
    .eq('demo_id', demo)
    .eq('kind', 'html')
    .not('html_path', 'is', null);
  const steps = (rows ?? []) as RecheckStep[];
  if (!steps.length) return json(200, { status: 'ok', blocked: [] });
  const gsb = await checkUrls(recheckUrls(steps), Deno.env.get('GOOGLE_SAFE_BROWSING_API_KEY'));
  if (gsb.status !== 'ok') return json(200, { status: 'unavailable', blocked: [] });

  const blocked: Array<{ stepId: string; text: string }> = [];
  const changed: string[] = [];
  for (const up of recheckPlan(steps, gsb.flagged, new Date().toISOString())) {
    const r = await admin
      .from('html_page_security')
      .update({ security: up.security })
      .eq('path', up.path)
      .eq('workspace_id', d.workspace_id);
    if (r.error) return json(500, { error: 'UPDATE' });
    // Les déclencheurs recopient le rapport et retirent les autorisations des liens signalés
    const s = steps.find((x) => x.id === up.stepId)!;
    await admin.from('steps').update({ html_meta: s.html_meta, html_ops: s.html_ops }).eq('id', up.stepId);
    for (const text of up.newlyBlocked) blocked.push({ stepId: up.stepId, text });
    changed.push(up.stepId);
  }
  // Étapes à jour (rapport, autorisations retirées) : l'éditeur les reprend sans recharger
  const { data: after } = changed.length
    ? await admin.from('steps').select('id, html_meta, html_ops').in('id', changed)
    : { data: [] };
  return json(200, { status: 'ok', blocked, steps: after ?? [] });
});
