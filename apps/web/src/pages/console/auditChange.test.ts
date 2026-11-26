import { describe, expect, it } from 'vitest';
import { assistantListChanges } from './auditChange';

const W = { order: 'Ordre', proposed: 'Proposé', notProposed: 'Non proposé', noTag: 'Sans étiquette' };

describe('assistantListChanges', () => {
  it('étiquette changée : seulement ce qui change', () => {
    expect(
      assistantListChanges(
        'Claude Sonnet (Recommandé), Claude Haiku (Recommandé)',
        'Claude Sonnet (Recommandé), Claude Haiku (Bêta)',
        W,
      ),
    ).toEqual([{ object: 'Claude Haiku', before: 'Recommandé', after: 'Bêta' }]);
  });
  it('modèle proposé ou retiré', () => {
    expect(
      assistantListChanges('Claude Sonnet (Recommandé)', 'Claude Sonnet (Recommandé), Claude Haiku', W),
    ).toEqual([{ object: 'Claude Haiku', before: 'Non proposé', after: 'Proposé' }]);
    expect(assistantListChanges('Claude Sonnet, Claude Opus', 'Claude Opus', W)).toEqual([
      { object: 'Claude Sonnet', before: 'Proposé', after: 'Non proposé' },
    ]);
  });
  it('ordre : noms courts, sans étiquette, sur une ligne', () => {
    expect(
      assistantListChanges(
        'Claude Sonnet (Recommandé), Claude Opus (Recommandé), Claude Haiku (Bêta)',
        'Claude Haiku (Bêta), Claude Sonnet (Recommandé), Claude Opus (Recommandé)',
        W,
      ),
    ).toEqual([{ object: 'Ordre', before: 'Sonnet · Opus · Haiku', after: 'Haiku · Sonnet · Opus' }]);
  });
  it('sans étiquette ; rien de visible ou valeur absente : null', () => {
    expect(assistantListChanges('Claude Opus (Recommandé)', 'Claude Opus', W)).toEqual([
      { object: 'Claude Opus', before: 'Recommandé', after: 'Sans étiquette' },
    ]);
    expect(assistantListChanges('Claude Opus', 'Claude Opus', W)).toBeNull();
    expect(assistantListChanges(null, 'Claude Opus', W)).toBeNull();
  });
});
