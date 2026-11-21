import { describe, expect, it } from 'vitest';
import {
  contrast,
  currentPath,
  filterPaths,
  highlight,
  pathView,
  pathTags,
  themeVars,
  type CenterModule,
  type CenterPath,
} from './center';

const mod = (demoId: string, o: Partial<CenterModule> = {}): CenterModule => ({
  demoId,
  title: demoId,
  required: true,
  steps: 6,
  hasQuiz: false,
  access: 'open',
  cover: null,
  status: 'not_started',
  seen: 0,
  total: 6,
  ...o,
});
const path = (o: Partial<CenterPath> = {}): CenterPath => ({
  id: 'p',
  title: 'Nouvel outil de gestion',
  description: 'Les bases du logiciel',
  ordered: true,
  isNew: false,
  tags: [{ name: 'Logiciel métier', color: 'blue' }],
  modules: [],
  ...o,
});

describe('centre de formation', () => {
  const p = path({
    modules: [
      mod('a', { status: 'validated', seen: 6 }),
      mod('b', { status: 'in_progress', seen: 3, title: 'Fiches usagers' }),
      mod('c'),
      mod('d', { access: 'password' }),
      mod('e', { required: false }),
    ],
  });

  it('états des modules pour un visiteur identifié (ordre imposé)', () => {
    const v = pathView(p, true);
    expect(v.modules).toEqual([
      { kind: 'ok', best: null },
      { kind: 'cur', step: 4, total: 6 },
      { kind: 'lock', after: 2 },
      { kind: 'password' },
      { kind: 'lock', after: 4 },
    ]);
    expect([v.validated, v.total, v.started, v.done, v.badge]).toEqual([1, 5, true, false, 'current']);
    expect(v.next?.title).toBe('Fiches usagers');
  });

  it('sans identification : aucune progression, rien de verrouillé', () => {
    const v = pathView(p, false);
    expect(v.modules.map((m) => m.kind)).toEqual(['todo', 'todo', 'todo', 'password', 'todo']);
    expect([v.validated, v.started, v.badge]).toEqual([0, false, null]);
  });

  it('formation terminée quand les modules obligatoires sont validés ; badge Nouveau sinon', () => {
    const done = path({ modules: [mod('a', { status: 'validated' }), mod('b', { required: false })] });
    expect(pathView(done, true)).toMatchObject({ done: true, badge: 'done' });
    expect(pathView(path({ isNew: true, modules: [mod('a')] }), true).badge).toBe('new');
    const exp = pathView(
      path({
        modules: [
          mod('x', { access: 'expired', expiredAt: '2026-09-30T00:00:00Z' }),
          mod('y', { status: 'validated', hasQuiz: true, best: 85 }),
        ],
      }),
      true,
    );
    expect(exp.modules).toEqual([
      { kind: 'expired', since: '2026-09-30T00:00:00Z' },
      { kind: 'ok', best: 85 },
    ]);
    // L'expiré ne compte pas dans la progression
    expect([exp.validated, exp.total, exp.done]).toEqual([1, 1, true]);
  });

  it('formation en cours : la première commencée et non terminée', () => {
    const views = [
      pathView(path({ id: 'fini', modules: [mod('a', { status: 'validated' })] }), true),
      pathView(p, true),
    ];
    expect(currentPath(views)?.path.id).toBe('p');
  });

  it('recherche (titres, descriptions, modules, étiquettes ; sans accents) et étiquette', () => {
    const q = [
      p,
      path({
        id: 'agenda',
        title: 'Agenda partagé',
        description: '',
        tags: [{ name: 'Bureautique', color: 'orange' }],
        modules: [mod('r', { title: 'Planifier un rendez-vous' })],
      }),
    ];
    expect(filterPaths(q, 'LOGICIEL', '').map((x) => x.id)).toEqual(['p']);
    expect(filterPaths(q, 'rendez', '').map((x) => x.id)).toEqual(['agenda']);
    expect(filterPaths(q, 'partage', 'Bureautique').map((x) => x.id)).toEqual(['agenda']);
    expect(filterPaths(q, '', 'Logiciel métier').map((x) => x.id)).toEqual(['p']);
    expect(pathTags(q)).toEqual([
      { name: 'Bureautique', color: 'orange' },
      { name: 'Logiciel métier', color: 'blue' },
    ]);
  });

  it('surlignage sans tenir compte des accents ni de la casse', () => {
    expect(highlight('Partager un agenda', 'AGENDA')).toEqual([
      { text: 'Partager un ', hit: false },
      { text: 'agenda', hit: true },
    ]);
    expect(highlight('Créer une fiche', 'cree')).toEqual([
      { text: 'Crée', hit: true },
      { text: 'r une fiche', hit: false },
    ]);
  });

  it('couleurs : texte lisible sur la couleur principale, styles prédéfinis', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(themeVars({ brand: '#A3195B', style: 'workspace' })['--brand-on']).toBe('#FFFFFF');
    expect(themeVars({ brand: '#F2E94E', style: 'workspace' })['--brand-on']).toBe('#12161B');
    expect(themeVars({ brand: '#A3195B', style: 'sober' })['--brand']).toBe('#12161B');
  });
});

import { demoSections, demoTagCounts, filterDemos, type CenterDemo } from './center';
describe('Demo Center (A8)', () => {
  const d = (id: string, title: string, section: string | null, tags: string[]): CenterDemo => ({
    demoId: id,
    title,
    kind: 'guided',
    steps: 3,
    section,
    tags: tags.map((name) => ({ name, color: 'blue' })),
    cover: null,
  });
  const demos = [
    d('1', 'Créer une fiche usager', 'Logiciel métier', ['Usagers']),
    d('2', 'Planifier un rendez-vous', 'Logiciel métier', ['Agenda']),
    d('3', 'Explorer librement', null, ['Sandbox', 'Usagers']),
  ];
  it('recherche sans accents, filtre par étiquette', () => {
    expect(filterDemos(demos, 'creer', '').map((x) => x.demoId)).toEqual(['1']);
    expect(filterDemos(demos, 'logiciel', '').map((x) => x.demoId)).toEqual(['1', '2']);
    expect(filterDemos(demos, '', 'Usagers').map((x) => x.demoId)).toEqual(['1', '3']);
  });
  it('sections (sans dossier en dernier) et étiquettes comptées', () => {
    expect(demoSections(demos).map((s) => [s.name, s.demos.length])).toEqual([
      ['Logiciel métier', 2],
      [null, 1],
    ]);
    expect(demoTagCounts(demos)[0]).toEqual({ name: 'Usagers', color: 'blue', count: 2 });
  });
});
