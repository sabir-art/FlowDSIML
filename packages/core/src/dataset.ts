/**
 * L25-09 : jeu de données CSV d'une démo (lecture côté navigateur). Données fictives ou agrégées
 * uniquement : une colonne qui ressemble à des e-mails, des téléphones ou des identifiants est
 * refusée (même détection que F1 §1) ; la base refait le contrôle des cellules (dataset_ok).
 */
import { labelType, matchText, type PiiType } from './pii';

export const DATASET_MAX_BYTES = 500 * 1024;
export const DATASET_MAX_ROWS = 1000;
export const DATASET_MAX_COLUMNS = 20;
export const DATASET_MAX_CELL = 200;
export const DATASET_MAX_HEADER = 60;

export type CsvEncoding = 'UTF-8' | 'Windows-1252';
export type CsvSeparator = ';' | ',';

export interface ParsedDataset {
  columns: string[];
  rows: string[][];
  separator: CsvSeparator;
  encoding: CsvEncoding;
}

export type DatasetError =
  | { code: 'empty' }
  | { code: 'tooBig' }
  | { code: 'tooManyRows' }
  | { code: 'tooManyColumns' }
  | { code: 'header' }
  | { code: 'duplicate'; column: string }
  | { code: 'cellTooLong'; column: string }
  | { code: 'personal'; column: string };

/** UTF-8 si le fichier l'est (BOM retiré), sinon Windows-1252. */
export function decodeCsv(bytes: Uint8Array): { text: string; encoding: CsvEncoding } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text: text.replace(/^\uFEFF/, ''), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252' };
  }
}

/** Séparateur de la première ligne (hors guillemets) : point-virgule ou virgule. */
export function detectSeparator(text: string): CsvSeparator {
  let semi = 0;
  let comma = 0;
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === '\n' || c === '\r')) break;
    else if (!quoted && c === ';') semi++;
    else if (!quoted && c === ',') comma++;
  }
  return semi >= comma && semi > 0 ? ';' : ',';
}

/** Lecture RFC 4180 : guillemets, guillemets doublés, retours à la ligne dans un champ. */
export function parseCsv(text: string, sep: CsvSeparator): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((x) => x.trim() !== ''));
}

const PERSONAL_HEADER: PiiType[] = ['email', 'phone', 'identifier', 'nir', 'iban', 'birthdate'];
const PERSONAL_VALUE: PiiType[] = ['email', 'phone', 'nir', 'iban'];

/**
 * Colonne de données personnelles : en-tête d'e-mail, de téléphone ou d'identifiant ; une cellule
 * qui ressemble à un e-mail, un téléphone, un NIR ou un IBAN ; ou une majorité de « Prénom NOM ».
 */
export function personalColumn(header: string, values: string[]): boolean {
  const lt = labelType(header);
  if (lt && PERSONAL_HEADER.includes(lt)) return true;
  const filled = values.filter((v) => v.trim() !== '');
  let names = 0;
  for (const v of filled) {
    const types = matchText(v).map((m) => m.type);
    if (types.some((t) => PERSONAL_VALUE.includes(t))) return true;
    if (types.includes('name')) names++;
  }
  return filled.length > 0 && names * 2 >= filled.length;
}

/** Fichier CSV → jeu de données vérifié (limites, en-têtes, colonnes personnelles refusées). */
export function readDataset(
  bytes: Uint8Array,
): { ok: true; data: ParsedDataset } | { ok: false; error: DatasetError } {
  if (bytes.byteLength > DATASET_MAX_BYTES) return { ok: false, error: { code: 'tooBig' } };
  const { text, encoding } = decodeCsv(bytes);
  const separator = detectSeparator(text);
  const all = parseCsv(text, separator);
  if (all.length < 2) return { ok: false, error: { code: 'empty' } };
  const columns = all[0]!.map((h) => h.trim());
  if (columns.length > DATASET_MAX_COLUMNS) return { ok: false, error: { code: 'tooManyColumns' } };
  if (columns.some((h) => !h || h.length > DATASET_MAX_HEADER))
    return { ok: false, error: { code: 'header' } };
  const dup = columns.find((h, i) => columns.indexOf(h) !== i);
  if (dup) return { ok: false, error: { code: 'duplicate', column: dup } };
  const rows = all.slice(1).map((r) => columns.map((_, i) => (r[i] ?? '').trim()));
  if (rows.length > DATASET_MAX_ROWS) return { ok: false, error: { code: 'tooManyRows' } };
  for (let c = 0; c < columns.length; c++) {
    const values = rows.map((r) => r[c]!);
    if (values.some((v) => v.length > DATASET_MAX_CELL))
      return { ok: false, error: { code: 'cellTooLong', column: columns[c]! } };
    if (personalColumn(columns[c]!, values))
      return { ok: false, error: { code: 'personal', column: columns[c]! } };
  }
  return { ok: true, data: { columns, rows, separator, encoding } };
}
