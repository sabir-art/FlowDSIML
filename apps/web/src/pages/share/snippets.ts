/**
 * L29-01 / L29-02 : snippets d'intégration par outil (spec docs/ux/specs/l29-snippets-version-accessible.md §2).
 * Aucun nouveau mode : le code reste l'iframe ou le bouton + pop-up existants (L16-05, L16-06) ;
 * SharePoint, Notion et Confluence (L35, macro Iframe) n'acceptent qu'une adresse.
 */
export const TARGETS = ['html', 'wordpress', 'sharepoint', 'moodle', 'notion', 'confluence'] as const;
export type Target = (typeof TARGETS)[number];

/** Outils qui n'incorporent qu'une adresse (pas de code, pas de script : pas de pop-up). */
export const addressOnly = (t: Target) => t === 'sharepoint' || t === 'notion' || t === 'confluence';
export const popupAllowed = (t: Target) => !addressOnly(t);
/** Nombre de consignes affichées (3 au plus). */
export const STEP_COUNT: Record<Target, number> = {
  html: 1,
  wordpress: 3,
  sharepoint: 3,
  moodle: 3,
  notion: 3,
  confluence: 3,
};
export const hasLimit = (t: Target) => t !== 'html';

const KEY = 'fd.embedTarget';
/** Choix mémorisé par utilisateur (stockage local, clé par utilisateur). */
export function readTarget(userId: string | undefined): Target {
  try {
    const v = localStorage.getItem(`${KEY}.${userId ?? 'anon'}`);
    return (TARGETS as readonly string[]).includes(v ?? '') ? (v as Target) : 'html';
  } catch {
    return 'html';
  }
}
export function writeTarget(userId: string | undefined, t: Target) {
  try {
    localStorage.setItem(`${KEY}.${userId ?? 'anon'}`, t);
  } catch {
    /* stockage indisponible */
  }
}
