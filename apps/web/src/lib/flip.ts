import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Durée d'un jeton de mouvement, en millisecondes (0 en mouvement réduit). */
export function motionMs(token = '--fd-motion-duration-base'): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : 0;
}

/**
 * MOTION-01 (FLIP) : quand l'ordre ou le nombre des éléments d'une liste change, ceux qui restent
 * rejoignent leur nouvelle place en glissant (transform seul, 200 ms, courbe standard) au lieu de sauter.
 * Les éléments suivis portent `data-flip="<clé stable>"`. La mise en page change d'un coup ; seul le
 * rendu est animé. Rien en mouvement réduit, ni au premier affichage.
 */
export function useFlip(
  container: RefObject<HTMLElement | null>,
  signature: string,
  /**
   * `list` (défaut) : positions dans la liste, indépendantes de son défilement. `viewport` : positions à
   * l'écran, pour une pile ancrée en bas (toasts) dont le conteneur grandit vers le haut.
   */
  frame: 'list' | 'viewport' = 'list',
): void {
  const before = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    const moved: Array<{ el: HTMLElement; dx: number; dy: number }> = [];
    for (const el of root.querySelectorAll<HTMLElement>('[data-flip]')) {
      const key = el.dataset.flip!;
      const r = el.getBoundingClientRect();
      const pos =
        frame === 'viewport'
          ? { x: r.left, y: r.top }
          : { x: r.left - base.left + root.scrollLeft, y: r.top - base.top + root.scrollTop };
      next.set(key, pos);
      const old = before.current.get(key);
      if (old && (Math.abs(old.x - pos.x) > 0.5 || Math.abs(old.y - pos.y) > 0.5))
        moved.push({ el, dx: old.x - pos.x, dy: old.y - pos.y });
    }
    before.current = next;
    const ms = motionMs();
    if (!(ms > 0)) return;
    for (const m of moved)
      m.el.animate([{ transform: `translate(${m.dx}px, ${m.dy}px)` }, { transform: 'none' }], {
        duration: ms,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
  }, [container, signature, frame]);
}
