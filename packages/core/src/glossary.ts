/**
 * L17 : repérage des termes du glossaire dans le texte d'une étape.
 * Règles (spec l17-formation-plus) : mot entier (pluriel simple en s ou x compris), insensible à la
 * casse et aux accents, première
 * occurrence de chaque terme par étape, jamais dans une valeur de variable ni dans un lien ;
 * l'ancien terme n'est jamais souligné (seuls le terme et ses autres formes sont cherchés).
 */

export interface GlossaryEntry {
  term: string;
  oldTerm?: string | null;
  definition: string;
  forms?: string[];
}

/** Bornes d'une valeur de variable insérée (caractères à usage privé, retirés à la sortie). */
export const VAR_OPEN = '';
export const VAR_CLOSE = '';

/** Repli d'un caractère : minuscules, sans accents. Un caractère donne toujours un caractère. */
function foldChar(ch: string): string {
  const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return f.length === 1 ? f : ch.toLowerCase().length === 1 ? ch.toLowerCase() : ch;
}

/** Repli d'une chaîne, même longueur que l'entrée (indices conservés). */
export function foldText(s: string): string {
  let out = '';
  for (const ch of s) {
    const f = foldChar(ch);
    // Un caractère hors BMP reste tel quel : sa longueur en unités UTF-16 est conservée.
    out += f.length === ch.length ? f : ch;
  }
  return out;
}

const WORD = /[\p{L}\p{N}_]/u;
const isWord = (c: string | undefined) => !!c && WORD.test(c);

interface Needle {
  folded: string;
  index: number;
}

export function buildNeedles(entries: GlossaryEntry[], escape: (s: string) => string = (s) => s): Needle[] {
  const seen = new Set<string>();
  const out: Needle[] = [];
  entries.forEach((e, index) => {
    for (const raw of [e.term, ...(e.forms ?? [])]) {
      const folded = foldText(escape(raw.trim()));
      if (!folded || seen.has(folded)) continue;
      seen.add(folded);
      out.push({ folded, index });
    }
  });
  // Le plus long d'abord : « dossier unique » l'emporte sur « dossier » à la même position.
  return out.sort((a, b) => b.folded.length - a.folded.length);
}

export interface TermMatch {
  start: number;
  end: number;
  index: number;
}

/**
 * Occurrences à souligner dans `text` (texte brut, déjà replié ou non). `used` : termes déjà
 * soulignés dans l'étape (mis à jour). Les plages entre VAR_OPEN et VAR_CLOSE sont ignorées.
 */
export function findTerms(text: string, needles: Needle[], used: Set<number>): TermMatch[] {
  const folded = foldText(text);
  const out: TermMatch[] = [];
  let pos = 0;
  while (pos < folded.length) {
    let best: TermMatch | null = null;
    for (const n of needles) {
      if (used.has(n.index)) continue;
      let from = pos;
      while (from < folded.length) {
        const at = folded.indexOf(n.folded, from);
        if (at < 0) break;
        let end = at + n.folded.length;
        // Pluriel simple : « rapport » reconnaît « rapports », « tableau » reconnaît « tableaux »
        if ((folded[end] === 's' || folded[end] === 'x') && !isWord(folded[end + 1])) end += 1;
        if (!isWord(folded[at - 1]) && !isWord(folded[end]) && !insideVar(text, at)) {
          if (!best || at < best.start || (at === best.start && end > best.end))
            best = { start: at, end, index: n.index };
          break;
        }
        from = at + 1;
      }
    }
    if (!best) break;
    out.push(best);
    used.add(best.index);
    pos = best.end;
  }
  return out;
}

function insideVar(text: string, at: number): boolean {
  const open = text.lastIndexOf(VAR_OPEN, at);
  if (open < 0) return false;
  const close = text.lastIndexOf(VAR_CLOSE, at);
  return close < open;
}

/**
 * Applique le soulignement à un HTML produit par richTextToHtml (texte échappé, quelques balises) :
 * seuls les nœuds texte hors <a> sont examinés. Chaque terme devient
 * <span class="p-term" tabindex="0" data-term="i">…</span>. Les bornes de variable sont retirées.
 */
export function markTermsInHtml(html: string, needles: Needle[], used: Set<number>): string {
  const parts = html.split(/(<[^>]*>)/);
  let inLink = 0;
  let out = '';
  for (const part of parts) {
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part)) inLink++;
      else if (/^<\/a>/i.test(part)) inLink = Math.max(0, inLink - 1);
      out += part;
      continue;
    }
    if (inLink || !needles.length) {
      out += part;
      continue;
    }
    let last = 0;
    for (const m of findTerms(part, needles, used)) {
      out += part.slice(last, m.start);
      out += `<span class="p-term" tabindex="0" data-term="${m.index}">${part.slice(m.start, m.end)}</span>`;
      last = m.end;
    }
    out += part.slice(last);
  }
  return out.replace(/[]/g, '');
}

/** Index des termes présents dans un ensemble de textes (tiroir « Glossaire » du lecteur). */
export function termsPresent(texts: string[], needles: Needle[]): Set<number> {
  const found = new Set<number>();
  for (const t of texts) {
    const used = new Set(found);
    for (const m of findTerms(t, needles, used)) found.add(m.index);
  }
  return found;
}
