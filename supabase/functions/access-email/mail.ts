// E-mail du lien d'accès à une démo « Sur invitation » ou « Par domaine e-mail » (retours client du 24/11
// §8, maquette retours-2411/email-acces-*). Charte des e-mails : tableaux, 600 px, une colonne, mode
// sombre, aucun pixel de suivi, aucune image distante hors de la marque. Envoi par l'API HTTP de Brevo ;
// la clé ne sort jamais de sendAccessMail : ni dans les réponses, ni dans les journaux.

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
/** Validité du lien, en secondes : celle d'Auth (supabase/config.toml, otp_expiry). Un test de l'app
 *  vérifie que les deux valeurs restent égales ; ACCESS_LINK_TTL_SECONDS la remplace si Auth change. */
export const DEFAULT_TTL_SECONDS = 3600;

export interface AccessMail {
  to: string;
  /** Nom d'expéditeur : « {Espace} via TutoClick ». */
  senderName: string;
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Texte venu de l'espace (nom, titre) : une ligne, sans caractère de contrôle, longueur bornée. */
export const oneLine = (s: string, max = 120) =>
  // deno-lint-ignore no-control-regex
  s
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** « 1 heure », « 2 heures », « 30 minutes » : la durée réelle du lien, jamais un texte figé. */
export function ttlText(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min % 60 === 0) {
    const h = min / 60;
    return h === 1 ? '1 heure' : `${h} heures`;
  }
  return min === 1 ? '1 minute' : `${min} minutes`;
}

const FONT = "font-family:'Segoe UI', Arial, Helvetica, sans-serif;";

export function renderAccess(a: {
  to: string;
  demoTitle: string;
  workspace: string;
  url: string;
  ttlSeconds: number;
}): AccessMail {
  const ws = oneLine(a.workspace, 60) || 'TutoClick';
  const demo = oneLine(a.demoTitle) || 'Démo';
  const subject = `Votre lien d’accès à « ${demo} »`;
  const lead = `Vous avez demandé à ouvrir la démo « ${demo} » partagée par ${ws}. Ce lien vous est personnel : ne le transférez pas.`;
  const valid = `Le lien est valable ${ttlText(a.ttlSeconds)} et ne sert qu’une fois.`;
  const ignore =
    'Vous n’avez rien demandé ? Ignorez cet e-mail : personne n’aura accès à la démo avec votre adresse.';
  const foot = `Envoyé par TutoClick pour ${ws}. Cet e-mail suit votre demande sur la page de la démo ; vous ne recevrez rien d’autre.`;
  const cta = 'Ouvrir la démo';
  const initial = esc([...ws][0]!.toUpperCase());
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
    .em-text { color: #F3F5F8 !important; } .em-muted { color: #A9B3BF !important; }
  }
  [data-ogsc] .em-text { color: #F3F5F8 !important; }
  [data-ogsc] .em-muted { color: #A9B3BF !important; }
  [data-ogsb] .em-bg { background-color: #0B0D10 !important; }
  [data-ogsb] .em-card { background-color: #15191F !important; }
</style></head>
<body class="em-bg" style="margin:0;padding:0;background-color:#EEF2F6;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(lead)}</div>
<table role="presentation" class="em-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2F6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" class="em-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td class="em-card em-pad" style="background-color:#FFFFFF;border:1px solid #E2E8EF;border-radius:16px;padding:32px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>
      <td width="40" height="40" align="center" valign="middle" bgcolor="#A3195B" style="width:40px;height:40px;border-radius:10px;background-color:#A3195B;${FONT}font-size:18px;line-height:40px;font-weight:700;color:#FFFFFF;">${initial}</td>
      <td class="em-text" style="padding-left:12px;${FONT}font-size:16px;line-height:24px;font-weight:700;color:#080808;">${esc(ws)}</td>
    </tr></table>
    <h1 class="em-text" style="margin:0 0 16px;${FONT}font-size:24px;line-height:32px;font-weight:700;color:#080808;">${esc(subject)}</h1>
    <p class="em-text" style="margin:0 0 24px;${FONT}font-size:16px;line-height:24px;color:#080808;">${esc(lead)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td align="center" bgcolor="#A3195B" style="border-radius:999px;background-color:#A3195B;">
        <a href="${esc(a.url)}" style="display:inline-block;padding:14px 28px;${FONT}font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;background-color:#A3195B;">${esc(cta)}</a>
      </td></tr>
    </table>
    <p class="em-muted" style="margin:0 0 8px;${FONT}font-size:14px;line-height:20px;color:#4F5966;">${esc(valid)}</p>
    <p class="em-muted" style="margin:0;${FONT}font-size:14px;line-height:20px;color:#4F5966;">${esc(ignore)}</p>
  </td></tr>
  <tr><td class="em-pad" style="padding:24px 40px 0;">
    <p class="em-muted" style="margin:0;${FONT}font-size:12px;line-height:18px;color:#4F5966;">${esc(foot)}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [subject, '', lead, '', `${cta} : ${a.url}`, '', valid, ignore, '', foot].join('\n');
  return { to: a.to, senderName: `${ws} via TutoClick`, subject, html, text };
}

/** Appel de l'API transactionnelle de Brevo. Ni la clé, ni le lien, ni la réponse ne sont journalisés. */
export async function sendAccessMail(
  mail: AccessMail,
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
        sender: { name: mail.senderName, email: from },
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
