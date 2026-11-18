import { parseManifest, type EventType, type Manifest } from '@flowdsiml/manifest';
import { OPEN_URL, publishedBase, SUPABASE_ANON_KEY, SUPABASE_URL, TRACK_URL } from './config';
import { resolveAssets, randomId } from './logic';

const rpcHeaders = () => ({
  'content-type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

async function rpc<T>(fn: string, args: Record<string, unknown>, keepalive = false): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify(args),
    keepalive,
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Réponse de l'Edge Function open-demo (L11). */
export type GateInfo = {
  status:
    | 'ok'
    | 'not_found'
    | 'unavailable'
    | 'expired'
    | 'password_required'
    | 'password_wrong'
    | 'locked'
    | 'error';
  title?: string;
  workspace?: string;
  website?: string | null;
  expiredAt?: string;
  remaining?: number;
  retryIn?: number;
  grant?: string;
  manifest?: Manifest;
};

const grantKey = (demoId: string) => `fd.grant.${demoId}`;

/**
 * Ouvre une démo publiée via open-demo : le serveur applique l'accès (expiration, mot de passe) et
 * renvoie le manifeste avec des URL d'images signées. Le jeton d'accès reste pour la session.
 */
export async function openDemo(demoId: string, password?: string): Promise<GateInfo> {
  let grant: string | null = null;
  try {
    grant = sessionStorage.getItem(grantKey(demoId));
  } catch {
    /* stockage indisponible */
  }
  const res = await fetch(OPEN_URL, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify({ demoId, password: password || undefined, grant: grant || undefined }),
  }).catch(() => null);
  if (!res || (!res.ok && res.status !== 429)) return { status: 'error' };
  const body = (await res.json().catch(() => null)) as (GateInfo & { manifest?: unknown }) | null;
  if (!body) return { status: 'error' };
  if (res.status === 429) return { status: 'locked', retryIn: 60 };
  if (body.status === 'ok') {
    if (body.grant) {
      try {
        sessionStorage.setItem(grantKey(demoId), body.grant);
      } catch {
        /* stockage indisponible */
      }
    }
    try {
      return { ...body, manifest: resolveAssets(parseManifest(body.manifest), publishedBase(demoId)) };
    } catch {
      return { status: 'not_found' };
    }
  }
  return body as GateInfo;
}

export function resolveLink(token: string) {
  return rpc<{ demoId: string; linkId: string; variables: Record<string, string> } | null>(
    'resolve_share_link',
    { p_token: token },
  );
}

export function submitLead(args: {
  demoId: string;
  versionId: string;
  email: string;
  fields: Record<string, string>;
  consent: boolean;
  visitorId: string;
  linkToken: string | null;
}) {
  return rpc<string>('submit_lead', {
    p_demo: args.demoId,
    p_version: args.versionId,
    p_email: args.email,
    p_fields: args.fields,
    p_consent: args.consent,
    p_visitor: args.visitorId,
    p_link_token: args.linkToken,
  });
}

function storageGet(store: Storage | undefined, key: string): string {
  try {
    const v = store?.getItem(key);
    if (v) return v;
    const id = randomId();
    store?.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
}

/** File d'événements : envoi groupé toutes les 2 s et à la fermeture de la page. */
export class Tracker {
  private queue: Array<{
    type: EventType;
    stepId?: string | null;
    hotspotId?: string | null;
    stepIndex?: number;
    props?: Record<string, string | number | boolean>;
    at: string;
  }> = [];
  private timer: number | undefined;
  readonly visitorId = storageGet(globalThis.localStorage, 'fd.vid');
  readonly sessionId = storageGet(globalThis.sessionStorage, 'fd.sid');

  constructor(
    private readonly demoId: string,
    private readonly versionId: string,
    readonly linkToken: string | null,
    private readonly enabled: boolean,
  ) {
    addEventListener('pagehide', () => this.flush(true));
    addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.flush(true));
  }

  track(
    type: EventType,
    data: {
      stepId?: string | null;
      hotspotId?: string | null;
      stepIndex?: number;
      props?: Record<string, string | number | boolean>;
    } = {},
  ) {
    // Relais vers la page hôte (GA4, Segment…) : le site client peut écouter ces messages.
    if (parent !== window)
      parent.postMessage({ type: 'flowdsiml:event', event: type, demoId: this.demoId, ...data }, '*');
    if (!this.enabled) return;
    this.queue.push({ type, ...data, at: new Date().toISOString() });
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(false), 2000);
  }

  flush(unloading: boolean) {
    if (!this.queue.length) return;
    const events = this.queue.splice(0, 50);
    const batch = {
      demoId: this.demoId,
      versionId: this.versionId,
      linkToken: this.linkToken,
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      referrer: document.referrer || null,
      embedOrigin: parent !== window ? (location.ancestorOrigins?.[0] ?? null) : null,
      events,
    };
    const body = JSON.stringify(batch);
    // 1) Edge Function (text/plain : pas de pré-requête CORS, compatible sendBeacon)
    if (TRACK_URL) {
      const sent = unloading && navigator.sendBeacon?.(TRACK_URL, new Blob([body], { type: 'text/plain' }));
      if (sent) return;
      void fetch(TRACK_URL, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'text/plain' },
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
        })
        .catch(() => rpc('track_events', { p_batch: batch }, true).catch(() => undefined));
      return;
    }
    // 2) Repli : RPC directe
    void rpc('track_events', { p_batch: batch }, true).catch(() => undefined);
  }
}

export interface QuizResult {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  attemptsLeft: number | null;
  questions: Array<{ questionId: string; correct: boolean }>;
}

/** F2 : enregistre une tentative ; le score fait foi côté serveur (recalculé à partir du manifeste). */
export function submitQuizAttempt(batch: {
  demoId: string;
  versionId: string;
  visitorId: string;
  sessionId: string;
  linkToken: string | null;
  answers: Array<{ questionId: string; answerIds: string[] }>;
}) {
  return rpc<QuizResult>('submit_quiz_attempt', { p_batch: batch });
}
