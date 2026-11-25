// Edge Function `webhooks-dispatch` (L23) : envoie les webhooks. Deux modes, et aucune autre porte :
//  * planifié : pg_cron (public.webhooks_dispatch_tick, via pg_net) avec
//    « Authorization: Bearer <WEBHOOKS_DISPATCH_SECRET> » (secret de la fonction et de Vault, jamais dans le
//    dépôt, comparé en temps constant) : envoie les livraisons dues (webhook_claim_due, bail de 2 min) ;
//  * immédiat (test, rejeu) : JWT d'un utilisateur, { delivery_id } ; webhook_claim_one ne rend la livraison
//    que si elle est en attente et que l'utilisateur est admin de son workspace (sinon : même réponse
//    qu'une livraison inexistante) ; 10 envois immédiats par minute et par utilisateur au plus.
// Même sécurité réseau dans les deux modes (lib.ts) : DNS puis refus des IP privées, pas de redirection,
// 10 s, réponse tronquée à 2 Ko ; L37 : connexion à l'IP contrôlée, TLS vérifié pour le nom (pinned.ts). Le résultat est enregistré par webhook_record_result.
// ALERT-01 : messages Slack des alertes (slack.ts). Planifié : { task: 'slack' } ; test immédiat par un
// admin : { slack_test: <numéro> }. Le lien du message vient du réglage APP_URL (absent : sans lien).
// Déployée sans vérification JWT par la plateforme : chaque mode vérifie lui-même son accès.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { deliver, purgeOrphans, safeEqual, type Delivery, type Orphan } from './lib.ts';
import { pinnedFetch } from './pinned.ts';
import { postSlack, type SlackMessage } from './slack.ts';

const BATCH = 25;
const CONCURRENCY = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

async function resolve(host: string): Promise<string[]> {
  const [a, aaaa] = await Promise.all([
    Deno.resolveDns(host, 'A').catch(() => [] as string[]),
    Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]),
  ]);
  return [...a, ...aaaa];
}

const send = pinnedFetch();

async function sendOne(d: Delivery) {
  const r = await deliver(d, { resolve, fetch: send });
  const { data: outcome } = await supabase.rpc('webhook_record_result', {
    p_id: d.id,
    p_status: r.status,
    p_body: r.body,
    p_duration: r.durationMs,
    p_error: r.error,
  });
  return { ...r, outcome: outcome as string | null };
}

async function scheduled() {
  const { data, error } = await supabase.rpc('webhook_claim_due', { p_limit: BATCH });
  if (error) return json(500, { error: 'claim' });
  const queue = [...((data ?? []) as Delivery[])];
  let sent = 0;
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      await sendOne(d);
      sent++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return json(200, { sent });
}

/** ALERT-01 : envoie un message Slack et note le résultat (un échec repart à la tâche suivante). */
async function sendSlack(m: SlackMessage): Promise<boolean> {
  const ok = await postSlack(m, Deno.env.get('APP_URL'));
  await supabase.rpc('slack_record_result', { p_id: m.id, p_ok: ok });
  return ok;
}

/** ALERT-01 : messages Slack en attente (tâche planifiée). */
async function slackScheduled() {
  const { data, error } = await supabase.rpc('slack_claim_due', { p_limit: BATCH });
  if (error) return json(500, { error: 'claim' });
  let sent = 0;
  for (const m of (data ?? []) as SlackMessage[]) if (await sendSlack(m)) sent++;
  return json(200, { sent });
}

/** L25 : vidéos de plus de 24 h citées par aucune étape, retirées par l'API Storage (lots de 100). */
async function purgeVideos() {
  const { data, error } = await supabase.rpc('orphan_videos', { p_limit: 500 });
  if (error) return json(500, { error: 'orphans' });
  const names = ((data ?? []) as Array<{ name: string }>).map((r) => r.name);
  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const { data: gone } = await supabase.storage.from('videos').remove(names.slice(i, i + 100));
    removed += gone?.length ?? 0;
  }
  console.log(`purge_videos : ${removed} vidéo(s) retirée(s)`);
  return json(200, { removed });
}

/** Purge nocturne de storage_orphans (comptes et espaces supprimés, photos de profil), lots bornés. */
async function purgeStorageOrphans() {
  const { data, error } = await supabase.rpc('storage_orphans_claim', { p_limit: 500 });
  if (error) return json(500, { error: 'orphans' });
  const r = await purgeOrphans((data ?? []) as Orphan[], async (bucket, paths) => {
    const { data: gone, error: e } = await supabase.storage.from(bucket).remove(paths);
    return { removed: gone?.length ?? 0, ok: !e };
  });
  if (r.done.length) await supabase.rpc('storage_orphans_done', { p_ids: r.done });
  console.log(`purge_orphans : ${r.removed} fichier(s) retiré(s), ${r.done.length} ligne(s) traitée(s)`);
  return json(200, { removed: r.removed, done: r.done.length });
}

async function immediate(req: Request, token: string) {
  const { data: u } = await supabase.auth.getUser(token);
  if (!u.user) return json(401, { error: 'auth' });
  const body = (await req.json().catch(() => null)) as { delivery_id?: unknown; slack_test?: unknown } | null;
  // ALERT-01 : « Envoyer un test » de la carte Slack (le message n'est rendu qu'à un admin de l'espace)
  if (typeof body?.slack_test === 'number' && Number.isSafeInteger(body.slack_test)) {
    const { data: m } = await supabase.rpc('slack_claim_test', { p_id: body.slack_test, p_user: u.user.id });
    if (!m) return json(404, { error: 'not_found' });
    return json(200, { ok: await sendSlack(m as SlackMessage) });
  }
  const id = typeof body?.delivery_id === 'string' && UUID.test(body.delivery_id) ? body.delivery_id : null;
  if (!id) return json(404, { error: 'not_found' });
  const { data, error } = await supabase.rpc('webhook_claim_one', { p_delivery: id, p_user: u.user.id });
  if (error)
    return json(error.message.includes('RATE_LIMIT') ? 429 : 500, {
      error: error.message.includes('RATE_LIMIT') ? 'rate_limit' : 'claim',
    });
  const d = ((data ?? []) as Delivery[])[0];
  if (!d) return json(404, { error: 'not_found' });
  const r = await sendOne(d);
  return json(200, { status: r.status, duration_ms: r.durationMs, error: r.error, outcome: r.outcome });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const auth = req.headers.get('authorization') ?? '';
  const secret = Deno.env.get('WEBHOOKS_DISPATCH_SECRET') ?? '';
  if (secret && safeEqual(auth, `Bearer ${secret}`)) {
    // L25 : purge planifiée des vidéos orphelines (même secret, appel distinct de pg_cron)
    const body = (await req.json().catch(() => null)) as { task?: unknown } | null;
    if (body?.task === 'purge_videos') return purgeVideos();
    if (body?.task === 'purge_orphans') return purgeStorageOrphans();
    if (body?.task === 'slack') return slackScheduled();
    return scheduled();
  }
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json(401, { error: 'auth' });
  return immediate(req, token);
});
