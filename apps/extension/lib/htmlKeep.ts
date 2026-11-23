/**
 * EXT-02 §2.3 : « Garder » une donnée personnelle remplacée. À la capture, le texte d'origine de chaque
 * donnée est mis de côté dans le navigateur (jamais affiché, jamais envoyé tel quel) et son élément porte
 * `data-fd-pii`. À l'envoi, seules les données gardées sont rétablies dans la copie ; les marques sont
 * retirées dans tous les cas.
 */
export type PiiOriginal =
  /** Élément entier remplacé (champ, zone) : ses nœuds texte dans l'ordre, et sa valeur s'il en a une. */
  | { texts: string[]; value?: string }
  /** Extrait d'un texte : valeur masquée, texte d'origine, rang du nœud texte dans l'élément et position. */
  | { masked: string; original: string; node: number; start: number };

export const PII_ATTR = 'data-fd-pii';
const MARK_RE = new RegExp(` ${PII_ATTR}="[^"]*"`, 'g');
const BLUR_RE = /;?\s*filter:\s*blur\([^)]*\)\s*!important/g;

const textNodes = (el: Element): Text[] => {
  const out: Text[] = [];
  const w = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n as Text);
  return out;
};

/** Remet le texte d'origine à sa place, si la valeur masquée s'y trouve toujours. */
function restoreSlice(el: Element, o: Extract<PiiOriginal, { masked: string }>): boolean {
  const t = textNodes(el)[o.node];
  if (!t || !o.masked || t.data.slice(o.start, o.start + o.masked.length) !== o.masked) return false;
  t.data = t.data.slice(0, o.start) + o.original + t.data.slice(o.start + o.masked.length);
  return true;
}

/**
 * Rétablit dans le document les données gardées, puis retire les marques. Le flou d'un élément tombe
 * quand toutes ses données sont gardées. Renvoie le nombre de données rétablies.
 */
export function restorePiiIn(doc: Document, originals: Record<string, PiiOriginal>, keep: Iterable<string>) {
  const kept = new Set(keep);
  let restored = 0;
  for (const el of [...doc.querySelectorAll(`[${PII_ATTR}]`)]) {
    const ids = (el.getAttribute(PII_ATTR) ?? '').split(/\s+/).filter(Boolean);
    const mine = ids.filter((id) => kept.has(id) && originals[id]);
    // Du dernier au premier : les positions des extraits d'un même nœud restent justes
    const slices = mine
      .map((id) => originals[id]!)
      .filter((o): o is Extract<PiiOriginal, { masked: string }> => 'masked' in o)
      .sort((a, b) => b.node - a.node || b.start - a.start);
    for (const o of slices) if (restoreSlice(el, o)) restored++;
    for (const id of mine) {
      const o = originals[id]!;
      if ('masked' in o) continue;
      const nodes = textNodes(el);
      if (nodes.length === o.texts.length) nodes.forEach((n, i) => (n.data = o.texts[i]!));
      if (o.value !== undefined && el.hasAttribute('value')) el.setAttribute('value', o.value);
      restored++;
    }
    if (ids.length && mine.length === ids.length) {
      const style = (el.getAttribute('style') ?? '').replace(BLUR_RE, '');
      if (style.replace(/[;\s]/g, '')) el.setAttribute('style', style);
      else el.removeAttribute('style');
      el.removeAttribute('data-fd-blurred');
    }
    el.removeAttribute(PII_ATTR);
  }
  return restored;
}

/** Même chose sur la page sérialisée. */
export function restorePii(html: string, originals: Record<string, PiiOriginal> | undefined, keep: string[]) {
  // Rien à rétablir : seules les marques de travail sont retirées (elles ne portent que des identifiants)
  if (!originals || !keep.length) return { html: html.replace(MARK_RE, ''), restored: 0 };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const restored = restorePiiIn(doc, originals, keep);
  return { html: `<!doctype html>\n${doc.documentElement.outerHTML}`, restored };
}
