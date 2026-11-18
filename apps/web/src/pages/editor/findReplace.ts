/**
 * L12-04 : rechercher et remplacer dans les textes de la démo. Les variables {{…}} ne sont jamais
 * touchées : une occurrence qui chevauche une variable est ignorée.
 */
export type FindScope = 'all' | 'bubbles' | 'titles';
export type FindOptions = { caseSensitive: boolean; wholeWord: boolean; scope: FindScope };

/** Champ texte modifiable : colonne d'une ligne, ou clé dans steps.options. */
export type FieldRef = {
  table: 'steps' | 'hotspots';
  id: string;
  field: 'title' | 'body' | 'options.buttonLabel' | 'options.prevLabel' | 'cta.label';
  kind: 'bubble' | 'title' | 'button';
};
export type TextField = FieldRef & { stepIndex: number; text: string };
export type Match = TextField & { start: number; end: number };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VAR = /\{\{[^}]*\}\}/g;

export function inScope(kind: FieldRef['kind'], scope: FindScope): boolean {
  if (scope === 'all') return true;
  return scope === 'bubbles' ? kind === 'bubble' : kind === 'title';
}

function pattern(query: string, o: FindOptions): RegExp | null {
  if (!query) return null;
  const body = escape(query);
  const src = o.wholeWord ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body;
  return new RegExp(src, `gu${o.caseSensitive ? '' : 'i'}`);
}

/** Occurrences dans un texte, hors variables. */
export function findIn(text: string, query: string, o: FindOptions): Array<[number, number]> {
  const re = pattern(query, o);
  if (!re) return [];
  const vars = [...text.matchAll(VAR)].map((m) => [m.index!, m.index! + m[0].length] as const);
  const out: Array<[number, number]> = [];
  for (const m of text.matchAll(re)) {
    const s = m.index!;
    const e = s + m[0].length;
    if (e === s) continue;
    if (vars.some(([a, b]) => s < b && e > a)) continue;
    out.push([s, e]);
  }
  return out;
}

export function findAll(fields: TextField[], query: string, o: FindOptions): Match[] {
  return fields
    .filter((f) => inScope(f.kind, o.scope))
    .flatMap((f) => findIn(f.text, query, o).map(([start, end]) => ({ ...f, start, end })));
}

/** Remplace toutes les occurrences (hors variables) d'un texte. */
export function replaceIn(text: string, query: string, by: string, o: FindOptions): string {
  const hits = findIn(text, query, o);
  let out = text;
  for (const [s, e] of [...hits].reverse()) out = out.slice(0, s) + by + out.slice(e);
  return out;
}

/** Remplace une seule occurrence. */
export function replaceAt(text: string, start: number, end: number, by: string): string {
  return text.slice(0, start) + by + text.slice(end);
}

/** Extrait autour d'une occurrence, pour la liste des résultats. */
export function snippet(text: string, start: number, end: number, around = 32) {
  const plain = (s: string) => s.replace(/\*\*|\*/g, '');
  const a = Math.max(0, start - around);
  const b = Math.min(text.length, end + around);
  return {
    before: (a > 0 ? '…' : '') + plain(text.slice(a, start)),
    hit: plain(text.slice(start, end)),
    after: plain(text.slice(end, b)) + (b < text.length ? '…' : ''),
  };
}
