/**
 * L22 : mode présentateur. La vue présentateur et l'écran public (deux fenêtres du même navigateur)
 * se parlent par BroadcastChannel ; aucun serveur, aucune statistique (lecteur en mode aperçu).
 */
import type { Manifest } from '@flowdsiml/manifest';

export const channelName = (demoId: string) => `fd-present-${demoId}`;

export interface PresentOptions {
  mode: 'two' | 'one';
  start: number;
  timer: boolean;
  /** Durée cible en minutes (1 à 180). */
  minutes: number;
  hideHotspots: boolean;
}

export const DEFAULT_PRESENT: PresentOptions = {
  mode: 'two',
  start: 0,
  timer: true,
  minutes: 15,
  hideHotspots: false,
};

export type PresentMessage =
  | { type: 'hello' }
  | { type: 'alive' }
  | {
      type: 'state';
      manifest?: Manifest;
      index: number;
      black: boolean;
      hideHotspots: boolean;
      title: string;
      total: number;
    }
  | { type: 'end' };

export function toSearch(o: PresentOptions): string {
  const p = new URLSearchParams({
    mode: o.mode,
    start: String(o.start),
    timer: o.timer ? '1' : '0',
    min: String(o.minutes),
    hide: o.hideHotspots ? '1' : '0',
  });
  return `?${p.toString()}`;
}

export function fromSearch(search: string, steps: number): PresentOptions {
  const p = new URLSearchParams(search);
  const int = (v: string | null, d: number, lo: number, hi: number) => {
    const n = Number.parseInt(v ?? '', 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    mode: p.get('mode') === 'one' ? 'one' : 'two',
    start: int(p.get('start'), 0, 0, Math.max(0, steps - 1)),
    timer: p.get('timer') !== '0',
    minutes: int(p.get('min'), 15, 1, 180),
    hideHotspots: p.get('hide') === '1',
  };
}

/** « 06:42 » (ou « 1:02:03 » au-delà d'une heure). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Libellé lisible pour le toast de fin : « 14 min 05 ». */
export function spoken(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
}

/** Notes du présentateur → puces (une par ligne non vide). */
export const noteLines = (notes: string | null | undefined) =>
  (notes ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** URL de l'écran public (même origine que l'app). */
export const screenUrl = (demoId: string) =>
  `${location.origin}${location.pathname}#/present/${demoId}/screen`;
