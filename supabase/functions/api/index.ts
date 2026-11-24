// Edge Function `api` : API publique v1 de TutoClick, en lecture seule (retours client du 24/11 §6.2.1).
// Déployée sans vérification JWT par la plateforme : l'appelant est un outil de l'espace (CRM, intranet),
// authentifié par une clé d'accès (Authorization: Bearer tc_…) que la base vérifie par son condensé.
// La clé n'est jamais journalisée. Réglage : PLAYER_URL (lien d'une démo publiée).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, type Deps, type DemoRow, type KeyCheck, type LeadRow, type StatsRow } from './lib.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const deps: Deps = {
  playerUrl: Deno.env.get('PLAYER_URL')?.trim() || null,
  async useKey(hash) {
    const { data, error } = await admin.rpc('api_key_use', { p_hash: hash });
    // Base injoignable : la clé n'est pas acceptée par défaut
    return error || !data ? { ok: false, reason: 'invalid' } : (data as KeyCheck);
  },
  async demos(workspace) {
    const { data, error } = await admin.rpc('api_demos', { p_workspace: workspace });
    if (error) throw error;
    return (data ?? []) as DemoRow[];
  },
  async stats(workspace, demo, days) {
    const { data, error } = await admin.rpc('api_demo_stats', {
      p_workspace: workspace,
      p_demo: demo,
      p_days: days,
    });
    if (error) throw error;
    return (data ?? null) as StatsRow | null;
  },
  async leads(workspace, demo, limit, before) {
    const { data, error } = await admin.rpc('api_demo_leads', {
      p_workspace: workspace,
      p_demo: demo,
      p_limit: limit,
      p_before: before?.at ?? null,
      p_before_id: before?.id ?? null,
    });
    if (error) throw error;
    return (data ?? null) as LeadRow[] | null;
  },
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Chemin après le nom de la fonction : « …/api/v1/demos » → « /v1/demos »
  const path = url.pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/';
  try {
    const r = await handle(
      { method: req.method, path, query: url.searchParams, authorization: req.headers.get('authorization') },
      deps,
    );
    return new Response(r.body, { status: r.status, headers: r.headers });
  } catch {
    // Aucun détail interne dans la réponse
    return new Response(JSON.stringify({ error: { code: 'server_error', message: 'Unexpected error.' } }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
});
