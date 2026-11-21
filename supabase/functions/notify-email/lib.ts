// E-mails P2 (spec emails-notifications-invitations §3, charte docs/ux/emails/README.md) : logique de l'Edge Function notify-email, sans
// dépendance au réseau ni à Deno (testée avec des doubles et un faux serveur Brevo : aucun envoi réel).
//  - status      : l'app sait si l'option est disponible (clé, expéditeur et adresse de l'app présents) ;
//  - run         : tâche planifiée (secret partagé), un résumé par personne due, API HTTP de Brevo ;
//  - unsubscribe : « Ne plus recevoir ces e-mails » et List-Unsubscribe à un clic, sans connexion.
// La clé Brevo ne sort jamais de sendBrevo : ni dans les réponses, ni dans les journaux.
import { FR } from './texts.ts';

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TOKEN = /^[0-9a-f]{48}$/;

export interface Line {
  kind: string;
  actor: string;
  demo: string;
  step: number | null;
  data: Record<string, unknown> | null;
}
export interface Claim {
  user: string;
  email: string;
  ids: string[];
  previous: string | null;
  total: number;
  token: string;
  lines: Line[];
}
export interface Config {
  /** Absente : l'option reste « Bientôt » et la tâche ne fait rien. */
  apiKey: string | null;
  from: string | null;
  appUrl: string | null;
  /** Adresse publique de la fonction (désinscription à un clic). */
  selfUrl: string;
}
export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}
export interface Deps {
  config: Config;
  /** Secret partagé avec la tâche planifiée (comparé en temps constant). */
  secretOk(bearer: string): boolean;
  claim(): Promise<Claim[]>;
  undo(c: Claim): Promise<void>;
  unsubscribe(token: string): Promise<boolean>;
  send(mail: Mail): Promise<boolean>;
}

export const available = (c: Config) => !!(c.apiKey && c.from && c.appUrl);

const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(v[k] ?? ''));
const plural = (key: string, count: number, v: Record<string, string | number> = {}) =>
  fill(FR[`${key}_${count === 1 ? 'one' : 'other'}`] ?? FR[key] ?? '', { count, ...v });

/** Texte d'une ligne, comme dans l'app (notifications.k_*, alert_*). */
export function lineText(l: Line): string {
  const d = l.data ?? {};
  if (l.kind === 'invite')
    return fill(FR['notifications.k_invite']!, {
      actor: String(d.actor || '') || FR['notifications.someone']!,
      workspace: String(d.workspace ?? ''),
    });
  if (l.kind === 'alert') {
    const trigger = String(d.trigger ?? 'lead');
    const v = {
      demo: l.demo || FR['notifications.allDemos']!,
      value: String(d.value ?? '?'),
      threshold: String(d.threshold ?? '?'),
    };
    return FR[`notifications.alert_${trigger}`] !== undefined
      ? fill(FR[`notifications.alert_${trigger}`]!, v)
      : plural(`notifications.alert_${trigger}`, Number(d.count ?? 0), v);
  }
  return fill(FR[`notifications.k_${l.kind}`] ?? '', {
    actor: l.actor || FR['notifications.someone']!,
    demo: l.demo || FR['demos.untitled']!,
    step: l.step ?? '?',
  });
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const FONT = "font-family:'Segoe UI', Arial, Helvetica, sans-serif;";
/** Même logo que les 4 gabarits d'authentification (supabase/templates). */
const LOGO = 'https://sabir-art.github.io/FlowDSIML/email/logo-tutoclick.png';

/** E-mail du résumé (charte des gabarits : tableaux, 600 px, une colonne, bouton #A3195B, mode sombre). */
export function renderDigest(c: Claim, cfg: Config): Mail {
  const app = cfg.appUrl!.replace(/[?#].*$/, '');
  const open = `${app}#/?notifications=1`;
  const unsubPage = `${app}#/unsubscribe/${c.token}`;
  const unsubPost = `${cfg.selfUrl}?u=${c.token}`;
  const texts = c.lines.slice(0, 10).map(lineText);
  const more = c.total > texts.length ? plural('email.digest.more', c.total - texts.length) : '';
  const subject = plural('email.digest.subject', c.total);
  const rows = texts
    .map(
      (t) =>
        `<tr><td class="em-text em-rule" style="padding:12px 0;border-top:1px solid #E2E8EF;${FONT}font-size:16px;line-height:24px;color:#080808;">${esc(t)}</td></tr>`,
    )
    .join('');
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  body { margin: 0; padding: 0; width: 100% !important; }
  table { border-collapse: collapse; }
  @media (max-width: 620px) { .em-wrap { width: 100% !important; } .em-pad { padding-left: 24px !important; padding-right: 24px !important; } }
  @media (prefers-color-scheme: dark) {
    .em-bg { background-color: #0B0D10 !important; } .em-card { background-color: #15191F !important; border-color: #272E37 !important; }
    .em-text { color: #F3F5F8 !important; } .em-muted { color: #A9B3BF !important; } .em-rule { border-color: #272E37 !important; }
    .em-link { color: #CF86A9 !important; }
  }
  [data-ogsc] .em-text { color: #F3F5F8 !important; }
  [data-ogsc] .em-muted { color: #A9B3BF !important; }
  [data-ogsc] .em-link { color: #CF86A9 !important; }
  [data-ogsb] .em-bg { background-color: #0B0D10 !important; }
  [data-ogsb] .em-card { background-color: #15191F !important; }
</style></head>
<body class="em-bg" style="margin:0;padding:0;background-color:#EEF2F6;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(texts[0] ?? '')}</div>
<table role="presentation" class="em-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2F6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" class="em-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td class="em-card em-pad" style="background-color:#FFFFFF;border:1px solid #E2E8EF;border-radius:16px;padding:32px 40px;">
    <a href="${esc(app)}" style="display:block;margin:0 0 24px;text-decoration:none;"><img src="${LOGO}" width="400" height="129" alt="TutoClick, porté par la DSIML" style="display:block;width:400px;max-width:100%;height:auto;${FONT}font-size:20px;font-weight:bold;color:#A3195B;"></a>
    <h1 class="em-text" style="margin:0 0 16px;${FONT}font-size:24px;line-height:32px;font-weight:700;color:#080808;">${esc(subject)}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    ${more ? `<p class="em-muted" style="margin:12px 0 0;${FONT}font-size:14px;line-height:20px;color:#4F5966;">${esc(more)}</p>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
      <tr><td align="center" bgcolor="#A3195B" style="border-radius:10px;background-color:#A3195B;">
        <a href="${esc(open)}" style="display:inline-block;padding:14px 28px;${FONT}font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;background-color:#A3195B;">${esc(FR['email.digest.open']!)}</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td class="em-pad" style="padding:24px 40px 0;">
    <p class="em-muted" style="margin:0 0 8px;${FONT}font-size:14px;line-height:20px;color:#4F5966;">${esc(FR['email.digest.why']!)}</p>
    <p style="margin:0;${FONT}font-size:14px;line-height:20px;"><a class="em-link" href="${esc(unsubPage)}" style="color:#A3195B;text-decoration:underline;">${esc(FR['email.digest.unsubscribe']!)}</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [
    subject,
    '',
    ...texts.map((t) => `- ${t}`),
    ...(more ? [more] : []),
    '',
    `${FR['email.digest.open']} : ${open}`,
    '',
    FR['email.digest.why'],
    `${FR['email.digest.unsubscribe']} : ${unsubPage}`,
  ].join('\n');
  return {
    to: c.email,
    subject,
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubPost}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

/** Appel de l'API transactionnelle de Brevo. Ni la clé ni la réponse ne sont journalisées. */
export async function sendBrevo(
  mail: Mail,
  key: string,
  from: string,
  fetcher: typeof fetch = fetch,
  url = BREVO_URL,
): Promise<boolean> {
  try {
    const r = await fetcher(url, {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'TutoClick', email: from },
        to: [{ email: mail.to }],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
        headers: mail.headers,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    await r.body?.cancel();
    return r.ok;
  } catch {
    return false;
  }
}

export interface Result {
  status: number;
  body: Record<string, unknown>;
}

export async function handle(
  body: Record<string, unknown>,
  query: URLSearchParams,
  bearer: string,
  deps: Deps,
): Promise<Result> {
  // Désinscription à un clic (List-Unsubscribe-Post) : POST sur ?u=<jeton>, corps imposé par la norme
  const oneClick = query.get('u');
  if (oneClick !== null || body.action === 'unsubscribe') {
    const token = String(oneClick ?? body.token ?? '');
    const ok = TOKEN.test(token) && (await deps.unsubscribe(token));
    return { status: 200, body: { ok } };
  }
  if (body.action === 'status') return { status: 200, body: { available: available(deps.config) } };
  if (body.action !== 'run') return { status: 400, body: { error: 'bad_action' } };
  if (!bearer || !deps.secretOk(bearer)) return { status: 401, body: { error: 'unauthorized' } };
  // Sans clé (ou sans expéditeur, ou sans adresse de l'app) : rien n'est réservé, rien ne part
  if (!available(deps.config)) return { status: 200, body: { skipped: true } };
  let sent = 0;
  let failed = 0;
  for (const c of await deps.claim()) {
    const ok = await deps.send(renderDigest(c, deps.config));
    if (ok) sent++;
    else {
      failed++;
      await deps.undo(c);
    }
  }
  return { status: 200, body: { sent, failed } };
}

/** Comparaison en temps constant (secret partagé de la tâche planifiée). */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
