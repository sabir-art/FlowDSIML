/**
 * L22-07 : mentions @ dans les commentaires.
 * Stockage : « @[Prénom Nom](uuid) » (format lu par le déclencheur notify_comment).
 * Saisie : le champ montre « @Prénom Nom » ; la liste des mentions insérées garde l'uuid.
 */

export interface Mention {
  name: string;
  id: string;
}

export type BodyPart = { text: string } | { mention: string; userId: string };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const STORED = new RegExp(`@\\[([^\\]]{1,80})\\]\\((${UUID})\\)`, 'g');

/** Message stocké → texte et pastilles. */
export function bodyParts(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  for (const m of body.matchAll(STORED)) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) });
    parts.push({ mention: m[1] ?? '', userId: m[2] ?? '' });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

/** Message stocké → texte du champ (« @Nom ») et mentions connues, pour modifier un commentaire. */
export function toDraft(body: string): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  const text = bodyParts(body)
    .map((p) => {
      if ('text' in p) return p.text;
      if (!mentions.some((m) => m.id === p.userId)) mentions.push({ name: p.mention, id: p.userId });
      return `@${p.mention}`;
    })
    .join('');
  return { text, mentions };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** « @Nom » en début de texte ou après un blanc, suivi d'une fin de mot. */
const tokenRe = (name: string, flags = 'g') =>
  new RegExp(`(^|\\s)@${esc(name)}(?![\\p{L}\\p{N}_-])`, `${flags}u`);

/** Texte du champ → message stocké. Seules les mentions insérées depuis la liste deviennent des mentions. */
export function serialize(text: string, mentions: Mention[]): string {
  // Les noms les plus longs d'abord (« Marie Durand » avant « Marie »)
  return [...mentions]
    .filter((m) => m.name && !/[[\]]/.test(m.name))
    .sort((a, b) => b.name.length - a.name.length)
    .reduce(
      (out, m) => out.replace(tokenRe(m.name), (_all, pre: string) => `${pre}@[${m.name}](${m.id})`),
      text,
    );
}

/** Segments pour le calque d'affichage du champ : pastilles sur les « @Nom » insérés. */
export function draftParts(text: string, mentions: Mention[]): BodyPart[] {
  return bodyParts(serialize(text, mentions));
}

/** « @requête » en cours de saisie juste avant le curseur, ou null. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]{0,30}(?: [^\s@]{0,30})?)$/u.exec(before);
  if (!m) return null;
  return { start: caret - m[2]!.length - 1, query: m[2]! };
}

/** Remplace « @requête » par « @Nom  » et place le curseur après l'espace. */
export function insertMention(text: string, start: number, caret: number, name: string) {
  const ins = `@${name} `;
  const next = text.slice(0, start) + ins + text.slice(caret).replace(/^ /, '');
  return { text: next, caret: start + ins.length };
}

/** Retour arrière juste après une mention : elle part d'un seul coup. */
export function backspaceMention(text: string, caret: number, mentions: Mention[]) {
  const before = text.slice(0, caret);
  for (const m of [...mentions].sort((a, b) => b.name.length - a.name.length)) {
    const token = `@${m.name}`;
    if (before.endsWith(token)) {
      const start = caret - token.length;
      if (start === 0 || /\s/.test(text[start - 1] ?? ''))
        return { text: text.slice(0, start) + text.slice(caret), caret: start };
    }
  }
  return null;
}

/** Filtre de la liste : début du prénom, du nom ou de l'e-mail, sans accents ni casse. */
export function matchesMember(query: string, name: string, email: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  return [...norm(name).split(/\s+/), norm(name), norm(email)].some((w) => w.startsWith(q));
}
