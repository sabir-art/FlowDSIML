import { describe, expect, it } from 'vitest';
import { inlineLabelValue, labelType, plausibleValue } from './pii';

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

describe('libellés de rôle et noms d’un seul mot (L60, petit lot UX)', () => {
  it('Client, Contact, Interlocuteur, Responsable, Bénéficiaire annoncent un nom', () => {
    for (const l of ['Client', 'Contact', 'Interlocuteur', 'Interlocutrice', 'Responsable', 'Bénéficiaire'])
      expect(labelType(l), l).toBe('name');
    expect(labelType('Client', { roles: false })).toBeNull();
    expect(labelType('Nom du client', { roles: false })).toBe('name');
  });
  it('« Client : Camille Durand » est repéré, pas « Responsable : Service RH »', () => {
    const text = 'Client : Camille Durand';
    const m = inlineLabelValue(text)!;
    expect(m.type).toBe('name');
    expect(plausibleValue(m.type, text.slice(m.start, m.end))).toBe(true);
    for (const v of ['Service RH', 'Support client', 'Mode API', 'Equipe IT'])
      expect(plausibleValue('name', v), v).toBe(false);
  });
  it('un seul mot n’est un nom que dans une colonne de nom, et s’il en a la forme', () => {
    for (const v of ['Durand', 'DURAND', 'Le-Gall', 'O’Neil'])
      expect(plausibleValue('name', v, { single: true }), v).toBe(true);
    expect(plausibleValue('name', 'Durand')).toBe(false);
    for (const v of [
      'Statut',
      'Actions',
      'Active',
      'Brouillon',
      'RH',
      'Nom',
      'Prénom',
      'durand',
      'NomStatut',
    ])
      expect(plausibleValue('name', v, { single: true }), v).toBe(false);
  });
});
