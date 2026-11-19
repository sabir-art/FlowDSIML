/**
 * L25-10 : règles de suite conditionnelles d'une étape (« Suite de l'étape »). Conditions déclaratives
 * (variable, réponse à une étape, score du quiz, variante A/B), opérateurs en liste fermée ; jamais
 * d'expression évaluée. Les règles L22 (menu de choix, réponse au quiz) sont gardées telles quelles.
 */
import {
  RULE_OPS,
  type ChoiceAction,
  type RuleCond,
  type RuleOp,
  type StepOptions,
} from '@flowdsiml/manifest';

export const MAX_COND_RULES = 8;

export interface CondRule {
  cond: RuleCond;
  goto: ChoiceAction;
}

/** Destination non choisie (règle ajoutée) : signalée en erreur, bloque la publication. */
export const NO_DEST: ChoiceAction = { type: 'goto', stepId: '' };
export const missingDest = (a: ChoiceAction) => a.type === 'goto' && !a.stepId;

/** Règles conditionnelles de l'étape, dans l'ordre. */
export function condRules(o: StepOptions): CondRule[] {
  return o.rules.flatMap((r) => ('cond' in r.when ? [{ cond: r.when.cond, goto: r.goto }] : []));
}

/** Patch d'options : règles L22 conservées, règles conditionnelles remplacées (8 au plus). */
export function withCondRules(o: StepOptions, rules: CondRule[]): Pick<StepOptions, 'rules'> {
  const others = o.rules.filter((r) => !('cond' in r.when));
  return {
    rules: [
      ...others,
      ...rules.slice(0, MAX_COND_RULES).map((r) => ({ when: { cond: r.cond }, goto: r.goto })),
    ],
  };
}

/** Opérateurs proposés selon la source (tous en liste fermée). */
export function opsFor(source: RuleCond['source']): readonly RuleOp[] {
  if (source === 'ab') return ['is', 'isNot'];
  if (source === 'score') return ['is', 'isNot', 'lt', 'gt'];
  return RULE_OPS;
}

/** Première étape (index) dont une règle n'a pas de destination ; -1 sinon. */
export function firstMissingRule(steps: StepOptions[]): number {
  return steps.findIndex((o) => condRules(o).some((r) => missingDest(r.goto)));
}

/** Nouvelle règle : première variable connue, sinon le score du quiz. */
export function newRule(firstVar: string | null): CondRule {
  return {
    cond: firstVar
      ? { source: 'var', key: firstVar, op: 'is', value: '' }
      : { source: 'score', op: 'lt', value: '50' },
    goto: NO_DEST,
  };
}
