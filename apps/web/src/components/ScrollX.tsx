import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Conteneur à défilement horizontal qui signale le contenu masqué par une ombre de bord (RF5). */
export function ScrollX({ children, label }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft > 1,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, []);
  return (
    <div
      ref={ref}
      // §18.7 : tableau large, défilement horizontal voulu
      data-scroll-x=""
      className={`table-scroll${edges.start ? ' has-more-start' : ''}${edges.end ? ' has-more-end' : ''}`}
      // Zone défilante focalisable au clavier quand elle déborde
      tabIndex={edges.start || edges.end ? 0 : undefined}
      role={edges.start || edges.end ? 'region' : undefined}
      aria-label={edges.start || edges.end ? label : undefined}
    >
      {children}
    </div>
  );
}
