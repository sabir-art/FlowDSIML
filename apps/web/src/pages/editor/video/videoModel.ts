import { useSyncExternalStore } from 'react';
import type { Json } from '@flowdsiml/supabase-types';

/** F7 : réglages d'une étape vidéo (colonne steps.video), lus prudemment. Temps en ms (origine). */
export interface VideoPause {
  id: string;
  t: number;
  title: string;
  body: string;
}
export interface VideoCaption {
  from: number;
  to: number;
  text: string;
}
export interface VideoConfig {
  cuts: Array<{ from: number; to: number }>;
  pauses: VideoPause[];
  captions: VideoCaption[];
  captionsDefault: boolean;
  autoplayMuted: boolean;
  hasVoice: boolean;
  frames: Record<string, string>;
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const str = (x: unknown) => (typeof x === 'string' ? x : '');

export function asVideo(raw: Json | null | undefined): VideoConfig {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as Array<Record<string, unknown>>) : []);
  return {
    cuts: arr('cuts')
      .map((c) => ({ from: num(c.from), to: num(c.to) }))
      .filter((c): c is { from: number; to: number } => c.from !== null && c.to !== null && c.to > c.from),
    pauses: arr('pauses')
      .map((p) => ({ id: str(p.id), t: num(p.t) ?? -1, title: str(p.title), body: str(p.body) }))
      .filter((p) => p.id && p.t >= 0)
      .sort((a, b) => a.t - b.t),
    captions: arr('captions')
      .map((c) => ({ from: num(c.from) ?? -1, to: num(c.to) ?? -1, text: str(c.text) }))
      .filter((c) => c.from >= 0 && c.to > c.from && c.text)
      .sort((a, b) => a.from - b.from),
    captionsDefault: o.captionsDefault === true,
    autoplayMuted: o.autoplayMuted !== false,
    hasVoice: o.hasVoice === true,
    frames:
      o.frames && typeof o.frames === 'object' && !Array.isArray(o.frames)
        ? Object.fromEntries(
            Object.entries(o.frames as Record<string, unknown>).filter(
              (e): e is [string, string] => typeof e[1] === 'string',
            ),
          )
        : {},
  };
}

/** Limites de la base (video_options_ok). */
export const MAX_PAUSES = 50;
export const MAX_CUTS = 50;
export const MAX_CAPTIONS = 500;

export const newPauseId = () => `p-${crypto.randomUUID().slice(0, 8)}`;

/** « 01:05 » (minutes:secondes), comme la maquette du montage. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * État partagé du montage (canevas, pistes et panneau sont des composants séparés) : temps courant,
 * pause sélectionnée, début de coupe en attente. Un seul montage ouvert à la fois.
 */
interface EditState {
  stepId: string | null;
  t: number;
  pause: string | null;
  cutStart: number | null;
  playing: boolean;
}
let state: EditState = { stepId: null, t: 0, pause: null, cutStart: null, playing: false };
const subs = new Set<() => void>();
export function setVideoEdit(patch: Partial<EditState>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
export function useVideoEdit(stepId: string): EditState {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
  // Autre étape : état remis à zéro (lecture du nouvel état au prochain rendu)
  if (s.stepId !== stepId) {
    state = { stepId, t: 0, pause: null, cutStart: null, playing: false };
    return state;
  }
  return s;
}
/** Élément <video> du canevas (piloté par les pistes et le panneau). */
export const videoEl: { current: HTMLVideoElement | null } = { current: null };
