/**
 * MOTION-01 §2 : la scène de l'éditeur (cadre de navigateur, capture et tout ce qui est posé dessus) suit
 * les panneaux par FLIP. La mise en page change d'un coup ; la scène part de son ancien rectangle et
 * rejoint le nouveau par `transform` seul (jamais `width` ni la grille), en 320 ms.
 *  - `key` change quand la place disponible change (panneau d'outil, Commentaires, échelle de la vue) ;
 *  - une animation en cours est reprise depuis son état visuel (pas de saut) ;
 *  - un appui sur la scène termine l'animation aussitôt ; mouvement réduit : pas de FLIP.
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Délai de garde si `transitionend` n'arrive pas (onglet en arrière-plan). */
const GUARD_MS = 400;

export function useStageFlip(inner: RefObject<HTMLElement | null>, key: string) {
  const seen = useRef(key);
  const first = useRef<DOMRect | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const scene = () => inner.current?.querySelector<HTMLElement>(':scope > .frame') ?? null;

  // Avant la mise à jour de la page : le rectangle de la scène tel qu'on le voit (transform en cours compris)
  if (seen.current !== key) {
    seen.current = key;
    first.current = scene()?.getBoundingClientRect() ?? null;
  }

  useLayoutEffect(() => {
    const from = first.current;
    first.current = null;
    const el = scene();
    if (!el || !from) return;
    stop.current?.();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = el.getBoundingClientRect();
    if (to.width < 1 || from.width < 1) return;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const s = from.width / to.width;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(s - 1) < 0.001) return;

    let frame = 0;
    let guard = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(guard);
      el.removeEventListener('transitionend', onEnd);
      el.removeEventListener('pointerdown', finish, true);
      // Une transition en cours ne s'arrête pas quand on retire la propriété `transition` (sa cible n'a
      // pas changé) : `transition: none` l'annule vraiment, puis tout est retiré.
      el.style.transition = 'none';
      el.style.removeProperty('transform');
      void el.offsetWidth;
      // will-change retiré à la fin : une capture qui le garde devient floue
      for (const p of ['transition', 'transform-origin', 'will-change']) el.style.removeProperty(p);
      stop.current = null;
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') finish();
    };
    stop.current = finish;
    el.style.transition = 'none';
    el.style.transformOrigin = '0 0';
    el.style.willChange = 'transform';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    // L'état de départ est pris en compte avant de lancer la transition
    void el.offsetWidth;
    frame = requestAnimationFrame(() => {
      el.style.transition = 'transform var(--fd-motion-duration-slow) var(--fd-motion-ease-standard)';
      el.style.transform = 'none';
    });
    el.addEventListener('transitionend', onEnd);
    // Un glisser commencé pendant l'animation la termine aussitôt
    el.addEventListener('pointerdown', finish, true);
    guard = window.setTimeout(finish, GUARD_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useLayoutEffect(() => () => stop.current?.(), []);
}
