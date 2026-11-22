/**
 * Positionnement des overlays (composants.md §15.7) : portail unique #fd-portal, position fixed,
 * retournement (flip), décalage pour rester à 8 px des bords (shift), hauteur maximale (size).
 * Volontairement minimal (pas de dépendance) : les menus de l'app n'ont besoin que de ces 4 côtés.
 */
export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export const VIEWPORT_MARGIN = 8;
const GAP = 4;

export function getPortal(): HTMLElement {
  let el = document.getElementById('fd-portal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fd-portal';
    document.body.appendChild(el);
  }
  return el;
}

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Calcule top/left/maxHeight d'un overlay de taille `size` ancré à `anchor`, dans un viewport `vw`×`vh`. */
export function computePosition(
  anchor: Rect,
  size: { width: number; height: number },
  placement: Placement,
  vw: number,
  vh: number,
  margin = VIEWPORT_MARGIN,
): { top: number; left: number; maxHeight: number; placement: Placement } {
  const [side0, align] = placement.split('-') as ['top' | 'bottom', 'start' | 'end'];
  const below = vh - anchor.bottom - GAP - margin;
  const above = anchor.top - GAP - margin;
  // Retournement : on garde le côté préféré s'il suffit, sinon le côté le plus spacieux
  let side = side0;
  if (side === 'bottom' && size.height > below && above > below) side = 'top';
  else if (side === 'top' && size.height > above && below > above) side = 'bottom';
  let available = side === 'bottom' ? below : above;
  let height = Math.min(size.height, available);
  let top = side === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - height;
  // Aucun côté ne suffit mais le menu tient dans la fenêtre : on le décale pour le montrer en entier
  // (pas de défilement caché, utile aussi au zoom 200 %), quitte à recouvrir le bouton.
  if (size.height > available && size.height <= vh - 2 * margin) {
    available = vh - 2 * margin;
    height = size.height;
    top = Math.min(Math.max(top, margin), vh - margin - height);
  }
  // Alignement horizontal puis décalage pour rester dans le viewport
  let left = align === 'start' ? anchor.left : anchor.right - size.width;
  left = Math.min(left, vw - margin - size.width);
  left = Math.max(left, margin);
  return { top, left, maxHeight: Math.max(available, 0), placement: `${side}-${align}` as Placement };
}
