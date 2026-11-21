import { describe, expect, it } from 'vitest';
import { advance, GUIDE_START, guidePath, guideView, readGuide } from './guide';

const hs = (id: string) => ({
  id,
  x: 0.1,
  y: 0.1,
  w: 0.1,
  h: 0.1,
  title: id,
  body: '',
  placement: 'auto' as const,
  action: { type: 'next' as const },
  cta: null,
  pulse: true,
  style: 'beacon' as const,
  sel: null,
});
const page = (id: string, hotspots: string[]) =>
  ({ id, kind: 'html', hotspots: hotspots.map(hs) }) as unknown as Parameters<
    typeof guidePath
  >[0]['steps'][number];
const m = (guideSteps: Array<{ page: string; hotspot: string; advance?: 'click' | 'next' }>, guide = true) =>
  ({
    kind: 'sandbox',
    sandbox: {
      start: 'p1',
      autoLink: true,
      unlinked: 'toast',
      guide,
      keyPages: [],
      guideSteps: guideSteps.map((g) => ({ advance: 'click', ...g })),
    },
    steps: [page('p1', ['a', 'b']), page('p2', ['c']), page('p3', [])],
  }) as unknown as Parameters<typeof guidePath>[0];

describe('A8 guide du Sandbox', () => {
  it('chemin : étapes dont la page et la bulle existent, dans l’ordre ; guide désactivé : aucun', () => {
    const path = guidePath(
      m([
        { page: 'p1', hotspot: 'a' },
        { page: 'p1', hotspot: 'zz' },
        { page: 'p2', hotspot: 'a' },
        { page: 'p2', hotspot: 'c', advance: 'next' },
      ]),
    );
    expect(path.map((p) => [p.page, p.hotspot.id, p.advance])).toEqual([
      ['p1', 'a', 'click'],
      ['p2', 'c', 'next'],
    ]);
    expect(guidePath(m([{ page: 'p1', hotspot: 'a' }], false))).toEqual([]);
  });

  it('vue : bulle sur sa page, pause hors du chemin, départ sur une autre page, fin', () => {
    const path = guidePath(
      m([
        { page: 'p2', hotspot: 'c' },
        { page: 'p1', hotspot: 'a' },
      ]),
    );
    // Étape 1 sur une autre page que le départ
    expect(guideView(GUIDE_START, path, 'p1', 'p1')).toMatchObject({
      startsOn: 'p2',
      bubble: null,
      pill: 'active',
    });
    expect(guideView(GUIDE_START, path, 'p2', 'p1')).toMatchObject({
      bubble: { page: 'p2' },
      pill: 'active',
    });
    // Étape 2 attendue sur p1, visiteur sur p3 : pause silencieuse
    expect(guideView({ k: 1, mode: 'on' }, path, 'p3', 'p1')).toMatchObject({ bubble: null, pill: 'paused' });
    expect(guideView({ k: 1, mode: 'hold' }, path, 'p1', 'p1')).toMatchObject({
      bubble: null,
      pill: 'paused',
    });
    expect(guideView({ k: 1, mode: 'off' }, path, 'p1', 'p1')).toMatchObject({
      bubble: null,
      pill: 'resume',
    });
    expect(guideView({ k: 1, mode: 'done' }, path, 'p1', 'p1')).toMatchObject({ done: true, pill: null });
    expect(guideView({ k: 1, mode: 'closed' }, path, 'p1', 'p1')).toEqual({ kind: 'none' });
    expect(guideView(GUIDE_START, [], 'p1', 'p1')).toEqual({ kind: 'none' });
  });

  it('avance et état de session', () => {
    expect(advance({ k: 0, mode: 'on' }, 3)).toEqual({ k: 1, mode: 'on' });
    expect(advance({ k: 2, mode: 'on' }, 3)).toEqual({ k: 2, mode: 'done' });
    expect(readGuide(JSON.stringify({ k: 9, mode: 'off' }), 3)).toEqual({ k: 2, mode: 'off' });
    expect(readGuide('{"k":1,"mode":"pirate"}', 3)).toEqual(GUIDE_START);
    expect(readGuide('pas du json', 3)).toEqual(GUIDE_START);
    expect(readGuide(null, 3)).toEqual(GUIDE_START);
  });
});
