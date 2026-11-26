import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fr from './fr.json';
import en from './en.json';

/**
 * NUM-01 (décision du chef, recette UX « num-01-partout ») : un nombre (ou une valeur {{x}}) et son unité
 * ne se séparent jamais à la ligne, ni « sur » et le nombre qui le suit (« 3 sur 12 », « sur 15:00 ») :
 * espace insécable. Contrôlé dans les locales de l'app, les textes du lecteur et les gabarits du code
 * (`${…} px`, « 100 % »), hors commentaires et tests. Unités : ms, s, min, h, o, Ko, Mo, Go, KB, MB, GB, %,
 * px, €.
 */
const UNIT = /(\d|\}\}) (ms|s|min|h|Mo|Ko|Go|o|MB|KB|GB|%|px|€)(?![\p{L}\p{N}])/u;
const SUR = /\bsur (\d|\{\{)/u;
const offenders = (node: unknown, re: RegExp, path = ''): string[] =>
  typeof node === 'string'
    ? re.test(node)
      ? [path]
      : []
    : node && typeof node === 'object'
      ? Object.entries(node).flatMap(([k, v]) => offenders(v, re, path ? `${path}.${k}` : k))
      : [];

/** Lignes de code (hors commentaires) d'un fichier qui correspondent au motif. */
const codeLines = (file: string, re: RegExp) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((l, i) => [i + 1, l] as const)
    // « num01-donnee » : valeur d'un export de données (CSV), pas un texte affiché
    .filter(([, l]) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l) && !l.includes('num01-donnee') && re.test(l))
    .map(([n, l]) => `${file.replace(/^.*?(apps|packages)\//, '$1/')}:${n}: ${l.trim()}`);

const ROOT = resolve(__dirname, '../../../..');
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' || f === 'dist' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$|\.d\.ts$/.test(f) ? [p] : [];
  });
}

describe('NUM-01 : nombre et unité insécables', () => {
  for (const [lang, res] of [
    ['fr', fr],
    ['en', en],
  ] as const)
    it(`${lang} : aucune espace ordinaire entre un nombre et son unité`, () => {
      expect(offenders(res, UNIT)).toEqual([]);
    });
  it('fr : « sur » suivi d’un nombre ou d’une valeur, toujours insécable', () => {
    expect(offenders(fr, SUR)).toEqual([]);
  });
  it('lecteur (apps/player/src/i18n.ts) : unités et « sur N » insécables', () => {
    const f = join(ROOT, 'apps/player/src/i18n.ts');
    expect([...codeLines(f, UNIT), ...codeLines(f, SUR)]).toEqual([]);
  });
  it('code (src et packages) : aucun gabarit « ${…} unité » ni « 100 % » avec une espace ordinaire', () => {
    const TPL =
      /\$\{[^}]+\} (ms|s|min|h|Mo|Ko|Go|MB|KB|GB|px|%)(?![\p{L}\p{N}])|>\s*\d+ (%|px|ms|s|min)\s*</u;
    const files = [
      ...sources(join(ROOT, 'apps/web/src')),
      ...sources(join(ROOT, 'apps/player/src')),
      ...sources(join(ROOT, 'packages')),
    ];
    expect(files.flatMap((f) => codeLines(f, TPL))).toEqual([]);
  });
  it('le motif reconnaît les cas visés et ignore les mots', () => {
    for (const bad of ['5 Mo au plus', '{{n}} min', '{{pct}} %', '320 ms', 'à 9 h', '2 MB at most'])
      expect(UNIT.test(bad), bad).toBe(true);
    for (const good of ['5 Mo', '{{count}} sûres', '2 minutes', '3 options', '{{n}} heures'])
      expect(UNIT.test(good), good).toBe(false);
    expect(SUR.test('Étape {{n}} sur {{total}}')).toBe(true);
    expect(SUR.test('sur 15:00') || SUR.test('sur la page')).toBe(false);
  });
});
