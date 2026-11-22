import { safeExternalUrl } from '@flowdsiml/manifest';

/**
 * Ouvre une adresse externe seulement si elle est sûre (https ; http pour localhost en développement).
 * Toute autre adresse (javascript:, data:, http distant…) est ignorée : rien ne s'ouvre.
 */
export function openExternal(url: string, target: '_blank' | '_top'): boolean {
  const safe = safeExternalUrl(url);
  if (!safe) return false;
  window.open(safe, target, 'noopener,noreferrer');
  return true;
}
