import { describe, expect, it } from 'vitest';
import { parseManifest } from '@flowdsiml/manifest';
import {
  backdropIndex,
  canAutoAdvance,
  checklistItems,
  choiceTarget,
  embedAllowed,
  isCorrect,
  isPartial,
  scoreQuiz,
  shuffled,
  nextIndex,
  parseRoute,
  resolveAssets,
  resolvePlacement,
  compareCond,
  datasetChartRows,
  datasetRow,
  datasetVars,
  withDataset,
  ruleTarget,
} from './logic';

const m = parseManifest({
  schemaVersion: 1,
  demoId: 'd',
  versionId: 'v',
  workspaceId: 'w',
  title: 'T',
  publishedAt: 'x',
  theme: {},
  steps: [
    { id: 'a', kind: 'image', image: { url: 'assets/a.webp', width: 10, height: 10 } },
    { id: 'b', kind: 'text' },
    { id: 'c', kind: 'image', image: { url: 'https://cdn/x.webp', width: 10, height: 10 } },
  ],
});

describe('player logic', () => {
  it('place l’info-bulle automatiquement', () => {
    expect(resolvePlacement('auto', { x: 0.1, y: 0.1, w: 0.1, h: 0.1 })).toBe('bottom');
    expect(resolvePlacement('auto', { x: 0.1, y: 0.8, w: 0.1, h: 0.1 })).toBe('top');
    expect(resolvePlacement('left', { x: 0.1, y: 0.8, w: 0.1, h: 0.1 })).toBe('left');
  });
  it('contrôle l’origine d’embed', () => {
    expect(embedAllowed([], true, null)).toBe(true);
    expect(embedAllowed(['acme.example'], false, null)).toBe(true);
    expect(embedAllowed(['acme.example'], true, 'https://acme.example')).toBe(true);
    expect(embedAllowed(['*.acme.example'], true, 'https://www.acme.example')).toBe(true);
    expect(embedAllowed(['acme.example'], true, 'https://evil.example')).toBe(false);
    expect(embedAllowed(['acme.example'], true, null)).toBe(false);
  });
  it('résout les assets relatifs uniquement', () => {
    const r = resolveAssets(m, 'https://s/published/d/');
    expect(r.steps[0]?.image?.url).toBe('https://s/published/d/assets/a.webp');
    expect(r.steps[2]?.image?.url).toBe('https://cdn/x.webp');
  });
  it('calcule l’étape suivante', () => {
    expect(nextIndex(m, 0, { type: 'next' })).toBe(1);
    expect(nextIndex(m, 2, { type: 'next' })).toBeNull();
    expect(nextIndex(m, 0, { type: 'goto', stepId: 'c' })).toBe(2);
  });
  it('parse les routes', () => {
    expect(parseRoute('#/d/0193a5c0-0000-7000-8000-000000000001?company=Acme')).toEqual({
      kind: 'demo',
      id: '0193a5c0-0000-7000-8000-000000000001',
      search: '?company=Acme',
    });
    expect(parseRoute('#/l/abcdef123456')).toEqual({ kind: 'link', token: 'abcdef123456', search: '?' });
    expect(parseRoute('#/d/not-a-uuid')).toEqual({ kind: 'none' });
    expect(parseRoute('#/preview')).toEqual({ kind: 'preview' });
  });
  it('F1 : fond des pop-up, checklist, choix, autoplay', () => {
    expect(backdropIndex(m, 1)).toBe(0);
    expect(backdropIndex(m, 0)).toBe(null);
    const items = checklistItems(m, new Set([0, 1]), 1);
    expect(items.map((x) => [x.done, x.current])).toEqual([
      [true, false],
      [true, true],
      [false, false],
    ]);
    const withChapters = parseManifest({
      ...m,
      chapters: [
        { id: 'k1', title: 'Un' },
        { id: 'k2', title: 'Deux' },
        { id: 'k3', title: 'Vide' },
      ],
      steps: m.steps.map((s, i) => ({ ...s, chapterId: i < 2 ? 'k1' : 'k2' })),
    });
    const ch = checklistItems(withChapters, new Set([0]), 0);
    expect(ch.map((x) => [x.id, x.target, x.done, x.current])).toEqual([
      ['k1', 0, false, true],
      ['k2', 2, false, false],
    ]);
    // coché dès que la dernière étape du chapitre est vue (embranchement)
    expect(checklistItems(withChapters, new Set([1]), 1)[0]?.done).toBe(true);
    expect(choiceTarget(withChapters, { type: 'chapter', chapterId: 'k2' })).toEqual({
      kind: 'step',
      index: 2,
    });
    expect(choiceTarget(m, { type: 'goto', stepId: 'c' })).toEqual({ kind: 'step', index: 2 });
    expect(choiceTarget(m, { type: 'goto', stepId: 'zz' })).toBe(null);
    expect(choiceTarget(m, { type: 'end' })).toEqual({ kind: 'end' });
    // L22-09 : « étape suivante » suit l'ordre courant ; après la dernière, fin
    expect(choiceTarget(m, { type: 'next' }, 0)).toEqual({ kind: 'step', index: 1 });
    expect(choiceTarget(m, { type: 'next' }, m.steps.length - 1)).toEqual({ kind: 'end' });
    expect(canAutoAdvance(m, 0, false)).toBe(true);
    expect(canAutoAdvance(m, 0, true)).toBe(false);
    expect(canAutoAdvance(m, 2, false)).toBe(false);
    const branching = parseManifest({
      ...m,
      steps: m.steps.map((s, i) =>
        i === 1
          ? {
              ...s,
              options: {
                choices: [
                  { label: 'A', action: { type: 'goto', stepId: 'c' } },
                  { label: 'Lien cassé', action: { type: 'url', url: 'javascript:alert(1)' } },
                ],
              },
            }
          : s,
      ),
    });
    expect(branching.steps[1]?.options.choices).toHaveLength(1);
    expect(canAutoAdvance(branching, 1, false)).toBe(false);
    expect(branching.steps[1]?.options.display).toBe('screen');
  });
  it('F2 : score du quiz (tout ou rien, points, seuil exact)', () => {
    const quiz = {
      mode: 'quiz' as const,
      threshold: 75,
      attempts: 3,
      feedback: 'each' as const,
      shuffle: false,
      required: true,
      questions: [
        {
          id: 'q1',
          type: 'single' as const,
          prompt: 'Q1',
          explanation: '',
          stepId: null,
          points: 1,
          answers: [
            { id: 'a', label: 'A', correct: true },
            { id: 'b', label: 'B', correct: false },
          ],
        },
        {
          id: 'q2',
          type: 'multiple' as const,
          prompt: 'Q2',
          explanation: '',
          stepId: null,
          points: 3,
          answers: [
            { id: 'a', label: 'A', correct: true },
            { id: 'b', label: 'B', correct: true },
            { id: 'c', label: 'C', correct: false },
          ],
        },
      ],
    };
    const q2 = quiz.questions[1]!;
    expect(isCorrect(q2, ['b', 'a'])).toBe(true);
    expect(isCorrect(q2, ['a'])).toBe(false);
    expect(isPartial(q2, ['a'])).toBe(true);
    expect(isPartial(q2, ['a', 'c'])).toBe(false);
    expect(scoreQuiz(quiz, { q1: ['a'], q2: ['a'] })).toMatchObject({ score: 25, correct: 1, passed: false });
    // seuil atteint à la valeur exacte
    expect(scoreQuiz(quiz, { q1: ['b'], q2: ['a', 'b'] })).toMatchObject({ score: 75, passed: true });
    expect(shuffled([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});

describe('L22 : branchement conditionnel', () => {
  const mb = parseManifest({
    schemaVersion: 1,
    demoId: 'd',
    versionId: 'v',
    workspaceId: 'w',
    title: 'T',
    publishedAt: 'x',
    theme: {},
    steps: [
      {
        id: 'menu',
        kind: 'text',
        options: {
          choices: [
            { label: 'Conseiller', action: { type: 'goto', stepId: 'a' } },
            { label: 'Accueil', action: { type: 'goto', stepId: 'b' } },
          ],
        },
      },
      {
        id: 'a',
        kind: 'text',
        options: {
          rules: [
            { when: { choice: { stepId: 'menu', index: 1 } }, goto: { type: 'goto', stepId: 'c' } },
            { when: { quiz: { questionId: 'q1', answerId: 'x' } }, goto: { type: 'end' } },
            { when: { nope: true }, goto: { type: 'end' } },
          ],
        },
      },
      { id: 'b', kind: 'text' },
      { id: 'c', kind: 'text' },
    ],
  });
  it('ignore une règle invalide et garde les autres', () => {
    expect(mb.steps[1]!.options.rules).toHaveLength(2);
  });
  it('première règle vraie, sinon null', () => {
    expect(ruleTarget(mb, 1, { choices: {}, answers: {} })).toBeNull();
    expect(ruleTarget(mb, 1, { choices: { menu: 1 }, answers: {} })).toEqual({ type: 'goto', stepId: 'c' });
    expect(ruleTarget(mb, 1, { choices: { menu: 0 }, answers: { q1: ['x'] } })).toEqual({ type: 'end' });
    expect(ruleTarget(mb, 0, { choices: { menu: 1 }, answers: {} })).toBeNull();
  });
});

describe('L25-10 : embranchement conditionnel (opérateurs en liste fermée)', () => {
  const cond = (c: Record<string, unknown>, goto: Record<string, unknown>) => ({ when: { cond: c }, goto });
  const mc = parseManifest({
    schemaVersion: 1,
    demoId: 'd',
    versionId: 'v',
    workspaceId: 'w',
    title: 'T',
    publishedAt: 'x',
    theme: {},
    steps: [
      {
        id: 'menu',
        kind: 'text',
        options: {
          choices: [
            { label: 'Conseiller', action: { type: 'next' } },
            { label: 'Accueil', action: { type: 'next' } },
          ],
        },
      },
      {
        id: 'r',
        kind: 'text',
        options: {
          rules: [
            cond(
              { source: 'var', key: 'role', op: 'is', value: 'Conseiller' },
              { type: 'goto', stepId: 'a' },
            ),
            cond({ source: 'score', op: 'lt', value: '50' }, { type: 'chapter', chapterId: 'ch1' }),
            cond({ source: 'answer', stepId: 'menu', op: 'contains', value: 'accu' }, { type: 'end' }),
            cond({ source: 'ab', op: 'is', value: 'B' }, { type: 'goto', stepId: 'b' }),
            cond({ source: 'var', key: 'role', op: 'eval', value: '1' }, { type: 'end' }),
            cond({ source: 'var', key: 'Role;alert(1)', op: 'is', value: '' }, { type: 'end' }),
          ],
          rulesElse: { type: 'goto', stepId: 'b' },
        },
      },
      { id: 'a', kind: 'text' },
      { id: 'b', kind: 'text' },
    ],
  });
  const mem = (x: Record<string, unknown> = {}) => ({ choices: {}, answers: {}, ...x });
  it('règle hors liste fermée ignorée (opérateur ou clé invalides)', () => {
    expect(mc.steps[1]!.options.rules).toHaveLength(4);
  });
  it('lues dans l’ordre, la première qui correspond s’applique ; sinon « Sinon »', () => {
    expect(ruleTarget(mc, 1, mem({ vars: { role: ' conseiller ' } }))).toEqual({ type: 'goto', stepId: 'a' });
    expect(ruleTarget(mc, 1, mem({ score: 40 }))).toEqual({ type: 'chapter', chapterId: 'ch1' });
    expect(ruleTarget(mc, 1, mem({ choices: { menu: 1 } }))).toEqual({ type: 'end' });
    expect(ruleTarget(mc, 1, mem({ variant: 'B' }))).toEqual({ type: 'goto', stepId: 'b' });
    // variable absente = vide ; aucune règle vraie → « Sinon »
    expect(ruleTarget(mc, 1, mem())).toEqual({ type: 'goto', stepId: 'b' });
  });
  it('comparaisons : chaînes sans casse, nombres, jamais d’évaluation', () => {
    expect(compareCond('Nord', 'isNot', 'Sud')).toBe(true);
    expect(compareCond('', 'contains', '')).toBe(false);
    expect(compareCond('1 248', 'gt', '1000')).toBe(true);
    expect(compareCond('12,5', 'lt', '13')).toBe(true);
    expect(compareCond('abc', 'lt', '5')).toBe(false);
    expect(compareCond('1+1', 'is', '2')).toBe(false);
  });
});

describe('L25-09 : jeu de données', () => {
  const ds = {
    columns: ['equipe', 'rapports'],
    rows: [
      ['Antenne Nord', '1 248'],
      ['Antenne Sud', '932'],
    ],
    bindings: [
      { column: 'equipe', kind: 'variable' as const, key: 'team' },
      { column: 'rapports', kind: 'element' as const, stepId: 'h', sel: 'b.value' },
      { column: 'rapports', kind: 'chart' as const, stepId: 'h', opId: 'c1' },
    ],
    rowMode: 'link' as const,
    linkColumn: 'equipe',
  };
  it('ligne selon le lien personnalisé, sinon valeurs de la capture', () => {
    expect(datasetRow(ds, { team: 'antenne sud' })).toEqual(['Antenne Sud', '932']);
    expect(datasetRow(ds, { team: 'Ouest' })).toBeNull();
    expect(datasetRow(ds, {})).toBeNull();
    expect(datasetRow({ ...ds, rowMode: 'first' }, {})).toEqual(['Antenne Nord', '1 248']);
    expect(datasetVars({ ...ds, rowMode: 'first' }, ds.rows[0]!)).toEqual({ team: 'Antenne Nord' });
    expect(datasetVars(ds, ds.rows[0]!)).toEqual({});
  });
  it('élément et graphique reliés', () => {
    expect(datasetChartRows(ds, 'rapports')).toEqual([
      { label: 'Antenne Nord', value: 1248 },
      { label: 'Antenne Sud', value: 932 },
    ]);
    const step = parseManifest({
      schemaVersion: 1,
      demoId: 'd',
      versionId: 'v',
      workspaceId: 'w',
      title: 'T',
      publishedAt: 'x',
      theme: {},
      steps: [
        {
          id: 'h',
          kind: 'html',
          html: {
            url: 'assets/h.html',
            ops: [
              {
                id: 'c1',
                sel: 'div.chart',
                op: 'chart',
                value: { type: 'bar', rows: [{ label: 'a', value: 1 }] },
                scope: 'step',
              },
            ],
          },
        },
      ],
    }).steps[0]!;
    const out = withDataset(step, ds, ds.rows[1]!).html!.ops;
    expect(out[0]!.value).toMatchObject({ rows: [{ value: 1248 }, { value: 932 }] });
    expect(out[1]).toMatchObject({ sel: 'b.value', op: 'text', value: '932' });
    expect(withDataset(step, ds, null).html!.ops).toHaveLength(1);
  });
});
