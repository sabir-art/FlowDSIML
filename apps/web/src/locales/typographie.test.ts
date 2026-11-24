import { describe, expect, it } from 'vitest';
import fr from './fr.json';

/**
 * Guillemets français : espace fine insécable (U+202F) après « et avant ». Sans elle, un texte étroit
 * (toast, carte, 390 px) coupe la ligne entre le guillemet et le nom cité.
 */
describe('typographie des textes français', () => {
  it('aucun guillemet « » séparé de son contenu par une espace ordinaire', () => {
    const bad: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (/« | »/.test(node)) bad.push(path);
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
      }
    };
    walk(fr, '');
    expect(bad).toEqual([]);
  });
});
