import { describe, expect, it } from 'vitest';
import { ringVars } from './Quiz';
import { contrast } from './center';

describe('L42 : couleurs de l’anneau de score', () => {
  it('thème par défaut : couleur principale et ardoise', () => {
    expect(ringVars('#A3195B', '#FFFFFF', '#080808')).toEqual({
      '--p-ring-pass': '#A3195B',
      '--p-ring-fail': '#5b6675',
    });
  });
  it('carte sombre : prune claire et ardoise claire', () => {
    expect(ringVars('#A3195B', '#1B1E23', '#F3F5F8')).toEqual({
      '--p-ring-pass': '#CF86A9',
      '--p-ring-fail': '#A9B3BF',
    });
  });
  it('couleur principale trop pâle : texte à 70 %, au moins 3:1 contre la piste', () => {
    const v = ringVars('#F4E9B0', '#FFFFFF', '#080808');
    expect(v['--p-ring-pass']).not.toBe('#F4E9B0');
    expect(contrast(v['--p-ring-pass']!, '#e7e7e7')).toBeGreaterThanOrEqual(3);
  });
  it('couleur invalide : aucune variable (valeurs CSS par défaut)', () => {
    expect(ringVars('red', '#FFFFFF', '#080808')).toEqual({});
  });
});
