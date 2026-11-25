/**
 * EXT-02 §5 : cadre gardé à chaque clic. On capture toujours toute la partie visible ; le cadre est un
 * recadrage non destructif (options.crop, relatif à l'image d'origine), modifiable à la vérification
 * puis dans l'éditeur (outil Recadrage). Géométrie pure, testée.
 */
import type { PxRect, RelRect, Viewport } from './geometry';

export type FrameMode = 'page' | 'element' | 'zone';
export const FRAME_MODES: FrameMode[] = ['page', 'element', 'zone'];
export const asFrameMode = (v: unknown): FrameMode =>
  FRAME_MODES.includes(v as FrameMode) ? (v as FrameMode) : 'page';

/** Marge autour de l'élément cliqué, et cadre minimal (validés par le client le 24/11). */
export const ELEMENT_MARGIN = 48;
export const MIN_FRAME = { width: 480, height: 300 };
/** Au-delà de cette part de la vue, recadrer sur l'élément n'apporte rien. */
export const ELEMENT_MAX_SHARE = 0.8;

/** Cadre d'une capture : ce qui a été demandé, et le recadrage qui en résulte (null : page entière). */
export interface Frame {
  mode: FrameMode;
  crop: RelRect | null;
  /** Mode Zone : le clic est tombé hors de la zone, la page entière est gardée pour cette étape. */
  outside?: boolean;
}

const round = (v: number) => Math.round(v * 10000) / 10000;

function toCrop(r: PxRect, vp: Viewport): RelRect | null {
  const left = Math.max(0, r.left);
  const top = Math.max(0, r.top);
  const right = Math.min(vp.width, r.left + r.width);
  const bottom = Math.min(vp.height, r.top + r.height);
  if (right - left < 8 || bottom - top < 8) return null;
  const crop = {
    x: round(left / vp.width),
    y: round(top / vp.height),
    w: round((right - left) / vp.width),
    h: round((bottom - top) / vp.height),
  };
  // Toute la vue : pas de recadrage
  return crop.w >= 0.995 && crop.h >= 0.995 ? null : crop;
}

/**
 * Cadre « Élément » : le rectangle de l'élément plus 48 px de marge, élargi autour de lui jusqu'au
 * minimum de 480 × 300, glissé puis borné dans la vue. Null si l'élément couvre plus de 80 % de la vue.
 */
export function elementCrop(el: PxRect | null, vp: Viewport): RelRect | null {
  if (!el || vp.width <= 0 || vp.height <= 0 || el.width <= 0 || el.height <= 0) return null;
  if ((el.width * el.height) / (vp.width * vp.height) > ELEMENT_MAX_SHARE) return null;
  const width = Math.min(vp.width, Math.max(el.width + 2 * ELEMENT_MARGIN, MIN_FRAME.width));
  const height = Math.min(vp.height, Math.max(el.height + 2 * ELEMENT_MARGIN, MIN_FRAME.height));
  const cx = el.left + el.width / 2;
  const cy = el.top + el.height / 2;
  // Centré sur l'élément, puis ramené dans la vue sans perdre de taille
  const left = Math.min(Math.max(0, cx - width / 2), vp.width - width);
  const top = Math.min(Math.max(0, cy - height / 2), vp.height - height);
  return toCrop({ left, top, width, height }, vp);
}

/** Cadre « Zone » : la zone tracée (relative à la fenêtre) si le clic y tombe, sinon la page entière. */
export function zoneFrame(zone: PxRect | null, click: { x: number; y: number }, vp: Viewport): Frame {
  if (!zone) return { mode: 'zone', crop: null, outside: true };
  const inside =
    click.x >= zone.left &&
    click.x <= zone.left + zone.width &&
    click.y >= zone.top &&
    click.y <= zone.top + zone.height;
  if (!inside) return { mode: 'zone', crop: null, outside: true };
  return { mode: 'zone', crop: toCrop(zone, vp) };
}

/** Cadre d'une capture selon le mode demandé. */
export function frameFor(
  mode: FrameMode,
  c: { element: PxRect | null; click: { x: number; y: number }; viewport: Viewport; zone?: PxRect | null },
): Frame {
  if (mode === 'element') return { mode, crop: elementCrop(c.element, c.viewport) };
  if (mode === 'zone') return zoneFrame(c.zone ?? null, c.click, c.viewport);
  return { mode: 'page', crop: null };
}

/**
 * Ramène une boîte relative à l'image entière dans le cadre (les hotspots sont relatifs au cadre
 * recadré, L25-02). La boîte est bornée au cadre ; null si elle en sort entièrement.
 */
export function intoCrop(r: RelRect, crop: RelRect | null): RelRect | null {
  if (!crop) return r;
  const x1 = Math.max(0, (r.x - crop.x) / crop.w);
  const y1 = Math.max(0, (r.y - crop.y) / crop.h);
  const x2 = Math.min(1, (r.x + r.w - crop.x) / crop.w);
  const y2 = Math.min(1, (r.y + r.h - crop.y) / crop.h);
  if (x2 - x1 <= 0 || y2 - y1 <= 0) return null;
  return { x: round(x1), y: round(y1), w: round(x2 - x1), h: round(y2 - y1) };
}
