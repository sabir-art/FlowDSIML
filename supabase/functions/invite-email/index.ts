// Edge Function `invite-email` (e-mails P1) : envoi des invitations d'équipe par Supabase Auth (gabarit
// invite.html, SMTP de TutoClick). JWT vérifié par la plateforme et ici (auth.getUser). Droits,
// plafond horaire et budget du jour : en base (invite_send_reserve). L'adresse de retour vient de
// l'app ; Supabase Auth n'accepte que les redirections autorisées (sinon l'adresse du site).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { handle, type Deps, type Reserve } from './lib.ts';

const MAX_BODY = 4_000;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const deps: Deps = {
  async userOf(jwt) {
    const { data } = await admin.auth.getUser(jwt);
    return data.user ? { id: data.user.id } : null;
  },
  async reserve(invitationId, userId) {
    const { data, error } = await admin.rpc('invite_send_reserve', {
      p_invitation: invitationId,
      p_user: userId,
    });
    return error || !data ? { ok: false, reason: 'not_found' } : (data as Reserve);
  },
  async undo(invitationId) {
    await admin.rpc('invite_send_undo', { p_invitation: invitationId });
  },
  async invite(email, redirectTo, meta) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: meta });
    return !error;
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'bad_json' });
  }
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const r = await handle(body ?? {}, jwt, deps);
  return json(r.status, r.body);
});
