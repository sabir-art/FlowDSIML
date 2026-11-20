import { describe, expect, it } from 'vitest';
import { CATEGORIES, orderedCategories } from './templates';

describe('orderedCategories (L48-C)', () => {
  it('garde l’ordre par défaut sans usage', () => {
    expect(orderedCategories([])).toEqual(CATEGORIES);
  });
  it('met la catégorie de l’usage en premier, sans en masquer', () => {
    expect(orderedCategories(['train'])).toEqual(['accueil', 'logiciel', 'procedure', 'reglementaire']);
  });
  it('dédoublonne et ignore les valeurs inconnues', () => {
    expect(orderedCategories(['document', 'comms', 'x'])).toEqual(CATEGORIES);
    expect(orderedCategories(['youth', 'train'])).toEqual([
      'procedure',
      'accueil',
      'logiciel',
      'reglementaire',
    ]);
  });
});
