import { describe, expect, it } from 'vitest';
import {
  backspaceMention,
  bodyParts,
  draftParts,
  insertMention,
  matchesMember,
  mentionQuery,
  serialize,
  toDraft,
} from './mentions';

const M = '0b5c1f0e-0000-4000-8000-0000000000b1';
const S = '0b5c1f0e-0000-4000-8000-0000000000b2';
const marie = { name: 'Marie Durand', id: M };
const sacha = { name: 'Sacha', id: S };

describe('L22-07 : mentions', () => {
  it('« @requête » détectée avant le curseur, pas au milieu d’un mot', () => {
    expect(mentionQuery('Bonjour @Ma', 11)).toEqual({ start: 8, query: 'Ma' });
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionQuery('Bonjour @Marie Du', 17)).toEqual({ start: 8, query: 'Marie Du' });
    expect(mentionQuery('mail@exemple', 12)).toBeNull();
    expect(mentionQuery('Bonjour @Ma ', 12)).toEqual({ start: 8, query: 'Ma ' });
  });
  it('insertion puis enregistrement au format stocké', () => {
    const r = insertMention('Merci @Ma pour tout', 6, 9, 'Marie Durand');
    expect(r).toEqual({ text: 'Merci @Marie Durand pour tout', caret: 20 });
    expect(serialize(r.text, [marie])).toBe(`Merci @[Marie Durand](${M}) pour tout`);
  });
  it('seules les mentions insérées sont converties ; nom le plus long d’abord', () => {
    expect(serialize('@Marie Durand et @Inconnu', [marie])).toBe(`@[Marie Durand](${M}) et @Inconnu`);
    expect(serialize('@Sacha et @Sachant', [sacha])).toBe(`@[Sacha](${S}) et @Sachant`);
    expect(serialize('mail@Sacha', [sacha])).toBe('mail@Sacha');
  });
  it('un seul retour arrière supprime la pastille', () => {
    expect(backspaceMention('Merci @Marie Durand', 19, [marie])).toEqual({ text: 'Merci ', caret: 6 });
    expect(backspaceMention('Merci @Marie Duran', 18, [marie])).toBeNull();
  });
  it('aller-retour pour modifier un commentaire', () => {
    const stored = `@[Marie Durand](${M}) regarde ça`;
    const d = toDraft(stored);
    expect(d).toEqual({ text: '@Marie Durand regarde ça', mentions: [marie] });
    expect(serialize(d.text, d.mentions)).toBe(stored);
    expect(draftParts(d.text, d.mentions)).toEqual(bodyParts(stored));
  });
  it('filtre sans accents, sur prénom, nom ou e-mail', () => {
    expect(matchesMember('dur', 'Marie Durand', 'marie@example.com')).toBe(true);
    expect(matchesMember('élo', 'Elodie Petit', 'elodie@example.com')).toBe(true);
    expect(matchesMember('x', 'Marie Durand', 'marie@example.com')).toBe(false);
  });
});
