import { parseManifest, type EventType, type Manifest } from '@flowdsiml/manifest';
import { publishedBase, SUPABASE_ANON_KEY, SUPABASE_URL, TRACK_URL } from './config';
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

export async function loadManifest(demoId: string): Promise<Manifest> {
  const base = publishedBase(demoId);
  const res = await fetch(`${base}latest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('NOT_FOUND');
  return resolveAssets(parseManifest(await res.json()), base);
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
    private readonly linkToken: string | null,
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
