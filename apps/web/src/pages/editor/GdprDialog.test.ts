import { describe, expect, it } from 'vitest';
import { gdprSummary } from './GdprDialog';

describe('gdprSummary', () => {
  it('compte calques, flous incrustés et détections non floutées par étape', () => {
    const s = gdprSummary([
      {
        blurs: [{ x: 0, y: 0, w: 0.1, h: 0.1 }],
        element_meta: { pii: [{ blurred: true }, { blurred: true }] },
      },
      { blurs: [], element_meta: { pii: [{ blurred: false }, { blurred: true }] } },
      { blurs: [], element_meta: {} },
    ]);
    expect(s).toEqual({ blurred: 4, pending: 1, pendingSteps: [2], imported: 0, aiText: 0 });
  });
  it('compte les images importées des étapes Avant / Après (non vérifiées)', () => {
    const s = gdprSummary([
      {
        kind: 'before_after',
        blurs: [],
        element_meta: {},
        options: {
          beforeAfter: {
            sources: { before: { kind: 'upload', name: 'ancien.png' }, after: { kind: 'step', stepId: 'x' } },
          },
        },
      },
    ]);
    expect(s.imported).toBe(1);
  });
  it('REV-07 : images importées dans les étapes', () => {
    const s = gdprSummary([
      { kind: 'image', blurs: [], element_meta: { imported: true } },
      { kind: 'image', blurs: [], element_meta: { imported: true, pii: [] } },
      { kind: 'image', blurs: [], element_meta: {} },
    ]);
    expect(s.imported).toBe(2);
  });
  it('L28 051 : image remplacée dans une capture HTML comptée comme importée', () => {
    const s = gdprSummary([
      {
        kind: 'html',
        blurs: [],
        element_meta: null,
        html_ops: [
          { id: 'a', sel: 'img', op: 'image', value: 'w/x.png', scope: 'step' },
          { id: 'b', sel: 'h1', op: 'text', value: 'Titre', scope: 'step' },
        ],
      },
    ] as never);
    expect(s.imported).toBe(1);
  });
});

describe('L49 : ligne du bilan (pages analysées)', async () => {
  const i18next = (await import('i18next')).default.createInstance();
  const fr = (await import('../../locales/fr.json')).default;
  await i18next.init({ lng: 'fr', resources: { fr: { translation: fr } } });
  const { securityLine } = await import('./GdprDialog');
  const line = (...s: Array<'safe' | 'removed' | 'partial'>) => securityLine(i18next.t, s);
  it('morceaux accordés, morceau nul omis, une seule page sans chiffre répété', () => {
    expect(line('safe', 'safe', 'removed')).toBe('3 pages analysées : 2 sûres, 1 avec éléments retirés');
    expect(line('safe', 'removed', 'removed')).toBe('3 pages analysées : 1 sûre, 2 avec éléments retirés');
    expect(line('safe', 'safe')).toBe('2 pages analysées : 2 sûres');
    expect(line('safe')).toBe('1 page analysée : sûre');
    expect(line('removed')).toBe('1 page analysée : avec éléments retirés');
  });
});
