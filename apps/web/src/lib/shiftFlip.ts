/**
 * MOTION-01 §3 (barre latérale, colonne Dossiers) : une colonne change de largeur d'un seul coup, et le
 * contenu voisin rejoint sa nouvelle place par FLIP, en `transform: translateX()` seul (jamais `width`
 * ni la grille).
 *  - `key` change quand la colonne bascule ;
 *  - une bascule pendant le mouvement repart de la position visible (pas de saut) ;
 *  - pendant le trajet, `clip` (un ancêtre) coupe ce qui dépasse, sans barre de défilement ;
 *  - mouvement réduit : pas de FLIP.
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { motionMs } from './flip';

const ID = 'fd-shift';

export function useShiftFlip(
  target: RefObject<HTMLElement | null>,
  key: string,
  options: { token?: string; clip?: () => HTMLElement | null } = {},
): void {
  const seen = useRef(key);
  const first = useRef<number | null>(null);

  // Avant la mise à jour de la page : la position telle qu'on la voit (transform en cours compris)
  if (seen.current !== key) {
    seen.current = key;
    first.current = target.current?.getBoundingClientRect().left ?? null;
  }

  useLayoutEffect(() => {
    const from = first.current;
    first.current = null;
    const el = target.current;
    if (!el || from === null) return;
    for (const a of el.getAnimations()) if (a.id === ID) a.cancel();
    const ms = motionMs(options.token ?? '--fd-motion-duration-base');
    if (ms <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dx = from - el.getBoundingClientRect().left;
    if (Math.abs(dx) < 0.5) return;
    const box = options.clip?.() ?? null;
    const before = box?.style.overflowX ?? '';
    if (box) box.style.overflowX = 'clip';
    const anim = el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], {
      duration: ms,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
    anim.id = ID;
    const done = () => {
      // Une nouvelle bascule a déjà pris le relais : elle garde la coupe
      if (box && !el.getAnimations().some((a) => a.id === ID && a !== anim)) box.style.overflowX = before;
    };
    anim.onfinish = done;
    anim.oncancel = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
