import { describe, expect, it } from 'vitest';
import { contrastRatio, darkenToContrast } from './contrast';

describe('contrastRatio', () => {
  it('noir sur blanc = 21', () => expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1));
  it('maquette : #9AD1C8 sur blanc ≈ 1,7', () =>
    expect(contrastRatio('#9AD1C8', '#FFFFFF')).toBeCloseTo(1.7, 1));
  it('valeur invalide traitée comme noir', () => expect(contrastRatio('xyz', '#FFFFFF')).toBeCloseTo(21, 1));
});

describe('darkenToContrast', () => {
  it('assombrit jusqu’à 4,5:1', () => {
    const out = darkenToContrast('#9AD1C8')!;
    expect(contrastRatio(out, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
  it('couleur déjà conforme inchangée', () => expect(darkenToContrast('#A3195B')).toBe('#A3195B'));
});
