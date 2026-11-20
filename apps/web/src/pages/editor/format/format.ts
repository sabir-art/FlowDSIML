/**
 * L28 021 : format des écrans. Géométrie pure : place l'image d'origine dans le cadre cible (Adapter : image
 * entière avec bandes ; Recadrer : cadre rempli, centré sur le repère) et recalcule les coordonnées relatives
 * pour qu'elles restent sur le même pixel de l'image.
 */
export type FormatId = 'original' | '16:9' | '16:10' | '4:3' | 'custom';
export type FitMode = 'fit' | 'fill';
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Layout {
  /** Taille du cadre de sortie, en pixels. */
  tw: number;
  th: number;
  /** Image placée dans le cadre (pixels) : décalage et taille dessinée. */
  ox: number;
  oy: number;
  dw: number;
  dh: number;
}

export const OUT_WIDTHS = [1280, 1440, 1920] as const;
const RATIOS: Record<Exclude<FormatId, 'original' | 'custom'>, number> = {
  '16:9': 16 / 9,
  '16:10': 16 / 10,
  '4:3': 4 / 3,
};

/** Taille du cadre de sortie pour une image donnée. « D'origine » garde le rapport de l'image. */
export function targetSize(
  format: FormatId,
  outWidth: number,
  src: { w: number; h: number },
  custom?: { w: number; h: number },
): { w: number; h: number } {
  if (format === 'custom' && custom) return { w: Math.round(custom.w), h: Math.round(custom.h) };
  const ratio = format === 'original' || format === 'custom' ? src.w / src.h : RATIOS[format];
  return { w: outWidth, h: Math.max(1, Math.round(outWidth / ratio)) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Place l'image dans le cadre. `focus` : point (relatif à l'image) à garder au centre en Recadrer. */
export function layout(
  src: { w: number; h: number },
  target: { w: number; h: number },
  mode: FitMode,
  focus: { x: number; y: number } = { x: 0.5, y: 0.5 },
): Layout {
  const s =
    mode === 'fit'
      ? Math.min(target.w / src.w, target.h / src.h)
      : Math.max(target.w / src.w, target.h / src.h);
  const dw = src.w * s;
  const dh = src.h * s;
  const ox = mode === 'fit' ? (target.w - dw) / 2 : clamp(target.w / 2 - focus.x * dw, target.w - dw, 0);
  const oy = mode === 'fit' ? (target.h - dh) / 2 : clamp(target.h / 2 - focus.y * dh, target.h - dh, 0);
  return { tw: target.w, th: target.h, ox, oy, dw, dh };
}

/** Rectangle relatif à l'image d'origine → rectangle relatif au cadre de sortie. */
export function mapRect<T extends Rect>(r: T, l: Layout): T {
  return {
    ...r,
    x: (l.ox + r.x * l.dw) / l.tw,
    y: (l.oy + r.y * l.dh) / l.th,
    w: (r.w * l.dw) / l.tw,
    h: (r.h * l.dh) / l.th,
  };
}

/** Point relatif (zoom) → point relatif au cadre de sortie. */
export function mapPoint<T extends { x: number; y: number }>(p: T, l: Layout): T {
  return { ...p, x: clamp((l.ox + p.x * l.dw) / l.tw, 0, 1), y: clamp((l.oy + p.y * l.dh) / l.th, 0, 1) };
}

const EPS = 1e-6;
/** Le rectangle dépasse-t-il du cadre (0..1) ? */
export const outside = (r: Rect) => r.x < -EPS || r.y < -EPS || r.x + r.w > 1 + EPS || r.y + r.h > 1 + EPS;

/** Partie visible d'un rectangle (null s'il est entièrement hors du cadre). */
export function clipRect<T extends Rect>(r: T): T | null {
  const x1 = clamp(r.x, 0, 1);
  const y1 = clamp(r.y, 0, 1);
  const x2 = clamp(r.x + r.w, 0, 1);
  const y2 = clamp(r.y + r.h, 0, 1);
  if (x2 - x1 < 0.002 || y2 - y1 < 0.002) return null;
  return { ...r, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Repère gardé dans le cadre : déplacé à l'intérieur s'il dépasse (signalé avant d'appliquer). */
export function keepInside<T extends Rect>(r: T): T {
  const w = Math.min(r.w, 1);
  const h = Math.min(r.h, 1);
  return { ...r, w, h, x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h) };
}
