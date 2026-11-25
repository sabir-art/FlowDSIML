import type { PxRect } from './geometry';
import {
  autocompleteType,
  inlineLabelValue,
  labelType,
  maskExcerpt,
  matchText,
  plausibleValue,
  type PiiType,
} from './pii';

/** Détection trouvée dans la page (boîte en pixels CSS du viewport). */
export interface Detection {
  type: PiiType;
  rect: PxRect;
  /** Extrait masqué (écran de vérification uniquement, jamais envoyé). */
  excerpt: string;
}

const SKIP = 'script,style,noscript,template,svg,[data-fd-ui],[aria-hidden="true"]';
const MAX_NODES = 6000;

const visible = (r: DOMRect) =>
  r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
const px = (r: DOMRect): PxRect => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Libellé associé à un champ de formulaire. */
function fieldLabel(el: HTMLElement): string {
  const id = el.id;
  const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  const wrap = el.closest('label');
  const labelledBy = el.getAttribute('aria-labelledby');
  const lb = labelledBy
    ? labelledBy
        .split(/\s+/)
        .map((x) => document.getElementById(x)?.textContent ?? '')
        .join(' ')
    : '';
  return [
    el.getAttribute('aria-label'),
    lb,
    byFor?.textContent,
    wrap?.textContent,
    el.getAttribute('placeholder'),
    el.getAttribute('name'),
    id,
  ]
    .map(clean)
    .filter(Boolean)
    .join(' | ');
}

/** Boutons, liens, onglets, entrées de menu : leur texte est une commande, jamais une valeur. */
const COMMAND =
  'button,a[href],summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="option"],[role="switch"]';

/**
 * L60 (faux positifs) : l'élément précédent n'est un libellé que s'il est affiché, s'il n'est pas une
 * commande, et s'il a la forme d'un libellé : pas une phrase (« Indiquez votre nom. »), pas un couple
 * « libellé : valeur » déjà complet (« Ville : Lyon »), quatre mots au plus.
 */
function isLabelLike(el: Element, text: string): boolean {
  if (el.matches(COMMAND) || el.closest('[hidden],[aria-hidden="true"]')) return false;
  if ((el as HTMLElement).getClientRects?.().length === 0) return false;
  if (/[.!?…]$/.test(text) || /:\s*\S/.test(text)) return false;
  return text.split(' ').length <= 4;
}

/** Libellé de contexte d'un texte affiché : en-tête de colonne, terme <dt>, libellé voisin. */
function contextLabel(el: Element): string {
  const cell = el.closest('td,[role="cell"],[role="gridcell"]');
  if (cell) {
    const row = cell.parentElement;
    const table = cell.closest('table,[role="table"],[role="grid"]');
    const idx = row ? Array.prototype.indexOf.call(row.children, cell) : -1;
    const head = table?.querySelector('thead tr, [role="row"]');
    const th = idx >= 0 && head && head !== row ? head.children[idx] : null;
    if (th) return clean(th.textContent);
  }
  const dd = el.closest('dd');
  if (dd) {
    let p = dd.previousElementSibling;
    while (p && p.tagName !== 'DT') p = p.previousElementSibling;
    if (p) return clean(p.textContent);
  }
  // Libellé court juste avant (« Nom » puis la valeur dans l'élément suivant)
  let host: Element | null = el;
  for (let i = 0; i < 2 && host; i++) {
    const prev = host.previousElementSibling;
    const t = clean(prev?.textContent);
    // Un libellé, pas une donnée : court, sans chiffre ni @
    if (prev && t && t.length <= 30 && !/[\d@]/.test(t) && isLabelLike(prev, t)) return t;
    host = host.parentElement;
  }
  return '';
}

function rangeRects(node: Text, start: number, end: number): DOMRect[] {
  const r = document.createRange();
  r.setStart(node, start);
  r.setEnd(node, end);
  return Array.from(r.getClientRects()).filter(visible);
}

/** Repérage brut : élément (champ, zone imposée) ou nœud texte avec la plage concernée. */
type Hit = (
  | { type: PiiType; el: HTMLElement; value: string }
  | { type: PiiType; node: Text; start: number; end: number; value: string }
) & {
  /** EXT-02 §4.4 : comment la donnée a été repérée (« Pourquoi masqué ? »), et le libellé qui a servi. */
  by: 'field' | 'label' | 'pattern' | 'zone';
  label?: string;
};

/**
 * Parcours commun : zones imposées, champs remplis, texte affiché. visibleOnly limite au viewport
 * (captures en image) ; sans lui, tout le document est parcouru (capture HTML, A8).
 */
function walk(root: ParentNode, visibleOnly: boolean, emit: (h: Hit) => void): void {
  const shown = (el: Element) => !visibleOnly || visible(el.getBoundingClientRect());
  // 1) Zones imposées et champs de formulaire
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-fd-blur]')))
    if (shown(el)) emit({ type: 'zone', el, value: '', by: 'zone' });
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('input,textarea,select'))) {
    if (el.closest(SKIP)) continue;
    const input = el as HTMLInputElement;
    const kind = (input.type || '').toLowerCase();
    if (
      [
        'hidden',
        'submit',
        'button',
        'reset',
        'checkbox',
        'radio',
        'file',
        'image',
        'range',
        'color',
      ].includes(kind)
    )
      continue;
    if (!shown(el)) continue;
    if (kind === 'password') {
      emit({ type: 'zone', el, value: '', by: 'zone' });
      continue;
    }
    const value =
      el instanceof HTMLSelectElement ? clean(el.selectedOptions[0]?.textContent) : clean(input.value);
    const byAc = autocompleteType(el.getAttribute('autocomplete'));
    if (byAc === 'zone') {
      emit({ type: 'zone', el, value: '', by: 'zone' });
      continue;
    }
    if (!value) continue; // champ vide : rien à cacher
    const label = fieldLabel(el);
    const type = byAc ?? labelType(label) ?? matchText(value)[0]?.type ?? null;
    if (type) emit({ type, el, value, by: 'field', label: clean(label).slice(0, 80) || undefined });
  }

  // 2) Texte affiché
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = 0;
  const max = visibleOnly ? MAX_NODES : MAX_NODES * 10;
  for (
    let node = walker.nextNode() as Text | null;
    node && n < max;
    node = walker.nextNode() as Text | null
  ) {
    const text = node.data;
    const parent = node.parentElement;
    if (
      !parent ||
      text.trim().length < 2 ||
      parent.closest(SKIP) ||
      parent.closest('input,textarea,select,label,th,thead,[role="columnheader"]')
    )
      continue;
    n++;
    // Le texte d'une commande (bouton, lien, onglet) n'est pas la valeur du libellé voisin ; les motifs
    // (adresse e-mail, téléphone…) y restent cherchés
    const ctx = parent.closest(COMMAND) ? '' : contextLabel(parent);
    const ctxType = labelType(ctx);
    const trimmed = text.trim();
    // La valeur doit avoir la forme de la donnée annoncée : « Statut » après « Nom » est un autre
    // en-tête, « Lyon » après « Ville » une ville seule (lisible)
    if (ctxType && trimmed.length <= 120 && !labelType(trimmed) && plausibleValue(ctxType, trimmed)) {
      const start = text.indexOf(trimmed);
      emit({
        type: ctxType,
        node,
        start,
        end: start + trimmed.length,
        value: trimmed,
        by: 'label',
        label: clean(ctx).slice(0, 80) || undefined,
      });
      continue;
    }
    const found = inlineLabelValue(text);
    const inline = found && plausibleValue(found.type, text.slice(found.start, found.end)) ? found : null;
    const matches = inline ? [inline] : matchText(text, ctx);
    for (const m of matches)
      emit({
        type: m.type,
        node,
        start: m.start,
        end: m.end,
        value: text.slice(m.start, m.end),
        by: 'pattern',
      });
  }
}

/**
 * Analyse le viewport visible. Les valeurs ne sont lues que pour être comparées aux motifs, dans
 * la page ; seul un extrait masqué en sort, vers l'écran de vérification local.
 */
export function scanPage(root: ParentNode = document.body): Detection[] {
  const out: Detection[] = [];
  const push = (type: PiiType, rect: DOMRect, value: string) =>
    out.push({ type, rect: px(rect), excerpt: type === 'zone' ? '' : maskExcerpt(type, value) });
  walk(root, true, (h) => {
    if ('el' in h) push(h.type, h.el.getBoundingClientRect(), h.value);
    else for (const rect of rangeRects(h.node, h.start, h.end)) push(h.type, rect, h.value);
  });
  return dedupe(out);
}

/**
 * L25-01 : repérage sur tout le document, pour la capture pleine page. Boîtes en pixels CSS du
 * document (défilement ajouté) ; seuls le type et la boîte en sortent, jamais la valeur.
 */
export function scanFullPage(root: ParentNode = document.body): { type: PiiType; rect: PxRect }[] {
  const out: { type: PiiType; rect: PxRect }[] = [];
  const push = (type: PiiType, r: DOMRect) => {
    if (r.width > 1 && r.height > 1)
      out.push({
        type,
        rect: { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height },
      });
  };
  walk(root, false, (h) => {
    if ('el' in h) push(h.type, h.el.getBoundingClientRect());
    else {
      const r = document.createRange();
      r.setStart(h.node, h.start);
      r.setEnd(h.node, h.end);
      for (const rect of Array.from(r.getClientRects())) push(h.type, rect);
    }
  });
  return out;
}

/** A8 : repérage sur tout le document (capture HTML) ; renvoie les nœuds, jamais les valeurs. */
export interface NodeDetection {
  type: PiiType;
  /** Élément (champ, zone imposée) ou parent du texte repéré. */
  el: Element;
  /** Nœud texte concerné et plage (absent pour un champ ou une zone). */
  node?: Text;
  start?: number;
  end?: number;
  /** Valeur lue dans la page : elle n'en sort jamais telle quelle (extrait masqué, empreinte). */
  value: string;
  by: 'field' | 'label' | 'pattern' | 'zone';
  label?: string;
}
export function scanNodes(root: ParentNode = document.body): NodeDetection[] {
  const out: NodeDetection[] = [];
  walk(root, false, (h) => {
    const more = { value: h.value, by: h.by, label: h.label };
    if ('el' in h) out.push({ type: h.type, el: h.el, ...more });
    else if (h.node.parentElement)
      out.push({ type: h.type, el: h.node.parentElement, node: h.node, start: h.start, end: h.end, ...more });
  });
  return out;
}

/** Retire les boîtes contenues dans une autre boîte déjà détectée. */
function dedupe(list: Detection[]): Detection[] {
  const inside = (a: PxRect, b: PxRect) =>
    a.left >= b.left - 1 &&
    a.top >= b.top - 1 &&
    a.left + a.width <= b.left + b.width + 1 &&
    a.top + a.height <= b.top + b.height + 1;
  return list.filter(
    (d, i) => !list.some((o, j) => j !== i && inside(d.rect, o.rect) && (j < i || !inside(o.rect, d.rect))),
  );
}
