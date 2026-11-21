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
const BLOCKS =
  'h1, h2, h3, h4, h5, h6, p, li, td, th, div, section, article, header, footer, nav, dt, dd, br, button, a';

/**
 * Règle 3 (L30) : adresses e-mail et numéros de téléphone (France et international) remplacés avant
 * l'envoi, même sans flou posé par l'auteur.
 */
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE =
  /(?:\+\d{1,3}[\s.-]?(?:\(0\)[\s.-]?)?|\(0\)[\s.-]?|\b0)\d(?:[\s.-]?\d{2}){4}\b|\+\d{1,3}(?:[\s.-]?\d{2,4}){2,5}\b/g;
export const maskPersonal = (s: string) => s.replace(EMAIL, '[e-mail]').replace(PHONE, '[téléphone]');

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
  ops: Array<{ op: string; sel: string; sels?: string[]; value?: unknown }>,
): { title: string; text: string; elements: PageElement[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Ce que voit le visiteur : textes remplacés par l'auteur (un nom réel devenu fictif ne part jamais)
  for (const o of ops) {
    if (o.op !== 'text' || typeof o.value !== 'string') continue;
    try {
      doc.querySelectorAll(o.sel).forEach((n) => (n.textContent = o.value as string));
    } catch {
      /* sélecteur invalide : ignoré */
    }
  }
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
  const title = maskPersonal(clean(doc.title)).slice(0, 200);
  const body = doc.body;
  const elements: PageElement[] = [];
  for (const [el, sel] of sels) {
    if (elements.length >= ELEMENTS_MAX) break;
    if (!sel || !el.isConnected || (el as HTMLElement).hidden) continue;
    const label = maskPersonal(labelOf(el)).slice(0, 80);
    if (!label || elements.some((e) => e.label === label)) continue;
    elements.push({ i: elements.length, label, sel });
  }
  // Un saut de ligne après chaque bloc : « Camille Exemple » et « Tél. » ne sont pas collés
  body?.querySelectorAll(BLOCKS).forEach((n) => n.after(doc.createTextNode('\n')));
  const text = maskPersonal(clean(body?.textContent ?? '')).slice(0, PAGE_TEXT_MAX);
  return { title, text, elements };
}
