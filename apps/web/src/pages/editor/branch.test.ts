import { describe, expect, it } from 'vitest';
import { stepOptionsSchema } from '@flowdsiml/manifest';
import { answersFromText, branchOf, branchPatch, isDead, remapRules } from './branch';
import { loopsWithoutExit } from './reachability';

const step = (id: string, options: unknown = {}) => ({
  id,
  chapterId: null,
  options: stepOptionsSchema.parse(options),
  hotspotActions: [],
});

describe('L22-09 : règles de suite', () => {
  it('menu F1 repris : une règle par réponse, Sinon = étape suivante', () => {
    const opts = stepOptionsSchema.parse({
      choices: [
        { label: 'A', action: { type: 'goto', stepId: 's3' } },
        { label: 'B', action: { type: 'end' } },
      ],
    });
    expect(branchOf(opts)).toEqual({
      rules: [
        { answer: 0, goto: { type: 'goto', stepId: 's3' } },
        { answer: 1, goto: { type: 'end' } },
      ],
      else: { type: 'next' },
    });
  });
  it('destinations recalculées : sa règle, sinon « Sinon » ; une règle par réponse', () => {
    const p = branchPatch(['A', 'B', 'C'], {
      rules: [
        { answer: 2, goto: { type: 'end' } },
        { answer: 2, goto: { type: 'goto', stepId: 'x' } },
        { answer: 7, goto: { type: 'end' } },
      ],
      else: { type: 'next' },
    });
    expect(p.choices.map((c) => c.action.type)).toEqual(['next', 'next', 'end']);
    expect(p.branch).toEqual({ rules: [2], else: { type: 'next' } });
  });
  it('relecture : destination des règles = celle du choix (remappée à la copie), Sinon d’une réponse libre', () => {
    const opts = stepOptionsSchema.parse({
      choices: [
        { label: 'A', action: { type: 'goto', stepId: 'copie-s3' } },
        { label: 'B', action: { type: 'goto', stepId: 'copie-s5' } },
      ],
      branch: { rules: [0], else: { type: 'goto', stepId: 'original-s5' } },
    });
    expect(branchOf(opts)).toEqual({
      rules: [{ answer: 0, goto: { type: 'goto', stepId: 'copie-s3' } }],
      else: { type: 'goto', stepId: 'copie-s5' },
    });
  });
  it('réponses une par ligne, 6 au plus', () => {
    expect(answersFromText(' A \n\nB\nC\nD\nE\nF\nG')).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
  it('les règles suivent leur réponse', () => {
    const b = { rules: [{ answer: 1, goto: { type: 'end' as const } }], else: { type: 'next' as const } };
    expect(remapRules(['A', 'B'], ['B', 'A'], b).rules[0]?.answer).toBe(0);
    expect(remapRules(['A', 'B'], ['A', 'Bis'], b).rules[0]?.answer).toBe(1);
    expect(remapRules(['A', 'B'], ['A'], b).rules).toEqual([]);
  });
  it('destination supprimée', () => {
    expect(isDead({ type: 'goto', stepId: 'z' }, new Set(['a']), new Set())).toBe(true);
    expect(isDead({ type: 'next' }, new Set(), new Set())).toBe(false);
  });
  it('boucle sans sortie signalée, pas une boucle avec issue', () => {
    const loop = [
      step('a'),
      step('b', { choices: [{ label: 'Encore', action: { type: 'goto', stepId: 'a' } }] }),
      step('c'),
    ];
    expect(loopsWithoutExit(loop)).toEqual([1]);
    const ok = [
      step('a'),
      step('b', {
        choices: [
          { label: 'Encore', action: { type: 'goto', stepId: 'a' } },
          { label: 'Suite', action: { type: 'next' } },
        ],
      }),
      step('c'),
    ];
    expect(loopsWithoutExit(ok)).toEqual([]);
  });
});
