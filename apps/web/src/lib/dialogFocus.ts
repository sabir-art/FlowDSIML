/**
 * L24 · RGAA 7.1 / 12.8 : dans une fenêtre modale, la tabulation boucle sur les éléments de la fenêtre au
 * lieu d'en sortir. Pour un <dialog> ouvert avec showModal, Échap et le retour du focus restent natifs.
 * L34 (WCAG 2.2) : même règle pour les fenêtres faites d'un bloc `role="dialog" aria-modal="true"`
 * (portails) : le focus y entre à l'ouverture si la fenêtre ne le place pas elle-même, y reste, et revient à
 * l'élément d'origine à la fermeture. Échap reste géré par chaque fenêtre.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const ARIA_MODAL = '[role="dialog"][aria-modal="true"]:not(dialog)';

export function focusables(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !el.closest('[inert]') &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden',
  );
}

function ariaModals(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(ARIA_MODAL)].filter((d) => d.getClientRects().length > 0);
}

/** Fenêtre modale au premier plan (un <dialog> modal passe devant, sinon la dernière ouverte), ou null. */
function topModal(doc: Document): HTMLElement | null {
  const native = [...doc.querySelectorAll<HTMLDialogElement>('dialog[open]')].filter((d) =>
    d.matches(':modal'),
  );
  const last = native[native.length - 1];
  if (last) return last;
  const divs = ariaModals(doc);
  return divs[divs.length - 1] ?? null;
}

export function installDialogFocusLoop(doc: Document = document) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    const d = topModal(doc);
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

  // Fenêtres « aria-modal » : élément d'origine retenu à l'ouverture, focus rendu à la fermeture
  const openers = new Map<HTMLElement, HTMLElement | null>();
  let lastOutside: HTMLElement | null = null;
  const onFocusIn = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && !el.closest(ARIA_MODAL) && !el.closest('dialog[open]')) lastOutside = el;
  };
  doc.addEventListener('focusin', onFocusIn);
  const sync = () => {
    const current = ariaModals(doc);
    for (const d of current) {
      if (openers.has(d)) continue;
      openers.set(d, lastOutside);
      // Laisse la fenêtre placer son focus (autoFocus), sinon le premier élément, sinon la fenêtre
      requestAnimationFrame(() => {
        if (!d.isConnected || d.contains(doc.activeElement)) return;
        const target = focusables(d)[0];
        if (target) target.focus();
        else {
          if (!d.hasAttribute('tabindex')) d.setAttribute('tabindex', '-1');
          d.focus();
        }
      });
    }
    for (const [d, opener] of [...openers]) {
      if (d.isConnected && current.includes(d)) continue;
      openers.delete(d);
      const active = doc.activeElement;
      const lost = !active || active === doc.body || !active.isConnected;
      if (lost && opener?.isConnected) opener.focus();
    }
  };
  // Une vérification par image au plus, quel que soit le nombre de modifications du DOM
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  };
  const observer =
    typeof MutationObserver === 'undefined' || !doc.body ? null : new MutationObserver(schedule);
  observer?.observe(doc.body, { childList: true, subtree: true });

  return () => {
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('focusin', onFocusIn);
    observer?.disconnect();
  };
}
