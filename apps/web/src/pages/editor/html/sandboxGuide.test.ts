import { describe, expect, it } from 'vitest';
import {
  dropGuideStep,
  fallbackRect,
  GUIDE_MAX,
  guideOnPages,
  guideRows,
  guideStepsOf,
  moveGuideStep,
} from './sandboxGuide';

const steps = [
  { id: 'p1', title: 'Accueil', kind: 'html' },
  { id: 'p2', title: 'Agenda', kind: 'html' },
];
const hotspots = [
  { id: 'a', step_id: 'p1', title: '<b>Menu</b>', body: '' },
  { id: 'b', step_id: 'p2', title: '', body: 'Créez un rendez-vous' },
];

describe('A8 guide du Sandbox (éditeur)', () => {
  it('lecture : forme valide seulement, avance par défaut « click », 30 au plus', () => {
    expect(
      guideStepsOf({
        guideSteps: [
          { page: 'p1', hotspot: 'a' },
          { page: 'p2', hotspot: 'b', advance: 'next' },
          { page: 3 },
          'x',
        ],
      }),
    ).toEqual([
      { page: 'p1', hotspot: 'a', advance: 'click' },
      { page: 'p2', hotspot: 'b', advance: 'next' },
    ]);
    expect(guideStepsOf(null)).toEqual([]);
    const many = Array.from({ length: 40 }, () => ({ page: 'p1', hotspot: 'a' }));
    expect(guideStepsOf({ guideSteps: many })).toHaveLength(GUIDE_MAX);
  });

  it('lignes : titre ou début du texte, page, orphelines (bulle supprimée, page supprimée, autre page)', () => {
    const rows = guideRows(steps, hotspots, [
      { page: 'p1', hotspot: 'a', advance: 'click' },
      { page: 'p1', hotspot: 'zz', advance: 'click' },
      { page: 'p2', hotspot: 'b', advance: 'next' },
      { page: 'p9', hotspot: 'a', advance: 'click' },
      { page: 'p2', hotspot: 'a', advance: 'click' },
    ]);
    expect(rows.map((r) => [r.n, r.title, r.pageTitle, r.orphan])).toEqual([
      [1, 'Menu', 'Accueil', false],
      [2, '', 'Accueil', true],
      [3, 'Créez un rendez-vous', 'Agenda', false],
      [4, 'Menu', '', true],
      [5, 'Menu', 'Agenda', true],
    ]);
    expect([...guideOnPages(rows)]).toEqual([
      ['p1', [1]],
      ['p2', [3]],
    ]);
  });

  it('ordre : monter, descendre, glisser-déposer ; sans effet aux bords', () => {
    const l = [
      { page: 'p1', hotspot: 'a', advance: 'click' as const },
      { page: 'p2', hotspot: 'b', advance: 'click' as const },
      { page: 'p2', hotspot: 'c', advance: 'click' as const },
    ];
    expect(moveGuideStep(l, 1, -1).map((x) => x.hotspot)).toEqual(['b', 'a', 'c']);
    expect(moveGuideStep(l, 2, 1)).toBe(l);
    expect(dropGuideStep(l, 0, 2).map((x) => x.hotspot)).toEqual(['b', 'c', 'a']);
    expect(dropGuideStep(l, 1, 1)).toBe(l);
  });

  it('zone de secours : fractions de la fenêtre capturée, bornées', () => {
    expect(fallbackRect({ x: 128, y: 72, w: 256, h: 36 }, 1280, 720)).toEqual({
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.05,
    });
    expect(fallbackRect({ x: -20, y: 700, w: 3000, h: 100 }, 1280, 720)).toEqual({
      x: 0,
      y: 0.9722,
      w: 1,
      h: 0.0278,
    });
  });
});
