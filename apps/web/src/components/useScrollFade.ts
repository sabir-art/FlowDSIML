import { useCallback, useRef } from 'react';

/**
 * Rangée qui défile horizontalement (onglets sur petit écran) : pose `data-more` tant qu'il reste du
 * contenu à droite, pour qu'un fondu de 24 px le signale au lieu d'une coupure nette.
 * Référence par rappel : la rangée peut n'être montée qu'après le chargement de la page.
 */
export function useScrollFade<T extends HTMLElement>() {
  const stop = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;
    const sync = () => {
      const more = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      if (more) el.dataset.more = '';
      else delete el.dataset.more;
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    stop.current = () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, []);
}
