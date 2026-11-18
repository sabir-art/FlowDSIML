import { describe, expect, it } from 'vitest';
import { isoToParis, parisToIso } from './AccessPanel';

describe('heure de Paris (expiration L11)', () => {
  it('hiver : UTC+1', () => {
    expect(parisToIso('2026-11-30', '18:00')).toBe('2026-11-30T17:00:00.000Z');
    expect(isoToParis('2026-11-30T17:00:00.000Z')).toEqual({ date: '2026-11-30', time: '18:00' });
  });
  it('été : UTC+2', () => {
    expect(parisToIso('2026-07-14', '09:30')).toBe('2026-07-14T07:30:00.000Z');
    expect(isoToParis('2026-07-14T07:30:00.000Z')).toEqual({ date: '2026-07-14', time: '09:30' });
  });
  it('saisie invalide', () => {
    expect(parisToIso('30/11/2026', '18:00')).toBeNull();
  });
});
