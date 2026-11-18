/**
 * L24 · RGAA 7.1 / 12.8 : dans une fenêtre modale (<dialog> ouvert avec showModal), la tabulation
 * boucle sur les éléments de la fenêtre au lieu d'en sortir vers le navigateur. Échap et le retour
 * du focus au bouton d'origine restent gérés par le <dialog> natif.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusables(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !el.closest('[inert]') &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden',
  );
}

/** Fenêtre modale au premier plan (la dernière ouverte), ou null. */
function topModal(): HTMLDialogElement | null {
  const open = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].filter((d) =>
    d.matches(':modal'),
  );
  return open[open.length - 1] ?? null;
}

export function installDialogFocusLoop(doc: Document = document) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    const d = topModal();
    if (!d) return;
    const list = focusables(d);
    if (!list.length) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const active = doc.activeElement as HTMLElement | null;
    const inside = !!active && d.contains(active);
    if (e.shiftKey && (!inside || active === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || active === last)) {
      e.preventDefault();
      first.focus();
    }
  };
  doc.addEventListener('keydown', onKey);
  return () => doc.removeEventListener('keydown', onKey);
}
