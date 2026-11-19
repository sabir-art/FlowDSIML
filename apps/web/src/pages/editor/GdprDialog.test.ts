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
    expect(s).toEqual({ blurred: 4, pending: 1, pendingSteps: [2], imported: 0 });
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
});
