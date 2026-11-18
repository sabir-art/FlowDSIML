// Edge Function `open-demo` (L11) : ouverture d'une démo publiée par le lecteur.
// Le bucket « published » est privé : cette fonction applique les règles d'accès côté serveur
// (liens publics du workspace, date d'expiration, mot de passe avec essais limités), puis renvoie le
// manifeste et des URL d'images signées (1 h). Déployée sans vérification JWT (visiteurs anonymes).
// L'IP n'est jamais stockée : seule une empreinte HMAC-SHA256 salée (IP + démo, clé dérivée du secret
// serveur) sert à compter les essais. Réponses refusées (introuvable, mot de passe…) rendues après un
// délai minimal identique, pour ne pas révéler l'existence d'une démo par le temps de réponse.
// CORS : toute origine en lecture (le lecteur peut être intégré), sans cookies ni identifiants.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_BODY = 4_000;
const SIGN_TTL = 3600;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60; // ouvertures par minute et par IP (meilleur effort : mémoire locale de l'instance)
const MIN_DELAY_MS = 350;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

let hmacKey: Promise<CryptoKey> | null = null;
function key(): Promise<CryptoKey> {
  // Clé dérivée du secret serveur, propre à cet usage (jamais exposée ni stockée)
  hmacKey ??= crypto.subtle
    .digest(
      'SHA-256',
      new TextEncoder().encode(`open-demo|rate|${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`),
    )
    .then((raw) => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
  return hmacKey;
}
async function clientKey(ip: string, demoId: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(`${ip}|${demoId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const pause = (since: number) =>
  new Promise((r) => setTimeout(r, Math.max(0, MIN_DELAY_MS - (Date.now() - since))));

type Step = { image?: { url: string } | null };
const isRelative = (u: string) => !/^(https?:|blob:|data:)/.test(u);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const started = Date.now();
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'unknown';
  if (rateLimited(ip)) return json(429, { status: 'rate_limited' });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
  let body: { demoId?: unknown; password?: unknown; grant?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'bad_json' });
  }
  const demoId = typeof body.demoId === 'string' && UUID.test(body.demoId) ? body.demoId : null;
  if (!demoId) {
    await pause(started);
    return json(200, { status: 'not_found' });
  }
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : null;
  const grant = typeof body.grant === 'string' ? body.grant.slice(0, 100) : null;

  const { data: gate, error } = await supabase.rpc('demo_gate', {
    p_demo: demoId,
    p_password: password,
    p_grant: grant,
    p_client: await clientKey(ip, demoId),
  });
  if (error || !gate) return json(500, { error: 'gate_failed' });
  if (gate.status !== 'ok') {
    await pause(started);
    return json(200, gate);
  }

  const dl = await supabase.storage.from('published').download(`${demoId}/latest.json`);
  if (dl.error || !dl.data) {
    await pause(started);
    return json(200, { status: 'not_found' });
  }
  let manifest: { steps?: Step[] } & Record<string, unknown>;
  try {
    manifest = JSON.parse(await dl.data.text());
  } catch {
    return json(200, { status: 'not_found' });
  }

  // Images : chemins relatifs du manifeste → URL signées à durée limitée
  const steps = Array.isArray(manifest.steps) ? manifest.steps : [];
  const paths = [
    ...new Set(
      steps
        .map((s) => s.image?.url)
        .filter((u): u is string => typeof u === 'string' && isRelative(u) && !u.includes('..'))
        .map((u) => `${demoId}/${u}`),
    ),
  ];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from('published').createSignedUrls(paths, SIGN_TTL);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  manifest.steps = steps.map((s) =>
    s.image && isRelative(s.image.url)
      ? { ...s, image: { ...s.image, url: signed.get(`${demoId}/${s.image.url}`) ?? '' } }
      : s,
  );
  return json(200, { ...gate, manifest });
});
