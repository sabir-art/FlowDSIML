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
