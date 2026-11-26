import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import fr from './fr.json';
import en from './en.json';

/**
 * NUM-01 (recette UX de L41, étape 2) : une durée ne se coupe pas entre le nombre et son unité
 * (« 320 ms »). Console › Modèles IA : toasts « Tester » et « Tester et enregistrer », en français et en
 * anglais, et tout texte de cette section qui affiche une durée.
 */
const NBSP = ' ';
const strings = (node: unknown, path = ''): Array<[string, string]> =>
  typeof node === 'string'
    ? [[path, node]]
    : node && typeof node === 'object'
      ? Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
      : [];

describe('NUM-01 : durées insécables dans Console › Modèles IA', () => {
  for (const [lang, res] of [
    ['fr', fr],
    ['en', en],
  ] as const) {
    const ai = (res as { console: { ai: unknown } }).console.ai;
    it(`${lang} : « {{ms}} ms » toujours avec une espace insécable`, () => {
      const withMs = strings(ai).filter(([, v]) => /\{\{ms\}\}/.test(v));
      expect(withMs.map(([k]) => k).sort()).toEqual(['added', 'replaced', 'testOk']);
      expect(withMs.filter(([, v]) => !v.includes(`{{ms}}${NBSP}ms`)).map(([k]) => k)).toEqual([]);
    });
    it(`${lang} : le toast rendu garde « 320 ms » d’un seul tenant`, async () => {
      const i = i18next.createInstance();
      await i.init({
        lng: lang,
        resources: { [lang]: { translation: res } },
        interpolation: { escapeValue: false },
      });
      const out = i.t('console.ai.testOk', { name: 'Anthropic', ms: 320 });
      expect(out).toContain(`320${NBSP}ms`);
      expect(out).not.toMatch(/320 ms/);
    });
  }
});
