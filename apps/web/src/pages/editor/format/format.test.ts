import { describe, expect, it } from 'vitest';
import { clipRect, fitInside, keepInside, layout, mapRect, outside, targetSize, unmapRect } from './format';
import { mapLayers } from './applyFormat';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('format des écrans', () => {
  it('taille cible', () => {
    expect(targetSize('16:9', 1280, { w: 1440, h: 900 })).toEqual({ w: 1280, h: 720 });
    expect(targetSize('4:3', 1440, { w: 1920, h: 1080 })).toEqual({ w: 1440, h: 1080 });
    expect(targetSize('original', 1280, { w: 1920, h: 1080 })).toEqual({ w: 1280, h: 720 });
    expect(targetSize('custom', 1280, { w: 1920, h: 1080 }, { w: 1000, h: 1000 })).toEqual({
      w: 1000,
      h: 1000,
    });
  });

  it('Adapter : image entière avec bandes, repère sur le même pixel', () => {
    // 1 440 × 900 (16:10) dans 1 280 × 720 (16:9) : bandes à gauche et à droite
    const l = layout({ w: 1440, h: 900 }, { w: 1280, h: 720 }, 'fit');
    near(l.dh, 720);
    near(l.dw, 1152);
    near(l.ox, 64);
    const r = mapRect({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, l);
    // Centre de l'image → centre du cadre
    near(r.x + r.w / 2, 0.5 + (0.05 * 1152) / 1280);
    near(r.y, 0.5);
    expect(outside(mapRect({ x: 0, y: 0, w: 1, h: 1 }, l))).toBe(false);
  });

  it('Recadrer : cadre rempli, centré sur le repère, sortie signalée', () => {
    // 1 920 × 1 080 dans 4:3 : on coupe à gauche et à droite ; repère tout à droite
    const l = layout({ w: 1920, h: 1080 }, { w: 1440, h: 1080 }, 'fill', { x: 0.9, y: 0.5 });
    near(l.dh, 1080);
    near(l.ox, 1440 - 1920); // décalage maximal : bord droit de l'image sur le bord droit du cadre
    const hs = mapRect({ x: 0.88, y: 0.4, w: 0.04, h: 0.05 }, l);
    expect(outside(hs)).toBe(false);
    const left = mapRect({ x: 0.02, y: 0.4, w: 0.04, h: 0.05 }, l);
    expect(outside(left)).toBe(true);
    expect(keepInside(left).x).toBe(0);
  });

  it('flou coupé : partie visible gardée', () => {
    const c = clipRect({ x: -0.1, y: 0.2, w: 0.3, h: 0.1 })!;
    near(c.x, 0);
    near(c.y, 0.2);
    near(c.w, 0.2);
    near(c.h, 0.1);
    expect(clipRect({ x: -0.5, y: 0.2, w: 0.3, h: 0.1 })).toBeNull();
  });

  it('images ajoutées : aller et retour entre l’origine et le cadre', () => {
    const l = layout({ w: 1440, h: 900 }, { w: 1280, h: 720 }, 'fit');
    const r = { x: 0.5, y: 0.5, w: 0.2, h: 0.2, id: 'i1' };
    const back = unmapRect(mapRect(r, l), l);
    near(back.x, r.x);
    near(back.y, r.y);
    near(back.w, r.w);
    near(back.h, r.h);
    expect(back.id).toBe('i1');
  });

  it('images ajoutées : gardées entières dans le cadre', () => {
    expect(fitInside({ x: 0.9, y: -0.2, w: 0.2, h: 0.2 })).toEqual({ x: 0.8, y: 0, w: 0.2, h: 0.2 });
    // plus grande que le cadre : réduite en gardant ses proportions
    expect(fitInside({ x: 0, y: 0, w: 2, h: 1 })).toEqual({ x: 0, y: 0, w: 1, h: 0.5 });
  });

  it('images ajoutées : un deuxième changement de format repart de l’image d’origine', () => {
    const src = { w: 1440, h: 900 };
    const first = layout(src, { w: 1280, h: 720 }, 'fit');
    const second = layout(src, { w: 1000, h: 1000 }, 'fit');
    const r = { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    const once = mapLayers([r], null, first);
    const twice = mapLayers(once, first, second)[0]!;
    const direct = mapLayers([r], null, second)[0]!;
    expect(twice.x).toBeCloseTo(direct.x, 3);
    expect(twice.y).toBeCloseTo(direct.y, 3);
    expect(twice.w).toBeCloseTo(direct.w, 3);
    expect(twice.h).toBeCloseTo(direct.h, 3);
  });
});
