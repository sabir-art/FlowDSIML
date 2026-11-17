import { describe, expect, it } from 'vitest';
import { beaconCenter, resolvePlacement, themeVars, tipClass, zoomBox, zoomOrigin } from './index';
import { themeSchema } from '@flowdsiml/manifest';

describe('player-core', () => {
  it('place la bulle', () => {
    expect(resolvePlacement('auto', { x: 0.1, y: 0.1, w: 0.1, h: 0.1 })).toBe('bottom');
    expect(resolvePlacement('auto', { x: 0.1, y: 0.8, w: 0.1, h: 0.1 })).toBe('top');
    expect(resolvePlacement('right', { x: 0.1, y: 0.8, w: 0.1, h: 0.1 })).toBe('right');
  });
  it('décale près des bords', () => {
    expect(tipClass({ x: 0.0, y: 0.1, w: 0.1, h: 0.1 }, 'auto')).toBe('p-tip p-tip-bottom p-tip-shift-r');
    expect(tipClass({ x: 0.9, y: 0.8, w: 0.1, h: 0.1 }, 'auto')).toBe('p-tip p-tip-top p-tip-shift-l');
  });
  it('centre la pastille', () => {
    expect(beaconCenter({ x: 0.2, y: 0.4, w: 0.2, h: 0.2 })).toEqual({ left: '30%', top: '50%' });
  });
});

describe('zoom (PL2)', () => {
  it('projette une boîte en coordonnées écran', () => {
    const b = zoomBox({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, { x: 0.5, y: 0.5 }, 2);
    expect(b).toMatchObject({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 });
  });
  it('recale l’origine pour garder le hotspot dans le cadre', () => {
    const focus = { x: 0.9, y: 0.45, w: 0.04, h: 0.04 };
    const zoom = { x: 0.2, y: 0.5, scale: 1.4 };
    const o = zoomOrigin(zoom, focus);
    const c = zoomBox(focus, o, 1.4);
    expect(c.x + c.w / 2).toBeLessThan(0.9);
    expect(c.x + c.w / 2).toBeGreaterThanOrEqual(0.12);
    expect(o.y).toBe(0.5);
  });
});

describe('spotlightVeilPath', () => {
  it('cadre plein + un trou par zone (evenodd)', async () => {
    const { spotlightVeilPath } = await import('./index');
    expect(spotlightVeilPath([])).toBe('M0 0H100V100H0Z');
    expect(spotlightVeilPath([{ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }])).toBe('M0 0H100V100H0ZM10 20V30H40V20Z');
  });
});

describe('themeVars : fond dégradé (EDT-10)', () => {
  it('aucun dégradé par défaut', () => {
    expect(themeVars(themeSchema.parse({}))['--p-bg-image']).toBe('none');
  });
  it('dégradé à partir des couleurs du thème', () => {
    const v = themeVars(themeSchema.parse({ backgroundGradient: true }))['--p-bg-image'];
    expect(v).toContain('linear-gradient');
    expect(v).toContain('#A3195B');
  });
});
