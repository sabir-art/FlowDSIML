// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- déclaration locale de gifenc (sans types)
/// <reference path="./gifenc.d.ts" />
/**
 * L15-02 : GIF animé côté navigateur, encodé avec gifenc (MIT). Une image par étape, avec en option
 * la bulle, le curseur qui rejoint la zone puis un clic, et la lecture en boucle.
 */
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import type { ExportStep } from './model';

export interface GifOptions {
  /** Secondes par étape : 4 (lente), 2,5 (normale), 1,5 (rapide). */
  seconds: number;
  width: 640 | 960 | 1280;
  /** Plage d'étapes, indices inclusifs à partir de 0. */
  from: number;
  to: number;
  bubble: boolean;
  cursor: boolean;
  loop: boolean;
}

export const GIF_SPEEDS = [
  { key: 'slow', seconds: 4 },
  { key: 'normal', seconds: 2.5 },
  { key: 'fast', seconds: 1.5 },
] as const;
export const GIF_WIDTHS = [640, 960, 1280] as const;
export const DEFAULT_GIF = { seconds: 2.5, width: 960, bubble: true, cursor: true, loop: true } as const;

/** Une image du GIF : étape, avancement du curseur (0 à 1), clic, durée (ms). */
export interface GifFrame {
  step: number;
  cursor: number | null;
  click: number;
  bubble: boolean;
  delay: number;
}

const MOVE = 6;
const MOVE_MS = 70;
const CLICK_MS = [110, 110];

/** Images à produire : la somme des durées d'une étape vaut toujours `seconds`. */
export function planGif(steps: ExportStep[], o: GifOptions): GifFrame[] {
  const out: GifFrame[] = [];
  const total = o.seconds * 1000;
  for (let i = Math.max(0, o.from); i <= Math.min(o.to, steps.length - 1); i++) {
    const target = steps[i]!.target;
    if (o.cursor && target) {
      for (let k = 1; k <= MOVE; k++)
        out.push({ step: i, cursor: k / MOVE, click: 0, bubble: false, delay: MOVE_MS });
      CLICK_MS.forEach((d, k) => out.push({ step: i, cursor: 1, click: k + 1, bubble: false, delay: d }));
      const used = MOVE * MOVE_MS + CLICK_MS.reduce((a, b) => a + b, 0);
      out.push({ step: i, cursor: 1, click: 0, bubble: o.bubble, delay: Math.max(100, total - used) });
    } else out.push({ step: i, cursor: null, click: 0, bubble: o.bubble && !!target, delay: total });
  }
  return out;
}

export const gifHeight = (s: ExportStep, width: number) => Math.round((width * s.height) / s.width / 2) * 2;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function wrap(ctx: Ctx, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    lines.push(cur);
  }
  return lines;
}

/** Dessine une image du GIF. `img` est la capture déjà floutée, `w` × `h` la taille de sortie. */
export function drawGifFrame(
  ctx: Ctx,
  img: CanvasImageSource | null,
  steps: ExportStep[],
  f: GifFrame,
  w: number,
  h: number,
  font = 'Plus Jakarta Sans, system-ui, sans-serif',
) {
  const s = steps[f.step]!;
  ctx.fillStyle = '#F1F3F6';
  ctx.fillRect(0, 0, w, h);
  if (img) ctx.drawImage(img, 0, 0, w, h);
  const k = w / 960;
  const t = s.target;
  if (!img && !t && (s.title || s.text)) {
    // Étape de texte (écran de titre) : titre et texte centrés
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#12161B';
    ctx.font = `800 ${28 * k}px ${font}`;
    const tl = s.title ? wrap(ctx, s.title, w * 0.7) : [];
    ctx.font = `400 ${17 * k}px ${font}`;
    const bl = s.text ? wrap(ctx, s.text, w * 0.6).slice(0, 6) : [];
    let y = (h - (tl.length * 36 + bl.length * 24 + (tl.length && bl.length ? 12 : 0)) * k) / 2;
    ctx.font = `800 ${28 * k}px ${font}`;
    for (const l of tl) {
      ctx.fillText(l, w / 2, y);
      y += 36 * k;
    }
    if (tl.length && bl.length) y += 12 * k;
    ctx.fillStyle = '#4A5562';
    ctx.font = `400 ${17 * k}px ${font}`;
    for (const l of bl) {
      ctx.fillText(l, w / 2, y);
      y += 24 * k;
    }
    ctx.textAlign = 'left';
    return;
  }
  if (t) {
    const tx = (t.x + t.w / 2) * w;
    const ty = (t.y + t.h / 2) * h;
    // Cadre de la zone (framboise, visible sur toute capture)
    ctx.strokeStyle = '#D60B52';
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.roundRect(t.x * w, t.y * h, Math.max(8, t.w * w), Math.max(8, t.h * h), 6 * k);
    ctx.stroke();
    if (f.cursor !== null) {
      const prev = steps[f.step - 1]?.target;
      const sx = prev ? (prev.x + prev.w / 2) * w : w * 0.5;
      const sy = prev ? (prev.y + prev.h / 2) * h : h * 0.85;
      const e = 1 - (1 - f.cursor) ** 3;
      const cx = sx + (tx - sx) * e;
      const cy = sy + (ty - sy) * e;
      if (f.click) {
        ctx.fillStyle = 'rgba(214, 11, 82, 0.28)';
        ctx.beginPath();
        ctx.arc(cx, cy, (10 + f.click * 9) * k, 0, Math.PI * 2);
        ctx.fill();
      }
      // Curseur (flèche) en blanc bordé de noir
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k * 1.3, k * 1.3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 17);
      ctx.lineTo(4.5, 13);
      ctx.lineTo(7.5, 20);
      ctx.lineTo(10, 19);
      ctx.lineTo(7, 12);
      ctx.lineTo(12.5, 12);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#080808';
      ctx.stroke();
      ctx.restore();
    }
    if (f.bubble && (s.title || s.text)) {
      const pad = 14 * k;
      const bw = Math.min(360 * k, w - 2 * pad);
      ctx.font = `700 ${15 * k}px ${font}`;
      const tl = s.title ? wrap(ctx, s.title, bw - 2 * pad) : [];
      ctx.font = `400 ${13 * k}px ${font}`;
      const bl = s.text ? wrap(ctx, s.text, bw - 2 * pad).slice(0, 5) : [];
      const bh = pad * 2 + tl.length * 20 * k + (tl.length && bl.length ? 4 * k : 0) + bl.length * 18 * k;
      // Sous la zone si la place le permet, sinon au-dessus
      let by = (t.y + t.h) * h + 12 * k;
      if (by + bh > h - pad) by = Math.max(pad, t.y * h - bh - 12 * k);
      const bx = Math.min(Math.max(pad, tx - bw / 2), w - bw - pad);
      ctx.shadowColor = 'rgba(8, 8, 8, 0.25)';
      ctx.shadowBlur = 16 * k;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 10 * k);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#12161B';
      ctx.textBaseline = 'top';
      let y = by + pad;
      ctx.font = `700 ${15 * k}px ${font}`;
      for (const l of tl) {
        ctx.fillText(l, bx + pad, y);
        y += 20 * k;
      }
      if (tl.length && bl.length) y += 4 * k;
      ctx.fillStyle = '#4A5562';
      ctx.font = `400 ${13 * k}px ${font}`;
      for (const l of bl) {
        ctx.fillText(l, bx + pad, y);
        y += 18 * k;
      }
    }
  }
}

/** Encode des images RGBA (même taille) en GIF animé. */
export class GifWriter {
  private enc = GIFEncoder();
  private first = true;
  constructor(
    private width: number,
    private height: number,
    private loop: boolean,
  ) {}
  add(rgba: Uint8Array | Uint8ClampedArray, delay: number) {
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    this.enc.writeFrame(index, this.width, this.height, {
      palette,
      delay,
      ...(this.first ? { repeat: this.loop ? 0 : -1 } : {}),
    });
    this.first = false;
  }
  finish(): Uint8Array {
    this.enc.finish();
    return this.enc.bytes();
  }
}
