import { describe, expect, it } from 'vitest';
import { distinctNames } from './stepNames';

describe('noms d’étapes distincts (lot B, recette UX §3.1)', () => {
  it('garde les noms déjà distincts', () => {
    expect(distinctNames([{ name: 'Accueil' }, { name: 'Clients' }])).toEqual(['Accueil', 'Clients']);
  });
  it('nomme d’après le clic qui a amené la page', () => {
    expect(
      distinctNames([
        { name: 'Tableau de bord', clickLabel: 'Ajouter une vente' },
        { name: 'Tableau de bord' },
      ]),
    ).toEqual(['Tableau de bord', 'Tableau de bord · après « Ajouter une vente »']);
  });
  it('sinon un numéro, jamais deux fois le même nom', () => {
    expect(distinctNames([{ name: 'Catalogue' }, { name: 'Catalogue' }, { name: 'Catalogue' }])).toEqual([
      'Catalogue',
      'Catalogue (2)',
      'Catalogue (3)',
    ]);
    const names = distinctNames([
      { name: 'A', clickLabel: 'x' },
      { name: 'A', clickLabel: 'x' },
      { name: 'A' },
    ]);
    expect(new Set(names).size).toBe(3);
  });
});
