/**
 * EXT-CONNECT (spec L48-G §5, décision du chef du 20 novembre) : seul canal de l'app vers l'extension.
 * - `externally_connectable` limité à l'origine exacte de l'app (wxt.config.ts) ;
 * - un seul message, « attacher une capture HTML à un Sandbox », au schéma strict (aucune clé en plus) ;
 * - `sender.origin` comparé à l'origine de l'app, en plus du filtre du manifeste ;
 * - aucun jeton ni donnée de session dans le message : l'extension agit avec sa propre session, et la base
 *   (RLS) refuse l'ajout si l'utilisateur ne peut pas modifier ce Sandbox.
 */
export const ATTACH_TYPE = 'fd:sandbox-attach';

export interface AttachRequest {
  demoId: string;
  workspaceId: string;
  /** Adresse de la page à capturer (http ou https). */
  url: string;
}

export type AttachRefusal = 'origin' | 'schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEYS = ['demoId', 'type', 'url', 'v', 'workspaceId'];

/** Origine de l'app attendue (celle de WXT_APP_URL), ou null si l'adresse est illisible. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Valide l'expéditeur puis le message ; ne renvoie jamais autre chose que les trois champs attendus. */
export function parseAttach(
  msg: unknown,
  senderOrigin: string | undefined,
  appOrigin: string | null,
): { ok: true; req: AttachRequest } | { ok: false; error: AttachRefusal } {
  if (!appOrigin || !senderOrigin || senderOrigin !== appOrigin) return { ok: false, error: 'origin' };
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return { ok: false, error: 'schema' };
  const m = msg as Record<string, unknown>;
  const keys = Object.keys(m).sort();
  if (keys.length !== KEYS.length || keys.some((k, i) => k !== KEYS[i]))
    return { ok: false, error: 'schema' };
  if (m.type !== ATTACH_TYPE || m.v !== 1) return { ok: false, error: 'schema' };
  if (typeof m.demoId !== 'string' || !UUID.test(m.demoId)) return { ok: false, error: 'schema' };
  if (typeof m.workspaceId !== 'string' || !UUID.test(m.workspaceId)) return { ok: false, error: 'schema' };
  if (typeof m.url !== 'string' || m.url.length > 2000) return { ok: false, error: 'schema' };
  let u: URL;
  try {
    u = new URL(m.url);
  } catch {
    return { ok: false, error: 'schema' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'schema' };
  return { ok: true, req: { demoId: m.demoId, workspaceId: m.workspaceId, url: u.href } };
}

/** Rattachement en attente (posé à la réception du message, lu par la popup et la revue HTML). */
export interface PendingAttach extends AttachRequest {
  /** Origine de la page à capturer : la popup ne propose le rattachement que sur cette origine. */
  origin: string;
  at: number;
}

/** Un rattachement non utilisé expire au bout de 15 minutes. */
export const ATTACH_TTL_MS = 15 * 60 * 1000;

export function attachFor(p: PendingAttach | undefined, tabUrl: string | undefined, now: number) {
  if (!p || now - p.at > ATTACH_TTL_MS || !tabUrl) return null;
  return originOf(tabUrl) === p.origin ? p : null;
}

/**
 * EXT-02 §8 : « Capturer de nouvelles étapes » depuis l'éditeur. Mêmes règles que le rattachement :
 * origine exacte de l'app, schéma strict (aucune clé en plus), aucun jeton. L'app ne donne que la cible
 * (démo, étape d'insertion) et la page de départ ; le titre de la démo et de l'étape sont lus par
 * l'extension avec sa propre session, et la base (RLS) refuse l'ajout sans droit de modification.
 */
export type AddRequest =
  | { type: 'fd:ping' }
  | {
      type: 'fd:add-steps';
      demoId: string;
      workspaceId: string;
      afterStepId: string | null;
      url: string;
      /** Captures d'écran (défaut), ou capture HTML (extension 0.3.1). */
      mode: AddMode;
    }
  | { type: 'fd:add-status' | 'fd:add-focus' | 'fd:add-clear'; demoId: string };

export type AddMode = 'clicks' | 'html';
const ADD_KEYS: Record<string, string[]> = {
  'fd:ping': ['type', 'v'],
  'fd:add-steps': ['afterStepId', 'demoId', 'type', 'url', 'v', 'workspaceId'],
  'fd:add-status': ['demoId', 'type', 'v'],
  'fd:add-focus': ['demoId', 'type', 'v'],
  'fd:add-clear': ['demoId', 'type', 'v'],
};

/** Null : ce n'est pas un message de l'ajout d'étapes (le rattachement à un Sandbox le traite). */
export function parseAdd(
  msg: unknown,
  senderOrigin: string | undefined,
  appOrigin: string | null,
): { ok: true; req: AddRequest } | { ok: false; error: AttachRefusal } | null {
  const type = (msg as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !(type in ADD_KEYS)) return null;
  if (!appOrigin || !senderOrigin || senderOrigin !== appOrigin) return { ok: false, error: 'origin' };
  const m = msg as Record<string, unknown>;
  // « mode » est facultatif (absent : captures d'écran) ; aucune autre clé en plus
  const keys = Object.keys(m)
    .filter((k) => !(type === 'fd:add-steps' && k === 'mode'))
    .sort();
  const want = ADD_KEYS[type]!;
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i]) || m.v !== 1)
    return { ok: false, error: 'schema' };
  if (type === 'fd:ping') return { ok: true, req: { type } };
  if (typeof m.demoId !== 'string' || !UUID.test(m.demoId)) return { ok: false, error: 'schema' };
  if (type !== 'fd:add-steps')
    return {
      ok: true,
      req: { type: type as 'fd:add-status' | 'fd:add-focus' | 'fd:add-clear', demoId: m.demoId },
    };
  if (typeof m.workspaceId !== 'string' || !UUID.test(m.workspaceId)) return { ok: false, error: 'schema' };
  if (m.afterStepId !== null && (typeof m.afterStepId !== 'string' || !UUID.test(m.afterStepId)))
    return { ok: false, error: 'schema' };
  if (typeof m.url !== 'string' || m.url.length > 2000) return { ok: false, error: 'schema' };
  let u: URL;
  try {
    u = new URL(m.url);
  } catch {
    return { ok: false, error: 'schema' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'schema' };
  if ('mode' in m && m.mode !== 'clicks' && m.mode !== 'html') return { ok: false, error: 'schema' };
  return {
    ok: true,
    req: {
      type,
      demoId: m.demoId,
      workspaceId: m.workspaceId,
      afterStepId: m.afterStepId,
      url: u.href,
      mode: m.mode === 'html' ? 'html' : 'clicks',
    },
  };
}

/** Cible d'un ajout d'étapes (posée à la demande de l'éditeur, valable pour une seule capture). */
export interface AddTarget {
  demoId: string;
  workspaceId: string;
  afterStepId: string | null;
  /** Titre de la démo et étape d'insertion (numéro, titre), lus par l'extension ; null : au début. */
  title: string;
  after: { n: number; title: string } | null;
  at: number;
  /** pending : onglet ouvert, capture pas encore démarrée (accès au site à accorder dans le popup). */
  state: 'pending' | 'recording' | 'review' | 'sent';
  editorTabId: number | null;
  captureTabId: number | null;
  stepIds: string[];
  /** Type de capture demandé (absent : captures d'écran). */
  mode?: AddMode;
}

/** Une cible expire après 30 minutes sans démarrage (EXT-02 §8.5). */
export const ADD_TTL_MS = 30 * 60 * 1000;
export const ADD_KEY = 'fd.addTarget';
export function liveTarget(t: AddTarget | undefined, now: number): AddTarget | null {
  if (!t) return null;
  if (t.state === 'pending' && now - t.at > ADD_TTL_MS) return null;
  return t;
}
