import type { HotspotAction, StepOptions } from '@flowdsiml/manifest';

interface StepLike {
  id: string;
  chapterId: string | null;
  options: StepOptions;
  hotspotActions: HotspotAction[];
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
        if (c.action.type === 'goto') next.push(index.get(c.action.stepId) ?? -1);
        if (c.action.type === 'chapter') next.push(chapterStart.get(c.action.chapterId) ?? -1);
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
