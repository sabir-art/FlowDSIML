import type { ChoiceAction, HotspotAction, StepOptions } from '@flowdsiml/manifest';

interface StepLike {
  id: string;
  chapterId: string | null;
  options: StepOptions;
  hotspotActions: HotspotAction[];
}

/**
 * L25-10 : destinations des règles de suite d'une étape (« Sinon » compris) ; null si l'étape n'a
 * pas de règle. « Suivant » passe toujours par les règles.
 */
export function ruleDests(o: StepOptions): ChoiceAction[] | null {
  if (!o.rules.length) return null;
  return [...o.rules.map((r) => r.goto), o.rulesElse ?? { type: 'next' }];
}

/**
 * F1 (spec a2 §5) : étapes qu'aucun chemin n'atteint depuis la première. Chemins suivis : bouton
 * Suivant (sauf sur un menu de choix), Précédent, actions de hotspot, choix de parcours, et
 * l'entrée de chaque chapitre (menu des chapitres du player). Contrôle indicatif, non bloquant.
 */
export function unreachableSteps(steps: StepLike[]): number[] {
  const index = new Map(steps.map((s, i) => [s.id, i]));
  const chapterStart = new Map<string, number>();
  steps.forEach((s, i) => s.chapterId && !chapterStart.has(s.chapterId) && chapterStart.set(s.chapterId, i));
  const seen = new Set<number>();
  const queue = steps.length ? [0, ...chapterStart.values()] : [];
  while (queue.length) {
    const i = queue.pop()!;
    if (seen.has(i) || i < 0 || i >= steps.length) continue;
    seen.add(i);
    const s = steps[i]!;
    const next: number[] = [i - 1];
    if (s.options.choices.length) {
      for (const c of s.options.choices) {
        if (c.action.type === 'next') next.push(i + 1);
        if (c.action.type === 'goto') next.push(index.get(c.action.stepId) ?? -1);
        if (c.action.type === 'chapter') next.push(chapterStart.get(c.action.chapterId) ?? -1);
      }
    } else if (ruleDests(s.options)) {
      for (const a of ruleDests(s.options)!) {
        if (a.type === 'next') next.push(i + 1);
        if (a.type === 'goto') next.push(index.get(a.stepId) ?? -1);
        if (a.type === 'chapter') next.push(chapterStart.get(a.chapterId) ?? -1);
      }
    } else next.push(i + 1);
    for (const a of s.hotspotActions) {
      if (a.type === 'next') next.push(i + 1);
      if (a.type === 'goto') next.push(index.get(a.stepId) ?? -1);
    }
    queue.push(...next);
  }
  return steps.flatMap((_, i) => (seen.has(i) ? [] : [i]));
}

/**
 * L22-09 : menus de choix d'où aucun chemin ne mène à une fin (fin de la démo, lien, ou bouton
 * Suivant de la dernière étape) : boucle sans sortie. « Précédent » n'est pas une sortie.
 * Avertissement non bloquant.
 */
export function loopsWithoutExit(steps: StepLike[]): number[] {
  const index = new Map(steps.map((s, i) => [s.id, i]));
  const chapterStart = new Map<string, number>();
  steps.forEach((s, i) => s.chapterId && !chapterStart.has(s.chapterId) && chapterStart.set(s.chapterId, i));
  /** Successeurs d'une étape ; null = cette étape a une sortie. */
  const succ = (i: number): number[] | null => {
    const s = steps[i]!;
    const out: number[] = [];
    let exit = false;
    const add = (j: number) => (j >= steps.length ? (exit = true) : j >= 0 && out.push(j));
    if (s.options.choices.length) {
      for (const c of s.options.choices) {
        if (c.action.type === 'end' || c.action.type === 'url') exit = true;
        if (c.action.type === 'next') add(i + 1);
        if (c.action.type === 'goto') add(index.get(c.action.stepId) ?? -1);
        if (c.action.type === 'chapter') add(chapterStart.get(c.action.chapterId) ?? -1);
      }
    } else if (ruleDests(s.options)) {
      for (const a of ruleDests(s.options)!) {
        if (a.type === 'end' || a.type === 'url') exit = true;
        if (a.type === 'next') add(i + 1);
        if (a.type === 'goto') add(index.get(a.stepId) ?? -1);
        if (a.type === 'chapter') add(chapterStart.get(a.chapterId) ?? -1);
      }
    } else add(i + 1);
    for (const a of s.hotspotActions) {
      if (a.type === 'next') add(i + 1);
      if (a.type === 'goto') add(index.get(a.stepId) ?? -1);
      if (a.type === 'url') exit = true;
    }
    return exit ? null : out;
  };
  const canExit = (start: number) => {
    const seen = new Set<number>();
    const queue = [start];
    while (queue.length) {
      const i = queue.pop()!;
      if (seen.has(i)) continue;
      seen.add(i);
      const n = succ(i);
      if (n === null) return true;
      queue.push(...n);
    }
    return false;
  };
  return steps.flatMap((s, i) =>
    (s.options.choices.length || s.options.rules.length) && !canExit(i) ? [i] : [],
  );
}
