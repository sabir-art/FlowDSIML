import { describe, expect, it } from 'vitest';
import { computePosition } from './floating';

const rect = (left: number, top: number, w = 32, h = 32) => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
  width: w,
  height: h,
});

describe('computePosition', () => {
  it('bottom-end : sous le déclencheur, aligné à droite', () => {
    const p = computePosition(rect(500, 100), { width: 200, height: 150 }, 'bottom-end', 1280, 800);
    expect(p).toMatchObject({ top: 136, left: 332, placement: 'bottom-end' });
  });
  it('retourne vers le haut quand la place manque en bas', () => {
    const p = computePosition(rect(500, 740), { width: 200, height: 150 }, 'bottom-end', 1280, 800);
    expect(p.placement).toBe('top-end');
    expect(p.top + 150).toBeLessThanOrEqual(740);
  });
  it('top-start du menu de compte : dépasse la barre latérale mais reste à 8 px des bords', () => {
    const p = computePosition(rect(200, 740), { width: 240, height: 260 }, 'top-start', 1280, 800);
    expect(p).toMatchObject({ left: 200, placement: 'top-start' });
    const q = computePosition(rect(1250, 740), { width: 240, height: 260 }, 'top-start', 1280, 800);
    expect(q.left).toBe(1280 - 8 - 240);
    const r = computePosition(rect(2, 100), { width: 240, height: 100 }, 'bottom-end', 1280, 800);
    expect(r.left).toBe(8);
  });
  it('décale le menu pour le montrer en entier quand aucun côté ne suffit', () => {
    // Bouton au milieu d'une fenêtre de 768 px : 360 px au-dessus et au-dessous, menu de 460 px
    const p = computePosition(rect(500, 370, 32, 32), { width: 220, height: 460 }, 'bottom-end', 1024, 768);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + 460).toBeLessThanOrEqual(768 - 8);
    expect(p.maxHeight).toBeGreaterThanOrEqual(460);
  });
  it('limite la hauteur à l’espace disponible', () => {
    const p = computePosition(rect(10, 300, 32, 32), { width: 200, height: 2000 }, 'bottom-start', 1280, 800);
    expect(p.maxHeight).toBe(800 - 332 - 4 - 8);
  });
});
