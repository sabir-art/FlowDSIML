/**
 * A8 : une application peut changer d'écran sans changer d'adresse. Après un clic, la page est recopiée
 * si l'affichage a vraiment changé : titre principal différent, ou nouveau contenu sur une grande part
 * de la fenêtre. Les menus, listes, fenêtres et infobulles ne comptent pas (décision du chef, 23/11) :
 * ce sont des états passagers de la même page.
 */

/** Part de la fenêtre que le nouveau contenu doit couvrir pour valoir un changement d'écran. */
export const BIG_CHANGE_RATIO = 0.3;
/** Un élément posé par-dessus la page (fixed, absolute) plus petit que cette part est un état passager. */
export const OVERLAY_RATIO = 0.5;

const PASSING =
  '[role="menu"],[role="listbox"],[role="dialog"],[role="alertdialog"],[role="tooltip"],dialog,[aria-modal="true"],[popover]';

export const isVisible = (el: Element): boolean =>
  typeof el.checkVisibility === 'function'
    ? el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
    : (el as HTMLElement).offsetParent !== null;

/** Titre principal affiché (hors fenêtres et menus), ou titre du document. */
export function mainHeading(doc: Document): string {
  for (const h of doc.querySelectorAll('h1,[role="heading"][aria-level="1"]')) {
    if (h.closest(`[data-fd-ui],${PASSING}`) || !isVisible(h)) continue;
    return (h.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return doc.title;
}

/**
 * L60 : nom lisible d'un écran pour le plan. Le titre principal affiché, suivi de l'onglet choisi quand
 * la page en a (« Fiche produit · Tarifs ») : deux états d'une même page ne portent pas le même nom.
 */
export function screenName(doc: Document): string {
  const head = mainHeading(doc);
  // Lot B (recette UX §3.1) : menu ouvert au moment de la copie (déplié, ou survolé) : « Catalogue ·
  // menu Produits », pour le distinguer de la même page menu fermé
  for (const m of doc.querySelectorAll('[aria-haspopup]:not([aria-haspopup="false"])')) {
    if (m.closest(`[data-fd-ui],${PASSING}`) || !isVisible(m)) continue;
    const open =
      m.getAttribute('aria-expanded') === 'true' ||
      m.matches(':hover') ||
      !!m.parentElement?.matches(':hover');
    const label = (m.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (open && label && label.length <= 40) return `${head} · menu ${label}`;
  }
  for (const t of doc.querySelectorAll('[role="tab"][aria-selected="true"]')) {
    if (t.closest(`[data-fd-ui],${PASSING}`) || !isVisible(t)) continue;
    const tab = (t.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (tab && tab.length <= 40 && tab !== head) return `${head} · ${tab}`;
  }
  return head;
}

/** Aire visible d'un élément dans la fenêtre, en px². */
function areaInViewport(el: Element, vw: number, vh: number): number {
  const r = el.getBoundingClientRect();
  const w = Math.min(r.right, vw) - Math.max(r.left, 0);
  const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Vrai si les éléments apparus depuis le clic valent un nouvel écran.
 * @param appeared éléments ajoutés ou rendus visibles depuis le clic
 * @param headingBefore titre principal relevé au moment du clic
 */
export function isScreenChange(
  doc: Document,
  appeared: Iterable<Element>,
  headingBefore: string,
  view: { w: number; h: number },
): boolean {
  const list = [...appeared].filter(
    (el) => el.isConnected && !el.closest(`[data-fd-ui],${PASSING}`) && isVisible(el),
  );
  if (!list.length) return false;
  const set = new Set(list);
  let area = 0;
  for (const el of list) {
    // Un élément déjà compté avec son parent n'est pas recompté
    let nested = false;
    for (let p = el.parentElement; p; p = p.parentElement)
      if (set.has(p)) {
        nested = true;
        break;
      }
    if (nested) continue;
    const a = areaInViewport(el, view.w, view.h);
    const pos = getComputedStyle(el).position;
    if ((pos === 'fixed' || pos === 'absolute') && a < OVERLAY_RATIO * view.w * view.h) continue;
    area += a;
  }
  if (area === 0) return false;
  return mainHeading(doc) !== headingBefore || area >= BIG_CHANGE_RATIO * view.w * view.h;
}
