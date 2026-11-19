/**
 * L26-10 / 11 : télécommande sur téléphone. Le présentateur reste maître de l'état : le téléphone
 * envoie des commandes, la vue présentateur renvoie l'état. Transport : canal Realtime broadcast
 * « present-remote:<clé> » (clé aléatoire de 128 bits renouvelée à chaque appairage), doublé d'un
 * BroadcastChannel du même nom (même navigateur : essais, réseau local coupé). Chaque message porte un
 * identifiant : un message reçu deux fois n'est traité qu'une fois.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type RemoteCmd = 'next' | 'prev' | 'black' | 'end' | 'hello';
export type RemoteMessage =
  | { type: 'cmd'; cmd: RemoteCmd }
  | {
      type: 'state';
      index: number;
      total: number;
      black: boolean;
      startedAt: number;
      /** Durée cible en minutes, null sans minuteur. */
      minutes: number | null;
    }
  /** Notes modifiées pendant la présentation (index d'étape, ou -1 pour la démo). */
  | { type: 'notes'; index: number; text: string }
  | { type: 'end' };

type Envelope = { id: string; m: RemoteMessage };

export interface RemoteLink {
  send(m: RemoteMessage): void;
  close(): void;
  /** État de la connexion Realtime (le BroadcastChannel est toujours prêt). */
  readonly online: () => boolean;
}

export function openRemote(
  key: string,
  onMessage: (m: RemoteMessage) => void,
  onStatus?: (online: boolean) => void,
): RemoteLink {
  const seen = new Set<string>();
  const topic = `present-remote:${key}`;
  let online = false;
  const take = (e: Envelope | undefined) => {
    if (!e?.id || seen.has(e.id)) return;
    seen.add(e.id);
    if (seen.size > 500) seen.delete(seen.values().next().value as string);
    onMessage(e.m);
  };
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(topic);
    bc.onmessage = (ev: MessageEvent<Envelope>) => take(ev.data);
  } catch {
    bc = null;
  }
  let ch: RealtimeChannel | null = null;
  try {
    ch = supabase.channel(topic, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => take(payload as Envelope));
    ch.subscribe((status) => {
      online = status === 'SUBSCRIBED';
      onStatus?.(online);
    });
  } catch {
    ch = null;
  }
  return {
    send(m) {
      const e: Envelope = { id: crypto.randomUUID(), m };
      seen.add(e.id);
      bc?.postMessage(e);
      void ch?.send({ type: 'broadcast', event: 'm', payload: e }).catch(() => undefined);
    },
    close() {
      bc?.close();
      if (ch) void supabase.removeChannel(ch);
    },
    online: () => online || !!bc,
  };
}

/** Adresse courte affichée (sans protocole) et adresse complète du QR code. */
export const remoteShortUrl = () =>
  `${location.host}${location.pathname.replace(/\/$/, '')}/t`.replace(/^\/+/, '');
export const remoteUrl = (id: string, code: string) =>
  `${location.origin}${location.pathname}#/t?r=${encodeURIComponent(id)}&c=${encodeURIComponent(code)}`;

/** « 4829 1307 » (lecture, 8 chiffres) ; chiffre par chiffre pour les lecteurs d'écran. */
export const codeDisplay = (code: string) => `${code.slice(0, 4)}\u00a0${code.slice(4)}`;
export const codeSpoken = (code: string) => code.split('').join(' ');
