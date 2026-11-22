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
import { isAccessLink, verifyAccessLink } from '../_shared/accessLink.ts';

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
/**
 * IP posée par la plateforme, jamais celle déclarée par le client : cf-connecting-ip (Cloudflare,
 * réécrit à l'entrée), sinon x-real-ip, sinon la DERNIÈRE valeur de x-forwarded-for (ajoutée par le
 * dernier proxy ; les premières peuvent venir du client). Le plafond global par démo (demo_gate)
 * protège de toute façon si une IP pouvait être falsifiée.
 */
let headersLogged = false;
function clientIp(req: Request): string {
  // Diagnostic (une fois par instance) : en-têtes d'IP PRÉSENTS, jamais leurs valeurs
  if (!headersLogged) {
    headersLogged = true;
    console.log(
      JSON.stringify({
        openDemoIpHeaders: {
          cfConnectingIp: req.headers.has('cf-connecting-ip'),
          xRealIp: req.headers.has('x-real-ip'),
          xForwardedForCount: (req.headers.get('x-forwarded-for') ?? '').split(',').filter((v) => v.trim())
            .length,
        },
      }),
    );
  }
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

const pause = (since: number) =>
  new Promise((r) => setTimeout(r, Math.max(0, MIN_DELAY_MS - (Date.now() - since))));

const ASSET = /^assets\/[\w.-]+$/;
function collect(v: unknown, out: Set<string>) {
  if (typeof v === 'string') {
    if (ASSET.test(v)) out.add(v);
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
}
function replaceAssets(v: unknown, signed: Map<string, string>): unknown {
  if (typeof v === 'string') return ASSET.test(v) ? (signed.get(v) ?? '') : v;
  if (Array.isArray(v)) return v.map((x) => replaceAssets(x, signed));
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replaceAssets(x, signed)]));
  return v;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const started = Date.now();
  const ip = clientIp(req);
  if (rateLimited(ip)) return json(429, { status: 'rate_limited' });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
  let body: { demoId?: unknown; password?: unknown; grant?: unknown; accessToken?: unknown };
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

  // L39 : retour d'un lien d'accès (invitation, domaine). Le jeton Supabase prouve l'adresse ; il n'est
  // utilisé qu'ici, puis révoqué : le lecteur ne garde que l'accès (grant) rendu par demo_gate.
  let email: string | null = null;
  const accessToken =
    typeof body.accessToken === 'string' && body.accessToken.length <= 4096 ? body.accessToken : null;
  if (accessToken && isAccessLink(accessToken)) {
    // Lien copié par un éditeur : jeton signé pour cette démo et cette adresse, sans compte ni session
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    email = secret ? await verifyAccessLink(secret, demoId, accessToken) : null;
  } else if (accessToken) {
    const { data } = await supabase.auth.getUser(accessToken);
    if (data.user?.email && data.user.email_confirmed_at) email = data.user.email.toLowerCase();
    // Session de ce seul lien (scope local) : les autres sessions du compte ne sont pas touchées
    await supabase.auth.admin.signOut(accessToken, 'local').catch(() => undefined);
  }

  const { data: gate, error } = await supabase.rpc('demo_gate', {
    p_demo: demoId,
    p_password: password,
    p_grant: grant,
    p_client: await clientKey(ip, demoId),
    p_email: email,
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
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await dl.data.text());
  } catch {
    return json(200, { status: 'not_found' });
  }

  // Toutes les ressources relatives du manifeste (« assets/… » : images des étapes, et toute image
  // publiée ajoutée plus tard) → URL signées. Les URL absolues (logo du bucket public « branding »,
  // liens externes) sont laissées telles quelles.
  const paths = new Set<string>();
  collect(manifest, paths);
  const signed = new Map<string, string>();
  if (paths.size) {
    const { data: urls } = await supabase.storage.from('published').createSignedUrls(
      [...paths].map((p) => `${demoId}/${p}`),
      SIGN_TTL,
    );
    for (const u of urls ?? [])
      if (u.path && u.signedUrl) signed.set(u.path.slice(demoId.length + 1), u.signedUrl);
  }
  manifest = replaceAssets(manifest, signed) as typeof manifest;
  // L26-08 : mesure des visites de l'espace (désactivée : le lecteur ne crée aucun identifiant)
  const ws =
    typeof manifest.workspaceId === 'string' && UUID.test(manifest.workspaceId) ? manifest.workspaceId : null;
  const measure = ws
    ? await supabase.from('workspaces').select('visit_measure').eq('id', ws).maybeSingle()
    : null;
  const visitMeasure = measure?.data ? measure.data.visit_measure !== false : true;
  return json(200, { ...gate, manifest, visitMeasure });
});
