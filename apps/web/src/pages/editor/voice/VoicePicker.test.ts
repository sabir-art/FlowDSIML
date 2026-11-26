import { describe, expect, it } from 'vitest';
import { filterVoices, fold, type VoiceInfo } from './VoicePicker';

const v = (
  name: string,
  gender: VoiceInfo['gender'],
  langs: string[],
  accent = '',
  style = '',
): VoiceInfo => ({
  id: `voix${name}00000`,
  name,
  gender,
  accent,
  style,
  langs,
  recommended: langs[0] === 'fr',
  own: false,
});
const list = [
  v('Élodie', 'f', ['fr'], '', 'narration'),
  v('Antoine', 'm', ['fr'], 'québécois', 'posé'),
  v('George', 'm', ['en', 'fr'], 'britannique'),
  v('Aria', 'f', ['en'], 'américain', 'calme'),
];

describe('sélecteur de voix (L62 §8)', () => {
  it('recherche sans accents ni casse, dans le nom, l’accent et le style', () => {
    expect(fold('Élodie QUÉBÉCOIS')).toBe('elodie quebecois');
    const names = (q: string) => filterVoices(list, q, { lang: null, gender: null }).map((x) => x.name);
    expect(names('elodie')).toEqual(['Élodie']);
    expect(names('quebecois')).toEqual(['Antoine']);
    expect(names('CALME')).toEqual(['Aria']);
    expect(names('')).toHaveLength(4);
  });
  it('filtres Langue et Genre', () => {
    const names = (lang: string | null, gender: VoiceInfo['gender'] | null) =>
      filterVoices(list, '', { lang, gender }).map((x) => x.name);
    expect(names('fr', null)).toEqual(['Élodie', 'Antoine', 'George']);
    expect(names('fr', 'm')).toEqual(['Antoine', 'George']);
    expect(names('en', 'f')).toEqual(['Aria']);
  });
});
