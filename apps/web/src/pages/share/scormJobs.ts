/**
 * L16 : générations de paquets SCORM en cours, hors de la modale. Fermer « Diffuser » ne les arrête pas ;
 * une génération terminée sans modale ouverte est annoncée par un toast avec « Télécharger ».
 */
import { useCallback, useSyncExternalStore } from 'react';
import { buildScormPackage, ScormBuildError, type ScormBuild, type ScormOptions } from './scormPackage';

export type JobState =
  | { status: 'running'; done: number; total: number }
  | { status: 'ready'; build: ScormBuild }
  | { status: 'error'; error: ScormBuildError };

export interface ScormJob {
  demoId: string;
  opts: ScormOptions;
  state: JobState;
  controller: AbortController;
}

const jobs = new Map<string, ScormJob>();
const listeners = new Set<() => void>();
/** Modales « Diffuser » ouvertes, par démo (sinon : toast à la fin). */
const watching = new Map<string, number>();
const emit = () => listeners.forEach((l) => l());

/** La génération est-elle toujours celle en cours ? (l'objet est remplacé à chaque mise à jour) */
const current = (demoId: string, job: ScormJob) => jobs.get(demoId)?.controller === job.controller;

function update(demoId: string, job: ScormJob, state: JobState) {
  if (!current(demoId, job)) return;
  jobs.set(demoId, { ...job, state });
  emit();
}

export function startScormJob(
  demoId: string,
  opts: ScormOptions,
  hooks: {
    /** Paquet prêt (diffusion enregistrée). */
    onReady: (build: ScormBuild) => void;
    /** Paquet prêt alors qu'aucune modale n'est ouverte pour cette démo. */
    onReadyInBackground: (build: ScormBuild) => void;
  },
) {
  jobs.get(demoId)?.controller.abort();
  const job: ScormJob = {
    demoId,
    opts,
    state: { status: 'running', done: 0, total: 0 },
    controller: new AbortController(),
  };
  jobs.set(demoId, job);
  emit();
  buildScormPackage(
    demoId,
    opts,
    (done, total) => update(demoId, job, { status: 'running', done, total }),
    job.controller.signal,
  ).then(
    (build) => {
      if (!current(demoId, job)) return;
      update(demoId, job, { status: 'ready', build });
      hooks.onReady(build);
      if (!watching.get(demoId)) hooks.onReadyInBackground(build);
    },
    (e: unknown) => {
      if (job.controller.signal.aborted) return;
      update(demoId, job, {
        status: 'error',
        error: e instanceof ScormBuildError ? e : new ScormBuildError('SERVER'),
      });
    },
  );
}

/** « Annuler la génération » ou réglage modifié : la génération et le fichier sont abandonnés. */
export function clearScormJob(demoId: string) {
  const job = jobs.get(demoId);
  if (!job) return;
  job.controller.abort();
  jobs.delete(demoId);
  emit();
}

export function getScormJob(demoId: string): ScormJob | undefined {
  return jobs.get(demoId);
}

/** Génération en cours ou résultat pour la démo (la modale s'abonne et se déclare ouverte). */
export function useScormJob(demoId: string): ScormJob | undefined {
  const subscribe = useCallback(
    (l: () => void) => {
      listeners.add(l);
      watching.set(demoId, (watching.get(demoId) ?? 0) + 1);
      return () => {
        listeners.delete(l);
        watching.set(demoId, (watching.get(demoId) ?? 1) - 1);
      };
    },
    [demoId],
  );
  return useSyncExternalStore(subscribe, () => jobs.get(demoId));
}
