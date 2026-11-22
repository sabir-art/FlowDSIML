import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { computePosition, type Placement } from './floating';

/**
 * Popover commun de COMP-01 (calendrier, heures, nuancier) : placé sous l'ancre (4 px), au-dessus s'il
 * n'y a pas la place, calé dans la fenêtre ; un clic en dehors ou Échap le ferme. Rendu dans le portail
 * (`getPortal(anchor)`), avec la classe « fd-pop ».
 */
export function usePopover(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  pop: RefObject<HTMLElement | null>,
  onClose: (focusAnchor: boolean) => void,
  placement: Placement = 'bottom-start',
  /** Hauteur maximale du contenu (liste plafonnée), pour choisir le côté d'ouverture. */
  maxContent = Infinity,
): { style: CSSProperties; ready: boolean } {
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = anchor.current;
      const p = pop.current;
      if (!a || !p) return;
      const r = computePosition(
        a.getBoundingClientRect(),
        // Hauteur utile : celle que le popover occupe réellement (une liste longue est plafonnée par son style)
        { width: p.offsetWidth, height: Math.min(p.scrollHeight + 2, maxContent) },
        placement,
        window.innerWidth,
        window.innerHeight,
      );
      setPos({ top: r.top, left: r.left, maxHeight: r.maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, pop, placement, maxContent]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !anchor.current?.contains(t)) onClose(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // La touche ferme le popover, pas la modale qui le contient
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, anchor, pop, onClose]);
  return {
    style: pos
      ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight }
      : { top: 0, left: 0, visibility: 'hidden' },
    ready: !!pos,
  };
}
