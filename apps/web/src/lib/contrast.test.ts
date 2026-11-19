import { describe, expect, it } from 'vitest';
import { adjustToContrast, contrastRatio, darkenToContrast, ratioText } from './contrast';

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

describe('adjustToContrast', () => {
  it('assombrit un texte clair sur fond blanc', () => {
    const out = adjustToContrast('#9AD1C8', '#FFFFFF')!;
    expect(contrastRatio(out, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
  it('éclaircit sur fond sombre', () => {
    const out = adjustToContrast('#3A3F47', '#0B0D10', 3)!;
    expect(contrastRatio(out, '#0B0D10')).toBeGreaterThanOrEqual(3);
  });
  it('rien à proposer si conforme', () => expect(adjustToContrast('#080808', '#FFFFFF')).toBeNull());
  it('rapport arrondi par défaut (jamais 4,5 pour 4,49)', () => expect(ratioText(4.49)).toBe('4,4'));
});
