/**
 * L22-09 : règles de suite d'un menu de choix (option A). Les règles (réponse → destination) et
 * « Sinon » sont la seule source dans l'éditeur ; la destination de chaque choix lue par le lecteur
 * en est recalculée à chaque modification.
 */
import type { ChoiceAction, StepOptions } from '@flowdsiml/manifest';
import { loopsWithoutExit, unreachableSteps } from './reachability';

export const MAX_ANSWERS = 6;
export const MAX_LABEL = 80;

/** Vue de l'éditeur : règles (réponse → destination) et « Sinon ». */
export interface BranchView {
  rules: Array<{ answer: number; goto: ChoiceAction }>;
  else: ChoiceAction;
}

/**
 * Règles de l'étape. Destination d'une règle = celle du choix ; « Sinon » = destination d'une réponse
 * sans règle (remappée à la copie), sinon la valeur enregistrée. Menu créé avant L22 : une règle par réponse.
 */
export function branchOf(opts: StepOptions): BranchView {
  const choices = opts.choices;
  if (!opts.branch)
    return { rules: choices.map((c, i) => ({ answer: i, goto: c.action })), else: { type: 'next' } };
  const ruled = [...new Set(opts.branch.rules)].filter((i) => i < choices.length);
  const free = choices.findIndex((_, i) => !ruled.includes(i));
  return {
    rules: ruled.map((i) => ({ answer: i, goto: choices[i]!.action })),
    else: free >= 0 ? choices[free]!.action : opts.branch.else,
  };
}

/** Destination de chaque réponse : sa règle, sinon « Sinon ». */
export function resolveChoices(labels: string[], view: BranchView): StepOptions['choices'] {
  return labels.map((label, i) => ({
    label,
    action: view.rules.find((r) => r.answer === i)?.goto ?? view.else,
  }));
}

/** Patch d'options : réponses avec règle (une règle par réponse) + choix recalculés. */
export function branchPatch(labels: string[], view: BranchView): Pick<StepOptions, 'branch' | 'choices'> {
  const seen = new Set<number>();
  const rules = view.rules.filter(
    (r) => r.answer < labels.length && !seen.has(r.answer) && seen.add(r.answer),
  );
  const v = { rules, else: view.else };
  return {
    branch: { rules: rules.map((r) => r.answer), else: view.else },
    choices: resolveChoices(labels, v),
  };
}

/** Réponses saisies une par ligne : lignes non vides, 6 au plus, 80 caractères chacune. */
export const answersFromText = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim().slice(0, MAX_LABEL))
    .filter(Boolean)
    .slice(0, MAX_ANSWERS);

/**
 * Réponses modifiées : chaque règle suit le libellé de sa réponse (déplacée ou non) ; une règle dont
 * la réponse a disparu est retirée, sauf si le nombre de réponses n'a pas changé (simple retouche).
 */
export function remapRules(prev: string[], next: string[], branch: BranchView): BranchView {
  const rules = branch.rules.flatMap((r) => {
    const label = prev[r.answer];
    const moved = label === undefined ? -1 : next.indexOf(label);
    if (moved >= 0) return [{ ...r, answer: moved }];
    if (prev.length === next.length && r.answer < next.length) return [r];
    return [];
  });
  return { rules, else: branch.else };
}

/** Destination vers une étape ou un chapitre qui n'existe plus. */
export function isDead(a: ChoiceAction, stepIds: Set<string>, chapterIds: Set<string>): boolean {
  return (
    (a.type === 'goto' && !stepIds.has(a.stepId)) || (a.type === 'chapter' && !chapterIds.has(a.chapterId))
  );
}

export interface BranchStep {
  id: string;
  chapterId: string | null;
  options: StepOptions;
  hotspotActions: import('@flowdsiml/manifest').HotspotAction[];
}

/** Avertissements de la démo : étapes jamais atteintes, destinations supprimées, boucles sans sortie. */
export function branchIssues(steps: BranchStep[], chapterIds: Set<string>) {
  const stepIds = new Set(steps.map((s) => s.id));
  const dead = steps.flatMap((s, i) => {
    if (!s.options.choices.length) return [];
    const b = branchOf(s.options);
    return [...b.rules.map((r) => r.goto), b.else].some((a) => isDead(a, stepIds, chapterIds)) ? [i] : [];
  });
  return { unreachable: unreachableSteps(steps), dead, loops: loopsWithoutExit(steps) };
}
