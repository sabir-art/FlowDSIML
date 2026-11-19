import { describe, expect, it } from 'vitest';
import { abOutcome } from './abResult';

describe('résultat A/B prudent', () => {
  it('pas de meneur sous 50 visiteurs par variante', () => {
    expect(
      abOutcome({ goal: 'completion', A: { visitors: 49, reached: 10 }, B: { visitors: 300, reached: 200 } }),
    ).toMatchObject({ tooFew: true, leader: null });
  });
  it('B mène de 11 points sur 412 visiteurs', () => {
    expect(
      abOutcome({
        goal: 'completion',
        A: { visitors: 206, reached: 82 },
        B: { visitors: 206, reached: 105 },
      }),
    ).toEqual({ tooFew: false, leader: 'B', points: 11, total: 412 });
  });
  it('égalité', () => {
    expect(
      abOutcome({ goal: 'cta', A: { visitors: 60, reached: 30 }, B: { visitors: 60, reached: 30 } }).leader,
    ).toBeNull();
  });
});
