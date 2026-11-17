import { describe, expect, it } from 'vitest';
import { beaconCenter, resolvePlacement, tipClass } from './index';

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
