import { foldText, toCsv } from '@flowdsiml/core';

/** L17 : import et export CSV du glossaire (colonnes nouveau, ancien, definition, formes). */

export const GLOSSARY_MAX = 500;
export const TERM_MAX = 60;
export const DEF_MAX = 140;
export const FORMS_MAX = 10;

export interface GlossaryRow {
  term: string;
  old_term: string | null;
  definition: string;
  forms: string[];
}

export type SkipReason = 'termEmpty' | 'termTooLong' | 'defEmpty' | 'defTooLong' | 'duplicate' | 'limit';

export interface ImportPreview {
  add: GlossaryRow[];
  update: GlossaryRow[];
  skipped: Array<{ line: number; reason: SkipReason }>;
}

/** Clé d'unicité d'un terme (même repli que la base : casse et accents ignorés). */
export const termKey = (s: string) => foldText(s.trim()).replace(/\s+/g, ' ');

/** Formes saisies séparées par des virgules : nettoyées, sans doublon, 10 au plus. */
export function splitForms(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of raw.split(/[,;]/)) {
    const v = f.trim().slice(0, TERM_MAX);
    const k = termKey(v);
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out.slice(0, FORMS_MAX);
}

/** CSV RFC 4180 ; séparateur deviné sur la première ligne (virgule ou point-virgule). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Protection contre les formules ajoutée à l'export (« '=… ») : retirée à l'import
  return rows.map((r) => r.map((v) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v)));
}

const HEADER = ['nouveau', 'ancien', 'definition', 'formes'];

/**
 * Aperçu d'un import : lignes à ajouter, à mettre à jour (terme déjà présent, jamais dupliqué) et
 * ignorées avec leur motif. La ligne d'en-tête est reconnue et sautée.
 */
export function previewImport(text: string, existing: Array<{ term: string }>): ImportPreview {
  const rows = parseCsv(text);
  const known = new Set(existing.map((e) => termKey(e.term)));
  const seen = new Set<string>();
  const out: ImportPreview = { add: [], update: [], skipped: [] };
  let total = existing.length;
  rows.forEach((r, i) => {
    const line = i + 1;
    if (r.every((v) => !v.trim())) return;
    if (i === 0 && termKey(r[0] ?? '') === HEADER[0]) return;
    const term = (r[0] ?? '').trim();
    const definition = (r[2] ?? '').trim();
    const reason: SkipReason | null = !term
      ? 'termEmpty'
      : term.length > TERM_MAX
        ? 'termTooLong'
        : !definition
          ? 'defEmpty'
          : definition.length > DEF_MAX
            ? 'defTooLong'
            : seen.has(termKey(term))
              ? 'duplicate'
              : null;
    if (reason) return out.skipped.push({ line, reason });
    const key = termKey(term);
    seen.add(key);
    const entry: GlossaryRow = {
      term,
      old_term: (r[1] ?? '').trim().slice(0, TERM_MAX) || null,
      definition,
      forms: splitForms(r[3] ?? ''),
    };
    if (known.has(key)) out.update.push(entry);
    else if (total >= GLOSSARY_MAX) out.skipped.push({ line, reason: 'limit' });
    else {
      total++;
      out.add.push(entry);
    }
  });
  return out;
}

/** Export : même format que l'import (relisible tel quel) ; le BOM est ajouté par downloadText. */
export function exportCsv(terms: GlossaryRow[]): string {
  return toCsv(
    HEADER,
    terms.map((x) => [x.term, x.old_term ?? '', x.definition, x.forms.join(', ')]),
  );
}
