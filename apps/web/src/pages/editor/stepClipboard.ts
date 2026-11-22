/**
 * P1-1 : presse-papiers des étapes de l'éditeur. Il vit le temps de la session et il est partagé entre
 * les démos de l'espace : une étape copiée dans une démo se colle dans une autre.
 */
import { useSyncExternalStore } from 'react';
import type { HotspotRow, StepRow } from './types';

export type StepClip = { step: StepRow; hotspots: HotspotRow[] };

let clip: StepClip | null = null;
const listeners = new Set<() => void>();

export function copyStepToClipboard(next: StepClip) {
  clip = next;
  for (const l of listeners) l();
}

export function readStepClipboard(): StepClip | null {
  return clip;
}

/** L'étape copiée, ou `null` ; le composant suit ses changements. */
export function useStepClipboard(): StepClip | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => clip,
  );
}
