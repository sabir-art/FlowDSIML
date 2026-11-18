import { describe, expect, it } from 'vitest';
import {
  activityOf,
  activityOfField,
  idleMinutes,
  isIdle,
  othersFrom,
  stack,
  topic,
  type PresencePayload,
} from './presence';

const p = (u: string, t: number, s = 's1'): PresencePayload => ({ u, s, a: null, t, c: null, e: null });

describe('L22-08 : présence', () => {
  it('sujet du canal conforme à la regex de la migration', () => {
    expect(topic('0b5c1f0e-0000-4000-8000-000000000001')).toMatch(
      /^demo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
  it('une entrée par personne, la plus récente, sans soi-même', () => {
    const others = othersFrom(
      { k1: [p('me', 5)], k2: [p('b', 1, 's1'), p('b', 9, 's2')], k3: [p('a', 3)] },
      'me',
    );
    expect(others.map((x) => [x.u, x.s])).toEqual([
      ['a', 's1'],
      ['b', 's2'],
    ]);
  });
  it('inactif au-delà de 2 minutes', () => {
    expect(isIdle({ t: 0 }, 119_000)).toBe(false);
    expect(isIdle({ t: 0 }, 121_000)).toBe(true);
    expect(idleMinutes({ t: 0 }, 3 * 60_000 + 5000)).toBe(3);
  });
  it('activité du champ qui a le focus ou du champ modifié', () => {
    expect(activityOf('hs-body')).toBe('bubble');
    expect(activityOf('st-notes')).toBe('notes');
    expect(activityOf('st-chapter')).toBe('step');
    expect(activityOf('search')).toBeNull();
    expect(activityOfField('hotspots', 'body')).toBe('bubble');
    expect(activityOfField('steps', 'title')).toBe('title');
  });
  it('3 avatars puis +n', () => {
    expect(stack([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3], more: 2 });
    expect(stack([1])).toEqual({ shown: [1], more: 0 });
  });
});
