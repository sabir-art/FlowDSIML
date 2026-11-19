/**
 * L25-11 / L25-12 : vidéo MP4 créée dans le navigateur (WebCodecs, H.264, conteneur MP4 via
 * mp4-muxer, licence MIT), à partir de la version publiée (zones floutées conservées). Écran de titre,
 * curseur et clic, bulle, zoom de l'éditeur, animations de saisie et de défilement. Sous-titres en
 * fichier .vtt (par défaut), incrustés ou absents. Images à durée variable : une phase immobile ne
 * coûte qu'une image.
 */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { drawGifFrame, type GifFrame } from './gif';
import type { ExportDemo, ExportStep } from './model';

export const MP4_FORMATS = [
  { key: '1920x1080', w: 1920, h: 1080, ratio: '16:9' },
  { key: '1280x720', w: 1280, h: 720, ratio: '16:9' },
  { key: '1080x1080', w: 1080, h: 1080, ratio: '1:1' },
  { key: '1080x1920', w: 1080, h: 1920, ratio: '9:16' },
] as const;
export type Mp4Format = (typeof MP4_FORMATS)[number]['key'];
export type Subtitles = 'vtt' | 'burn' | 'none';

export interface Mp4Options {
  /** Secondes par étape (mêmes vitesses que le GIF). */
  seconds: number;
  format: Mp4Format;
  from: number;
  to: number;
  bubble: boolean;
  cursor: boolean;
  zoom: boolean;
  /** Écran de titre (titre et logo, 3 s). */
  title: boolean;
  subtitles: Subtitles;
}

export const TITLE_SECONDS = 3;
/** 10 minutes au plus (au-delà : réduire les étapes). */
export const MP4_MAX_SECONDS = 600;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

export const defaultMp4 = (device?: 'desktop' | 'mobile'): Omit<Mp4Options, 'from' | 'to'> => ({
  seconds: 2.5,
  format: device === 'mobile' ? '1080x1920' : '1920x1080',
  bubble: true,
  cursor: true,
  zoom: true,
  title: true,
  subtitles: 'vtt',
});

export const mp4Format = (f: Mp4Format) => MP4_FORMATS.find((x) => x.key === f)!;

/** Durée calculée (jamais estimée) : étapes × vitesse, plus l'écran de titre. */
export function mp4Duration(o: Pick<Mp4Options, 'from' | 'to' | 'seconds' | 'title'>): number {
  const n = Math.max(0, o.to - o.from + 1);
  return Math.round((n * o.seconds + (o.title ? TITLE_SECONDS : 0)) * 10) / 10;
}

/** Une image de la vidéo : écran de titre ou étape, avec la phase de l'étape (0 à 1). */
export interface VideoFrame {
  kind: 'title' | 'step';
  step: number;
  /** Avancement dans l'étape (0 à 1) : curseur, clic, animation, zoom. */
  t: number;
  /** Début et durée (ms). */
  at: number;
  ms: number;
}

/**
 * Images à produire. Phases d'une étape : animation (saisie ou défilement) puis curseur qui rejoint
 * la zone (40 % du temps), clic, zoom progressif, bulle. Les images immobiles sont regroupées.
 */
export function planVideo(steps: ExportStep[], o: Mp4Options): VideoFrame[] {
  const out: VideoFrame[] = [];
  let at = 0;
  const push = (f: Omit<VideoFrame, 'at'>) => {
    out.push({ ...f, at });
    at += f.ms;
  };
  if (o.title) push({ kind: 'title', step: o.from, t: 1, ms: TITLE_SECONDS * 1000 });
  for (let i = Math.max(0, o.from); i <= Math.min(o.to, steps.length - 1); i++) {
    const s = steps[i]!;
    const total = o.seconds * 1000;
    const moving = (o.cursor && !!s.target) || (o.zoom && !!s.zoom) || !!s.animation;
    if (!moving) {
      push({ kind: 'step', step: i, t: 1, ms: total });
      continue;
    }
    // Phase animée (60 % de l'étape) image par image, puis l'état final immobile
    const animated = Math.round((total * 0.6) / FRAME_MS);
    for (let k = 0; k < animated; k++) push({ kind: 'step', step: i, t: k / animated, ms: FRAME_MS });
    push({ kind: 'step', step: i, t: 1, ms: Math.max(FRAME_MS, total - animated * FRAME_MS) });
  }
  return out;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
/** 00:00:01.500 */
export function vttTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(Math.round(ms % 1000), 3)}`;
}

/** Sous-titres WebVTT : une réplique par étape (titre et texte de la bulle). */
export function buildVtt(steps: ExportStep[], o: Mp4Options): { text: string; cues: number } {
  const lines = ['WEBVTT', ''];
  let at = o.title ? TITLE_SECONDS * 1000 : 0;
  let cues = 0;
  for (let i = Math.max(0, o.from); i <= Math.min(o.to, steps.length - 1); i++) {
    const s = steps[i]!;
    const text = [s.title, s.text].filter(Boolean).join('\n').replace(/-->/g, '→').trim();
    const end = at + o.seconds * 1000;
    if (text) {
      cues++;
      lines.push(String(cues), `${vttTime(at)} --> ${vttTime(end)}`, text, '');
    }
    at = end;
  }
  return { text: lines.join('\n'), cues };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** Images chargées d'une étape (capture floutée, capture pleine page). */
export interface StepImages {
  img: CanvasImageSource | null;
  full?: CanvasImageSource | null;
}

/**
 * Dessine une image de la vidéo sur un canevas `W` × `H` : capture centrée (bandes de couleur
 * autour), zoom, animations, curseur, bulle ; sous-titres incrustés si demandé.
 */
export function drawVideoFrame(
  ctx: Ctx,
  demo: ExportDemo,
  images: Map<number, StepImages>,
  f: VideoFrame,
  W: number,
  H: number,
  o: Mp4Options,
  logo: CanvasImageSource | null = null,
  stage?: { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: Ctx },
) {
  const font = 'Plus Jakarta Sans, system-ui, sans-serif';
  ctx.fillStyle = '#F1F3F6';
  ctx.fillRect(0, 0, W, H);
  if (f.kind === 'title') {
    ctx.fillStyle = demo.brand;
    ctx.fillRect(0, 0, W, H);
    const k = Math.min(W, H) / 1080;
    let y = H / 2 - 40 * k;
    if (logo) {
      const lh = 96 * k;
      const lw =
        lh * (((logo as { width?: number }).width ?? 1) / ((logo as { height?: number }).height ?? 1));
      ctx.drawImage(logo, (W - lw) / 2, y - lh - 40 * k, lw, lh);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${64 * k}px ${font}`;
    ctx.fillText(demo.title, W / 2, y, W * 0.86);
    y += 80 * k;
    ctx.font = `500 ${32 * k}px ${font}`;
    ctx.fillText(demo.workspace, W / 2, y, W * 0.86);
    ctx.textAlign = 'left';
    return;
  }
  const s = demo.steps[f.step]!;
  const im = images.get(f.step) ?? { img: null };
  // Taille de l'étape dans la vidéo (contenue, centrée)
  const scale = Math.min(W / s.width, H / s.height);
  const w = Math.round(s.width * scale);
  const h = Math.round(s.height * scale);
  const x0 = Math.round((W - w) / 2);
  const y0 = Math.round((H - h) / 2);
  const anim = s.animation;
  const animT = anim ? ease(f.t / 0.5) : 1;
  const after = anim ? Math.max(0, (f.t - 0.5) / 0.5) : f.t;
  // Étape dessinée à sa taille sur un canevas intermédiaire (cadre, curseur, bulle du GIF)
  const sc =
    stage ??
    (() => {
      const c = new OffscreenCanvas(w, h);
      return { canvas: c, ctx: c.getContext('2d')! };
    })();
  if (sc.canvas.width !== w || sc.canvas.height !== h) {
    sc.canvas.width = w;
    sc.canvas.height = h;
  }
  const g: GifFrame = {
    step: f.step,
    cursor: o.cursor && s.target ? (after < 0.4 ? after / 0.4 : 1) : null,
    click: o.cursor && s.target && after >= 0.4 && after < 0.5 ? (after < 0.45 ? 1 : 2) : 0,
    bubble: o.bubble && !!s.target && after >= 0.5,
    delay: 0,
  };
  let base: CanvasImageSource | null = im.img;
  if (anim?.type === 'scroll' && s.fullPage && im.full) {
    // L25-05 : la capture pleine page défile jusqu'à la position d'arrivée
    const fp = s.fullPage;
    const dir = anim.direction === 'up' ? -1 : 1;
    const top = Math.max(0, Math.min(fp.height - fp.viewportHeight, fp.top + dir * anim.distance * animT));
    const tmp = new OffscreenCanvas(w, h);
    tmp.getContext('2d')!.drawImage(im.full, 0, top, fp.width, fp.viewportHeight, 0, 0, w, h);
    base = tmp;
  }
  drawGifFrame(sc.ctx, base, demo.steps, g, w, h, font);
  if (anim?.type === 'typing' && anim.field) {
    // L25-04 : texte saisi lettre à lettre dans le champ repéré, toujours lisible
    const fl = anim.field;
    const shown = anim.text.slice(0, Math.round(anim.text.length * animT));
    sc.ctx.fillStyle = '#FFFFFF';
    sc.ctx.fillRect(fl.x * w + 2, fl.y * h + 2, fl.w * w - 4, fl.h * h - 4);
    sc.ctx.fillStyle = '#12161B';
    sc.ctx.font = `500 ${Math.max(10, fl.h * h * 0.5)}px ${font}`;
    sc.ctx.textBaseline = 'middle';
    sc.ctx.fillText(shown, fl.x * w + 8, (fl.y + fl.h / 2) * h, fl.w * w - 16);
  }
  // Zoom de l'éditeur : progressif après le clic
  const z = o.zoom && s.zoom ? s.zoom : null;
  const zk = z ? 1 + (z.scale - 1) * ease(Math.max(0, (after - 0.45) / 0.3)) : 1;
  if (z && zk > 1) {
    const sw = w / zk;
    const sh = h / zk;
    const sx = Math.min(w - sw, Math.max(0, z.x * w - sw / 2));
    const sy = Math.min(h - sh, Math.max(0, z.y * h - sh / 2));
    ctx.drawImage(sc.canvas, sx, sy, sw, sh, x0, y0, w, h);
  } else ctx.drawImage(sc.canvas, x0, y0);
  if (o.subtitles === 'burn') {
    const text = [s.title, s.text].filter(Boolean).join(' · ');
    if (text) {
      const k = Math.min(W, H) / 1080;
      ctx.font = `600 ${30 * k}px ${font}`;
      const lines = wrapText(ctx, text, W * 0.84).slice(0, 2);
      const lh = 40 * k;
      const bh = lines.length * lh + 24 * k;
      const by = H - bh - 40 * k;
      ctx.fillStyle = 'rgba(8, 8, 8, 0.82)';
      ctx.beginPath();
      ctx.roundRect(W * 0.06, by, W * 0.88, bh, 12 * k);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, by + 12 * k + i * lh));
      ctx.textAlign = 'left';
    }
  }
}

function wrapText(ctx: Ctx, text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** WebCodecs disponible (VideoEncoder) ; sinon la carte MP4 reste visible, désactivée. */
export const canEncodeVideo = () => typeof globalThis.VideoEncoder === 'function';

/** Profil H.264 accepté par le navigateur pour la taille demandée ; null si aucun. */
export async function pickCodec(w: number, h: number): Promise<string | null> {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42002a', 'avc1.42001f']) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 4_000_000 });
      if (r.supported) return codec;
    } catch {
      /* profil suivant */
    }
  }
  return null;
}

/**
 * Encode les images (durées variables) en H.264 dans un MP4. `draw(i)` dessine l'image i sur
 * `canvas` ; `progress(i)` est appelé après chaque image. Annulable par `signal`.
 */
export async function encodeMp4(p: {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  frames: Array<{ at: number; ms: number }>;
  draw: (i: number) => void | Promise<void>;
  progress: (i: number) => void;
  signal: AbortSignal;
}): Promise<ArrayBuffer> {
  const { width: w, height: h } = p.canvas;
  const codec = await pickCodec(w, h);
  if (!codec) throw new Error('NO_CODEC');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });
  let failure: unknown = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  enc.configure({ codec, width: w, height: h, bitrate: 4_000_000, framerate: FPS, latencyMode: 'quality' });
  let lastKey = -Infinity;
  for (const [i, f] of p.frames.entries()) {
    if (p.signal.aborted) {
      enc.close();
      throw new DOMException('Export annulé', 'AbortError');
    }
    if (failure) throw failure;
    await p.draw(i);
    const frame = new VideoFrame(p.canvas, {
      timestamp: Math.round(f.at * 1000),
      duration: Math.round(f.ms * 1000),
    });
    const key = f.at - lastKey >= 2000 || f.ms > FRAME_MS * 2;
    if (key) lastKey = f.at;
    enc.encode(frame, { keyFrame: key });
    frame.close();
    while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 0));
    p.progress(i);
  }
  // Le conteneur ne garde pas la durée de la dernière image : une image de clôture (même contenu)
  // termine la vidéo à la durée calculée
  const last = p.frames[p.frames.length - 1];
  if (last && last.ms > FRAME_MS) {
    const end = last.at + last.ms;
    const frame = new VideoFrame(p.canvas, {
      timestamp: Math.round((end - FRAME_MS) * 1000),
      duration: Math.round(FRAME_MS * 1000),
    });
    enc.encode(frame, { keyFrame: false });
    frame.close();
  }
  await enc.flush();
  if (failure) throw failure;
  enc.close();
  muxer.finalize();
  return target.buffer;
}
