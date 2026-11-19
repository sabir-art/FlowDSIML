/**
 * L25-01 : géométrie pure (testée) de la capture pleine page et de la taille de l'onglet.
 *
 * La capture de l'étape reste celle du viewport (vérifiée à l'écran de vérification). La capture
 * pleine page sert seulement à l'animation de défilement : ses zones sont repérées sur tout le
 * document et floutées par défaut. Seule une zone que l'utilisateur a décochée sur la capture du
 * viewport (même type, même place) reste nette, pour que les deux images disent la même chose.
 */
import type { RelRect } from './geometry';
import type { PiiType } from './pii';

/** Taille du document et position du défilement au moment du clic (pixels CSS). */
export interface PageBox {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

/** Hauteur maximale capturée (pixels CSS) : au-delà, le bas de la page est coupé. */
export const FULL_MAX_HEIGHT = 12000;

/** Taille de l'onglet choisie dans la popup (L25-01). */
export type TabSizeKey = 'current' | '1280x720' | '1440x900' | '1920x1080' | 'custom';
export const TAB_SIZE_MIN = 800;
export const TAB_SIZE_MAX = 2560;

/** Taille demandée, ou null pour garder la taille actuelle. Bornée de 800 à 2 560 px. */
export function tabSize(key: TabSizeKey, custom: { w: number; h: number }): { w: number; h: number } | null {
  if (key === 'current') return null;
  if (key !== 'custom') {
    const [w, h] = key.split('x').map(Number);
    return { w: w!, h: h! };
  }
  const clamp = (v: number) => Math.min(TAB_SIZE_MAX, Math.max(TAB_SIZE_MIN, Math.round(v) || TAB_SIZE_MIN));
  return { w: clamp(custom.w), h: clamp(custom.h) };
}

/** Hauteur capturée de la page (bornée). */
export const fullHeight = (page: PageBox) => Math.min(Math.max(1, Math.round(page.height)), FULL_MAX_HEIGHT);

/** Zone du viewport (relative au viewport) ramenée en relatif à la page entière. */
export function viewportToPage(r: RelRect, vp: { width: number; height: number }, page: PageBox): RelRect {
  const h = fullHeight(page);
  const w = Math.max(1, page.width);
  return {
    x: (r.x * vp.width + page.scrollX) / w,
    y: (r.y * vp.height + page.scrollY) / h,
    w: (r.w * vp.width) / w,
    h: (r.h * vp.height) / h,
  };
}

const overlap = (a: RelRect, b: RelRect) => {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = x * y;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
};

export interface ViewportZone {
  type: PiiType;
  rect: RelRect;
  blur: boolean;
  manual?: boolean;
}

/**
 * Zones à flouter sur la capture pleine page :
 * - toutes les zones repérées sur la page, sauf celles décochées sur le viewport (même type, même place) ;
 * - plus les zones cochées ou tracées à la main sur le viewport.
 */
export function fullPageBlurs(
  pageZones: { type: PiiType; rect: RelRect }[],
  viewportZones: ViewportZone[],
  vp: { width: number; height: number },
  page: PageBox,
): RelRect[] {
  const mapped = viewportZones.map((z) => ({ ...z, rect: viewportToPage(z.rect, vp, page) }));
  const kept = pageZones
    .filter((p) => !mapped.some((m) => !m.blur && m.type === p.type && overlap(m.rect, p.rect) > 0.5))
    .map((p) => p.rect);
  return [...kept, ...mapped.filter((m) => m.blur).map((m) => m.rect)];
}
