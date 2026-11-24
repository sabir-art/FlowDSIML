import { describe, expect, it } from 'vitest';
import {
  addFrame,
  clock,
  manualMask,
  maskBox,
  rectsAt,
  segments,
  span,
  toBurn,
  type MaskFrame,
  type VideoMask,
} from './videoMasks';

const R = (x: number, y = 0.1) => ({ x, y, w: 0.2, h: 0.05 });
const mask = (frames: MaskFrame[], extra: Partial<VideoMask> = {}): VideoMask => ({
  id: 'm1',
  type: 'name',
  excerpt: 'C•••••• M••••••',
  by: 'pattern',
  live: false,
  on: true,
  frames,
  ...extra,
});

describe('suivi des données repérées en vidéo (EXT-02 §4)', () => {
  it('addFrame ne garde que les changements', () => {
    const f: MaskFrame[] = [];
    addFrame(f, { t: 0, rects: [] });
    expect(f).toHaveLength(0);
    addFrame(f, { t: 100, rects: [R(0.1)] });
    addFrame(f, { t: 200, rects: [R(0.1)] });
    addFrame(f, { t: 300, rects: [R(0.1, 0.3)] });
    addFrame(f, { t: 250, rects: [R(0.5)] });
    addFrame(f, { t: 400, rects: [] });
    expect(f.map((x) => [x.t, x.rects.length])).toEqual([
      [100, 1],
      [300, 1],
      [400, 0],
    ]);
  });

  it('passages à l’écran et étendue', () => {
    const m = mask([
      { t: 4000, rects: [R(0.1)] },
      { t: 9000, rects: [] },
      { t: 12000, rects: [R(0.1)] },
    ]);
    expect(segments(m, 20000)).toEqual([
      [4000, 9000],
      [12000, 20000],
    ]);
    expect(span(m, 20000)).toEqual([4000, 20000]);
    expect(span(mask([]), 20000)).toBeNull();
  });

  it('rectsAt : position courante, plus celles relevées juste avant et après', () => {
    const m = mask([
      { t: 1000, rects: [R(0.1, 0.5)] },
      { t: 2000, rects: [R(0.1, 0.4)] },
      { t: 2100, rects: [R(0.1, 0.3)] },
      { t: 5000, rects: [] },
    ]);
    expect(rectsAt(m, 500)).toEqual([]);
    expect(rectsAt(m, 1500)).toEqual([R(0.1, 0.5)]);
    // Défilement en cours : les positions voisines sont couvertes aussi
    const ys = (t: number) =>
      rectsAt(m, t)
        .map((r) => r.y)
        .sort();
    expect(ys(2050)).toEqual([0.3, 0.4, 0.5]);
    expect(ys(1950)).toEqual([0.3, 0.4, 0.5]);
    expect(ys(3000)).toEqual([0.3]);
    expect(rectsAt(m, 6000)).toEqual([]);
  });

  it('boîte en pixels bornée à l’image', () => {
    expect(maskBox({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1000, 500)).toEqual({ x: 0, y: 0, w: 506, h: 256 });
    expect(maskBox({ x: 0.9, y: 0.9, w: 0.2, h: 0.2 }, 1000, 500, 4)).toEqual({
      x: 896,
      y: 446,
      w: 104,
      h: 54,
    });
  });

  it('à incruster : actif et pas déjà masqué en direct', () => {
    const list = [
      mask([{ t: 0, rects: [R(0.1)] }], { id: 'a' }),
      mask([{ t: 0, rects: [R(0.1)] }], { id: 'b', on: false }),
      mask([{ t: 0, rects: [R(0.1)] }], { id: 'c', live: true }),
    ];
    expect(toBurn(list).map((m) => m.id)).toEqual(['a']);
  });

  it('masque ajouté à la main : une zone fixe sur un passage', () => {
    const m = manualMask('x1', R(0.3), 2000, 6000);
    expect(segments(m, 10000)).toEqual([[2000, 6000]]);
    expect(rectsAt(m, 3000)).toEqual([R(0.3)]);
    expect(m.on && !m.live && m.type === 'manual').toBe(true);
  });

  it('horloge de la chronologie', () => {
    expect([clock(0), clock(7400), clock(62000)]).toEqual(['0:00', '0:07', '1:02']);
  });
});
