/**
 * L38 paquet 2 (revue formation n° 2 et 3) : liste d'apprenants importée en CSV (prénom, nom, e-mail,
 * groupe facultatif), contrôlée ligne par ligne avant la création des liens, puis export des liens pour un
 * publipostage depuis la messagerie du formateur. TutoClick n'envoie aucun e-mail.
 */
import { foldText, toCsv } from '@flowdsiml/core';
import { parseCsv } from '../settings/glossaryCsv';

export const IMPORT_MAX = 500;
export const COHORT_MAX = 80;

export type RowError = 'name' | 'email' | 'duplicate' | 'exists' | 'cohort';

export interface ImportRow {
  /** Ligne du fichier (1 pour l'en-tête). */
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  cohort: string;
  errors: RowError[];
}

export interface ImportPreview {
  rows: ImportRow[];
  /** Colonnes reconnues : prénom ou nom, et e-mail, au minimum. */
  missing: Array<'name' | 'email'>;
  /** Lignes au-delà de IMPORT_MAX, ignorées. */
  truncated: number;
}

const COLUMNS: Record<'firstName' | 'lastName' | 'email' | 'cohort', string[]> = {
  firstName: ['prenom', 'first name', 'firstname', 'first_name'],
  lastName: ['nom', 'last name', 'lastname', 'last_name', 'nom de famille'],
  email: ['e-mail', 'email', 'mail', 'courriel', 'adresse e-mail', 'adresse email'],
  cohort: ['groupe', 'group', 'session', 'cohorte'],
};
const key = (s: string) => foldText(s.trim()).replace(/\s+/g, ' ');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Modèle à télécharger (données fictives). */
export const TEMPLATE = toCsv(
  ['prénom', 'nom', 'e-mail', 'groupe'],
  [['Camille', 'Exemple', 'camille.exemple@structure.example', 'Session du 12 novembre']],
  ';',
);

/**
 * Lit le fichier et contrôle chaque ligne : prénom ou nom requis, e-mail valide, pas de doublon dans le
 * fichier, pas d'e-mail déjà porté par un lien de la démo (`existing`, en minuscules). `cohort` : groupe
 * appliqué aux lignes qui n'en ont pas.
 */
export function previewImport(text: string, existing: Set<string>, cohort = ''): ImportPreview {
  const [head = [], ...body] = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  const idx = Object.fromEntries(
    Object.entries(COLUMNS).map(([k, names]) => [k, head.findIndex((h) => names.includes(key(h)))]),
  ) as Record<keyof typeof COLUMNS, number>;
  const missing: ImportPreview['missing'] = [];
  if (idx.firstName < 0 && idx.lastName < 0) missing.push('name');
  if (idx.email < 0) missing.push('email');
  if (missing.length) return { rows: [], missing, truncated: 0 };
  const seen = new Set<string>();
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  const rows = body.slice(0, IMPORT_MAX).map((r, i): ImportRow => {
    const email = cell(r, idx.email).toLowerCase();
    const row: ImportRow = {
      line: i + 2,
      firstName: cell(r, idx.firstName).slice(0, 60),
      lastName: cell(r, idx.lastName).slice(0, 60),
      email,
      cohort: (cell(r, idx.cohort) || cohort.trim()).replace(/\s+/g, ' '),
      errors: [],
    };
    if (!row.firstName && !row.lastName) row.errors.push('name');
    if (!EMAIL.test(email) || email.length > 254) row.errors.push('email');
    else if (seen.has(email)) row.errors.push('duplicate');
    else if (existing.has(email)) row.errors.push('exists');
    if (row.cohort.length > COHORT_MAX) row.errors.push('cohort');
    if (EMAIL.test(email)) seen.add(email);
    return row;
  });
  return { rows, missing, truncated: Math.max(0, body.length - IMPORT_MAX) };
}

/** Nom du lien et variables (first_name, last_name, email) d'une ligne valide. */
export function linkFromRow(r: ImportRow) {
  const name = [r.firstName, r.lastName].filter(Boolean).join(' ').slice(0, 120);
  const variables: Record<string, string> = { email: r.email };
  if (r.firstName) variables.first_name = r.firstName;
  if (r.lastName) variables.last_name = r.lastName;
  return { name, variables, cohort: r.cohort };
}

export interface ExportLink {
  name: string;
  email: string;
  cohort: string;
  /** Lien du centre (progression et attestation), pour un module de formation. */
  center: string | null;
  demo: string;
}

/** Export des liens (séparateur « ; », lu tel quel par Excel en français). */
export function exportLinks(
  links: ExportLink[],
  L: { name: string; email: string; cohort: string; center: string; demo: string },
): string {
  const withCenter = links.some((l) => l.center);
  const headers = [L.name, L.email, L.cohort, ...(withCenter ? [L.center] : []), L.demo];
  return toCsv(
    headers,
    links.map((l) => [l.name, l.email, l.cohort, ...(withCenter ? [l.center ?? ''] : []), l.demo]),
    ';',
  );
}

/** Groupes déjà utilisés (suggestions), triés, sans doublon. */
export function cohorts(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => (v ?? '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );
}
