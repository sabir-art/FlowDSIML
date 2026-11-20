import { describe, expect, it } from 'vitest';
import { gdprSummary } from './GdprDialog';

describe('gdprSummary : textes générés par IA (L30-05)', () => {
  it('compte les étapes dont le repère IA reste', () => {
    const base = { blurs: [], element_meta: null };
    const s = gdprSummary([
      { ...base, options: { aiText: true } },
      { ...base, options: {} },
      { ...base, options: { aiText: true } },
    ] as never);
    expect(s.aiText).toBe(2);
  });
});
