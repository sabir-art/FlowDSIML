// E-mail d'invitation envoyé par TutoClick lui-même (API HTTP de Brevo), pour les adresses auxquelles
// Supabase Auth n'envoie pas d'invitation : compte existant, ou envoi refusé par Auth. Même charte et
// mêmes textes que le gabarit invite.html (tableaux, 600 px, une colonne, mode sombre, aucun pixel de
// suivi). Le lien mène à la page d'acceptation de l'app : la personne s'y connecte, ou crée son compte.
// La clé ne sort jamais de sendInviteMail : ni dans les réponses, ni dans les journaux.

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const LOGO = 'https://sabir-art.github.io/FlowDSIML/email/logo-tutoclick.png';

export interface InviteMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Texte venu de l'espace (nom de l'espace, de l'invitant) : une ligne, sans caractère de contrôle. */
export const oneLine = (s: string, max = 80) =>
  s
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Page d'acceptation de l'app (HashRouter) ; null si l'adresse de l'app n'est pas réglée ou invalide. */
export function acceptLink(appUrl: string | null | undefined, token: string): string | null {
  if (!appUrl || !/^https?:\/\/[^\s?#]{1,300}$/.test(appUrl.replace(/[?#].*$/, ''))) return null;
  return `${appUrl.replace(/[?#].*$/, '')}#/invite/${encodeURIComponent(token)}`;
}

const FONT = "font-family:'Segoe UI', Arial, Helvetica, sans-serif;";

export function renderInvite(a: { to: string; workspace: string; inviter: string; url: string }): InviteMail {
  const ws = oneLine(a.workspace);
  const inviter = oneLine(a.inviter);
  const subject = 'Rejoignez votre espace TutoClick';
  const where = ws ? `l’espace « ${ws} »` : 'un espace';
  const lead = `${inviter ? `${inviter} vous invite à rejoindre` : 'Une invitation vous attend pour rejoindre'} ${where} sur TutoClick.`;
  const how = `Acceptez l’invitation, puis connectez-vous ou créez votre compte avec l’adresse ${a.to}.`;
  const cta = 'Accepter l’invitation';
  const copy = 'Si le bouton ne fonctionne pas, copiez ce lien dans la barre d’adresse de votre navigateur :';
  const ignore =
    'Cette invitation ne vous concerne pas ? Ignorez cet e-mail : rien ne change sans votre accord.';
  const foot = `Vous recevez cet e-mail parce qu’un administrateur d’un espace TutoClick a invité l’adresse ${a.to}.`;
  const p = (cls: string, size: number, line: number, color: string, margin: string, body: string) =>
    `<p class="${cls}" style="margin:${margin};${FONT}font-size:${size}px;line-height:${line}px;color:${color};">${body}</p>`;
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  body { margin: 0; padding: 0; width: 100% !important; }
  table { border-collapse: collapse; }
  @media (max-width: 620px) { .em-wrap { width: 100% !important; } .em-pad { padding-left: 24px !important; padding-right: 24px !important; } .em-btn a { display: block !important; } }
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
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Une invitation vous attend sur TutoClick.</div>
<table role="presentation" class="em-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2F6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" class="em-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td class="em-card em-pad" style="background-color:#FFFFFF;border:1px solid #E2E8EF;border-radius:16px;padding:32px 40px;">
    <img src="${LOGO}" width="400" height="129" alt="TutoClick, porté par la DSIML" style="display:block;width:400px;max-width:100%;height:auto;margin:0 0 24px;${FONT}font-size:20px;font-weight:bold;color:#A3195B;">
    <h1 class="em-text" style="margin:0 0 24px;${FONT}font-size:24px;line-height:32px;font-weight:700;color:#080808;">${esc(subject)}</h1>
    ${p('em-text', 16, 24, '#080808', '0 0 16px', 'Bonjour,')}
    ${p('em-text', 16, 24, '#080808', '0 0 16px', esc(lead))}
    ${p('em-text', 16, 24, '#080808', '0 0 16px', esc(how))}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
      <tr><td class="em-btn" align="center" bgcolor="#A3195B" style="border-radius:10px;background-color:#A3195B;">
        <a href="${esc(a.url)}" style="display:inline-block;padding:14px 28px;${FONT}font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;background-color:#A3195B;">${esc(cta)}</a>
      </td></tr>
    </table>
    ${p('em-muted', 14, 20, '#4F5966', '0 0 8px', esc(copy))}
    <p style="margin:0 0 24px;${FONT}font-size:14px;line-height:20px;word-break:break-all;"><a class="em-link" href="${esc(a.url)}" style="color:#A3195B;text-decoration:underline;">${esc(a.url)}</a></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="em-rule" style="border-top:1px solid #E2E8EF;padding-top:16px;">
      ${p('em-muted', 14, 20, '#4F5966', '0', esc(ignore))}
    </td></tr></table>
  </td></tr>
  <tr><td class="em-pad" style="padding:24px 40px 0;">
    ${p('em-muted', 12, 18, '#4F5966', '0 0 8px', esc(foot))}
    ${p('em-muted', 12, 18, '#4F5966', '0', 'TutoClick · DSI des Missions Locales')}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [subject, '', 'Bonjour,', '', lead, how, '', `${cta} : ${a.url}`, '', ignore, '', foot].join(
    '\n',
  );
  return { to: a.to, subject, html, text };
}

/** Appel de l'API transactionnelle de Brevo. Ni la clé, ni le lien, ni la réponse ne sont journalisés. */
export async function sendInviteMail(
  mail: InviteMail,
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
      }),
      signal: AbortSignal.timeout(10_000),
    });
    await r.body?.cancel();
    return r.ok;
  } catch {
    return false;
  }
}
