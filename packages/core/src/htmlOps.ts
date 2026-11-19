import { applyVariables, type VariableValues } from './variables';

/**
 * A8 (L20) : modifications d'une étape HTML, stockées comme opérations (sélecteur + action +
 * valeur) et non comme un DOM réécrit. Elles survivent à une nouvelle capture : un sélecteur qui ne
 * trouve plus rien est mis de côté (notFound), sans bloquer la publication.
 */
export type HtmlOpKind = 'text' | 'hide' | 'blur' | 'link' | 'image' | 'remove';

export interface HtmlOp {
  id: string;
  sel: string;
  op: HtmlOpKind;
  /** text : nouveau texte (variables {{…}} permises) ; link : id de l'étape ; image : chemin. */
  value?: string;
  /** Valeur avant modification (texte d'origine, affiché dans la liste « avant → après »). */
  before?: string;
  /** « Toutes les étapes » : même groupe sur chaque étape, une seule annulation. */
  scope: 'step' | 'all';
  group?: string;
}

export const HTML_OPS_MAX = 500;
export const HTML_MAX_BYTES = 10 * 1024 * 1024;
const KINDS: readonly HtmlOpKind[] = ['text', 'hide', 'blur', 'link', 'image', 'remove'];
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** Validation (même règle que la base) : forme stricte, sélecteur borné, aucune clé en trop. */
export function validHtmlOps(ops: unknown): ops is HtmlOp[] {
  if (!Array.isArray(ops) || ops.length > HTML_OPS_MAX) return false;
  return ops.every((o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    const r = o as Record<string, unknown>;
    const allowed = ['id', 'sel', 'op', 'value', 'before', 'scope', 'group'];
    if (Object.keys(r).some((k) => !allowed.includes(k))) return false;
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return false;
    if (typeof r.sel !== 'string' || r.sel.length < 1 || r.sel.length > 500) return false;
    if (!KINDS.includes(r.op as HtmlOpKind)) return false;
    if (r.scope !== 'step' && r.scope !== 'all') return false;
    if (r.group !== undefined && (typeof r.group !== 'string' || !ID_RE.test(r.group))) return false;
    for (const k of ['value', 'before'] as const)
      if (r[k] !== undefined && (typeof r[k] !== 'string' || (r[k] as string).length > 5000)) return false;
    if ((r.op === 'text' || r.op === 'link' || r.op === 'image') && typeof r.value !== 'string') return false;
    return true;
  });
}

/** Texte neutre d'un élément flouté (« Camille Martin » → « Xxxxxxx Xxxxxx ») : jamais l'original. */
export function neutralText(s: string): string {
  return s
    .replace(/\p{Lu}/gu, 'X')
    .replace(/\p{Ll}/gu, 'x')
    .replace(/\p{N}/gu, '0');
}

/** Remplace le texte de tous les nœuds texte sous el (structure conservée). */
export function neutralizeText(el: Element): void {
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) n.nodeValue = neutralText(n.nodeValue ?? '');
  for (const a of ['alt', 'title', 'aria-label', 'placeholder', 'value'])
    for (const e of [el, ...el.querySelectorAll(`[${a}]`)])
      if (e.hasAttribute(a)) e.setAttribute(a, neutralText(e.getAttribute(a) ?? ''));
}

const cssEscape = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, (c) => `\\${c}`);
/** Classes générées (hash, utilitaires dynamiques) : inutilisables pour un sélecteur stable. */
const unstableClass = (c: string) => /\d{3,}|[A-Za-z0-9]{6,}_[A-Za-z0-9]{4,}|^css-|^sc-|^jsx-|--/.test(c);
const unstableId = (id: string) => /\d{4,}|^[a-f0-9-]{16,}$|^:r/.test(id);

function unique(doc: Document | Element, sel: string): boolean {
  try {
    return doc.querySelectorAll(sel).length === 1;
  } catch {
    return false;
  }
}

function part(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes = [...el.classList].filter((c) => !unstableClass(c)).slice(0, 2);
  let p = tag + classes.map((c) => `.${cssEscape(c)}`).join('');
  const parent = el.parentElement;
  if (parent) {
    const same = [...parent.children].filter((c) => c.tagName === el.tagName);
    if (same.length > 1)
      p = `${tag}${classes.map((c) => `.${cssEscape(c)}`).join('')}:nth-of-type(${same.indexOf(el) + 1})`;
  }
  return p;
}

/**
 * Sélecteur stable et unique : id stable s'il existe (sur l'élément ou un ancêtre proche), sinon
 * attributs de test, sinon chemin court depuis body. Les classes générées sont ignorées.
 */
export function stableSelector(el: Element): string {
  const doc = el.ownerDocument;
  for (const a of ['data-testid', 'data-test', 'data-qa', 'name']) {
    const v = el.getAttribute(a);
    if (v && v.length < 80) {
      const s = `${el.tagName.toLowerCase()}[${a}="${v.replace(/["\\]/g, '\\$&')}"]`;
      if (unique(doc, s)) return s;
    }
  }
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML') {
    if (cur.id && !unstableId(cur.id) && unique(doc, `#${cssEscape(cur.id)}`)) {
      parts.unshift(`#${cssEscape(cur.id)}`);
      const s = parts.join(' > ');
      if (unique(doc, s)) return s;
      break;
    }
    parts.unshift(part(cur));
    const s = parts.join(' > ');
    if (parts.length >= 2 && unique(doc, `body ${s}`) && unique(doc, s)) return s;
    cur = cur.parentElement;
  }
  const s = parts[0]?.startsWith('#') ? parts.join(' > ') : `body > ${parts.join(' > ')}`;
  return s;
}

/** Fil du sélecteur (body › main › div.kpi › b.value), pour l'en-tête du canevas. */
export function selectorTrail(el: Element): Array<{ label: string; el: Element }> {
  const out: Array<{ label: string; el: Element }> = [];
  for (let cur: Element | null = el; cur && cur.tagName !== 'HTML'; cur = cur.parentElement) {
    const cls = [...cur.classList].filter((c) => !unstableClass(c))[0];
    out.unshift({ label: cur.tagName.toLowerCase() + (cls ? `.${cls}` : ''), el: cur });
  }
  return out;
}

/** Sélecteur court de l'étiquette de sélection (dernier maillon). */
export function shortSelector(el: Element): string {
  const cls = [...el.classList].filter((c) => !unstableClass(c))[0];
  return el.tagName.toLowerCase() + (el.id && !unstableId(el.id) ? `#${el.id}` : cls ? `.${cls}` : '');
}

export interface ApplyResult {
  /** Opérations dont le sélecteur ne trouve plus rien (mises de côté). */
  notFound: string[];
  /** Liens vers des étapes : élément → id d'étape. */
  links: Array<{ el: Element; step: string }>;
}

/**
 * Applique les opérations. Éditeur : masqué barré et estompé, supprimé estompé (réversible à
 * l'affichage). Lecteur : masqué et supprimé retirés du rendu (display: none, aria-hidden).
 * Le texte d'un élément flouté est remplacé (la source capturée l'est déjà).
 */
export function applyHtmlOps(
  doc: Document,
  ops: HtmlOp[],
  opts: {
    mode: 'editor' | 'player';
    variables?: VariableValues;
    defaults?: VariableValues;
    imageUrl?: (path: string) => string;
  },
): ApplyResult {
  const notFound: string[] = [];
  const links: ApplyResult['links'] = [];
  for (const o of ops) {
    let el: Element | null = null;
    try {
      el = doc.querySelector(o.sel);
    } catch {
      el = null;
    }
    if (!el) {
      notFound.push(o.id);
      continue;
    }
    const h = el as HTMLElement;
    switch (o.op) {
      case 'text':
        h.textContent =
          opts.mode === 'player'
            ? applyVariables(o.value ?? '', opts.variables ?? {}, opts.defaults)
            : (o.value ?? '');
        break;
      case 'blur':
        neutralizeText(el);
        h.style.filter = 'blur(6px)';
        h.setAttribute('data-fd-blurred', '');
        break;
      case 'hide':
      case 'remove':
        if (opts.mode === 'player') {
          h.style.setProperty('display', 'none', 'important');
          h.setAttribute('aria-hidden', 'true');
        } else {
          h.setAttribute(o.op === 'hide' ? 'data-fd-hidden' : 'data-fd-removed', '');
        }
        break;
      case 'link':
        h.setAttribute('data-fd-link', o.value ?? '');
        links.push({ el, step: o.value ?? '' });
        break;
      case 'image':
        if (el.tagName === 'IMG' && o.value)
          el.setAttribute('src', opts.imageUrl ? opts.imageUrl(o.value) : o.value);
        el.removeAttribute('srcset');
        break;
    }
  }
  return { notFound, links };
}

/** Annulation : retire l'opération, ou tout son groupe (« Toutes les étapes ») d'un coup. */
export function undoHtmlOp(ops: HtmlOp[], id: string): HtmlOp[] {
  const target = ops.find((o) => o.id === id);
  if (!target) return ops;
  return ops.filter((o) => (target.group ? o.group !== target.group : o.id !== id));
}
