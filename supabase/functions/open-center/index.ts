// Edge Function `open-center` (L14) : ouverture du centre de formation public d'un workspace.
// Même modèle que open-demo (L11) : décision côté serveur (center_open, service_role), mot de passe du
// centre avec essais limités (empreinte HMAC de l'IP, jamais l'IP), délai minimal identique pour toute
// réponse refusée, URL signées 1 h pour les couvertures des modules ouverts uniquement.
// Déployée sans vérification JWT (visiteurs anonymes). CORS : toute origine, sans identifiants.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { openCenter, type CenterGate } from './logic.ts';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const MIN_DELAY_MS = 350;
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

let hmacKey: Promise<CryptoKey> | null = null;
function key(): Promise<CryptoKey> {
  hmacKey ??= crypto.subtle
    .digest(
      'SHA-256',
      new TextEncoder().encode(`open-center|rate|${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`),
    )
    .then((raw) => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
  return hmacKey;
}

/** IP posée par la plateforme (même règle qu'open-demo ; voir docs/tech/dettes.md). */
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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const started = Date.now();
  const ip = clientIp(req);
  if (rateLimited(ip)) return json(429, { status: 'rate_limited' });

  const reply = await openCenter(await req.text(), {
    async gate(args) {
      // @rpc-params p_slug, p_password, p_grant, p_client, p_link_token, p_visitor (voir logic.ts)
      const { data, error } = await supabase.rpc('center_open', args);
      return error ? null : (data as CenterGate);
    },
    async sign(paths, ttl) {
      const { data } = await supabase.storage.from('published').createSignedUrls(paths, ttl);
      const out = new Map<string, string>();
      for (const u of data ?? []) if (u.path && u.signedUrl) out.set(u.path, u.signedUrl);
      return out;
    },
    async clientKey(slug) {
      const sig = await crypto.subtle.sign(
        'HMAC',
        await key(),
        new TextEncoder().encode(`${ip}|center|${slug}`),
      );
      return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    },
    pause: () => new Promise((r) => setTimeout(r, Math.max(0, MIN_DELAY_MS - (Date.now() - started)))),
  });
  return json(reply.status, reply.body);
});
