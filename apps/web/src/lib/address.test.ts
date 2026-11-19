import { describe, expect, it } from 'vitest';
import { checkLabel, normalizeLabel, splitAddress } from './address';

describe('adresse personnalisée', () => {
  it('valide la partie lisible comme la base', () => {
    expect(checkLabel('accueil-rh')).toBe('valid');
    expect(checkLabel('ab')).toBe('invalid');
    expect(checkLabel('-accueil')).toBe('invalid');
    expect(checkLabel('accueil-')).toBe('invalid');
    expect(checkLabel('a'.repeat(49))).toBe('invalid');
    expect(checkLabel('admin')).toBe('reserved');
  });
  it('normalise la saisie', () => {
    expect(normalizeLabel('Accueil RH Été')).toBe('accueil-rh-ete');
  });
  it('sépare la partie lisible du suffixe', () => {
    expect(splitAddress('accueil-rh-aB3dE9')).toEqual({ label: 'accueil-rh', suffix: 'aB3dE9' });
  });
});
