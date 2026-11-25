import { describe, expect, it } from 'vitest';
import { changesChannel } from './channelName';

describe('changesChannel', () => {
  it('rend un nom différent à chaque abonnement, avec la base lisible', () => {
    const a = changesChannel('notifications:u-1');
    const b = changesChannel('notifications:u-1');
    expect(a).not.toBe(b);
    expect(a.startsWith('notifications:u-1:')).toBe(true);
  });
});
