import { describe, expect, it } from 'vitest';
import { defaultHotspotTitle, elementLabel, hotspotRect, toRelRect } from './geometry';

const vp = { width: 1000, height: 500 };

describe('geometry', () => {
  it('convertit en coordonnées relatives et borne au cadre', () => {
    expect(toRelRect({ left: 100, top: 50, width: 200, height: 100 }, vp)).toEqual({
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.2,
    });
    expect(toRelRect({ left: 900, top: 450, width: 400, height: 400 }, vp)).toEqual({
      x: 0.9,
      y: 0.9,
      w: 0.1,
      h: 0.1,
    });
    expect(toRelRect({ left: 2000, top: 0, width: 10, height: 10 }, vp)).toBeNull();
  });
  it('utilise la boîte de l’élément si raisonnable, sinon une zone autour du clic', () => {
    expect(hotspotRect({ x: 150, y: 100 }, { left: 100, top: 80, width: 120, height: 40 }, vp)).toEqual({
      x: 0.1,
      y: 0.16,
      w: 0.12,
      h: 0.08,
    });
    const big = hotspotRect({ x: 500, y: 250 }, { left: 0, top: 0, width: 1000, height: 500 }, vp);
    expect(big.w).toBeCloseTo(0.032);
  });
  it('produit un libellé et un titre', () => {
    expect(elementLabel({ text: '  Créer   un  projet ' })).toBe('Créer un projet');
    expect(elementLabel({ ariaLabel: 'Fermer', text: 'x' })).toBe('Fermer');
    expect(defaultHotspotTitle('Créer')).toBe('Cliquez sur « Créer »');
    expect(defaultHotspotTitle('', 'en')).toBe('Click here');
  });
});
