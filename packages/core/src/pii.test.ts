import { describe, expect, it } from 'vitest';
import { autocompleteType, inlineLabelValue, labelType, maskExcerpt, matchText } from './pii';

/** Données entièrement fictives. */
const types = (t: string, ctx = '') => matchText(t, ctx).map((m) => [m.type, t.slice(m.start, m.end)]);

describe('détection de données personnelles', () => {
  it('motifs : e-mail, téléphone, NIR, IBAN', () => {
    expect(types('Contact : camille.durand@exemple.example')).toEqual([
      ['email', 'camille.durand@exemple.example'],
    ]);
    expect(types('Tél. 06 12 34 56 78')).toEqual([['phone', '06 12 34 56 78']]);
    expect(types('+33 6 12 34 56 78')[0]?.[0]).toBe('phone');
    expect(types('NIR 2 04 07 75 123 456 78')).toEqual([['nir', '2 04 07 75 123 456 78']]);
    expect(types('FR76 3000 6000 0112 3456 7890 189')[0]?.[0]).toBe('iban');
  });
  it('adresse : voie et code postal + ville', () => {
    expect(types('12 rue des Lilas')[0]).toEqual(['address', '12 rue des Lilas']);
    expect(types('75012 Paris')[0]).toEqual(['address', '75012 Paris']);
  });
  it('date : seulement près d’un libellé de naissance', () => {
    expect(types('Rendez-vous le 12/03/2026')).toEqual([]);
    expect(types('Née le 14/02/2007')).toEqual([['birthdate', '14/02/2007']]);
    expect(types('14/02/2007', 'Date de naissance')).toEqual([['birthdate', '14/02/2007']]);
  });
  it('nom : Prénom + NOM', () => {
    expect(types('Suivi par Camille DURAND')).toEqual([['name', 'Camille DURAND']]);
    expect(types('Tableau de bord')).toEqual([]);
  });
  it('libellés et autocomplete', () => {
    expect(labelType('Prénom')).toBe('name');
    expect(labelType('N° de sécurité sociale')).toBe('nir');
    expect(labelType('Date de naissance')).toBe('birthdate');
    expect(labelType('Identifiant')).toBe('identifier');
    expect(labelType('IBAN')).toBe('iban');
    expect(labelType('Statut')).toBe(null);
    expect(autocompleteType('family-name')).toBe('name');
    expect(autocompleteType('cc-number')).toBe('zone');
    expect(autocompleteType('off')).toBe(null);
    expect(inlineLabelValue('Nom : DURAND')).toEqual({ type: 'name', start: 6, end: 12 });
    expect(inlineLabelValue('Statut : actif')).toBe(null);
  });
  it('extrait masqué : jamais la valeur en clair', () => {
    expect(maskExcerpt('phone', '06 12 34 56 78')).toBe('06 •• •• •• ••');
    expect(maskExcerpt('email', 'camille@exemple.example')).toBe('c••••@••••.example');
    expect(maskExcerpt('name', 'Camille DURAND')).not.toContain('amille');
  });
});
