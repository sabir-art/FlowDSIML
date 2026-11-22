// Edge Function `track` : ingestion des événements du player.
// Déployée sans vérification JWT (verify_jwt = false) : appelée par des visiteurs anonymes,
// y compris via navigator.sendBeacon (corps text/plain, sans en-têtes).
// La validation métier (démo publiée, version, types d'événements) est faite par la RPC SQL track_events.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_BODY = 32_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120; // lots par minute et par IP (meilleur effort : mémoire locale de l'instance)
const hits = new Map<string, { n: number; reset: number }>();

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + RATE_WINDOW_MS });
    if (hits.size > 10_000) hits.clear();
    return false;
  }
  h.n++;
  return h.n > RATE_MAX;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

/** IP posée par la plateforme (comme open-demo) : jamais la première valeur de x-forwarded-for, que le client choisit. */
function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const xff = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return xff[xff.length - 1] ?? 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const ip = clientIp(req);
  if (rateLimited(ip)) return json(429, { error: 'rate_limited' });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
  let batch: Record<string, unknown>;
  try {
    batch = JSON.parse(text);
  } catch {
    return json(400, { error: 'bad_json' });
  }
  if (!batch || typeof batch !== 'object' || !Array.isArray(batch.events))
    return json(400, { error: 'bad_batch' });

  // L'IP n'est jamais stockée (minimisation RGPD). Pays (L19) : seul le code à 2 lettres de l'en-tête
  // cf-ipcountry est gardé, et il remplace toujours une valeur envoyée par le client ; null sinon.
  const cc = (req.headers.get('cf-ipcountry') ?? '').trim().toUpperCase();
  batch.country = /^[A-Z]{2}$/.test(cc) ? cc : null;
  const { data, error } = await supabase.rpc('track_events', { p_batch: batch });
  if (error) return json(400, { error: 'rejected' });
  return json(200, { inserted: data });
});
