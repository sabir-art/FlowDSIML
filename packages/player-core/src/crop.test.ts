import { describe, expect, it } from 'vitest';
import { asCrop, croppedSize, cropToRatio, outOfFrame, reframe } from './crop';

describe('L25-02 : recadrage', () => {
  it('zone valide ou null', () => {
    expect(asCrop(null)).toBeNull();
    expect(asCrop({ x: 0, y: 0, w: 1, h: 1 })).toBeNull();
    expect(asCrop({ x: 0.1, y: 0.1, w: 0.01, h: 0.5 })).toBeNull();
    expect(asCrop({ x: 0.5, y: 0, w: 0.8, h: 0.5 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });
  it('taille recadrée', () => {
    expect(croppedSize({ width: 1600, height: 900 }, { x: 0.1, y: 0, w: 0.8, h: 0.8 })).toEqual({
      width: 1280,
      height: 720,
    });
  });
  it('les boîtes suivent le recadrage, et reviennent à la réinitialisation', () => {
    const crop = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const h = { x: 0.5, y: 0.5, w: 0.1, h: 0.1 };
    const c = reframe(h, null, crop);
    expect(c).toEqual({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 });
    expect(reframe(c, crop, null)).toEqual(h);
    expect(outOfFrame(reframe({ x: 0.05, y: 0.05, w: 0.05, h: 0.05 }, null, crop))).toBe(true);
    expect(outOfFrame(c)).toBe(false);
  });
  it('format imposé, centré et borné', () => {
    const r = cropToRatio({ width: 1600, height: 900 }, { x: 0, y: 0, w: 1, h: 1 }, 1);
    expect(r).toEqual({ x: 0.2188, y: 0, w: 0.5625, h: 1 });
    expect(cropToRatio({ width: 1600, height: 900 }, { x: 0, y: 0, w: 1, h: 1 }, 16 / 9)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });
});
