import { describe, expect, it } from 'vitest';
import { orderImages } from './importImages';

const f = (name: string, type = 'image/png') => new File([''], name, { type });

describe('orderImages', () => {
  it('trie par nom en tenant compte des numéros', () => {
    const out = orderImages([f('ecran-10.png'), f('Ecran-2.png'), f('ecran-1.jpg', 'image/jpeg')]);
    expect(out.map((x) => x.name)).toEqual(['ecran-1.jpg', 'Ecran-2.png', 'ecran-10.png']);
  });
  it('écarte les formats non pris en charge', () => {
    expect(
      orderImages([f('notes.pdf', 'application/pdf'), f('a.webp', 'image/webp')]).map((x) => x.name),
    ).toEqual(['a.webp']);
  });
});
