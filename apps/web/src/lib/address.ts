/**
 * L28 082 : partie lisible d'une adresse personnalisée (#/l/<partie lisible>-<suffixe>). Mêmes règles et
 * mêmes mots réservés que le centre de formation (center_slug_reserved, contrôlés aussi par la base).
 */
export const ADDRESS_RESERVED = [
  'admin',
  'api',
  'app',
  'auth',
  'c',
  'd',
  'l',
  'login',
  'logout',
  'signup',
  'settings',
  'preview',
  'demo',
  'demos',
  'centre',
  'center',
  'formation',
  'formations',
  'aide',
  'help',
  'support',
  'static',
  'assets',
  'www',
  'tutoclick',
  'flowdsiml',
  'invite',
  'legal',
];
const LABEL = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

export type LabelState = 'valid' | 'invalid' | 'reserved';
export function checkLabel(v: string): LabelState {
  if (!LABEL.test(v)) return 'invalid';
  return ADDRESS_RESERVED.includes(v) ? 'reserved' : 'valid';
}

/** Saisie normalisée : minuscules, caractères hors liste remplacés par un tiret, 48 au plus. */
export const normalizeLabel = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 48);

/** Partie lisible et suffixe d'une adresse complète. */
export function splitAddress(address: string): { label: string; suffix: string } {
  const i = address.lastIndexOf('-');
  return { label: address.slice(0, i), suffix: address.slice(i + 1) };
}
