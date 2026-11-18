import { describe, expect, it } from 'vitest';
import { badge, bodyParts, excerpt, groupOf, grouped, notificationHref, readPrefs } from './notifications';

const U = '0b5c1f0e-0000-4000-8000-0000000000a2';

describe('L22-05 : centre de notifications', () => {
  it('groupes Aujourd’hui, Cette semaine, Plus ancien', () => {
    const now = new Date('2026-11-18T15:00:00').getTime();
    expect(groupOf('2026-11-18T08:00:00', now)).toBe('today');
    expect(groupOf('2026-11-17T23:00:00', now)).toBe('week');
    expect(groupOf('2026-11-05T10:00:00', now)).toBe('older');
    const g = grouped(
      [
        { created_at: '2026-11-18T09:00:00' },
        { created_at: '2026-11-16T09:00:00' },
        { created_at: '2026-11-15T09:00:00' },
      ],
      now,
    );
    expect(g.map((x) => [x.group, x.rows.length])).toEqual([
      ['today', 1],
      ['week', 2],
    ]);
  });
  it('pastille : 9+ au-delà de 9, rien à 0', () => {
    expect([badge(0), badge(3), badge(9), badge(12)]).toEqual(['', '3', '9', '9+']);
  });
  it('mentions en pastilles, extrait sur une ligne', () => {
    expect(bodyParts(`@[Alice Martin](${U}) peux-tu vérifier ?`)).toEqual([
      { mention: 'Alice Martin', userId: U },
      { text: ' peux-tu vérifier ?' },
    ]);
    expect(bodyParts('@[pas une mention](123)')).toEqual([{ text: '@[pas une mention](123)' }]);
    expect(excerpt(`@[Alice Martin](${U})\n  merci`)).toBe('@Alice Martin merci');
    expect(excerpt('mot '.repeat(60), 20)).toBe('mot mot mot mot mot…');
  });
  it('préférences : clés absentes activées', () => {
    expect(readPrefs({ reply: false })).toEqual({
      mention: true,
      reply: false,
      comment: true,
      resolved: true,
    });
    expect(readPrefs(null).mention).toBe(true);
  });
  it('lien vers l’étape avec le fil ouvert', () => {
    expect(notificationHref({ demo_id: 'd', step_id: 's', comment_id: 'c' })).toBe(
      '/demos/d/edit?step=s&comment=c',
    );
  });
});
