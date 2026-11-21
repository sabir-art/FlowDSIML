// E-mails P1 (spec emails-notifications-invitations §4) : logique de l'Edge Function invite-email, sans
// dépendance au réseau (testée avec des doubles : aucun envoi réel en test). Un admin envoie les
// invitations d'équipe qu'il vient de créer :
//  - nouvelle adresse : invitation Supabase Auth (gabarit invite.html), avec le nom de l'espace et
//    celui de l'invitant pour seules données ; le lien ramène à l'acceptation (#/invite/<jeton>) ;
//  - compte existant : notification « invite » dans l'app (posée en base), aucun e-mail.
// Droits, plafond horaire (20 par espace) et budget du jour (150) sont décidés en base
// (invite_send_reserve) ; un envoi en échec est rendu (invite_send_undo).

export type Status = 'sent' | 'failed' | 'rate_limit' | 'budget' | 'sent_before' | 'not_found';
export type Reserve =
  | {
      ok: true;
      mode: 'email';
      email: string;
      token: string;
      workspace_name: string;
      inviter_name: string | null;
    }
  | { ok: true; mode: 'notify' }
  | { ok: false; reason: 'forbidden' | 'not_found' | 'sent' | 'rate_limit' | 'budget' };

/** Lu par le gabarit invite.html ({{ .Data.* }}). */
export interface Meta {
  workspace_name: string;
  inviter_name: string;
  /** Toujours vide : un compte visiteur (accès à une démo) ne reçoit pas le texte « démo » du gabarit. */
  demo_title: '';
}

export interface Deps {
  userOf(jwt: string): Promise<{ id: string } | null>;
  reserve(invitationId: string, userId: string): Promise<Reserve>;
  undo(invitationId: string): Promise<void>;
  /** Invitation Auth (gabarit invite) ; false si l'envoi a échoué. */
  invite(email: string, redirectTo: string, meta: Meta): Promise<boolean>;
}

export const MAX_BATCH = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_URL = /^https?:\/\/[^\s?#]{1,300}$/;

/** Retour après le lien : l'app lit ?next= (HashRouter), sans fragment (réservé à Supabase Auth). */
export function redirectFor(appUrl: string, token: string): string {
  const u = new URL(appUrl);
  u.search = '';
  u.hash = '';
  u.searchParams.set('next', `/invite/${token}`);
  return u.toString();
}

export interface Result {
  status: number;
  body: { results: Array<{ id: string; status: Status }> } | { error: string };
}

export async function handle(body: Record<string, unknown>, jwt: string, deps: Deps): Promise<Result> {
  const user = jwt ? await deps.userOf(jwt) : null;
  if (!user) return { status: 401, body: { error: 'unauthorized' } };
  const ids = body.invitations;
  const appUrl = typeof body.appUrl === 'string' ? body.appUrl : '';
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > MAX_BATCH ||
    !ids.every((v) => typeof v === 'string' && UUID.test(v)) ||
    !APP_URL.test(appUrl)
  )
    return { status: 400, body: { error: 'bad_request' } };
  const results: Array<{ id: string; status: Status }> = [];
  // Une à une : le plafond horaire et le budget sont relus à chaque envoi
  for (const id of new Set(ids as string[])) {
    const r = await deps.reserve(id, user.id);
    if (!r.ok) {
      if (r.reason === 'forbidden') return { status: 403, body: { error: 'forbidden' } };
      results.push({ id, status: r.reason === 'sent' ? 'sent_before' : r.reason });
      continue;
    }
    // Confidentialité : même réponse qu'un e-mail, l'admin ne sait pas si l'adresse a un compte
    if (r.mode === 'notify') {
      results.push({ id, status: 'sent' });
      continue;
    }
    const meta: Meta = {
      workspace_name: r.workspace_name,
      inviter_name: r.inviter_name ?? '',
      demo_title: '',
    };
    const ok = await deps.invite(r.email, redirectFor(appUrl, r.token), meta).catch(() => false);
    if (!ok) await deps.undo(id);
    results.push({ id, status: ok ? 'sent' : 'failed' });
  }
  return { status: 200, body: { results } };
}
