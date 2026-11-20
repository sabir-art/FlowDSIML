import { applyVariables, type VariableValues } from './variables';

/**
 * A8 (L20) : modifications d'une étape HTML, stockées comme opérations (sélecteur + action +
 * valeur) et non comme un DOM réécrit. Elles survivent à une nouvelle capture : un sélecteur qui ne
 * trouve plus rien est mis de côté (notFound), sans bloquer la publication.
 */
export type HtmlOpKind = 'text' | 'hide' | 'blur' | 'link' | 'image' | 'remove' | 'style' | 'chart' | 'mask';

/**
 * L25-07 : style posé en masse. Liste blanche stricte (aucune chaîne CSS libre) : couleurs en
 * #RRGGBB, taille de 8 à 96 px, graisse 400, 600 ou 700.
 */
export interface HtmlStyle {
  color?: string;
  background?: string;
  fontSize?: number;
  fontWeight?: '400' | '600' | '700';
}
export const STYLE_KEYS = ['color', 'fontSize', 'fontWeight', 'background'] as const;
export const FONT_WEIGHTS = ['400', '600', '700'] as const;
export const STYLE_SELS_MAX = 200;

/** L25-08 : graphique redessiné (12 lignes au plus, valeurs numériques). */
export type ChartType = 'bar' | 'line' | 'donut';
export interface HtmlChart {
  type: ChartType;
  rows: Array<{ label: string; value: number }>;
  title?: string;
}
export const CHART_ROWS_MAX = 12;

export interface HtmlOp {
  id: string;
  sel: string;
  op: HtmlOpKind;
  /** L25-07 : style seulement, tous les éléments touchés (sel = le premier). */
  sels?: string[];
  /**
   * text : nouveau texte (variables {{…}} permises) ; link : id de l'étape ; image : chemin ;
   * style : propriétés en liste blanche ; chart : type et valeurs.
   */
  value?: string | HtmlStyle | HtmlChart;
  /** L28-05 : image remplacée : « contain » (Ajuster, par défaut) ou « cover » (Remplir). */
  fit?: 'contain' | 'cover';
  /** Valeur avant modification (texte d'origine, affiché dans la liste « avant → après »). */
  before?: string;
  /** « Toutes les étapes » : même groupe sur chaque étape, une seule annulation. */
  scope: 'step' | 'all';
  group?: string;
}

/** Pixel transparent (« Masquer l'image ») : l'élément garde sa place, sans l'image d'origine. */
export const TRANSPARENT_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const HTML_OPS_MAX = 500;
export const HTML_MAX_BYTES = 10 * 1024 * 1024;
const KINDS: readonly HtmlOpKind[] = [
  'text',
  'hide',
  'blur',
  'link',
  'image',
  'remove',
  'style',
  'chart',
  'mask',
];
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** L25-07 : même règle que html_style_ok (base). */
export function validStyle(v: unknown): v is HtmlStyle {
  if (!isObj(v)) return false;
  if (Object.keys(v).some((k) => !(STYLE_KEYS as readonly string[]).includes(k))) return false;
  for (const k of ['color', 'background'] as const)
    if (v[k] !== undefined && (typeof v[k] !== 'string' || !HEX_RE.test(v[k] as string))) return false;
  if (
    v.fontSize !== undefined &&
    (typeof v.fontSize !== 'number' || !Number.isFinite(v.fontSize) || v.fontSize < 8 || v.fontSize > 96)
  )
    return false;
  if (v.fontWeight !== undefined && !(FONT_WEIGHTS as readonly unknown[]).includes(v.fontWeight))
    return false;
  return true;
}

/** L25-08 : même règle que html_chart_ok (base). */
export function validChart(v: unknown): v is HtmlChart {
  if (!isObj(v)) return false;
  if (Object.keys(v).some((k) => !['type', 'rows', 'title'].includes(k))) return false;
  if (!['bar', 'line', 'donut'].includes(v.type as string)) return false;
  if (v.title !== undefined && (typeof v.title !== 'string' || v.title.length > 120)) return false;
  if (!Array.isArray(v.rows) || v.rows.length < 1 || v.rows.length > CHART_ROWS_MAX) return false;
  return v.rows.every(
    (r) =>
      isObj(r) &&
      Object.keys(r).every((k) => k === 'label' || k === 'value') &&
      typeof r.label === 'string' &&
      r.label.length <= 40 &&
      typeof r.value === 'number' &&
      Number.isFinite(r.value),
  );
}

/** Validation (même règle que la base) : forme stricte, sélecteur borné, aucune clé en trop. */
export function validHtmlOps(ops: unknown): ops is HtmlOp[] {
  if (!Array.isArray(ops) || ops.length > HTML_OPS_MAX) return false;
  return ops.every((o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    const r = o as Record<string, unknown>;
    const allowed = ['id', 'sel', 'sels', 'op', 'value', 'before', 'scope', 'group', 'fit'];
    if (Object.keys(r).some((k) => !allowed.includes(k))) return false;
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return false;
    if (typeof r.sel !== 'string' || r.sel.length < 1 || r.sel.length > 500) return false;
    if (!KINDS.includes(r.op as HtmlOpKind)) return false;
    if (r.scope !== 'step' && r.scope !== 'all') return false;
    if (r.group !== undefined && (typeof r.group !== 'string' || !ID_RE.test(r.group))) return false;
    if (
      r.sels !== undefined &&
      (r.op !== 'style' ||
        !Array.isArray(r.sels) ||
        r.sels.length < 1 ||
        r.sels.length > STYLE_SELS_MAX ||
        !r.sels.every((x) => typeof x === 'string' && x.length >= 1 && x.length <= 500))
    )
      return false;
    if (r.op === 'style') {
      if (!validStyle(r.value)) return false;
    } else if (r.op === 'chart') {
      if (!validChart(r.value)) return false;
    } else if (r.value !== undefined && (typeof r.value !== 'string' || r.value.length > 5000)) return false;
    if (r.before !== undefined && (typeof r.before !== 'string' || r.before.length > 5000)) return false;
    if ((r.op === 'text' || r.op === 'link' || r.op === 'image') && typeof r.value !== 'string') return false;
    if (r.fit !== undefined && (r.op !== 'image' || (r.fit !== 'contain' && r.fit !== 'cover'))) return false;
    if (r.op === 'mask' && r.value !== undefined) return false;
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
            ? applyVariables(String(o.value ?? ''), opts.variables ?? {}, opts.defaults)
            : String(o.value ?? '');
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
      case 'link': {
        const step = typeof o.value === 'string' ? o.value : '';
        h.setAttribute('data-fd-link', step);
        links.push({ el, step });
        break;
      }
      case 'image':
        if (el.tagName === 'IMG' && typeof o.value === 'string' && o.value) {
          el.setAttribute('src', opts.imageUrl ? opts.imageUrl(o.value) : o.value);
          h.style.setProperty('object-fit', o.fit === 'cover' ? 'cover' : 'contain');
        }
        el.removeAttribute('srcset');
        break;
      case 'mask':
        // L28-05 : l'image d'origine n'est plus servie ; aplat transparent sur le fond de la page
        if (el.tagName === 'IMG') {
          el.setAttribute('src', TRANSPARENT_GIF);
          el.removeAttribute('srcset');
          el.setAttribute('alt', '');
          h.setAttribute('data-fd-masked', '');
        }
        break;
      case 'style':
        for (const s of o.sels ?? [o.sel]) {
          let t: Element | null = null;
          try {
            t = doc.querySelector(s);
          } catch {
            t = null;
          }
          if (t) applyStyle(t as HTMLElement, o.value);
        }
        break;
    }
  }
  return { notFound, links };
}

/** L25-07 : pose les seules propriétés de la liste blanche, revalidées (jamais de CSS libre). */
export function applyStyle(h: HTMLElement, v: unknown): void {
  if (!validStyle(v)) return;
  if (v.color) h.style.setProperty('color', v.color);
  if (v.background) h.style.setProperty('background-color', v.background);
  if (v.fontSize) h.style.setProperty('font-size', `${Math.round(v.fontSize)}px`);
  if (v.fontWeight) h.style.setProperty('font-weight', v.fontWeight);
}

/** Annulation : retire l'opération, ou tout son groupe (« Toutes les étapes ») d'un coup. */
export function undoHtmlOp(ops: HtmlOp[], id: string): HtmlOp[] {
  const target = ops.find((o) => o.id === id);
  if (!target) return ops;
  return ops.filter((o) => (target.group ? o.group !== target.group : o.id !== id));
}
