import { describe, expect, it } from 'vitest';
import { plausibleValue } from './pii';

describe('forme de la valeur désignée par un libellé (L60)', () => {
  it('nom : un nom de personne, pas un mot d’interface', () => {
    for (const v of [
      'Camille Durand',
      'J. Martin',
      'Anne de La Tour',
      'DURAND Camille',
      'Jean-Pierre O’Neil',
    ])
      expect(plausibleValue('name', v), v).toBe(true);
    for (const v of [
      'Statut',
      'Actions',
      'Offre essentielle',
      'Modifier la fiche',
      'NomStatutActions',
      'Lyon',
      '3 éléments',
      'a@b.example',
    ])
      expect(plausibleValue('name', v), v).toBe(false);
  });
  it('adresse : un numéro (voie ou code postal), une ville seule reste lisible', () => {
    for (const v of ['12 rue des Lilas', '69003 Lyon', '12 rue des Lilas, 69003 Lyon'])
      expect(plausibleValue('address', v), v).toBe(true);
    for (const v of ['Lyon', 'Nantes', 'Saint-Étienne']) expect(plausibleValue('address', v), v).toBe(false);
  });
  it('les autres types ne sont pas filtrés ici', () => {
    expect(plausibleValue('email', 'x')).toBe(true);
    expect(plausibleValue('phone', 'x')).toBe(true);
  });
});
