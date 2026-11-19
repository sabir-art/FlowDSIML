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

/** Sous-titre WebVTT : début et fin en ms, texte sur une ligne (balises retirées). */
export interface Cue extends Span {
  text: string;
}

const ts = (s: string): number | null => {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/.exec(s.trim());
  if (!m) return null;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]);
};

/**
 * F7 : import .vtt (« Importer .vtt »). Lit les blocs « début --> fin » et leur texte ; ignore les
 * en-têtes, notes et styles ; retire les balises (<v Nom>, <b>…) ; 200 caractères par sous-titre et
 * 500 sous-titres au plus, comme la base. Rejette un fichier sans en-tête WEBVTT.
 */
export function parseVtt(src: string): Cue[] | null {
  const text = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(text)) return null;
  const out: Cue[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, rest = ''] = lines[i]!.split('-->');
    const from = ts(a ?? '');
    const to = ts(rest.trim().split(/\s+/)[0] ?? '');
    if (from === null || to === null || to <= from) continue;
    const body = lines
      .slice(i + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    if (body) out.push({ from, to: Math.min(to, 600000), text: body });
    if (out.length >= 500) break;
  }
  return out;
}

/** Export .vtt (« Modifier » → télécharger), pour garder une copie modifiable. */
export function toVtt(cues: Cue[]): string {
  const f = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor(ms / 60000) % 60;
    const s = Math.floor(ms / 1000) % 60;
    const r = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
  };
  return `WEBVTT\n\n${cues.map((c) => `${f(c.from)} --> ${f(c.to)}\n${c.text}`).join('\n\n')}\n`;
}
