/**
 * F7 : règles de l'enregistrement vidéo de l'onglet (arbitrages du chef d'équipe) : 10 minutes au
 * plus, débit plafonné à 600 kb/s (≈ 45 Mo pour 10 min), fichier de 50 Mo au plus (plan gratuit),
 * WebM VP9 + Opus. Fonctions pures, testées.
 */
export const MAX_MS = 10 * 60 * 1000;
export const WARN_MS = 9 * 60 * 1000;
export const MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_BPS = 560_000;
export const AUDIO_BPS = 40_000;

/** Premier format WebM accepté par le navigateur (VP9 + Opus de préférence). */
export function pickMime(supported: (t: string) => boolean): string {
  for (const t of [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ])
    if (supported(t)) return t;
  return 'video/webm';
}

/** Chronomètre « 01:05 » (minutes:secondes). */
export function timer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Temps d'enregistrement écoulé (pauses exclues). */
export function elapsed(
  st: { startedAt: number; pausedAt: number | null; pausedMs: number },
  now: number,
): number {
  const end = st.pausedAt ?? now;
  return Math.max(0, end - st.startedAt - st.pausedMs);
}

export interface Mark {
  t: number;
  /** Clic détecté (libellé de l'élément) ou marque manuelle. */
  label: string;
  manual: boolean;
  /** L21-01 : zones floutées à l'écran au moment du repère (relatives à la fenêtre, 0 à 1). */
  zones?: Zone[];
}
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zone gardée dans l'image (0 à 1), taille minimale 2 %. */
export function clampZone(z: Zone): Zone {
  const w = Math.min(1, Math.max(0.02, z.w));
  const h = Math.min(1, Math.max(0.02, z.h));
  return { x: Math.min(1 - w, Math.max(0, z.x)), y: Math.min(1 - h, Math.max(0, z.y)), w, h };
}

/**
 * Pauses-étapes proposées au montage : clics horodatés et marques manuelles, dans l'ordre ; deux
 * repères à moins de 1,5 s fusionnent (la marque manuelle l'emporte) ; 50 au plus.
 */
export function proposePauses(marks: Mark[], durationMs: number): Mark[] {
  const out: Mark[] = [];
  for (const m of [...marks].filter((x) => x.t >= 0 && x.t <= durationMs).sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (last && m.t - last.t < 1500) {
      if (m.manual && !last.manual) out[out.length - 1] = m;
      continue;
    }
    out.push(m);
  }
  return out.slice(0, 50);
}

/** Envoi possible (taille et durée) ; sinon la raison. */
export function checkRecording(bytes: number, durationMs: number): 'ok' | 'tooBig' | 'tooLong' | 'empty' {
  if (bytes <= 0 || durationMs <= 0) return 'empty';
  if (bytes > MAX_BYTES) return 'tooBig';
  if (durationMs > MAX_MS + 2000) return 'tooLong';
  return 'ok';
}

/** Formats mobiles (popup « Format mobile »). */
export const DEVICES = {
  phone: { w: 390, h: 844 },
  large: { w: 430, h: 932 },
  tablet: { w: 820, h: 1180 },
} as const;
export type DeviceKey = keyof typeof DEVICES | 'custom';

/** Taille émulée (orientation appliquée), bornée à 200–2000 comme la base. */
export function viewportFor(
  device: DeviceKey,
  landscape: boolean,
  custom: { w: number; h: number } = { w: 390, h: 844 },
): { w: number; h: number } {
  const base = device === 'custom' ? custom : DEVICES[device];
  const clamp = (n: number) => Math.min(2000, Math.max(200, Math.round(n)));
  const w = clamp(base.w);
  const h = clamp(base.h);
  return landscape ? { w: h, h: w } : { w, h };
}
