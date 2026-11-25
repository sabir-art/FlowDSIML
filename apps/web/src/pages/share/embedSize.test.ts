import { describe, expect, it } from 'vitest';
import { DEFAULT_EMBED_SIZE, readEmbedSize } from './embedSize';

describe('readEmbedSize', () => {
  it('rend la taille automatique par défaut', () => {
    expect(readEmbedSize(null)).toEqual(DEFAULT_EMBED_SIZE);
    expect(readEmbedSize('pas du json')).toEqual(DEFAULT_EMBED_SIZE);
    expect(readEmbedSize('"texte"')).toEqual(DEFAULT_EMBED_SIZE);
  });
  it('relit une taille fixe et borne les valeurs', () => {
    expect(readEmbedSize('{"fixed":true,"width":800,"height":500}')).toEqual({
      fixed: true,
      width: 800,
      height: 500,
    });
    expect(readEmbedSize('{"fixed":true,"width":5,"height":99999}')).toEqual({
      fixed: true,
      width: 200,
      height: 4000,
    });
    expect(readEmbedSize('{"fixed":"oui","width":"x"}')).toEqual(DEFAULT_EMBED_SIZE);
  });
});
