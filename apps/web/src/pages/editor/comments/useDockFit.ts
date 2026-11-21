import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Écart minimal entre la sélection (hotspot, bulle) et le bord haut du panneau Commentaires. */
const GAP = 16;
/** Largeur minimale du cadre quand on le réduit pour tenir en hauteur. */
const MIN_W = 320;

/**
 * Retours client 21/11 §1 : quand le panneau Commentaires s'ouvre ou grandit, le canevas réduit sa
 * hauteur et se recadre (« Ajuster » : le cadre tient en hauteur dans la zone visible). Dans tous les
 * cas (panneau ouvert), la sélection (hotspot et sa bulle) reste à 16 px au moins du bord bas de la zone visible.
 */
export function useDockFit(
  inner: RefObject<HTMLElement | null>,
  open: boolean,
  fit: boolean,
  deps: unknown[],
) {
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || !open) return;
    const frame = () => el.querySelector<HTMLElement>(':scope > .frame');
    const apply = () => {
      const f = frame();
      if (f) {
        f.style.maxWidth = '';
        if (fit) {
          // Hauteur utile : sans les marges intérieures (non comptées par scrollHeight dans une grille).
          // Hauteur du cadre quasi proportionnelle à sa largeur : deux passes suffisent
          const cs = getComputedStyle(el);
          const avail = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          const gap = parseFloat(cs.rowGap) || 0;
          const used = () => {
            const kids = [...el.children].filter(
              (c): c is HTMLElement =>
                c instanceof HTMLElement && c.offsetHeight > 0 && getComputedStyle(c).position !== 'absolute',
            );
            return kids.reduce((sum, c) => sum + c.offsetHeight, 0) + gap * Math.max(0, kids.length - 1);
          };
          for (let i = 0; i < 2; i++) {
            const over = used() - avail;
            if (over <= 0) break;
            const w = f.offsetWidth;
            const h = f.offsetHeight;
            f.style.maxWidth = `${Math.max(MIN_W, Math.floor((w * (h - over)) / h))}px`;
          }
        }
      }
      const sel = [...el.querySelectorAll<HTMLElement>('.canvas-hotspot.selected, .canvas-tip')];
      if (!sel.length) return;
      const box = el.getBoundingClientRect();
      const bottom = Math.max(...sel.map((s) => s.getBoundingClientRect().bottom));
      const top = Math.min(...sel.map((s) => s.getBoundingClientRect().top));
      const below = bottom - (box.bottom - GAP);
      // Défiler pour garder la sélection visible, sans faire sortir son haut par le haut
      if (below > 0) el.scrollTop += Math.min(below, Math.max(0, top - box.top - GAP));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      const f = frame();
      if (f) f.style.maxWidth = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcul à chaque changement d'étape, de sélection ou de zoom
  }, [inner, open, fit, ...deps]);
}

/**
 * La zone du canevas défile quand son contenu dépasse (zoom 100 %, page HTML, panneau Commentaires
 * ouvert) : elle doit alors être atteignable au clavier (RGAA 7.3, axe scrollable-region-focusable).
 */
export function useScrollable(el: RefObject<HTMLElement | null>, deps: unknown[]): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const update = () =>
      setOn(node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    const mo = new MutationObserver(() => {
      ro.disconnect();
      ro.observe(node);
      for (const c of node.children) ro.observe(c);
      update();
    });
    mo.observe(node, { childList: true });
    for (const c of node.children) ro.observe(c);
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rattaché quand la zone apparaît ou change
  }, [el, ...deps]);
  return on;
}
