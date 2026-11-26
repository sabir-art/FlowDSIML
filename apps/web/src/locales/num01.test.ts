import { describe, expect, it } from 'vitest';
import fr from './fr.json';
import en from './en.json';

/**
 * NUM-01 (décision du chef, suite de la recette UX de L41 étape 2) : dans toutes les locales, un nombre
 * (ou une valeur {{x}}) et son unité ne se séparent jamais à la ligne : espace insécable entre les deux.
 * Unités : ms, s, min, h, o, Ko, Mo, Go, KB, MB, GB, %, px, €.
 */
const RE = /(\d|\}\}) (ms|s|min|h|Mo|Ko|Go|o|MB|KB|GB|%|px|€)(?![\p{L}\p{N}])/u;
const offenders = (node: unknown, path = ''): string[] =>
  typeof node === 'string'
    ? RE.test(node)
      ? [path]
      : []
    : node && typeof node === 'object'
      ? Object.entries(node).flatMap(([k, v]) => offenders(v, path ? `${path}.${k}` : k))
      : [];

describe('NUM-01 : nombre et unité insécables, toutes les locales', () => {
  for (const [lang, res] of [
    ['fr', fr],
    ['en', en],
  ] as const)
    it(`${lang} : aucune espace ordinaire entre un nombre et son unité`, () => {
      expect(offenders(res)).toEqual([]);
    });
  it('le motif reconnaît les cas visés et ignore les mots', () => {
    for (const bad of ['5 Mo au plus', '{{n}} min', '{{pct}} %', '320 ms', 'à 9 h', '2 MB at most'])
      expect(RE.test(bad), bad).toBe(true);
    for (const good of ['5 Mo', '{{count}} sûres', '2 minutes', '3 options', '{{n}} heures'])
      expect(RE.test(good), good).toBe(false);
  });
});
