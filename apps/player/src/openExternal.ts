import { safeExternalUrl } from '@flowdsiml/manifest';

/**
 * Ouvre une adresse externe seulement si elle est sûre (https ; http pour localhost en développement).
 * Toute autre adresse (javascript:, data:, http distant…) est ignorée : rien ne s'ouvre.
 */
export function openExternal(url: string, target: '_blank' | '_top'): boolean {
  const safe = safeExternalUrl(url);
  if (!safe) return false;
  // Démo hors ligne : le lien reste visible mais ne s'ouvre pas (aucune requête ne sort de l'archive)
  if (offlineNotice) {
    offlineNotice();
    return false;
  }
  window.open(safe, target, 'noopener,noreferrer');
  return true;
}

let offlineNotice: (() => void) | null = null;

/**
 * Démo hors ligne (archive ouverte depuis le disque) : les adresses externes ne s'ouvrent plus ; `notice`
 * dit « Disponible en ligne seulement ». Appelé une fois, par le lecteur hors ligne.
 */
export function blockExternalLinks(notice: () => void) {
  offlineNotice = notice;
}
