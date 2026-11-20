import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

/**
 * L34 (WCAG 2.2) : fenêtre modale du lecteur (fin de démo, formulaire, reprise). Le focus y entre à
 * l'ouverture s'il est ailleurs, la tabulation y reste (dans les deux sens), et il revient à l'élément
 * d'origine à la fermeture.
 */
export function useModalFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => {
      if (root.contains(document.activeElement)) return;
      const first = focusables(root)[0];
      if (first) first.focus();
      else {
        if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
        root.focus();
      }
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      const list = focusables(root);
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && root.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
      const active = document.activeElement;
      if ((!active || active === document.body || !active.isConnected) && opener?.isConnected) opener.focus();
    };
  }, []);
  return ref;
}

/** Fenêtre modale du lecteur : bloc `role="dialog"` qui gère son focus (useModalFocus). */
export function ModalBox({
  class: cls,
  labelledby,
  children,
}: {
  class: string;
  labelledby: string;
  children: ComponentChildren;
}) {
  const ref = useModalFocus<HTMLDivElement>();
  return (
    <div ref={ref} class={cls} role="dialog" aria-modal="true" aria-labelledby={labelledby}>
      {children}
    </div>
  );
}
