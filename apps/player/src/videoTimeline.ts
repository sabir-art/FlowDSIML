/**
 * F7 : temps d'une vidéo montée (coupes retirées). Les temps sont en ms dans la vidéo d'origine.
 */
export interface Span {
  from: number;
  to: number;
}

/** Coupes triées et fusionnées (chevauchements réunis), bornées à la durée. */
export function normalizeCuts(cuts: Span[], durationMs: number): Span[] {
  const s = cuts
    .map((c) => ({ from: Math.max(0, c.from), to: Math.min(durationMs, c.to) }))
    .filter((c) => c.to > c.from)
    .sort((a, b) => a.from - b.from);
  const out: Span[] = [];
  for (const c of s) {
    const last = out[out.length - 1];
    if (last && c.from <= last.to) last.to = Math.max(last.to, c.to);
    else out.push({ ...c });
  }
  return out;
}

/** Durée après coupe. */
export const editedDuration = (cuts: Span[], durationMs: number) =>
  durationMs - normalizeCuts(cuts, durationMs).reduce((n, c) => n + c.to - c.from, 0);

/** Temps d'origine → temps monté (un temps dans une coupe tombe sur son début). */
export function toEdited(t: number, cuts: Span[]): number {
  let shift = 0;
  for (const c of cuts) {
    if (t >= c.to) shift += c.to - c.from;
    else if (t > c.from) return c.from - shift;
  }
  return t - shift;
}

/** Temps monté → temps d'origine. */
export function toSource(e: number, cuts: Span[]): number {
  let t = e;
  for (const c of cuts) {
    if (t >= c.from) t += c.to - c.from;
    else break;
  }
  return t;
}

/** Si t est dans une coupe : fin de la coupe (saut), sinon null. */
export function skipCut(t: number, cuts: Span[]): number | null {
  const c = cuts.find((x) => t >= x.from && t < x.to);
  return c ? c.to : null;
}

/** « 1:05 » (minutes:secondes), arrondi à la seconde inférieure. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Sous-titre affiché au temps t (origine), ou null. */
export const captionAt = (t: number, caps: Array<Span & { text: string }>) =>
  caps.find((c) => t >= c.from && t < c.to)?.text ?? null;
