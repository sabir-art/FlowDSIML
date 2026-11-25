import { describe, expect, it } from 'vitest';
import { asFrameMode, elementCrop, frameFor, intoCrop, zoneFrame } from './frame';

const vp = { width: 1440, height: 900 };

describe('cadre « Élément » (EXT-02 §5)', () => {
  it('ajoute 48 px de marge et élargit au minimum de 480 × 300 autour de l’élément', () => {
    // Bouton de 120 × 40 au centre : 216 × 136 avec la marge, porté à 480 × 300
    const c = elementCrop({ left: 660, top: 430, width: 120, height: 40 }, vp)!;
    expect(Math.round(c.w * vp.width)).toBe(480);
    expect(Math.round(c.h * vp.height)).toBe(300);
    expect(Math.round((c.x + c.w / 2) * vp.width)).toBe(720);
    expect(Math.round((c.y + c.h / 2) * vp.height)).toBe(450);
  });
  it('garde la marge de 48 px quand l’élément dépasse le minimum', () => {
    const c = elementCrop({ left: 300, top: 200, width: 600, height: 400 }, vp)!;
    expect(Math.round(c.x * vp.width)).toBe(252);
    expect(Math.round(c.y * vp.height)).toBe(152);
    expect(Math.round(c.w * vp.width)).toBe(696);
    expect(Math.round(c.h * vp.height)).toBe(496);
  });
  it('reste dans l’image près d’un bord, sans perdre de taille', () => {
    const c = elementCrop({ left: 1300, top: 10, width: 120, height: 36 }, vp)!;
    expect(c.x + c.w).toBeLessThanOrEqual(1.0001);
    expect(c.y).toBe(0);
    expect(Math.round(c.w * vp.width)).toBe(480);
    expect(Math.round(c.h * vp.height)).toBe(300);
  });
  it('ne recadre pas un élément qui couvre plus de 80 % de la vue, ni sans élément', () => {
    expect(elementCrop({ left: 0, top: 0, width: 1400, height: 880 }, vp)).toBeNull();
    expect(elementCrop(null, vp)).toBeNull();
  });
  it('ne recadre pas quand le cadre minimal couvre toute une petite vue', () => {
    expect(
      elementCrop({ left: 100, top: 100, width: 100, height: 40 }, { width: 400, height: 280 }),
    ).toBeNull();
  });
});

describe('cadre « Zone »', () => {
  const zone = { left: 346, top: 120, width: 748, height: 300 };
  it('garde la zone quand le clic y tombe', () => {
    const f = zoneFrame(zone, { x: 500, y: 200 }, vp);
    expect(f.outside).toBeUndefined();
    expect(Math.round(f.crop!.x * vp.width)).toBe(346);
    expect(Math.round(f.crop!.w * vp.width)).toBe(748);
  });
  it('garde la page entière et le signale quand le clic est hors de la zone', () => {
    expect(zoneFrame(zone, { x: 100, y: 800 }, vp)).toEqual({ mode: 'zone', crop: null, outside: true });
    expect(zoneFrame(null, { x: 100, y: 100 }, vp).outside).toBe(true);
  });
});

describe('frameFor et intoCrop', () => {
  it('« Page » ne recadre jamais ; un mode inconnu vaut « Page »', () => {
    expect(frameFor('page', { element: null, click: { x: 1, y: 1 }, viewport: vp })).toEqual({
      mode: 'page',
      crop: null,
    });
    expect(asFrameMode('autre')).toBe('page');
    expect(asFrameMode('zone')).toBe('zone');
  });
  it('ramène un hotspot dans le cadre', () => {
    const crop = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    expect(intoCrop({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, crop)).toEqual({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 });
    expect(intoCrop({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, null)).toEqual({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 });
    // Hors du cadre : rien
    expect(intoCrop({ x: 0.9, y: 0.9, w: 0.05, h: 0.05 }, crop)).toBeNull();
    // À cheval : borné au cadre
    expect(intoCrop({ x: 0.2, y: 0.3, w: 0.1, h: 0.1 }, crop)).toEqual({ x: 0, y: 0.1, w: 0.1, h: 0.2 });
  });
});
