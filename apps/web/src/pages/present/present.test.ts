import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESENT, clock, fromSearch, noteLines, spoken, toSearch } from './present';

describe('L22 : mode présentateur', () => {
  it('options aller-retour dans l’adresse, bornées', () => {
    const o = { mode: 'one' as const, start: 3, timer: false, minutes: 30, hideHotspots: true };
    expect(fromSearch(toSearch(o), 8)).toEqual(o);
    expect(fromSearch('?start=99&min=999', 5)).toMatchObject({
      start: 4,
      minutes: 180,
      mode: 'two',
      timer: true,
    });
    expect(fromSearch('', 5)).toEqual(DEFAULT_PRESENT);
  });
  it('minuteur et durée', () => {
    expect(clock(402)).toBe('06:42');
    expect(clock(3723)).toBe('1:02:03');
    expect(spoken(845)).toBe('14 min 05');
  });
  it('notes en puces', () => {
    expect(noteLines('Insister\n\n  Question fréquente  \n')).toEqual(['Insister', 'Question fréquente']);
    expect(noteLines(null)).toEqual([]);
  });
});
