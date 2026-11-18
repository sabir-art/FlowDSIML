// Edge Function `webhooks-dispatch` (L23) : envoie les webhooks. Deux modes, et aucune autre porte :
//  * planifié : pg_cron (public.webhooks_dispatch_tick, via pg_net) avec
//    « Authorization: Bearer <WEBHOOKS_DISPATCH_SECRET> » (secret de la fonction et de Vault, jamais dans le
//    dépôt, comparé en temps constant) : envoie les livraisons dues (webhook_claim_due, bail de 2 min) ;
//  * immédiat (test, rejeu) : JWT d'un utilisateur, { delivery_id } ; webhook_claim_one ne rend la livraison
//    que si elle est en attente et que l'utilisateur est admin de son workspace (sinon : même réponse
//    qu'une livraison inexistante) ; 10 envois immédiats par minute et par utilisateur au plus.
// Même sécurité réseau dans les deux modes (lib.ts) : DNS puis refus des IP privées, pas de redirection,
// 10 s, réponse tronquée à 2 Ko. Le résultat est enregistré par webhook_record_result.
// Déployée sans vérification JWT par la plateforme : chaque mode vérifie lui-même son accès.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { deliver, safeEqual, type Delivery } from './lib.ts';

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

async function sendOne(d: Delivery) {
  const r = await deliver(d, { resolve, fetch });
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

async function immediate(req: Request, token: string) {
  const { data: u } = await supabase.auth.getUser(token);
  if (!u.user) return json(401, { error: 'auth' });
  const body = (await req.json().catch(() => null)) as { delivery_id?: unknown } | null;
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
  if (secret && safeEqual(auth, `Bearer ${secret}`)) return scheduled();
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json(401, { error: 'auth' });
  return immediate(req, token);
});
