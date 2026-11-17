import { describe, expect, it } from 'vitest';
import { stepOptionsSchema } from '@flowdsiml/manifest';
import { unreachableSteps } from './reachability';

const step = (id: string, options: unknown = {}, chapterId: string | null = null) => ({
  id,
  chapterId,
  options: stepOptionsSchema.parse(options),
  hotspotActions: [],
});

describe('unreachableSteps', () => {
  it('parcours linéaire : tout est atteint', () => {
    expect(unreachableSteps([step('a'), step('b'), step('c')])).toEqual([]);
  });
  it('menu de choix : une étape sautée par tous les choix est signalée', () => {
    const steps = [
      step('a', {
        choices: [
          { label: 'A', action: { type: 'goto', stepId: 'c' } },
          { label: 'Fin', action: { type: 'end' } },
        ],
      }),
      step('b'),
      step('c', { choices: [{ label: 'Fin', action: { type: 'end' } }] }),
      step('d'),
    ];
    // b est atteinte par « Précédent » depuis c ; d n'est atteinte par rien
    expect(unreachableSteps(steps)).toEqual([3]);
  });
  it('entrée de chapitre : atteinte par le menu des chapitres', () => {
    const steps = [
      step('a', { choices: [{ label: 'Fin', action: { type: 'end' } }] }),
      step('b', {}, null),
      step('c', {}, 'k'),
    ];
    expect(unreachableSteps(steps)).toEqual([]);
  });
});
