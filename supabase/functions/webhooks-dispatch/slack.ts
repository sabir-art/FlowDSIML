// ALERT-01 §7 : envoi des messages Slack de l'espace (webhook entrant), sans dépendance à Deno ni au
// réseau (testé avec un faux fetch : aucun appel réel).
//  - seul l'hôte hooks.slack.com est appelé, en https, sans suivre de redirection, 5 s au plus ;
//  - le lien « Voir dans Analytics » est ajouté ici, à partir du réglage APP_URL de la fonction
//    (jamais d'une valeur venue d'un navigateur ou de la base) ; APP_URL absent : message sans lien ;
//  - l'adresse du webhook est un secret : elle ne sort jamais dans une réponse ni dans un journal.

export interface SlackMessage {
  id: number;
  url: string;
  text: string;
  /** Page de l'app à ouvrir (« /#/analytics »), ou null pour un message sans lien (test). */
  path: string | null;
}

const HOOK = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]{8,200}$/;
const PATH = /^\/#\/[a-z0-9/_-]{0,80}$/;
const TIMEOUT_MS = 5000;

/** Adresse de l'app utilisable dans un lien : https, sans paramètres ni ancre ; sinon null. */
export function appBase(appUrl: string | null | undefined): string | null {
  const v = (appUrl ?? '').trim().replace(/\/+$/, '');
  return /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~/-]*)?$/.test(v) ? v : null;
}

/** Texte envoyé : la ligne rangée par la base, suivie du lien vers la page quand il peut être construit. */
export function slackText(m: Pick<SlackMessage, 'text' | 'path'>, appUrl: string | null | undefined): string {
  const base = appBase(appUrl);
  if (!base || !m.path || !PATH.test(m.path)) return m.text;
  return `${m.text} — <${base}${m.path}|Voir dans Analytics>`;
}

/** Envoie un message. true : accepté par Slack (2xx). Ne lève jamais. */
export async function postSlack(
  m: SlackMessage,
  appUrl: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!HOOK.test(m.url)) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(m.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: slackText(m, appUrl) }),
      redirect: 'error',
      signal: ctl.signal,
    });
    // Corps ignoré (« ok ») : libéré pour ne pas garder la connexion
    await r.body?.cancel().catch(() => undefined);
    return r.status >= 200 && r.status < 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
