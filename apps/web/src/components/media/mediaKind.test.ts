import { describe, expect, it } from 'vitest';
import { deduceKind, type FileFacts } from './mediaKind';

const f = (over: Partial<FileFacts>): FileFacts => ({
  font: false,
  svg: false,
  width: null,
  height: null,
  alpha: null,
  ...over,
});

describe('médiathèque : catégorie déduite à l’import', () => {
  it('WOFF2 : police, quel que soit le filtre', () => {
    expect(deduceKind(f({ font: true }))).toEqual({ kind: 'font', reason: 'font' });
    expect(deduceKind(f({ font: true }), 'logo').kind).toBe('font');
  });
  it('SVG : logo', () => {
    expect(deduceKind(f({ svg: true }))).toEqual({ kind: 'logo', reason: 'svg' });
  });
  it('PNG transparent et à peu près carré, 1 024 px au plus : logo', () => {
    expect(deduceKind(f({ width: 512, height: 512, alpha: true }))).toEqual({
      kind: 'logo',
      reason: 'transparentSquare',
    });
    expect(deduceKind(f({ width: 1024, height: 512, alpha: true })).kind).toBe('logo');
    expect(deduceKind(f({ width: 400, height: 800, alpha: true })).kind).toBe('logo');
  });
  it('sinon : image', () => {
    // opaque
    expect(deduceKind(f({ width: 512, height: 512, alpha: false }))).toEqual({
      kind: 'image',
      reason: 'default',
    });
    // trop allongé
    expect(deduceKind(f({ width: 1000, height: 400, alpha: true })).kind).toBe('image');
    // trop grand
    expect(deduceKind(f({ width: 1600, height: 1600, alpha: true })).kind).toBe('image');
    // JPEG : ni dimensions lues ni transparence
    expect(deduceKind(f({})).kind).toBe('image');
  });
  it('importé depuis un filtre : la catégorie du filtre l’emporte', () => {
    expect(deduceKind(f({ svg: true }), 'image')).toEqual({ kind: 'image', reason: 'filter' });
    expect(deduceKind(f({ width: 2000, height: 900, alpha: false }), 'logo')).toEqual({
      kind: 'logo',
      reason: 'filter',
    });
    // « Polices » n'impose rien à une image
    expect(deduceKind(f({ svg: true }), 'font').kind).toBe('logo');
  });
});
