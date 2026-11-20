import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  buildRows,
  canRemind,
  cleanDomain,
  learnerCounts,
  csvTable,
  kpis,
  pathStats,
  sortRows,
  splitPercents,
  type ProgressData,
  type RawModule,
} from './progress';

const NOW = Date.parse('2026-11-18T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const mod = (demoId: string, o: Partial<RawModule> = {}): RawModule => ({
  demoId,
  total: 10,
  seen: 0,
  completed: false,
  hasQuiz: false,
  best: null,
  used: 0,
  max: null,
  status: 'not_started',
  lastActivity: null,
  ...o,
});

const data: ProgressData = {
  structures: [{ id: 's1', name: 'Antenne Nord' }],
  paths: [
    {
      id: 'p1',
      title: 'Logiciel métier',
      ordered: true,
      goal: 80,
      modules: [
        { demoId: 'd1', title: 'Prise en main', required: true, hasQuiz: false, threshold: 70 },
        { demoId: 'd2', title: 'Quiz final', required: true, hasQuiz: true, threshold: 70 },
      ],
    },
    {
      id: 'p2',
      title: 'Agenda',
      ordered: false,
      goal: 80,
      modules: [{ demoId: 'd3', title: 'Agenda', required: true, hasQuiz: false, threshold: 70 }],
    },
  ],
  learners: [
    {
      id: 'a',
      email: 'lea@exemple.invalid',
      name: 'Léa Exemple',
      source: 'link',
      structureId: 's1',
      createdAt: daysAgo(30),
      lastReminder: null,
      group: 'Session du 12 novembre',
      modules: [
        mod('d1', { seen: 10, status: 'validated', lastActivity: daysAgo(20) }),
        mod('d2', { seen: 2, hasQuiz: true, status: 'in_progress', lastActivity: daysAgo(12) }),
        mod('d3', { seen: 10, status: 'validated', lastActivity: daysAgo(25) }),
      ],
    },
    {
      id: 'b',
      email: 'hugo@exemple.invalid',
      name: 'Hugo Test',
      source: 'lead',
      structureId: null,
      createdAt: daysAgo(10),
      lastReminder: daysAgo(1),
      modules: [
        mod('d1', { seen: 10, status: 'validated', lastActivity: daysAgo(2) }),
        mod('d2', {
          seen: 10,
          hasQuiz: true,
          best: 90,
          used: 1,
          status: 'validated',
          lastActivity: daysAgo(2),
        }),
        mod('d3'),
      ],
    },
    {
      id: 'c',
      email: 'nina@exemple.invalid',
      name: '',
      source: 'lead',
      structureId: 's1',
      createdAt: daysAgo(3),
      lastReminder: null,
      modules: [
        mod('d1', { seen: 3, status: 'in_progress', lastActivity: daysAgo(1) }),
        mod('d2'),
        mod('d3'),
      ],
    },
  ],
};

describe('suivi des apprenants', () => {
  const rows = buildRows(data, NOW);
  const [lea, hugo, nina] = rows as [(typeof rows)[0], (typeof rows)[0], (typeof rows)[0]];

  it('déduit les formations suivies, la progression et le statut', () => {
    expect(lea.paths.map((s) => s.path.id)).toEqual(['p1', 'p2']);
    expect(lea.paths[0]!.pct).toBeCloseTo(0.6);
    expect(lea.paths[0]!.current).toEqual({ index: 1, title: 'Quiz final' });
    expect(lea.paths[1]!.done).toBe(true);
    expect(lea.status).toBe('stale');
    expect(lea.inactiveDays).toBe(12);
    expect(hugo.paths.map((s) => s.path.id)).toEqual(['p1']);
    expect(hugo.status).toBe('done');
    expect(hugo.best).toBe(90);
    expect(nina.status).toBe('active');
    expect(nina.label).toBe('nina@exemple.invalid');
  });

  it('calcule les KPI', () => {
    expect(kpis(rows, data.paths)).toEqual({
      total: 3,
      done: 1,
      active: 1,
      stale: 1,
      avgScore: 90,
      threshold: 70,
    });
  });

  it('filtre par formation (statut de la formation), structure, module et recherche', () => {
    const f = { path: '', status: '' as const, structure: '', group: '', q: '', module: '' };
    expect(applyFilters(rows, { ...f, path: 'p2' }).map((r) => r.raw.id)).toEqual(['a']);
    expect(applyFilters(rows, { ...f, path: 'p2', status: 'done' }).map((r) => r.raw.id)).toEqual(['a']);
    expect(applyFilters(rows, { ...f, structure: 'none' }).map((r) => r.raw.id)).toEqual(['b']);
    expect(applyFilters(rows, { ...f, module: 'd2' }).map((r) => r.raw.id)).toEqual(['a', 'c']);
    expect(applyFilters(rows, { ...f, q: 'HUGO' }).map((r) => r.raw.id)).toEqual(['b']);
    expect(applyFilters(rows, { ...f, status: 'stale' }).map((r) => r.raw.id)).toEqual(['a']);
    // L38-3 : groupe (session) et « sans groupe »
    expect(applyFilters(rows, { ...f, group: 'Session du 12 novembre' }).map((r) => r.raw.id)).toEqual(['a']);
    expect(applyFilters(rows, { ...f, group: 'none' }).map((r) => r.raw.id)).toEqual(['b', 'c']);
  });

  it('trie', () => {
    expect(sortRows(rows, 'last', true).map((r) => r.raw.id)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, 'score', false)[0]!.raw.id).toBe('b');
  });

  it('respecte les 72 h entre deux relances', () => {
    expect(canRemind(data.learners[0]!, NOW)).toBe(true);
    expect(canRemind(data.learners[1]!, NOW)).toBe(false);
  });

  it('statistiques par formation et plus gros décrochage', () => {
    const s = pathStats(rows, data.paths[0]!);
    expect(s.learners).toBe(3);
    expect(s.modules.map((m) => m.ok)).toEqual([2, 1]);
    expect(s.drop).toEqual({ from: 1, to: 2, points: 33 });
    expect(s.quizTried).toBe(1);
    expect(s.quizFirst).toBe(1);
  });

  it('parts entières dont la somme fait 100', () => {
    expect(splitPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitPercents([0, 0])).toEqual([0, 0]);
  });

  it('construit le CSV selon les colonnes', () => {
    const L = {
      name: 'Nom',
      email: 'E-mail',
      structure: 'Structure',
      group: 'Groupe',
      source: 'Identifié par',
      sourceValue: (s: string) => s,
      paths: 'Formations',
      progress: 'Progression',
      status: 'Statut',
      statusValue: (s: string) => s,
      lastActivity: 'Dernière activité',
      best: 'Score',
      attempts: 'Tentatives',
      moduleValue: (s: string) => s,
    };
    const t = csvTable([lea], data, ['identity', 'modules'], L);
    expect(t.headers).toEqual([
      'Nom',
      'E-mail',
      'Structure',
      'Groupe',
      'Identifié par',
      'Logiciel métier · Prise en main',
      'Logiciel métier · Quiz final',
      'Agenda · Agenda',
    ]);
    expect(t.data[0]).toEqual([
      'Léa Exemple',
      'lea@exemple.invalid',
      'Antenne Nord',
      'Session du 12 novembre',
      'link',
      'validated (100 %)',
      'in_progress (20 %)',
      'validated (100 %)',
    ]);
  });

  it('domaines de structure : nettoyés, messageries grand public refusées', () => {
    expect(cleanDomain(' @Mission-Locale.Example ')).toEqual({ domain: 'mission-locale.example' });
    expect(cleanDomain('gmail.com')).toEqual({ error: 'public' });
    expect(cleanDomain('pas un domaine')).toEqual({ error: 'invalid' });
  });

  it('compte les apprenants par formation et structure', () => {
    expect(learnerCounts(rows)).toEqual({ paths: { p1: 3, p2: 1 }, structures: { s1: 2 } });
  });
});
