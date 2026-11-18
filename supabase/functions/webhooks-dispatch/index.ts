// Edge Function `webhooks-dispatch` (L23) : envoie les webhooks dus. Appelée chaque minute par pg_cron
// (public.webhooks_dispatch_tick, via pg_net) avec « Authorization: Bearer <WEBHOOKS_DISPATCH_SECRET> » ;
// ce secret partagé vit dans les secrets de la fonction et dans Vault, jamais dans le dépôt.
// Déployée sans vérification JWT : seule la comparaison du secret (temps constant) ouvre l'accès.
// Les envois sont réservés en base (webhook_claim_due, rôle service, bail de 2 min) puis le résultat est
// enregistré (webhook_record_result) : succès, nouvel essai ou pause automatique.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { deliver, safeEqual, type Delivery } from './lib.ts';

const BATCH = 25;
const CONCURRENCY = 5;

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function resolve(host: string): Promise<string[]> {
  const [a, aaaa] = await Promise.all([
    Deno.resolveDns(host, 'A').catch(() => [] as string[]),
    Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]),
  ]);
  return [...a, ...aaaa];
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOKS_DISPATCH_SECRET') ?? '';
  const auth = req.headers.get('authorization') ?? '';
  if (req.method !== 'POST' || !secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response('Non autorisé', { status: 401 });
  }
  const { data, error } = await supabase.rpc('webhook_claim_due', { p_limit: BATCH });
  if (error) return new Response('Réservation impossible', { status: 500 });
  const queue = [...((data ?? []) as Delivery[])];
  let sent = 0;
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      const r = await deliver(d, { resolve, fetch });
      await supabase.rpc('webhook_record_result', {
        p_id: d.id,
        p_status: r.status,
        p_body: r.body,
        p_duration: r.durationMs,
        p_error: r.error,
      });
      sent++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return new Response(JSON.stringify({ sent }), { headers: { 'content-type': 'application/json' } });
});
