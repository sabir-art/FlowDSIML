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
    expect(s).toEqual({ blurred: 4, pending: 1, pendingSteps: [2] });
  });
});
