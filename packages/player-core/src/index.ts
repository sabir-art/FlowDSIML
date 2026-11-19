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

/** L18 : nom de famille d'une police importée dans la médiathèque. */
export const CUSTOM_FONT = 'TutoClick Media';

/**
 * Règle @font-face d'une police de la médiathèque (WOFF2 en https seulement, URL sans guillemet ni
 * parenthèse : aucune injection CSS possible). Chaîne vide sinon.
 */
export function fontFaceCss(theme: Pick<Theme, 'fontUrl'>): string {
  const u = theme.fontUrl;
  if (!u || !/^https:\/\/[^\s"'()\\<>]+$/.test(u)) return '';
  return `@font-face{font-family:'${CUSTOM_FONT}';src:url("${u}") format('woff2');font-display:swap}`;
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
    '--p-on-primary': theme.onPrimary,
    '--p-btn-radius': `${theme.buttonRadius}px`,
    // Fond dégradé : teinte principale en haut à gauche, teinte hotspot en bas à droite
    '--p-bg-image': theme.backgroundGradient
      ? `linear-gradient(160deg, color-mix(in srgb, ${theme.primary} 14%, ${theme.background}) 0%, ${theme.background} 55%, color-mix(in srgb, ${theme.hotspot} 10%, ${theme.background}) 100%)`
      : 'none',
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

/** Position d'une zone Spotlight (fractions → pourcentages CSS). */
export function boxStyle(b: Box): { left: string; top: string; width: string; height: string } {
  const pct = (v: number) => `${Math.round(v * 100000) / 1000}%`;
  return { left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) };
}

/**
 * Ancre de la bulle d'une zone Spotlight : un point sur le bord de la zone, du côté où la bulle
 * s'affiche, pour que la bulle ne recouvre jamais la zone éclairée.
 */
export function spotlightAnchor<T extends Box>(h: T, requested: string): { box: T; placement: Placement } {
  const place = resolvePlacement(requested, h);
  const e = 0.0001;
  const cx = h.x + h.w / 2;
  const cy = h.y + h.h / 2;
  const at = (x: number, y: number) => ({ ...h, x: x - e, y: y - e, w: 2 * e, h: 2 * e });
  const box =
    place === 'top'
      ? at(cx, h.y)
      : place === 'bottom'
        ? at(cx, h.y + h.h)
        : place === 'left'
          ? at(h.x, cy)
          : at(h.x + h.w, cy);
  return { box, placement: place };
}

/**
 * Voile Spotlight unique (spec a2 §1) : tracé SVG (viewBox 0 0 100 100, fill-rule evenodd) qui
 * couvre tout le cadre sauf les zones éclairées. Un seul voile, pour que plusieurs zones restent
 * toutes éclairées (des ombres superposées s'assombriraient l'une l'autre).
 */
export function spotlightVeilPath(boxes: Box[]): string {
  const r = (n: number) => Math.round(n * 100000) / 1000;
  return [
    'M0 0H100V100H0Z',
    ...boxes.map((b) => `M${r(b.x)} ${r(b.y)}V${r(b.y + b.h)}H${r(b.x + b.w)}V${r(b.y)}Z`),
  ].join('');
}
export * from './htmlFrame';
export * from './animation';
