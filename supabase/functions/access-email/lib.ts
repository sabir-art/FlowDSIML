// L39 (086, 088) : logique de l'Edge Function access-email, sans dépendance au réseau (testée avec des
// doubles : aucun envoi réel en test). Les envois passent par Supabase Auth (SMTP de l'espace TutoClick) :
//  - invite  : un admin de l'espace envoie le lien d'accès aux adresses invitées d'une démo ;
//  - request : un visiteur demande un lien pour une démo « Sur invitation » ou « Par domaine e-mail » ;
//  - link    : un éditeur copie un lien d'accès personnel (rien n'est envoyé). Ce lien est un jeton signé,
//              limité à la démo et à l'adresse : il ne passe pas par Auth (ni compte, ni session).
// Droits, adresses autorisées et plafonds sont décidés en base (access_email_reserve, access_link_check).

export type Reason = 'forbidden' | 'not_found' | 'not_allowed' | 'domain_refused' | 'rate_limited';
export type Reserve =
  { ok: true; email: string; demoTitle: string; workspace: string } | { ok: false; reason: Reason };

export interface Meta {
  /** Lus par les gabarits invite et magic_link : « pour voir la démo X » (sinon texte de l'app). */
  demo_title: string;
  workspace_name: string;
}

export interface Deps {
  /** Utilisateur du JWT (null si absent ou invalide). */
  userOf(jwt: string): Promise<{ id: string } | null>;
  reserve(
    kind: 'invite' | 'request',
    demoId: string,
    email: string,
    userId: string | null,
    client: string | null,
  ): Promise<Reserve>;
  linkCheck(demoId: string, email: string, userId: string): Promise<Reserve>;
  /** Compte existant pour l'adresse (null : aucun). */
  accountOf(email: string): Promise<{ id: string; visitor: boolean } | null>;
  /** Nouveau compte : invitation Auth (gabarit invite). Renvoie l'identifiant du compte créé. */
  invite(email: string, redirectTo: string, meta: Meta): Promise<string | null>;
  /** Compte existant : lien magique Auth (gabarit magic_link), sans création de compte. */
  magicLink(email: string, redirectTo: string): Promise<boolean>;
  /** app_metadata.kind = 'visitor' (comptes créés ici) et textes du gabarit (user_metadata). */
  markVisitor(id: string, meta: Meta, isNew: boolean): Promise<void>;
  /** Jeton d'accès signé, limité à cette démo et à cette adresse (jamais un lien de session Auth). */
  signLink(demoId: string, email: string): Promise<string | null>;
  playerUrl: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
export const MAX_INVITES = 50;

/** Retour du lien : le lecteur lit le jeton du fragment, le passe à open-demo et l'efface aussitôt. */
export const redirectFor = (playerUrl: string, demoId: string) =>
  `${playerUrl.replace(/\/+$/, '')}/?acces=${demoId}`;

/** Envoie le lien d'accès à une adresse autorisée : invitation (nouveau compte) ou lien magique. */
async function sendAccess(deps: Deps, r: Extract<Reserve, { ok: true }>, demoId: string): Promise<boolean> {
  const to = redirectFor(deps.playerUrl, demoId);
  const meta: Meta = { demo_title: r.demoTitle, workspace_name: r.workspace };
  const acc = await deps.accountOf(r.email);
  if (!acc) {
    const id = await deps.invite(r.email, to, meta);
    if (!id) return false;
    await deps.markVisitor(id, meta, true);
    return true;
  }
  // Compte visiteur : textes du gabarit mis à jour ; compte de l'app : texte de connexion inchangé
  if (acc.visitor) await deps.markVisitor(acc.id, meta, false);
  return deps.magicLink(r.email, to);
}

export interface Result {
  status: number;
  body: Record<string, unknown>;
}

export async function handle(
  body: Record<string, unknown>,
  jwt: string,
  client: string | null,
  deps: Deps,
): Promise<Result> {
  const demoId = typeof body.demoId === 'string' && UUID.test(body.demoId) ? body.demoId : null;
  if (!demoId) return { status: 400, body: { error: 'bad_demo' } };

  if (body.action === 'request') {
    // Visiteur anonyme : même réponse que l'adresse soit autorisée ou non (sauf domaine refusé, que le
    // visiteur connaît déjà), et quelle que soit la limite atteinte
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    if (!EMAIL.test(email)) return { status: 400, body: { error: 'bad_email' } };
    const r = await deps.reserve('request', demoId, email, null, client);
    if (!r.ok && r.reason === 'domain_refused') return { status: 200, body: { status: 'domain_refused' } };
    if (r.ok) await sendAccess(deps, r, demoId);
    return { status: 200, body: { status: 'sent' } };
  }

  const user = jwt ? await deps.userOf(jwt) : null;
  if (!user) return { status: 401, body: { error: 'unauthorized' } };

  if (body.action === 'invite') {
    const list = Array.isArray(body.emails)
      ? [
          ...new Set(
            body.emails.filter((e): e is string => typeof e === 'string').map((e) => e.trim().toLowerCase()),
          ),
        ]
      : [];
    if (!list.length || list.length > MAX_INVITES || !list.every((e) => EMAIL.test(e)))
      return { status: 400, body: { error: 'bad_emails' } };
    const sent: string[] = [];
    const limited: string[] = [];
    const failed: string[] = [];
    for (const email of list) {
      const r = await deps.reserve('invite', demoId, email, user.id, null);
      if (!r.ok) {
        if (r.reason === 'forbidden') return { status: 403, body: { error: 'forbidden' } };
        if (r.reason === 'rate_limited') limited.push(email);
        else failed.push(email);
        continue;
      }
      if (await sendAccess(deps, r, demoId)) sent.push(email);
      else failed.push(email);
    }
    return { status: 200, body: { sent, limited, failed } };
  }

  if (body.action === 'link') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL.test(email)) return { status: 400, body: { error: 'bad_email' } };
    const r = await deps.linkCheck(demoId, email, user.id);
    if (!r.ok) return { status: r.reason === 'forbidden' ? 403 : 404, body: { error: r.reason } };
    // Quel que soit le compte derrière l'adresse (membre, admin, visiteur, aucun) : aucun appel à Auth
    const token = await deps.signLink(demoId, r.email);
    return token
      ? { status: 200, body: { url: `${redirectFor(deps.playerUrl, demoId)}#access_token=${token}` } }
      : { status: 502, body: { error: 'link_failed' } };
  }

  return { status: 400, body: { error: 'bad_action' } };
}
