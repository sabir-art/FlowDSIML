/**
 * L30-05 : préparation d'une capture HTML pour « Générer avec l'IA ». Dans le navigateur, la page est
 * lue par DOMParser (document inerte : aucun script, aucune ressource chargée), puis :
 * - les zones floutées, masquées ou retirées (opérations de l'éditeur, flou de la capture) sont ôtées ;
 * - le texte restant est réduit à 6 000 caractères ;
 * - les éléments cliquables visibles reçoivent un numéro, un libellé court et un sélecteur unique.
 * Seuls le texte et les libellés numérotés partent vers l'IA ; les sélecteurs restent ici, pour poser
 * les bulles sur les éléments choisis.
 */
export const PAGE_TEXT_MAX = 6000;
export const ELEMENTS_MAX = 80;

export interface PageElement {
  i: number;
  label: string;
  sel: string;
}

const REMOVED_OPS = new Set(['blur', 'hide', 'remove', 'mask']);
const CLICKABLE =
  'a[href], button, input[type=button], input[type=submit], select, [role=button], [role=link], [role=tab], [role=menuitem]';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Sélecteur unique d'un élément dans son document (id sûr, sinon chemin nth-of-type depuis body). */
export function uniqueSelector(el: Element): string | null {
  const doc = el.ownerDocument;
  const unique = (sel: string) => {
    try {
      return doc.querySelectorAll(sel).length === 1 ? sel : null;
    } catch {
      return null;
    }
  };
  if (el.id && /^[A-Za-z][\w-]{0,60}$/.test(el.id)) {
    const s = unique(`#${el.id}`);
    if (s) return s;
  }
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== doc.body && cur !== doc.documentElement) {
    const tag = cur.tagName.toLowerCase();
    const same = cur.parentElement
      ? [...cur.parentElement.children].filter((c) => c.tagName === cur!.tagName)
      : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    cur = cur.parentElement;
  }
  const sel = ['body', ...parts].join(' > ');
  return sel.length <= 500 ? unique(sel) : null;
}

function labelOf(el: Element): string {
  const own =
    el.getAttribute('aria-label') ||
    (el as HTMLInputElement).value ||
    el.textContent ||
    el.getAttribute('title') ||
    el.getAttribute('placeholder') ||
    '';
  return clean(own).slice(0, 80);
}

export function preparePage(
  html: string,
  ops: Array<{ op: string; sel: string; sels?: string[] }>,
): { title: string; text: string; elements: PageElement[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Sélecteurs calculés sur la page intacte (celle que voit le lecteur), avant tout retrait
  const sels = new Map<Element, string | null>();
  doc.body?.querySelectorAll(CLICKABLE).forEach((el) => sels.set(el, uniqueSelector(el)));
  const drop = (sel: string) => {
    try {
      doc.querySelectorAll(sel).forEach((n) => n.remove());
    } catch {
      /* sélecteur invalide : ignoré */
    }
  };
  // Jamais envoyé : scripts, styles, zones floutées à la capture, zones floutées, masquées ou retirées
  drop('script, style, noscript, template, iframe, object, embed, [data-fd-blurred], [aria-hidden="true"]');
  for (const o of ops) if (REMOVED_OPS.has(o.op)) [o.sel, ...(o.sels ?? [])].forEach(drop);
  const title = clean(doc.title).slice(0, 200);
  const body = doc.body;
  const elements: PageElement[] = [];
  for (const [el, sel] of sels) {
    if (elements.length >= ELEMENTS_MAX) break;
    if (!sel || !el.isConnected || (el as HTMLElement).hidden) continue;
    const label = labelOf(el);
    if (!label || elements.some((e) => e.label === label)) continue;
    elements.push({ i: elements.length, label, sel });
  }
  const text = clean(body?.textContent ?? '').slice(0, PAGE_TEXT_MAX);
  return { title, text, elements };
}
