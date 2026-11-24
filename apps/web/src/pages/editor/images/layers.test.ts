import { describe, expect, it } from 'vitest';
import {
  MAX_LAYERS,
  asLayers,
  isFull,
  fitRect,
  frameToImage,
  growRect,
  layerName,
  moveRect,
  needsAlt,
  placeNew,
  reorder,
  resizeRect,
  type ImageLayer,
} from './layers';

const base: ImageLayer = { id: 'a', path: 'ws/demo/a.webp', x: 0.4, y: 0.4, w: 0.2, h: 0.2 };

describe('images ajoutées', () => {
  it('ne lit que les images complètes', () => {
    expect(asLayers(null)).toEqual([]);
    expect(asLayers({ images: 'non' })).toEqual([]);
    expect(asLayers({ images: [base, { id: 'b' }, null, { ...base, x: '1' }] })).toEqual([base]);
  });

  it('nomme une image par son texte alternatif court, sinon par son fichier', () => {
    expect(layerName({ alt: 'Logo Acme', name: 'logo.png' }, 'Image')).toBe('Logo Acme');
    expect(layerName({ alt: 'x'.repeat(60), name: 'logo.png' }, 'Image')).toBe('logo.png');
    expect(layerName({}, 'Image')).toBe('Image');
  });

  it('signale une image visible sans texte alternatif ni mention décorative', () => {
    expect(needsAlt(base)).toBe(true);
    expect(needsAlt({ ...base, alt: '  ' })).toBe(true);
    expect(needsAlt({ ...base, alt: 'Flèche' })).toBe(false);
    expect(needsAlt({ ...base, decorative: true })).toBe(false);
    expect(needsAlt({ ...base, hidden: true })).toBe(false);
  });

  it('pose une image au centre, à 30 % de la largeur', () => {
    // image 2:1 dans un cadre 16:10 : hauteur = 0,3 × 1,6 / 2
    expect(placeNew(2, 1.6)).toEqual({ x: 0.35, y: 0.38, w: 0.3, h: 0.24 });
    // image très haute : ramenée à 80 % de la hauteur
    const tall = placeNew(0.25, 1.6);
    expect(tall.h).toBe(0.8);
    expect(tall.w).toBeCloseTo(0.125, 4);
    expect(tall.x + tall.w / 2).toBeCloseTo(0.5, 3);
  });

  it('redimensionne par un coin en gardant le coin opposé', () => {
    expect(resizeRect(base, 1, 1, { x: 0.7, y: 0.5 }, null)).toEqual({ x: 0.4, y: 0.4, w: 0.3, h: 0.1 });
    expect(resizeRect(base, -1, -1, { x: 0.3, y: 0.2 }, null)).toEqual({ x: 0.3, y: 0.2, w: 0.3, h: 0.4 });
  });

  it('garde les proportions quand elles sont demandées', () => {
    const r = resizeRect(base, 1, 1, { x: 0.8, y: 0.45 }, 1);
    expect(r).toEqual({ x: 0.4, y: 0.4, w: 0.4, h: 0.4 });
    // poignée de milieu : l'autre dimension suit, centrée
    const e = resizeRect(base, 1, 0, { x: 0.7, y: 0 }, 1);
    expect(e).toEqual({ x: 0.4, y: 0.35, w: 0.3, h: 0.3 });
  });

  it('reste dans le cadre', () => {
    expect(resizeRect(base, 1, 1, { x: 3, y: 3 }, null)).toEqual({ x: 0.4, y: 0.4, w: 0.6, h: 0.6 });
    const kept = resizeRect(base, 1, 1, { x: 3, y: 0.5 }, 2);
    expect(kept.x + kept.w).toBeLessThanOrEqual(1);
    expect(kept.y + kept.h).toBeLessThanOrEqual(1);
    expect(kept.w / kept.h).toBeCloseTo(2, 3);
    expect(resizeRect(base, 1, 1, { x: 0, y: 0 }, null)).toEqual({ x: 0.4, y: 0.4, w: 0.01, h: 0.01 });
    expect(moveRect(base, 2, -2)).toEqual({ x: 0.8, y: 0, w: 0.2, h: 0.2 });
  });

  it('redimensionne au clavier depuis le coin haut gauche', () => {
    expect(growRect(base, 0.01, 0, null)).toEqual({ x: 0.4, y: 0.4, w: 0.21, h: 0.2 });
    expect(growRect(base, 0, -0.01, null)).toEqual({ x: 0.4, y: 0.4, w: 0.2, h: 0.19 });
  });

  it('fait suivre la hauteur quand la largeur est saisie avec les proportions gardées', () => {
    expect(fitRect(base, { ...base, w: 0.3 }, 2)).toEqual({ x: 0.4, y: 0.4, w: 0.3, h: 0.15 });
    expect(fitRect(base, { ...base, h: 0.1 }, 2)).toEqual({ x: 0.4, y: 0.4, w: 0.2, h: 0.1 });
    expect(fitRect(base, { ...base, x: 0.1 }, 2)).toEqual({ ...pos(base), x: 0.1 });
    expect(fitRect(base, { ...base, w: 0.3 }, null)).toEqual({ x: 0.4, y: 0.4, w: 0.3, h: 0.2 });
  });

  it('limite à 10 images par étape', () => {
    expect(MAX_LAYERS).toBe(10);
    expect(isFull(Array.from({ length: 9 }))).toBe(false);
    expect(isFull(Array.from({ length: 10 }))).toBe(true);
    expect(isFull(Array.from({ length: 11 }))).toBe(true);
  });

  it('monte et descend une image dans la liste', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(reorder(list, 'a', 1).map((l) => l.id)).toEqual(['b', 'a', 'c']);
    expect(reorder(list, 'c', -1).map((l) => l.id)).toEqual(['a', 'c', 'b']);
    expect(reorder(list, 'c', 1)).toBe(list);
  });

  it('ramène une zone du cadre recadré dans l’image entière', () => {
    expect(frameToImage(base, null)).toBe(base);
    const r = frameToImage({ x: 0.5, y: 0.5, w: 0.5, h: 0.25 }, { x: 0.2, y: 0.1, w: 0.6, h: 0.8 });
    expect(r.x).toBeCloseTo(0.5);
    expect(r.y).toBeCloseTo(0.5);
    expect(r.w).toBeCloseTo(0.3);
    expect(r.h).toBeCloseTo(0.2);
  });
});

function pos(r: { x: number; y: number; w: number; h: number }) {
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}
