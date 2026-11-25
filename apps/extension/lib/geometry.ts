import { readableLabel } from '@flowdsiml/core';
/** Géométrie pure (testée) : conversion des coordonnées de la page en coordonnées relatives (0–1). */
export interface Viewport {
  width: number;
  height: number;
}
export interface PxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface RelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round = (v: number) => Math.round(v * 10000) / 10000;

export function toRelRect(r: PxRect, vp: Viewport): RelRect | null {
  if (vp.width <= 0 || vp.height <= 0) return null;
  const x1 = clamp01(r.left / vp.width);
  const y1 = clamp01(r.top / vp.height);
  const x2 = clamp01((r.left + r.width) / vp.width);
  const y2 = clamp01((r.top + r.height) / vp.height);
  if (x2 - x1 <= 0 || y2 - y1 <= 0) return null;
  return { x: round(x1), y: round(y1), w: round(x2 - x1), h: round(y2 - y1) };
}

/**
 * Zone de hotspot pour un clic : la boîte de l'élément si elle est raisonnable,
 * sinon une petite zone centrée sur le point cliqué.
 */
export function hotspotRect(click: { x: number; y: number }, el: PxRect | null, vp: Viewport): RelRect {
  const fallback = 32;
  const usable =
    el && el.width >= 8 && el.height >= 8 && el.width <= vp.width * 0.6 && el.height <= vp.height * 0.5;
  const r: PxRect = usable
    ? el!
    : { left: click.x - fallback / 2, top: click.y - fallback / 2, width: fallback, height: fallback };
  return (
    toRelRect(r, vp) ?? {
      x: round(clamp01(click.x / vp.width)),
      y: round(clamp01(click.y / vp.height)),
      w: 0.02,
      h: 0.02,
    }
  );
}

/** Libellé lisible de l'élément cliqué (bouton, lien, champ…). */
export function elementLabel(info: {
  text?: string | null;
  ariaLabel?: string | null;
  placeholder?: string | null;
  title?: string | null;
  alt?: string | null;
}): string {
  // L63 : libellé accessible, puis texte visible court ; jamais un sélecteur ni des textes collés
  // (chaîne vide alors : « Cliquez ici »)
  return readableLabel([info.ariaLabel, info.text, info.placeholder, info.title, info.alt]);
}

export function defaultHotspotTitle(label: string, locale: 'fr' | 'en' = 'fr'): string {
  if (!label) return locale === 'en' ? 'Click here' : 'Cliquez ici';
  return locale === 'en' ? `Click “${label}”` : `Cliquez sur « ${label} »`;
}
