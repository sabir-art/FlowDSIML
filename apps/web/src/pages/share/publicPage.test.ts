import { describe, expect, it } from 'vitest';
import { ctaErrors } from './PublicPagePanel';

describe('page publique (L19b) : bouton d’action', () => {
  it('facultatifs ensemble, lien https obligatoire', () => {
    expect(ctaErrors({ ctaLabel: '', ctaUrl: '' })).toEqual({});
    expect(ctaErrors({ ctaLabel: 'Voir', ctaUrl: '' })).toEqual({ url: 'ctaUrlRequired' });
    expect(ctaErrors({ ctaLabel: '', ctaUrl: 'https://acme.example' })).toEqual({
      label: 'ctaLabelRequired',
    });
    expect(ctaErrors({ ctaLabel: 'Voir', ctaUrl: 'http://acme.example' })).toEqual({ url: 'ctaUrlHttps' });
    expect(ctaErrors({ ctaLabel: 'Voir', ctaUrl: 'javascript:alert(1)' })).toEqual({ url: 'ctaUrlHttps' });
    expect(ctaErrors({ ctaLabel: 'Voir', ctaUrl: 'https://www.acme.example/rdv?x=1' })).toEqual({});
  });
});
