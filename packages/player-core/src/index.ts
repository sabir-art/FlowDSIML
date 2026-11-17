/**
 * Cœur de rendu partagé entre le player (Preact) et l'aperçu WYSIWYG de l'éditeur (React) :
 * placement de la bulle, ancrage, variables CSS du thème. Les deux rendent les mêmes classes
 * (.p-beacon, .p-tip…) stylées par player-core.css : ce que l'on voit dans l'éditeur est ce que voit le prospect.
 */
import type { Theme } from '@flowdsiml/manifest';

export type Placement = 'top' | 'bottom' | 'left' | 'right';
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Position de la bulle : celle demandée, ou automatique selon la place disponible. */
export function resolvePlacement(requested: string, h: Box): Placement {
  if (requested === 'top' || requested === 'bottom' || requested === 'left' || requested === 'right')
    return requested;
  if (h.y + h.h < 0.62) return 'bottom';
  if (h.y > 0.38) return 'top';
  return h.x + h.w / 2 < 0.5 ? 'right' : 'left';
}

/** Centre de la pastille, en pourcentage du cadre. */
export function beaconCenter(h: Box): { left: string; top: string } {
  const pct = (v: number) => `${Math.round(v * 100000) / 1000}%`;
  return { left: pct(h.x + h.w / 2), top: pct(h.y + h.h / 2) };
}

/** Classes de la bulle (placement + décalage près des bords pour ne pas sortir du cadre). */
export function tipClass(h: Box, requested: string): string {
  const place = resolvePlacement(requested, h);
  const cx = (h.x + h.w / 2) * 100;
  const shift =
    place === 'top' || place === 'bottom'
      ? cx < 22
        ? ' p-tip-shift-r'
        : cx > 78
          ? ' p-tip-shift-l'
          : ''
      : '';
  return `p-tip p-tip-${place}${shift}`;
}

/** Variables CSS du thème (consommées par player-core.css). */
export function themeVars(theme: Theme): Record<string, string> {
  return {
    '--p-primary': theme.primary,
    '--p-hotspot': theme.hotspot,
    '--p-bg': theme.background,
    '--p-surface': theme.surface,
    '--p-text': theme.text,
    '--p-radius': `${theme.radius}px`,
    fontFamily: theme.fontFamily,
  };
}

/** Marge (fraction du cadre) dans laquelle le hotspot doit rester visible une fois zoomé. */
const ZOOM_SAFE = 0.12;

/**
 * Origine du zoom (fractions 0–1) : le point choisi dans l'éditeur, recalé si besoin pour que le
 * centre du hotspot `focus` reste dans le cadre une fois agrandi (PL2). L'origine reste dans [0, 1],
 * l'image couvre donc toujours le cadre.
 */
export function zoomOrigin(zoom: { x: number; y: number; scale: number }, focus?: Box | null) {
  const s = zoom.scale;
  if (!focus || s <= 1) return { x: zoom.x, y: zoom.y };
  const fit = (o: number, c: number) => {
    const projected = o + (c - o) * s;
    const target = Math.min(Math.max(projected, ZOOM_SAFE), 1 - ZOOM_SAFE);
    if (target === projected) return o;
    // o + (c − o)·s = target  ⇒  o = (target − c·s) / (1 − s)
    return Math.min(Math.max((target - c * s) / (1 - s), 0), 1);
  };
  return { x: fit(zoom.x, focus.x + focus.w / 2), y: fit(zoom.y, focus.y + focus.h / 2) };
}

/** Projette une boîte de l'image dans le cadre une fois l'image agrandie (coordonnées écran, fractions). */
export function zoomBox<T extends Box>(b: T, origin: { x: number; y: number }, scale: number): T {
  if (scale === 1) return b;
  return {
    ...b,
    x: origin.x + (b.x - origin.x) * scale,
    y: origin.y + (b.y - origin.y) * scale,
    w: b.w * scale,
    h: b.h * scale,
  };
}
