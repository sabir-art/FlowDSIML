import { describe, expect, it } from 'vitest';
import { isRisky } from './riskyLink';

describe('isRisky', () => {
  it('déconnexion, suppression, désabonnement : par le chemin ou le libellé', () => {
    expect(isRisky('https://acme.example/deconnexion')).toBe(true);
    expect(isRisky('https://acme.example/compte/supprimer')).toBe(true);
    expect(isRisky('https://acme.example/newsletter?action=unsubscribe')).toBe(true);
    expect(isRisky('https://acme.example/session/fin', 'Se déconnecter')).toBe(true);
  });
  it('fichiers à télécharger', () => {
    expect(isRisky('https://acme.example/guide.pdf')).toBe(true);
    expect(isRisky('https://acme.example/export.csv')).toBe(true);
  });
  it('pages ordinaires ; adresse illisible refusée', () => {
    expect(isRisky('https://acme.example/produits/crm', 'ExempleCRM')).toBe(false);
    expect(isRisky('https://acme.example/aide/faq')).toBe(false);
    expect(isRisky('pas une adresse')).toBe(true);
  });
});
