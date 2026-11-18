import { describe, expect, it } from 'vitest';
import { findAll, findIn, replaceIn, type TextField } from './findReplace';

const o = { caseSensitive: false, wholeWord: false, scope: 'all' as const };

describe('rechercher et remplacer (L12-04)', () => {
  it('trouve sans tenir compte de la casse, ou en la respectant', () => {
    expect(findIn('Rapport et rapport', 'rapport', o)).toHaveLength(2);
    expect(findIn('Rapport et rapport', 'rapport', { ...o, caseSensitive: true })).toEqual([[11, 18]]);
  });
  it('mot entier, accents compris', () => {
    expect(findIn('rapports, rapport, éditer', 'rapport', { ...o, wholeWord: true })).toEqual([[10, 17]]);
    expect(findIn('créer', 'cré', { ...o, wholeWord: true })).toEqual([]);
  });
  it('ne touche jamais aux variables', () => {
    const text = 'Bonjour {{first_name}}, votre first_name';
    expect(findIn(text, 'first_name', o)).toEqual([[30, 40]]);
    expect(replaceIn(text, 'first_name', 'prénom', o)).toBe('Bonjour {{first_name}}, votre prénom');
  });
  it('portée : bulles seulement', () => {
    const fields: TextField[] = [
      { table: 'hotspots', id: 'h', field: 'body', kind: 'bubble', stepIndex: 0, text: 'rapport' },
      { table: 'steps', id: 's', field: 'title', kind: 'title', stepIndex: 0, text: 'rapport' },
    ];
    expect(findAll(fields, 'rapport', { ...o, scope: 'bubbles' })).toHaveLength(1);
    expect(findAll(fields, 'rapport', o)).toHaveLength(2);
  });
});
