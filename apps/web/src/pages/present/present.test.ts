import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESENT,
  clock,
  fromSearch,
  minSec,
  noteLines,
  reportRows,
  spoken,
  toSearch,
  verdictOf,
} from './present';

describe('L22 : mode présentateur', () => {
  it('options aller-retour dans l’adresse, bornées', () => {
    const o = { mode: 'one' as const, start: 3, timer: false, minutes: 30, hideHotspots: true, remote: true };
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
    expect(spoken(845)).toBe('14\u00a0min\u00a005');
  });
  it('notes en puces', () => {
    expect(noteLines('Insister\n\n  Question fréquente  \n')).toEqual(['Insister', 'Question fréquente']);
    expect(noteLines(null)).toEqual([]);
  });
  it('L26-12 : bilan, plus de 6 étapes regroupées, la plus longue gardée', () => {
    const titles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const r = reportRows([72, 41, 348, 104, 60, 80, 70, 70], titles);
    expect(r.map((x) => [x.first, x.last, x.seconds, x.longest, x.count])).toEqual([
      [0, 0, 72, false, 1],
      [1, 1, 41, false, 1],
      [2, 2, 348, true, 1],
      [3, 3, 104, false, 1],
      [4, 7, 280, false, 4],
    ]);
    const far = reportRows([1, 1, 1, 1, 1, 1, 9, 1], titles);
    expect(far.map((x) => [x.first, x.last, x.longest])).toEqual([
      [0, 0, false],
      [1, 1, false],
      [2, 2, false],
      [3, 3, false],
      [6, 6, true],
      [4, 7, false],
    ]);
    expect(reportRows([5, 9], ['a', 'b']).map((x) => x.longest)).toEqual([false, true]);
  });
});

describe('verdictOf (L66, seuil tranché)', () => {
  it('sans minuteur : pas de verdict', () => expect(verdictOf(600, null)).toBeNull());
  it('sous 80 % : plus courte', () => expect(verdictOf(719, 15)).toBe('short'));
  it('80 % pile et 100 % pile : dans les temps', () => {
    expect(verdictOf(720, 15)).toBe('ok');
    expect(verdictOf(900, 15)).toBe('ok');
  });
  it('au-delà : dépassée', () => expect(verdictOf(901, 15)).toBe('over'));
});

describe('NUM-01 : durées du présentateur insécables', () => {
  it('« 14 min 05 » et « 45 s » ne se coupent jamais', () => {
    expect(spoken(845)).toBe('14 min 05');
    expect(minSec(45)).toBe('45 s');
    expect(minSec(760)).toBe('12 min 40');
    expect(/ /.test(spoken(3599) + minSec(9))).toBe(false);
  });
});
