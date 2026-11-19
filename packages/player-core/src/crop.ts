/**
 * L25-02 : recadrage non destructif d'une capture (pur, testé). La zone gardée est relative à
 * l'image d'origine ; hotspots, flous et zoom sont relatifs au cadre affiché (recadré).
 */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Zone valide (dans l'image, au moins 2 %) ou null (pas de recadrage). */
export function asCrop(v: unknown): CropRect | null {
  const c = v as Partial<CropRect> | null | undefined;
  if (!c || [c.x, c.y, c.w, c.h].some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null;
  const x = Math.min(1, Math.max(0, c.x!));
  const y = Math.min(1, Math.max(0, c.y!));
  const w = Math.min(1 - x, c.w!);
  const h = Math.min(1 - y, c.h!);
  if (w < 0.02 || h < 0.02) return null;
  if (x === 0 && y === 0 && w >= 0.9999 && h >= 0.9999) return null;
  return { x, y, w, h };
}

/** Taille affichée (pixels) d'une image recadrée. */
export function croppedSize(img: { width: number; height: number }, crop: CropRect | null) {
  const c = crop ?? FULL;
  return { width: Math.round(img.width * c.w), height: Math.round(img.height * c.h) };
}

/** Position de l'image entière dans le cadre recadré (en % du cadre). */
export function cropImageStyle(crop: CropRect | null): Record<string, string> {
  if (!crop) return {};
  return {
    position: 'absolute',
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
    width: `${100 / crop.w}%`,
    height: `${100 / crop.h}%`,
    maxWidth: 'none',
  };
}

/** Boîte relative à un cadre `from` ramenée dans le cadre `to` (cadres relatifs à l'image d'origine). */
export function reframe<T extends { x: number; y: number; w?: number; h?: number }>(
  b: T,
  from: CropRect | null,
  to: CropRect | null,
): T {
  const f = from ?? FULL;
  const t = to ?? FULL;
  const ox = f.x + b.x * f.w;
  const oy = f.y + b.y * f.h;
  const out = { ...b, x: r4((ox - t.x) / t.w), y: r4((oy - t.y) / t.h) };
  if (typeof b.w === 'number') out.w = r4((b.w * f.w) / t.w);
  if (typeof b.h === 'number') out.h = r4((b.h * f.h) / t.h);
  return out;
}

/** Le centre de la boîte sort du cadre affiché (hotspot hors du cadre après un recadrage). */
export const outOfFrame = (b: { x: number; y: number; w: number; h: number }) => {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return cx < 0 || cx > 1 || cy < 0 || cy > 1;
};

/** Zone d'un format donné (16:9, 4:3, 1:1), la plus grande possible, centrée dans la zone actuelle. */
export function cropToRatio(
  img: { width: number; height: number },
  current: CropRect,
  ratio: number,
): CropRect {
  const pw = current.w * img.width;
  const ph = current.h * img.height;
  let w = pw;
  let h = pw / ratio;
  if (h > ph) {
    h = ph;
    w = ph * ratio;
  }
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  const rw = w / img.width;
  const rh = h / img.height;
  return {
    x: r4(Math.min(1 - rw, Math.max(0, cx - rw / 2))),
    y: r4(Math.min(1 - rh, Math.max(0, cy - rh / 2))),
    w: r4(rw),
    h: r4(rh),
  };
}
