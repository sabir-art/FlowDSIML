/**
 * Sandbox v2, étape 4 (docs/tech/sandbox-v2.md §10) : destinations qu'aucune capture n'ouvre jamais d'elle-
 * même. Partagée par la capture en série de l'extension (linkedPages) et le plan de l'éditeur (« Liens sans
 * page » : pas de « Capturer cette page » sur ces liens, décision du chef).
 */

/** Libellés et chemins d'action : jamais ouverts par la capture en série (déconnexion, suppression…). */
const RISKY_WORDS =
  /(^|[^a-z])(log-?out|sign-?out|logoff|deconnexion|déconnexion|se deconnecter|se déconnecter|delete|remove|destroy|supprimer|suppression|effacer|unsubscribe|desabonner|désabonner|desinscri|désinscri|reset|revoke|revoquer|révoquer)([^a-z]|$)/i;
/** Fichiers à télécharger : pas des pages. */
const FILE =
  /\.(pdf|zip|gz|tar|rar|7z|exe|dmg|msi|apk|csv|xlsx?|docx?|pptx?|odt|ods|mp4|mp3|wav|mov|avi|png|jpe?g|gif|webp|svg|ics)$/i;

/** Une destination à ne jamais ouvrir automatiquement : déconnexion, suppression, désabonnement, fichier. */
export function isRisky(url: string, label = ''): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  const path = decodeURIComponent(u.pathname + u.search + u.hash).toLowerCase();
  return (
    RISKY_WORDS.test(path.replace(/[/_.?=&#]/g, ' ')) || RISKY_WORDS.test(label) || FILE.test(u.pathname)
  );
}
