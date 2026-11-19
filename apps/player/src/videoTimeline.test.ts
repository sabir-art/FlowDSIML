import { describe, expect, it } from 'vitest';
import {
  captionAt,
  clock,
  editedDuration,
  normalizeCuts,
  skipCut,
  toEdited,
  toSource,
} from './videoTimeline';

describe('vidéo (F7) : temps après coupe', () => {
  const cuts = normalizeCuts(
    [
      { from: 30000, to: 40000 },
      { from: 10000, to: 20000 },
      { from: 15000, to: 25000 },
    ],
    60000,
  );
  it('coupes triées et fusionnées', () => {
    expect(cuts).toEqual([
      { from: 10000, to: 25000 },
      { from: 30000, to: 40000 },
    ]);
    expect(editedDuration(cuts, 60000)).toBe(35000);
  });
  it('conversion aller-retour', () => {
    expect(toEdited(5000, cuts)).toBe(5000);
    expect(toEdited(27000, cuts)).toBe(12000);
    expect(toEdited(12000, cuts)).toBe(10000);
    expect(toSource(12000, cuts)).toBe(27000);
    expect(toSource(toEdited(50000, cuts), cuts)).toBe(50000);
  });
  it('saut d’une coupe, sous-titres, horloge', () => {
    expect(skipCut(31000, cuts)).toBe(40000);
    expect(skipCut(29000, cuts)).toBeNull();
    expect(captionAt(1500, [{ from: 1000, to: 2000, text: 'Ouvrez' }])).toBe('Ouvrez');
    expect(clock(65999)).toBe('1:05');
  });
});
