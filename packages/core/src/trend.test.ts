import { describe, expect, it } from 'vitest';
import { TREND_MIN_BASE, countTrend, rateTrend, trendDirection } from './trend';

describe('countTrend (L47 §9)', () => {
  it('base ≥ 10 : pourcentage arrondi', () => {
    expect(countTrend(4812, 4296)).toEqual({ kind: 'pct', value: 12 });
    expect(countTrend(9, 10)).toEqual({ kind: 'pct', value: -10 });
  });
  it('bornes 9 et 10', () => {
    expect(TREND_MIN_BASE).toBe(10);
    expect(countTrend(14, 9)).toEqual({ kind: 'abs', value: 5, previous: 9 });
    expect(countTrend(14, 10)).toEqual({ kind: 'pct', value: 40 });
  });
  it('au-delà de +999 % : multiplicateur', () => {
    expect(countTrend(1340, 12)).toEqual({ kind: 'mult', value: 112 });
    expect(countTrend(109.9, 10)).toEqual({ kind: 'pct', value: 999 });
    expect(countTrend(110, 10)).toEqual({ kind: 'mult', value: 11 });
  });
  it('base entre 1 et 9 : écart absolu et valeur précédente', () => {
    expect(countTrend(14, 3)).toEqual({ kind: 'abs', value: 11, previous: 3 });
    expect(countTrend(1, 3)).toEqual({ kind: 'abs', value: -2, previous: 3 });
  });
  it('rien avant : « Nouveau » ; rien des deux côtés : « — »', () => {
    expect(countTrend(27, 0)).toEqual({ kind: 'new' });
    expect(countTrend(0, 0)).toEqual({ kind: 'none' });
  });
});

describe('rateTrend', () => {
  it('en points si la base précédente compte au moins 10 visiteurs', () => {
    expect(rateTrend(0.64, 0.59, 10)).toEqual({ kind: 'pts', value: 5 });
    expect(rateTrend(0.64, 0.59, 9)).toEqual({ kind: 'none' });
  });
});

describe('trendDirection', () => {
  it('aucune flèche sur 0, « Nouveau » ou « — »', () => {
    expect(trendDirection({ kind: 'pct', value: 0 })).toBe('flat');
    expect(trendDirection({ kind: 'pts', value: 0 })).toBe('flat');
    expect(trendDirection({ kind: 'new' })).toBeNull();
    expect(trendDirection({ kind: 'none' })).toBeNull();
    expect(trendDirection({ kind: 'mult', value: 3 })).toBe('up');
    expect(trendDirection({ kind: 'abs', value: -2, previous: 3 })).toBe('down');
  });
});
