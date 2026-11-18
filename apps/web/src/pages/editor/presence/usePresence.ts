/**
 * L22-08 : canal de présence d'une démo. Petit magasin (useSyncExternalStore) : les mouvements de
 * curseur des autres ne re-rendent que le calque des curseurs, pas tout l'éditeur.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { supabase } from '../../../lib/supabase';
import { othersFrom, topic, type PresencePayload } from './presence';

export interface PresenceTransport {
  join(
    topic: string,
    me: string,
    onSync: (state: Record<string, PresencePayload[]>) => void,
  ): { track(p: PresencePayload): void; leave(): void };
}

/** Supabase Realtime, canal privé : les policies de realtime.messages s'appliquent. */
const supabaseTransport: PresenceTransport = {
  join(name, me, onSync) {
    const ch = supabase.channel(name, { config: { private: true, presence: { key: me } } });
    let ready = false;
    let pending: PresencePayload | null = null;
    ch.on('presence', { event: 'sync' }, () =>
      onSync(ch.presenceState() as unknown as Record<string, PresencePayload[]>),
    ).subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      ready = true;
      if (pending) void ch.track(pending);
    });
    return {
      track(p) {
        pending = p;
        if (ready) void ch.track(p);
      },
      leave() {
        void supabase.removeChannel(ch);
      },
    };
  },
};

/** En développement seulement, les tests e2e peuvent fournir leur propre transport. */
function transport(): PresenceTransport {
  const injected = import.meta.env.DEV
    ? (window as unknown as { __fdPresence?: PresenceTransport }).__fdPresence
    : undefined;
  return injected ?? supabaseTransport;
}

type Listener = () => void;
const sansCursor = (list: PresencePayload[]) => JSON.stringify(list.map((p) => ({ ...p, c: null })));

class PresenceStore {
  others: PresencePayload[] = [];
  /** Même liste, mais ne change pas quand seul un curseur bouge. */
  calm: PresencePayload[] = [];
  private calmKey = '[]';
  private listeners = new Set<Listener>();
  set(list: PresencePayload[]) {
    this.others = list;
    const key = sansCursor(list);
    if (key !== this.calmKey) {
      this.calmKey = key;
      this.calm = list;
    }
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

const THROTTLE_MS = 120;

export function usePresenceChannel(demoId: string, me: string | undefined) {
  const store = useMemo(() => new PresenceStore(), []);
  const conn = useRef<ReturnType<PresenceTransport['join']> | null>(null);
  const local = useRef<PresencePayload | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!me || !demoId) return;
    local.current = { u: me, s: null, a: null, t: Date.now(), c: null, e: null, ...(local.current ?? {}) };
    local.current.u = me;
    const c = transport().join(topic(demoId), me, (state) => store.set(othersFrom(state, me)));
    conn.current = c;
    c.track(local.current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      c.leave();
      conn.current = null;
      store.set([]);
    };
  }, [demoId, me, store]);

  /** Met à jour ma présence ; envoi limité à un message toutes les 120 ms (le dernier gagne). */
  const update = useMemo(
    () => (patch: Partial<Omit<PresencePayload, 'u'>>) => {
      const cur = local.current ?? { u: me ?? '', s: null, a: null, t: Date.now(), c: null, e: null };
      const next = { ...cur, ...patch };
      if (JSON.stringify(next) === JSON.stringify(cur)) return;
      local.current = next;
      const send = () => {
        timer.current = null;
        lastSent.current = Date.now();
        if (local.current) conn.current?.track(local.current);
      };
      const wait = THROTTLE_MS - (Date.now() - lastSent.current);
      if (wait <= 0) send();
      else if (!timer.current) timer.current = setTimeout(send, wait);
    },
    [me],
  );

  return { store, update };
}

export type PresenceStoreT = PresenceStore;

/** Autres personnes, sans re-rendu quand seul un curseur bouge. */
export function usePresenceCalm(store: PresenceStore) {
  return useSyncExternalStore(store.subscribe, () => store.calm);
}
/** Autres personnes, curseurs compris (calque des curseurs). */
export function usePresenceLive(store: PresenceStore) {
  return useSyncExternalStore(store.subscribe, () => store.others);
}
