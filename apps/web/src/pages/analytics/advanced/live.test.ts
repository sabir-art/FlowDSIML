import { describe, expect, it } from 'vitest';
import { elapsedShort, liveCsv, type LiveSpace } from './live';

const NBSP = String.fromCharCode(160);
const NOW = Date.parse('2026-11-24T10:00:00Z');
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

describe('elapsedShort', () => {
  it('donne des secondes, des minutes puis des heures', () => {
    expect(elapsedShort(ago(40), NOW)).toBe(`40${NBSP}s`);
    expect(elapsedShort(ago(125), NOW)).toBe(`2${NBSP}min`);
    expect(elapsedShort(ago(2 * 3600), NOW)).toBe(`2${NBSP}h`);
    expect(elapsedShort(ago(-5), NOW)).toBe(`0${NBSP}s`);
  });
});

describe('liveCsv', () => {
  const data: LiveSpace = {
    kpis: { live: 2, views30: 5, endsToday: 1, leadsToday: 1 },
    more: 0,
    demos: [],
    feed: [],
    visitors: [
      {
        key: 'a',
        demoId: 'd1',
        lastAt: ago(5),
        since: ago(120),
        stepIndex: 1,
        stepsTotal: 3,
        device: null,
        country: 'FR',
        identity: 'camille@acme.example',
      },
      {
        key: 'b',
        demoId: 'd2',
        lastAt: ago(5),
        since: ago(40),
        stepIndex: null,
        stepsTotal: 0,
        device: null,
        country: null,
        identity: null,
      },
    ],
  };
  const labels = {
    visitor: 'Visiteur',
    demo: 'Démo',
    step: 'Progression',
    since: 'Depuis',
    anon: 'Visiteur anonyme',
    learner: 'Apprenant identifié',
  };
  it('écrit une ligne par visiteur, sans identité inventée', () => {
    const csv = liveCsv(data, (id) => (id === 'd1' ? 'Démo ; CRM' : 'Onboarding'), labels, NOW);
    expect(csv.split('\r\n')).toEqual([
      'Visiteur;Démo;Progression;Depuis',
      'camille@acme.example;"Démo ; CRM";2/3;2 min',
      'Visiteur anonyme;Onboarding;0/0;40 s',
    ]);
  });
});
