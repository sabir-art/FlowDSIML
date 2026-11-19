/**
 * L25-04/05 : géométrie et rythme des animations d'étape (pur, testé ; éditeur et lecteur).
 */
import type { StepAnimation } from '@flowdsiml/manifest';

/** Délai par caractère de la saisie animée (ms). */
export const TYPING_MS = { slow: 90, normal: 50, fast: 25 } as const;

/** Durée totale de la saisie (ms), texte après remplacement des variables. */
export const typingDuration = (text: string, speed: keyof typeof TYPING_MS) =>
  [...text].length * TYPING_MS[speed];

export interface FullPage {
  width: number;
  height: number;
  /** Haut du viewport capturé dans l'image de la page (pixels de l'image). */
  top: number;
  viewportHeight: number;
}

/** Distance maximale du défilement (pixels de l'image) dans une direction. */
export function maxScroll(fp: FullPage, direction: 'down' | 'up'): number {
  return Math.max(0, Math.round(direction === 'down' ? fp.top : fp.height - fp.viewportHeight - fp.top));
}

/** Distance proposée par défaut : depuis le haut de la page (vers le bas) ou 640 px au plus (vers le haut). */
export function defaultScroll(fp: FullPage): { direction: 'down' | 'up'; distance: number } {
  const down = maxScroll(fp, 'down');
  if (down > 0) return { direction: 'down', distance: down };
  return { direction: 'up', distance: Math.min(640, maxScroll(fp, 'up')) };
}

/**
 * Positions de départ et d'arrivée (haut de la fenêtre, pixels de l'image). L'arrivée est toujours
 * la capture de l'étape ; la distance est bornée par la page.
 */
export function scrollPlan(fp: FullPage, a: Extract<StepAnimation, { type: 'scroll' }>) {
  const d = Math.min(a.distance, maxScroll(fp, a.direction));
  return { from: a.direction === 'down' ? fp.top - d : fp.top + d, to: fp.top, distance: d };
}

/** Décalage CSS (en % de la hauteur de l'image de la page) pour une position donnée. */
export const scrollOffset = (fp: FullPage, y: number) => `${(-y / fp.height) * 100}%`;
