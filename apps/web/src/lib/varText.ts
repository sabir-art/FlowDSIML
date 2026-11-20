/**
 * L46 : conversion entre le format stocké des textes (inchangé, lu par le lecteur, les exports et les
 * liens personnalisés) et le document de l'éditeur riche (TipTap / ProseMirror, JSON).
 *   **gras**  *italique*  [texte](url)  {{clé}}  {{clé|repli}}  retour à la ligne : \n
 * Un texte existant relu puis réenregistré sans modification est identique (test aller-retour) : une
 * variable garde son écriture d'origine (`raw`) tant que son repli n'a pas changé.
 */

export interface Mark {
  type: 'bold' | 'italic' | 'link';
  attrs?: { href: string };
}
export type Inline =
  | { type: 'text'; text: string; marks?: Mark[] }
  | { type: 'hardBreak' }
  | { type: 'variable'; attrs: { key: string; fallback: string | null; raw: string }; marks?: Mark[] };
export interface Doc {
  type: 'doc';
  content: Array<{ type: 'paragraph'; content?: Inline[] }>;
}

const VAR = /^\{\{\s*([a-z][a-z0-9_]{0,39})\s*(?:\|([^}]*))?\}\}/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)/;
const BOLD = /^\*\*([^*]+)\*\*/;
const ITALIC = /^\*([^*]+)\*/;

/** Variable stockée telle qu'elle doit s'écrire (forme d'origine si le repli n'a pas changé). */
export function varSource(a: { key: string; fallback: string | null; raw?: string }): string {
  if (a.raw) {
    const m = VAR.exec(a.raw);
    if (m && m[1] === a.key && (m[2] ?? null) === a.fallback) return a.raw;
  }
  return a.fallback !== null && a.fallback !== '' ? `{{${a.key}|${a.fallback}}}` : `{{${a.key}}}`;
}

function parseInline(src: string, marks: Mark[], out: Inline[]) {
  let text = '';
  const flush = () => {
    if (text) out.push(marks.length ? { type: 'text', text, marks } : { type: 'text', text });
    text = '';
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if (rest[0] === '\n') {
      flush();
      out.push({ type: 'hardBreak' });
      i += 1;
    } else if ((m = VAR.exec(rest))) {
      flush();
      const v: Inline = {
        type: 'variable',
        attrs: { key: m[1]!, fallback: m[2] ?? null, raw: m[0] },
      };
      if (marks.length) v.marks = marks;
      out.push(v);
      i += m[0].length;
    } else if (!marks.some((k) => k.type === 'link') && (m = LINK.exec(rest))) {
      flush();
      parseInline(m[1]!, [...marks, { type: 'link', attrs: { href: m[2]! } }], out);
      i += m[0].length;
    } else if (!marks.some((k) => k.type === 'bold') && (m = BOLD.exec(rest))) {
      flush();
      parseInline(m[1]!, [...marks, { type: 'bold' }], out);
      i += m[0].length;
    } else if (!marks.some((k) => k.type === 'italic') && (m = ITALIC.exec(rest))) {
      flush();
      parseInline(m[1]!, [...marks, { type: 'italic' }], out);
      i += m[0].length;
    } else {
      text += rest[0];
      i += 1;
    }
  }
  flush();
}

/** Texte stocké → document de l'éditeur (un paragraphe, retours à la ligne en hardBreak). */
export function parseVarText(src: string): Doc {
  const content: Inline[] = [];
  parseInline(src, [], content);
  return { type: 'doc', content: [content.length ? { type: 'paragraph', content } : { type: 'paragraph' }] };
}

const has = (n: Inline, t: Mark['type']) =>
  n.type !== 'hardBreak' && (n.marks ?? []).some((m) => m.type === t);
const href = (n: Inline) =>
  n.type === 'hardBreak' ? null : ((n.marks ?? []).find((m) => m.type === 'link')?.attrs?.href ?? null);

const plain = (n: Inline): string =>
  n.type === 'text' ? n.text : n.type === 'hardBreak' ? '\n' : varSource(n.attrs);

/** Regroupe par niveau (lien, puis gras, puis italique) : « [Voir **le guide**](url) » reste intact. */
function emit(nodes: Inline[], level: 0 | 1 | 2 | 3): string {
  if (level === 3) return nodes.map(plain).join('');
  const keyOf = (n: Inline): string | null =>
    level === 0 ? href(n) : level === 1 ? (has(n, 'bold') ? 'b' : null) : has(n, 'italic') ? 'i' : null;
  let out = '';
  let i = 0;
  while (i < nodes.length) {
    const k = keyOf(nodes[i]!);
    const group: Inline[] = [];
    while (i < nodes.length && keyOf(nodes[i]!) === k) group.push(nodes[i++]!);
    const inner = emit(group, (level + 1) as 1 | 2 | 3);
    out +=
      k === null ? inner : level === 0 ? `[${inner}](${k})` : level === 1 ? `**${inner}**` : `*${inner}*`;
  }
  return out;
}

/** Document de l'éditeur → texte stocké. Les paragraphes sont séparés par un retour à la ligne. */
export function serializeVarText(doc: { content?: Array<{ content?: Inline[] }> }): string {
  return (doc.content ?? []).map((p) => emit(p.content ?? [], 0)).join('\n');
}
