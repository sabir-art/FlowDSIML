// Edge Function `notify-email` (e-mails P2) : résumé des notifications par l'API HTTP de Brevo.
// Déployée sans vérification JWT par la plateforme : la désinscription à un clic vient d'un client de
// messagerie, sans connexion. La tâche planifiée (email_digest_tick, pg_cron + pg_net) s'authentifie
// avec le secret partagé des tâches (WEBHOOKS_DISPATCH_SECRET, comme webhooks-dispatch).
// Secrets et réglages : BREVO_API_KEY (jamais journalisée), EMAIL_FROM (expéditeur), APP_URL (adresse de
// l'app). L'un d'eux absent : l'option reste « Bientôt » et la tâche ne fait rien.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { handle, safeEqual, sendBrevo, type Claim, type Deps } from './lib.ts';

const MAX_BODY = 2_000;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const env = (k: string) => Deno.env.get(k)?.trim() || null;

function deps(): Deps {
  const apiKey = env('BREVO_API_KEY');
  const from = env('EMAIL_FROM');
  const secret = env('WEBHOOKS_DISPATCH_SECRET');
  return {
    config: {
      apiKey,
      from,
      appUrl: env('APP_URL'),
      selfUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-email`,
    },
    secretOk: (bearer) => !!secret && safeEqual(bearer, secret),
    async claim() {
      const { data, error } = await admin.rpc('digest_claim', { p_limit: 50 });
      return error ? [] : ((data ?? []) as Claim[]);
    },
    async undo(c) {
      await admin.rpc('digest_undo', { p_user: c.user, p_ids: c.ids, p_previous: c.previous });
    },
    async unsubscribe(token) {
      const { data, error } = await admin.rpc('email_unsubscribe', { p_token: token });
      return !error && data === true;
    },
    send: (mail) => sendBrevo(mail, apiKey!, from!),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
  const query = new URL(req.url).searchParams;
  let body: Record<string, unknown> = {};
  // Désinscription à un clic : corps « List-Unsubscribe=One-Click » (formulaire), pas du JSON
  if (!query.has('u')) {
    try {
      body = JSON.parse(text || '{}') ?? {};
    } catch {
      return json(400, { error: 'bad_json' });
    }
  }
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  // Option « Bientôt » dans l'app : le journal dit quel réglage manque (son nom seulement, jamais une valeur)
  if (body.action === 'status') {
    const missing = ['BREVO_API_KEY', 'EMAIL_FROM', 'APP_URL'].filter((k) => !env(k));
    if (missing.length)
      console.warn(`notify-email indisponible, réglage(s) absent(s) : ${missing.join(', ')}`);
  }
  const r = await handle(body, query, bearer, deps());
  return json(r.status, r.body);
});
