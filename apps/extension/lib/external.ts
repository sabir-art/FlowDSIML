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
