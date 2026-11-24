/**
 * Retours client du 24/11 §1 : images ajoutées par-dessus la capture d'une étape (options.images).
 * La liste est rangée du dessous vers le dessus ; positions et tailles en fraction du cadre de l'étape
 * (après recadrage), comme les zones de flou. Le fichier de chaque image est une copie dans le dossier
 * des captures de la démo.
 */
export type Rect = { x: number; y: number; w: number; h: number };
export type ImageLayer = Rect & {
  id: string;
  /** Chemin dans le bucket captures. */
  path: string;
  /** Nom du fichier d'origine (affiché tant qu'il n'y a pas de texte alternatif). */
  name?: string;
  /** Largeur / hauteur de l'image, en pixels. */
  ratio?: number;
  /** Conserver les proportions (activé quand absent). */
  keep?: boolean;
  /** 10 à 100 (100 quand absent). */
  opacity?: number;
  rounded?: boolean;
  shadow?: boolean;
  alt?: string;
  decorative?: boolean;
  hidden?: boolean;
  /** Copie suivie sur toutes les étapes capture (même identifiant sur chaque étape). */
  group?: string;
};

export const MAX_LAYERS = 10;
export const LAYER_OPACITY = { min: 10, max: 100, step: 5 } as const;
/** Arrondi et ombre à l'échelle d'une capture de 1 280 px de large (comme les zones de flou). */
export const LAYER_RADIUS = 12;
export const LAYER_SHADOW = {
  y: 4,
  blur: 12,
  color: 'rgb(16 24 40 / 0.18)',
  canvas: 'rgba(16, 24, 40, 0.18)',
} as const;
const MIN = 0.01;

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (r: Rect): Rect => ({ x: r4(r.x), y: r4(r.y), w: r4(r.w), h: r4(r.h) });

export function asLayers(options: unknown): ImageLayer[] {
  const list = (options as { images?: unknown } | null)?.images;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (l): l is ImageLayer =>
      !!l &&
      typeof l === 'object' &&
      typeof (l as ImageLayer).id === 'string' &&
      typeof (l as ImageLayer).path === 'string' &&
      (['x', 'y', 'w', 'h'] as const).every((k) => typeof (l as ImageLayer)[k] === 'number'),
  );
}

/** Nom affiché : le texte alternatif s'il est court, sinon le nom du fichier. */
export function layerName(l: Pick<ImageLayer, 'alt' | 'name'>, fallback: string): string {
  const alt = l.alt?.trim();
  if (alt && alt.length <= 40) return alt;
  return l.name?.trim() || alt || fallback;
}

/** Ni texte alternatif ni « image décorative » : à compléter avant de publier (image visible seulement). */
export const needsAlt = (l: ImageLayer) => !l.hidden && !l.decorative && !l.alt?.trim();

export const layerOpacity = (l: Pick<ImageLayer, 'opacity'>) =>
  typeof l.opacity === 'number' ? clamp(l.opacity, LAYER_OPACITY.min, LAYER_OPACITY.max) : 100;

/**
 * Proportions de l'image dans l'espace du cadre (largeur et hauteur en fraction) : une image carrée
 * dans un cadre 16:10 a une largeur en fraction plus petite que sa hauteur.
 */
export const fractionRatio = (imageRatio: number, frameRatio: number) => imageRatio / frameRatio;

/** Image posée au centre, à 30 % de la largeur du cadre (réduite si elle dépasse en hauteur). */
export function placeNew(imageRatio: number, frameRatio: number): Rect {
  const k = fractionRatio(imageRatio > 0 ? imageRatio : 1, frameRatio);
  let w = 0.3;
  let h = w / k;
  if (h > 0.8) {
    h = 0.8;
    w = h * k;
  }
  return round({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
}

/**
 * Redimensionnement par l'une des 8 poignées : `hx`, `hy` valent -1 (gauche, haut), 0 (milieu) ou 1
 * (droite, bas) ; le côté opposé reste fixe (le centre pour une poignée de milieu quand les proportions
 * sont gardées). `k` : proportions à garder (largeur / hauteur en fraction du cadre), ou null.
 */
export function resizeRect(
  r: Rect,
  hx: -1 | 0 | 1,
  hy: -1 | 0 | 1,
  p: { x: number; y: number },
  k: number | null,
): Rect {
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let w = hx === 0 ? r.w : hx > 0 ? p.x - r.x : right - p.x;
  let h = hy === 0 ? r.h : hy > 0 ? p.y - r.y : bottom - p.y;
  const maxW = hx > 0 ? 1 - r.x : hx < 0 ? right : k ? 2 * Math.min(cx, 1 - cx) : r.w;
  const maxH = hy > 0 ? 1 - r.y : hy < 0 ? bottom : k ? 2 * Math.min(cy, 1 - cy) : r.h;
  if (k) {
    // Coin : la dimension que le geste change le plus entraîne l'autre
    if (hx !== 0 && hy !== 0) w = Math.abs(w - r.w) >= Math.abs(h - r.h) * k ? w : h * k;
    else if (hx === 0) w = h * k;
    w = Math.min(Math.max(w, MIN, MIN * k), maxW, maxH * k);
    h = w / k;
  } else {
    w = clamp(w, MIN, maxW);
    h = clamp(h, MIN, maxH);
  }
  const x = hx > 0 ? r.x : hx < 0 ? right - w : cx - w / 2;
  const y = hy > 0 ? r.y : hy < 0 ? bottom - h : cy - h / 2;
  return round({ x, y, w, h });
}

/** Déplacement borné au cadre. */
export function moveRect(r: Rect, dx: number, dy: number): Rect {
  return round({ ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) });
}

/** Clavier, Alt + flèches : la largeur ou la hauteur change, le coin haut gauche reste en place. */
export function growRect(r: Rect, dw: number, dh: number, k: number | null): Rect {
  return resizeRect(r, dw !== 0 ? 1 : 0, dh !== 0 ? 1 : 0, { x: r.x + r.w + dw, y: r.y + r.h + dh }, k);
}

/** Champs Largeur ou Hauteur du panneau : l'autre dimension suit quand les proportions sont gardées. */
export function fitRect(prev: Rect, next: Rect, k: number | null): Rect {
  if (!k || (next.w === prev.w && next.h === prev.h)) return round(next);
  let w = next.w !== prev.w ? next.w : next.h * k;
  w = Math.min(Math.max(w, MIN, MIN * k), 1, k);
  const h = w / k;
  return round({ x: clamp(next.x, 0, 1 - w), y: clamp(next.y, 0, 1 - h), w, h });
}

/** Monter (vers le dessus : fin de la liste) ou descendre une image. */
export function reorder<T extends { id: string }>(list: T[], id: string, dir: 1 | -1): T[] {
  const i = list.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * Rectangle du cadre (après recadrage) ramené dans l'image entière : c'est là que les masques et les
 * images ajoutées sont incrustés à la publication.
 */
export function frameToImage(r: Rect, crop: Rect | null | undefined): Rect {
  if (!crop) return r;
  return { x: crop.x + r.x * crop.w, y: crop.y + r.y * crop.h, w: r.w * crop.w, h: r.h * crop.h };
}
