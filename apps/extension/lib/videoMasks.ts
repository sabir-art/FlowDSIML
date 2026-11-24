import type { PiiType } from '@flowdsiml/core';

/**
 * EXT-02 §4 : données repérées pendant l'enregistrement vidéo, suivies dans le temps. Une donnée (un
 * nom, un e-mail) a une ligne à la revue ; ses positions à l'écran sont relevées à chaque changement.
 * « En direct » : elle a été masquée dans la page, donc dans l'image enregistrée (définitif). Sinon
 * l'image est brute, et le masque est incrusté à l'envoi si la ligne est « Masqué ».
 * Fonctions pures, testées.
 */
export interface MaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Position à un instant (ms d'enregistrement) ; `rects` vide : la donnée n'est plus à l'écran. */
export interface MaskFrame {
  t: number;
  rects: MaskRect[];
}
/** Comment la donnée a été repérée : champ de formulaire, libellé voisin, forme du texte, zone imposée. */
export type MaskOrigin = 'field' | 'label' | 'pattern' | 'zone' | 'manual';
export interface VideoMask {
  id: string;
  type: PiiType | 'manual';
  /** Valeur déjà masquée (« j••••@••••.fr ») ; jamais la valeur réelle. */
  excerpt: string;
  by: MaskOrigin;
  /** Libellé du champ ou du texte voisin qui a servi au repérage. */
  label?: string;
  /** Masquée dans la page pendant l'enregistrement : définitif. */
  live: boolean;
  /** Masquée à l'envoi (sans effet sur une donnée « en direct »). */
  on: boolean;
  frames: MaskFrame[];
}

/** Au plus : données suivies par enregistrement, relevés par donnée. */
export const MAX_MASKS = 200;
export const MAX_FRAMES = 6000;

const sameRects = (a: MaskRect[], b: MaskRect[]) =>
  a.length === b.length &&
  a.every((r, i) => {
    const o = b[i]!;
    return (
      Math.abs(r.x - o.x) < 0.0015 &&
      Math.abs(r.y - o.y) < 0.0015 &&
      Math.abs(r.w - o.w) < 0.0015 &&
      Math.abs(r.h - o.h) < 0.0015
    );
  });

/** Ajoute un relevé s'il change quelque chose (positions différentes, ou disparition). */
export function addFrame(frames: MaskFrame[], f: MaskFrame): MaskFrame[] {
  const last = frames[frames.length - 1];
  if (last && (f.t < last.t || sameRects(last.rects, f.rects))) return frames;
  if (!last && !f.rects.length) return frames;
  if (frames.length >= MAX_FRAMES) return frames;
  frames.push({ t: Math.round(f.t), rects: f.rects });
  return frames;
}

/** Passages où la donnée est à l'écran : [début, fin] en ms. */
export function segments(m: Pick<VideoMask, 'frames'>, durationMs: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let from: number | null = null;
  for (const f of m.frames) {
    if (f.rects.length && from === null) from = f.t;
    else if (!f.rects.length && from !== null) {
      out.push([from, f.t]);
      from = null;
    }
  }
  if (from !== null) out.push([from, Math.max(from, durationMs)]);
  return out.filter(([a, b]) => b > a || durationMs <= a);
}

/** Premier et dernier instant à l'écran (ligne de la liste : « 0:04 – 0:19 »). */
export function span(m: Pick<VideoMask, 'frames'>, durationMs: number): [number, number] | null {
  const s = segments(m, durationMs);
  return s.length ? [s[0]![0], s[s.length - 1]![1]] : null;
}

/**
 * Zones à couvrir à l'instant t. Pour tenir compte d'un défilement entre deux relevés, on prend aussi les
 * positions relevées juste avant et juste après (marge en ms) : le masque déborde plutôt que de laisser
 * voir la donnée.
 */
export function rectsAt(m: Pick<VideoMask, 'frames'>, t: number, margin = 160): MaskRect[] {
  const out: MaskRect[] = [];
  let current: MaskFrame | null = null;
  let before: MaskFrame | null = null;
  for (const f of m.frames) {
    if (f.t > t + margin) break;
    if (f.t <= t) {
      before = current;
      current = f;
    } else out.push(...f.rects);
  }
  if (current) {
    out.push(...current.rects);
    // La position vient de changer : celle d'avant compte encore
    if (before && current.t > t - margin) out.push(...before.rects);
  }
  return out;
}

/** Boîte englobante en pixels, élargie d'une marge et bornée à l'image. */
export function maskBox(r: MaskRect, width: number, height: number, pad = 6) {
  const x = Math.max(0, Math.floor(r.x * width) - pad);
  const y = Math.max(0, Math.floor(r.y * height) - pad);
  const x2 = Math.min(width, Math.ceil((r.x + r.w) * width) + pad);
  const y2 = Math.min(height, Math.ceil((r.y + r.h) * height) + pad);
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

/** Masques à incruster à l'envoi : ceux qui sont actifs et que l'image ne porte pas déjà. */
export const toBurn = (masks: VideoMask[]) => masks.filter((m) => m.on && !m.live && m.frames.length);

/** Masque ajouté à la main à la revue : une zone fixe sur un passage. */
export function manualMask(id: string, rect: MaskRect, from: number, to: number): VideoMask {
  return {
    id,
    type: 'manual',
    excerpt: '',
    by: 'manual',
    live: false,
    on: true,
    frames: [
      // Arrondi vers le bas : le masque est là dès l'image affichée
      { t: Math.floor(from), rects: [rect] },
      { t: Math.ceil(Math.max(from + 1, to)), rects: [] },
    ],
  };
}

/** Durée par défaut d'un masque ajouté à la main, et durée minimale de son passage. */
export const MANUAL_MS = 5000;
export const MANUAL_MIN_MS = 500;

/** Déplace le début ou la fin du passage d'un masque ajouté (bornes : la vidéo, durée minimale). */
export function setManualSpan(m: VideoMask, from: number, to: number, durationMs: number): void {
  const a = m.frames[0];
  const b = m.frames[1];
  if (m.type !== 'manual' || !a || !b) return;
  const start = Math.min(Math.max(0, Math.floor(from)), Math.max(0, durationMs - MANUAL_MIN_MS));
  const end = Math.min(durationMs, Math.max(start + MANUAL_MIN_MS, Math.ceil(to)));
  a.t = start;
  b.t = end;
}

/** « 0:07 » (minutes non complétées, comme la chronologie de la revue). */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
