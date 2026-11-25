import { EXTENSION_ID } from './env';

/**
 * EXT-CONNECT : seul message de l'app vers l'extension (spec L48-G §5) : « attacher une capture HTML à un
 * Sandbox ». Aucun jeton ni donnée de session : l'extension agit avec sa propre session, et la base (RLS)
 * vérifie le droit de modifier ce Sandbox. `chrome.runtime.sendMessage` n'existe dans la page que si
 * l'extension l'autorise (externally_connectable, origine exacte de l'app).
 */
export type AttachResult =
  | { ok: true; started: boolean }
  | { ok: false; error: 'unavailable' | 'signed-out' | 'busy' | 'origin' | 'schema' | string };

type ChromeRuntime = {
  sendMessage: (id: string, msg: unknown, cb: (r: unknown) => void) => void;
  lastError?: unknown;
};

export function captureInExtension(req: {
  demoId: string;
  workspaceId: string;
  url: string;
}): Promise<AttachResult> {
  const rt = (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!EXTENSION_ID || typeof rt?.sendMessage !== 'function')
    return Promise.resolve({ ok: false, error: 'unavailable' });
  return new Promise((resolve) => {
    try {
      rt.sendMessage(
        EXTENSION_ID,
        { type: 'fd:sandbox-attach', v: 1, demoId: req.demoId, workspaceId: req.workspaceId, url: req.url },
        (r) => {
          if (rt.lastError || !r || typeof r !== 'object') resolve({ ok: false, error: 'unavailable' });
          else resolve(r as AttachResult);
        },
      );
    } catch {
      resolve({ ok: false, error: 'unavailable' });
    }
  });
}

/**
 * EXT-02 §8 : « Capturer de nouvelles étapes » depuis l'éditeur (extension 0.3.0). Mêmes garanties que
 * ci-dessus : messages au schéma strict, origine exacte de l'app, aucun jeton. L'app ne donne que la
 * cible (démo, étape d'insertion) et la page de départ ; l'extension lit le titre de la démo et de
 * l'étape avec sa propre session, et la base (RLS) refuse l'ajout sans droit de modification.
 */
function ask<T>(msg: Record<string, unknown>): Promise<T | null> {
  const rt = (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!EXTENSION_ID || typeof rt?.sendMessage !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      rt.sendMessage(EXTENSION_ID, { ...msg, v: 1 }, (r) =>
        resolve(rt.lastError || !r || typeof r !== 'object' ? null : (r as T)),
      );
    } catch {
      resolve(null);
    }
  });
}

/** Version de l'extension capable d'ajouter des étapes à une démo. */
export const ADD_STEPS_MIN = '0.3.0';
export function versionAtLeast(v: string, min: string): boolean {
  const a = v.split('.').map((n) => parseInt(n, 10) || 0);
  const b = min.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/** Extension présente et à jour ? (null : absente, ou trop ancienne pour répondre) */
export async function pingExtension(): Promise<{ version: string; ready: boolean } | null> {
  const r = await ask<{ ok: boolean; version?: string }>({ type: 'fd:ping' });
  if (!r?.ok || typeof r.version !== 'string') return null;
  return { version: r.version, ready: versionAtLeast(r.version, ADD_STEPS_MIN) };
}

export type AddStepsError = 'unavailable' | 'signed-out' | 'busy' | 'origin' | 'schema' | 'demo';
export type AddStepsResult = { ok: true; started: boolean } | { ok: false; error: AddStepsError | string };
export async function addStepsInExtension(req: {
  demoId: string;
  workspaceId: string;
  afterStepId: string | null;
  url: string;
}): Promise<AddStepsResult> {
  return (
    (await ask<AddStepsResult>({
      type: 'fd:add-steps',
      demoId: req.demoId,
      workspaceId: req.workspaceId,
      afterStepId: req.afterStepId,
      url: req.url,
    })) ?? { ok: false, error: 'unavailable' }
  );
}

export type AddStatus = {
  /** none : aucune capture pour cette démo ; sent : étapes envoyées, à insérer par l'éditeur. */
  state: 'none' | 'recording' | 'review' | 'sent';
  steps: number;
  stepIds: string[];
};
export async function addStatus(demoId: string): Promise<AddStatus | null> {
  const r = await ask<{ ok: boolean } & Partial<AddStatus>>({ type: 'fd:add-status', demoId });
  if (!r?.ok || !r.state) return null;
  return { state: r.state, steps: r.steps ?? 0, stepIds: Array.isArray(r.stepIds) ? r.stepIds : [] };
}
/** « Revenir à la capture » : active l'onglet de la capture (ou de la vérification). */
export const focusAddCapture = (demoId: string) => ask<{ ok: boolean }>({ type: 'fd:add-focus', demoId });
/** « Annuler l'ajout », ou accusé de réception après l'insertion : la cible est effacée. */
export const clearAddCapture = (demoId: string) => ask<{ ok: boolean }>({ type: 'fd:add-clear', demoId });
