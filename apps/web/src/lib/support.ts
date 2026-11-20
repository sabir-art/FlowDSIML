/**
 * L48-A §5 : lien du support de l'espace (Paramètres > Espace > Général, « Lien du support »), rangé dans
 * workspaces.settings.helpContact. Seuls une adresse e-mail (mailto:) ou un lien https sont acceptés :
 * jamais d'autre schéma dans un href.
 */
export const SUPPORT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SUPPORT_HTTPS_RE = /^https:\/\/[^\s]+$/;

export function supportContact(settings: unknown): string {
  const v = (settings as { helpContact?: unknown } | null)?.helpContact;
  return typeof v === 'string' ? v.trim() : '';
}

/** Adresse du lien, avec l'objet prérempli pour un e-mail ; null sans lien valide. */
export function supportHref(settings: unknown, subject?: string): string | null {
  const c = supportContact(settings);
  if (SUPPORT_EMAIL_RE.test(c))
    return `mailto:${c}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  return SUPPORT_HTTPS_RE.test(c) ? c : null;
}
