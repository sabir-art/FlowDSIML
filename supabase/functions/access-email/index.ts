// Edge Function `access-email` (L39, 086 et 088) : envoi des liens d'accès aux démos « Sur invitation » et
// « Par domaine e-mail » par Supabase Auth (gabarits invite et magic_link, SMTP de l'espace TutoClick).
// Déployée sans vérification JWT par la plateforme : les demandes de visiteurs sont anonymes ; les
// actions d'équipe (invite, link) vérifient le JWT ici (auth.getUser). Droits, adresses et plafonds :
// en base (access_email_reserve). PLAYER_URL : adresse publique du lecteur (lien de retour, à autoriser
// dans les redirections d'Auth). Les IP ne sont jamais stockées : empreinte HMAC salée (IP + démo).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { signAccessLink } from '../_shared/accessLink.ts';
import { handle, type Deps, type Meta, type Reserve } from './lib.ts';

const MAX_BODY = 8_000;
const MIN_DELAY_MS = 600;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

let hmacKey: Promise<CryptoKey> | null = null;
async function clientKey(ip: string, demoId: string): Promise<string> {
  hmacKey ??= crypto.subtle
    .digest(
      'SHA-256',
      new TextEncoder().encode(`access-email|rate|${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`),
    )
    .then((raw) => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey, new TextEncoder().encode(`${ip}|${demoId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** IP posée par la plateforme (comme open-demo) ; jamais le seul garde-fou (plafonds par adresse et global). */
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

const rpc = async (fn: string, args: Record<string, unknown>): Promise<Reserve> => {
  const { data, error } = await admin.rpc(fn, args);
  if (error || !data) return { ok: false, reason: 'not_found' };
  return data as Reserve;
};

async function markVisitor(id: string, meta: Meta, isNew: boolean) {
  await admin.auth.admin.updateUserById(id, {
    user_metadata: meta,
    ...(isNew ? { app_metadata: { kind: 'visitor' } } : {}),
  });
}

const deps = (playerUrl: string): Deps => ({
  playerUrl,
  async userOf(jwt) {
    const { data } = await admin.auth.getUser(jwt);
    return data.user ? { id: data.user.id } : null;
  },
  reserve: (kind, demoId, email, userId, client) =>
    rpc('access_email_reserve', {
      p_kind: kind,
      p_demo: demoId,
      p_email: email,
      p_user: userId,
      p_client: client,
    }),
  linkCheck: (demoId, email, userId) =>
    rpc('access_link_check', { p_demo: demoId, p_email: email, p_user: userId }),
  async accountOf(email) {
    const { data } = await admin.rpc('access_account_of', { p_email: email });
    return (data as { id: string; visitor: boolean } | null) ?? null;
  },
  async invite(email, redirectTo, meta) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: meta });
    return error || !data.user ? null : data.user.id;
  },
  async magicLink(email, redirectTo) {
    const { error } = await admin.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });
    return !error;
  },
  markVisitor,
  async signLink(demoId, email) {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    return secret ? signAccessLink(secret, demoId, email) : null;
  },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const playerUrl = Deno.env.get('PLAYER_URL') ?? '';
  if (!/^https?:\/\/\S+$/.test(playerUrl)) return json(500, { error: 'player_url_missing' });

  const started = Date.now();
  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'bad_json' });
  }
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const demoId = typeof body.demoId === 'string' ? body.demoId : '';
  const client = body.action === 'request' ? await clientKey(clientIp(req), demoId) : null;
  const r = await handle(body, body.action === 'request' ? '' : jwt, client, deps(playerUrl));
  // Demande anonyme : délai minimal identique, pour ne pas révéler par le temps si l'adresse est autorisée
  if (body.action === 'request')
    await new Promise((ok) => setTimeout(ok, Math.max(0, MIN_DELAY_MS - (Date.now() - started))));
  return json(r.status, r.body);
});
