import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * NUM-01 : dans les textes de l'extension, un nombre (ou une valeur {{x}}) et son unité ne se séparent
 * jamais à la ligne. Les commentaires du code ne sont pas des textes.
 */
const RE = /(\d|\}\}) (ms|s|min|h|Mo|Ko|Go|o|MB|KB|GB|%|px|€)(?![\p{L}\p{N}])/u;
const FILES = ['i18n.ts', 'videoReviewStrings.ts', 'verifyStrings.ts', 'reviewStrings.ts'];

describe('NUM-01 : nombre et unité insécables dans les textes de l’extension', () => {
  for (const f of FILES)
    it(f, () => {
      const bad = readFileSync(resolve(__dirname, f), 'utf8')
        .split('\n')
        .map((l, i) => [i + 1, l] as const)
        .filter(([, l]) => !/^\s*(\/\/|\*|\/\*)/.test(l) && RE.test(l))
        .map(([n, l]) => `${n}: ${l.trim()}`);
      expect(bad).toEqual([]);
    });
});
