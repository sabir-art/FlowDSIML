import { describe, expect, it } from 'vitest';
import { FULL_MAX_HEIGHT, fullHeight, fullPageBlurs, tabSize, viewportToPage } from './fullpage';

const vp = { width: 1000, height: 500 };
const page = { width: 1000, height: 2000, scrollX: 0, scrollY: 500 };

describe('L25-01 : taille de l’onglet', () => {
  it('garde la taille actuelle', () => expect(tabSize('current', { w: 0, h: 0 })).toBeNull());
  it('tailles prédéfinies', () => expect(tabSize('1440x900', { w: 0, h: 0 })).toEqual({ w: 1440, h: 900 }));
  it('taille personnalisée bornée de 800 à 2 560 px', () => {
    expect(tabSize('custom', { w: 600, h: 3000 })).toEqual({ w: 800, h: 2560 });
    expect(tabSize('custom', { w: 1600, h: 900 })).toEqual({ w: 1600, h: 900 });
    expect(tabSize('custom', { w: Number.NaN, h: 900 })).toEqual({ w: 800, h: 900 });
  });
});

describe('L25-01 : capture pleine page', () => {
  it('hauteur bornée', () => {
    expect(fullHeight({ ...page, height: 50000 })).toBe(FULL_MAX_HEIGHT);
    expect(fullHeight(page)).toBe(2000);
  });
  it('zone du viewport ramenée sur la page (défilement compris)', () => {
    expect(viewportToPage({ x: 0.1, y: 0.2, w: 0.5, h: 0.1 }, vp, page)).toEqual({
      x: 0.1,
      y: (100 + 500) / 2000,
      w: 0.5,
      h: 50 / 2000,
    });
  });
  it('floute par défaut, sauf une zone décochée au même endroit ; ajoute les zones cochées', () => {
    const decochee = { type: 'email' as const, rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.1 }, blur: false };
    const manuelle = {
      type: 'zone' as const,
      rect: { x: 0, y: 0, w: 0.1, h: 0.1 },
      blur: true,
      manual: true,
    };
    const pageZones = [
      { type: 'email' as const, rect: viewportToPage(decochee.rect, vp, page) },
      { type: 'phone' as const, rect: { x: 0, y: 0.9, w: 0.2, h: 0.01 } },
    ];
    const out = fullPageBlurs(pageZones, [decochee, manuelle], vp, page);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(pageZones[1]!.rect);
    expect(out[1]).toEqual(viewportToPage(manuelle.rect, vp, page));
  });
  it('un autre type au même endroit reste flouté', () => {
    const decochee = { type: 'email' as const, rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.1 }, blur: false };
    const pageZones = [{ type: 'phone' as const, rect: viewportToPage(decochee.rect, vp, page) }];
    expect(fullPageBlurs(pageZones, [decochee], vp, page)).toHaveLength(1);
  });
});
