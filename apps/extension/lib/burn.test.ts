import { describe, expect, it } from 'vitest';
import { blockSize, burnBox } from './burn';

describe('flou incrusté', () => {
  it('élargit la zone d’une marge et la borne à l’image', () => {
    expect(burnBox({ x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, 1000, 500)).toEqual({ x: 96, y: 46, w: 208, h: 58 });
    expect(burnBox({ x: 0.95, y: 0.95, w: 0.1, h: 0.1 }, 100, 100)).toEqual({ x: 91, y: 91, w: 9, h: 9 });
  });
  it('pavés d’au moins 8 px', () => {
    expect(blockSize(200, 10)).toBe(8);
    expect(blockSize(200, 40)).toBe(20);
  });
});
