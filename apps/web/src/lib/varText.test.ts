import { describe, expect, it } from 'vitest';
import { parseVarText, serializeVarText, varSource } from './varText';

const roundTrip = (s: string) => serializeVarText(parseVarText(s));

describe('L46 : texte stocké ⇄ éditeur riche', () => {
  it('aller-retour identique sur les textes existants', () => {
    for (const s of [
      '',
      'Bonjour',
      'Bienvenue {{first_name}} !',
      'Bonjour {{ first_name | vous }}, voici **Pipeline**.',
      'Cliquez sur *Enregistrer* puis [l’aide](https://aide.example/x?y=1).',
      'Ligne 1\nLigne 2\n\nLigne 4',
      '**{{company}}** et *{{first_name|vous}}*',
      '5 * 3 = 15 et un astérisque seul *',
      '[Voir **le guide**](https://guide.example)',
      'Accolades {{ invalides }} et {{Majuscule}}',
    ])
      expect(roundTrip(s)).toBe(s);
  });
  it('variable : pastille avec clé et repli', () => {
    const d = parseVarText('Bonjour {{first_name|vous}}');
    expect(d.content[0]!.content![1]).toMatchObject({
      type: 'variable',
      attrs: { key: 'first_name', fallback: 'vous' },
    });
  });
  it('repli modifié : écrit sous la forme {{clé|repli}}', () => {
    expect(varSource({ key: 'first_name', fallback: 'à vous', raw: '{{first_name}}' })).toBe(
      '{{first_name|à vous}}',
    );
    expect(varSource({ key: 'company', fallback: null })).toBe('{{company}}');
  });
});
