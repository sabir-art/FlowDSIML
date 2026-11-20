import { describe, expect, it } from 'vitest';
import { missingTerms } from './TranslateDialog';

describe('missingTerms', () => {
  it('terme du glossaire présent dans l’original et perdu dans la traduction', () => {
    expect(
      missingTerms(
        ['opportunité', 'CRM'],
        'Créez une opportunité dans le CRM',
        'Create an opportunity in the CRM',
      ),
    ).toEqual(['opportunité']);
    expect(missingTerms(['Opportunité'], 'Une opportunité', 'Une OPPORTUNITÉ')).toEqual([]);
    expect(missingTerms(['tableau'], 'Sans le terme', 'Without it')).toEqual([]);
  });
});
