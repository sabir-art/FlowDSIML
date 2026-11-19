import { describe, expect, it } from 'vitest';
import { stepOptionsSchema } from '@flowdsiml/manifest';
import { NO_DEST, condRules, firstMissingRule, newRule, opsFor, withCondRules } from './rules';
import { loopsWithoutExit, unreachableSteps } from './reachability';

const opts = (o: Record<string, unknown> = {}) => stepOptionsSchema.parse(o);

describe('L25-10 : règles de suite', () => {
  it('garde les règles L22 et remplace les règles conditionnelles (8 au plus)', () => {
    const o = opts({
      rules: [{ when: { choice: { stepId: 'm', index: 0 } }, goto: { type: 'end' } }],
    });
    const r = newRule('role');
    const patch = withCondRules(o, Array(10).fill(r));
    expect(patch.rules).toHaveLength(9);
    expect('choice' in patch.rules[0]!.when).toBe(true);
    expect(condRules({ ...o, ...patch })).toHaveLength(8);
  });
  it('règle sans destination : repérée (publication bloquée) et gardée au rechargement', () => {
    const o = opts({ ...withCondRules(opts(), [newRule(null)]) });
    expect(condRules(o)[0]!.goto).toEqual(NO_DEST);
    expect(firstMissingRule([opts(), o])).toBe(1);
  });
  it('opérateurs en liste fermée selon la source', () => {
    expect(opsFor('ab')).toEqual(['is', 'isNot']);
    expect(opsFor('var')).toContain('contains');
    expect(opsFor('score')).not.toContain('contains');
  });
  it('boucle sans sortie : A → B → A ; une issue suffit', () => {
    const step = (id: string, o: Record<string, unknown>) => ({
      id,
      chapterId: null,
      options: opts(o),
      hotspotActions: [],
    });
    const cond = { source: 'var', key: 'role', op: 'is', value: 'x' };
    const loop = [
      step('a', {
        rules: [{ when: { cond }, goto: { type: 'goto', stepId: 'b' } }],
        rulesElse: { type: 'goto', stepId: 'b' },
      }),
      step('b', {
        rules: [{ when: { cond }, goto: { type: 'goto', stepId: 'a' } }],
        rulesElse: { type: 'goto', stepId: 'a' },
      }),
      step('c', {}),
    ];
    expect(loopsWithoutExit(loop)).toEqual([0, 1]);
    expect(unreachableSteps(loop)).toEqual([2]);
    const exit = [
      loop[0]!,
      step('b', {
        rules: [{ when: { cond }, goto: { type: 'end' } }],
        rulesElse: { type: 'goto', stepId: 'a' },
      }),
      loop[2]!,
    ];
    expect(loopsWithoutExit(exit)).toEqual([]);
  });
});
