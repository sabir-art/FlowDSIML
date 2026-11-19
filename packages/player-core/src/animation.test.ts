import { describe, expect, it } from 'vitest';
import { defaultScroll, maxScroll, scrollPlan, typingDuration } from './animation';

const fp = { width: 1280, height: 2400, top: 600, viewportHeight: 720 };

describe('L25-04/05 : animations', () => {
  it('saisie : durée selon la vitesse', () => {
    expect(typingDuration('Rapport', 'slow')).toBe(7 * 90);
    expect(typingDuration('Rapport', 'fast')).toBe(7 * 25);
  });
  it('défilement : distances bornées par la page', () => {
    expect(maxScroll(fp, 'down')).toBe(600);
    expect(maxScroll(fp, 'up')).toBe(2400 - 720 - 600);
    expect(defaultScroll(fp)).toEqual({ direction: 'down', distance: 600 });
    expect(defaultScroll({ ...fp, top: 0 })).toEqual({ direction: 'up', distance: 640 });
  });
  it('défilement : départ et arrivée (arrivée = capture de l’étape)', () => {
    expect(scrollPlan(fp, { type: 'scroll', direction: 'down', distance: 400, duration: 1.2 })).toEqual({
      from: 200,
      to: 600,
      distance: 400,
    });
    expect(scrollPlan(fp, { type: 'scroll', direction: 'down', distance: 5000, duration: 1.2 }).from).toBe(0);
    expect(scrollPlan(fp, { type: 'scroll', direction: 'up', distance: 300, duration: 2 }).from).toBe(900);
  });
});
