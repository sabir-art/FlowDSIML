import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { asCrop, cropToRatio, type CropRect } from '@flowdsiml/player-core';
import { useToast } from '../../../components/Toast';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { FULL_CROP, RATIOS, applyCrop, ratioLabel, sameSize, type CropRatio } from './crop';

/** L25-02 : brouillon du recadrage, partagé entre le canevas et le panneau. */
export type CropDraft = { rect: CropRect; ratio: CropRatio; scope: 'step' | 'all' };
export const cropDraftFor = (step: StepRow): CropDraft => ({
  rect: asCrop((step.options as { crop?: unknown } | null)?.crop) ?? FULL_CROP,
  ratio: 'free',
  scope: 'step',
});

const MIN = 0.05;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Redimensionne par une poignée (bord ou coin), format respecté s'il est imposé. */
function resize(
  r: CropRect,
  h: Handle,
  dx: number,
  dy: number,
  ratio: number | null,
  imgRatio: number,
): CropRect {
  let { x, y, w, h: hh } = r;
  if (h.includes('w')) {
    const nx = clamp(x + dx, 0, x + w - MIN);
    w += x - nx;
    x = nx;
  }
  if (h.includes('e')) w = clamp(w + dx, MIN, 1 - x);
  if (h.includes('n')) {
    const ny = clamp(y + dy, 0, y + hh - MIN);
    hh += y - ny;
    y = ny;
  }
  if (h.includes('s')) hh = clamp(hh + dy, MIN, 1 - y);
  if (ratio) {
    // Hauteur relative déduite de la largeur (format en pixels : w·W / (h·H) = ratio)
    const want = (w * imgRatio) / ratio;
    if (h === 'n' || h === 's') w = clamp((hh * ratio) / imgRatio, MIN, 1 - x);
    else hh = clamp(want, MIN, 1 - y);
    if (h.includes('n')) y = r.y + r.h - hh;
  }
  return { x: r4(x), y: r4(y), w: r4(w), h: r4(hh) };
}

/**
 * Canevas du recadrage : capture entière, voile sombre hors du cadre, 8 poignées de 12 px (contour
 * blanc), étiquette des dimensions. Glisser le cadre le déplace ; flèches : 1 px, Maj : 10 px.
 */
export function CropCanvas({
  step,
  url,
  draft,
  setDraft,
}: {
  step: StepRow;
  url: string | undefined;
  draft: CropDraft;
  setDraft: (d: CropDraft) => void;
}) {
  const { t, i18n } = useTranslation();
  const frame = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ h: Handle | 'move'; x: number; y: number; r: CropRect } | null>(null);
  const W = step.image_width ?? 1280;
  const H = step.image_height ?? 800;
  const ratio = draft.ratio === 'free' ? null : RATIOS[draft.ratio];
  const r = draft.rect;
  const pw = Math.round(r.w * W);
  const ph = Math.round(r.h * H);
  const nf = (n: number) => n.toLocaleString(i18n.language);
  const label = `${nf(pw)} × ${nf(ph)}${ratioLabel(pw, ph) ? ` · ${ratioLabel(pw, ph)}` : ''}`;

  const rel = (e: { clientX: number; clientY: number }) => {
    const b = frame.current!.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height };
  };
  const down = (h: Handle | 'move') => (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ h, ...rel(e), r });
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = rel(e);
    const dx = p.x - drag.x;
    const dy = p.y - drag.y;
    if (drag.h === 'move')
      setDraft({
        ...draft,
        rect: {
          ...drag.r,
          x: r4(clamp(drag.r.x + dx, 0, 1 - drag.r.w)),
          y: r4(clamp(drag.r.y + dy, 0, 1 - drag.r.h)),
        },
      });
    else setDraft({ ...draft, rect: resize(drag.r, drag.h, dx, dy, ratio, W / H) });
  };
  const key = (h: Handle) => (e: KeyboardEvent) => {
    const step1 = e.shiftKey ? 10 : 1;
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return;
    e.preventDefault();
    setDraft({ ...draft, rect: resize(r, h, (k[0]! * step1) / W, (k[1]! * step1) / H, ratio, W / H) });
  };
  const pct = (v: number) => `${v * 100}%`;

  return (
    <div
      ref={frame}
      className="canvas-frame crop-frame"
      style={{ aspectRatio: `${W} / ${H}` }}
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      {url && <img src={url} alt={step.title || t('editor.untitled')} draggable={false} />}
      <div className="crop-veil" aria-hidden="true" style={{ left: 0, top: 0, right: 0, height: pct(r.y) }} />
      <div
        className="crop-veil"
        aria-hidden="true"
        style={{ left: 0, bottom: 0, right: 0, top: pct(r.y + r.h) }}
      />
      <div
        className="crop-veil"
        aria-hidden="true"
        style={{ left: 0, top: pct(r.y), width: pct(r.x), height: pct(r.h) }}
      />
      <div
        className="crop-veil"
        aria-hidden="true"
        style={{ left: pct(r.x + r.w), right: 0, top: pct(r.y), height: pct(r.h) }}
      />
      <div
        className="crop-box"
        style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }}
        onPointerDown={down('move')}
      >
        <span className="crop-dims">{label}</span>
        {HANDLES.map((h) => (
          <button
            key={h}
            type="button"
            className={`crop-h crop-h--${h}`}
            aria-label={t(`editor.crop.handle_${h}`)}
            onPointerDown={down(h)}
            onKeyDown={key(h)}
          />
        ))}
      </div>
    </div>
  );
}

/** Panneau « Recadrer la capture » (format, taille, appliquer à, réinitialiser, annuler, recadrer). */
export function CropPanel({
  editor,
  step,
  draft,
  setDraft,
  onClose,
}: {
  editor: DemoEditor;
  step: StepRow;
  draft: CropDraft;
  setDraft: (d: CropDraft) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const W = step.image_width ?? 1280;
  const H = step.image_height ?? 800;
  const same = sameSize(editor.steps, step);
  const others = editor.steps.filter((s) => s.kind === 'image' && s.image_path).length - same.length;
  const pw = Math.round(draft.rect.w * W);
  const ph = Math.round(draft.rect.h * H);
  const nf = (n: number) => n.toLocaleString(i18n.language);
  const setSize = (w: number, h: number) => {
    const rw = clamp(w / W, MIN, 1 - draft.rect.x);
    const rh = clamp(h / H, MIN, 1 - draft.rect.y);
    setDraft({ ...draft, ratio: 'free', rect: { ...draft.rect, w: r4(rw), h: r4(rh) } });
  };
  // L34 (WCAG 2.5.7) : position du cadre au clavier ou d'un clic, sans glisser
  const px = Math.round(draft.rect.x * W);
  const py = Math.round(draft.rect.y * H);
  const setPos = (x: number, y: number) => {
    const rx = clamp(x / W, 0, 1 - draft.rect.w);
    const ry = clamp(y / H, 0, 1 - draft.rect.h);
    setDraft({ ...draft, rect: { ...draft.rect, x: r4(rx), y: r4(ry) } });
  };
  const apply = () => {
    const next = asCrop(draft.rect);
    const targets = draft.scope === 'all' ? same : [step];
    applyCrop(editor, targets, next);
    if (draft.scope === 'all' && others > 0) toast(t('editor.crop.othersUnchanged', { count: others }));
    onClose();
  };
  return (
    <div className="sp-panel crop-panel">
      <div className="sec">
        <div className="sec-title">{t('editor.crop.title')}</div>
        <span className="t-label" id="crop-fmt">
          {t('editor.crop.format')}
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="crop-fmt">
          {(['free', '16:9', '4:3', '1:1'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={draft.ratio === k}
              onClick={() =>
                setDraft({
                  ...draft,
                  ratio: k,
                  rect:
                    k === 'free' ? draft.rect : cropToRatio({ width: W, height: H }, draft.rect, RATIOS[k]),
                })
              }
            >
              {k === 'free' ? t('editor.crop.free') : k}
            </button>
          ))}
        </div>
        <div className="crop-size">
          <div className="field">
            <label className="t-label" htmlFor="crop-w">
              {t('editor.crop.width')}
            </label>
            <input
              id="crop-w"
              className="input input-sm num"
              type="number"
              min={1}
              max={W}
              value={pw}
              onChange={(e) => setSize(Number(e.target.value) || 1, ph)}
            />
          </div>
          <div className="field">
            <label className="t-label" htmlFor="crop-h">
              {t('editor.crop.height')}
            </label>
            <input
              id="crop-h"
              className="input input-sm num"
              type="number"
              min={1}
              max={H}
              value={ph}
              onChange={(e) => setSize(pw, Number(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label className="t-label" htmlFor="crop-x">
              {t('editor.crop.left')}
            </label>
            <input
              id="crop-x"
              className="input input-sm num"
              type="number"
              min={0}
              max={W - pw}
              value={px}
              onChange={(e) => setPos(Number(e.target.value) || 0, py)}
            />
          </div>
          <div className="field">
            <label className="t-label" htmlFor="crop-y">
              {t('editor.crop.top')}
            </label>
            <input
              id="crop-y"
              className="input input-sm num"
              type="number"
              min={0}
              max={H - ph}
              value={py}
              onChange={(e) => setPos(px, Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <p className="help">{t('editor.crop.help')}</p>
        <p className="sr-only" aria-live="polite">
          {t('editor.crop.dims', { w: nf(pw), h: nf(ph) })}
        </p>
        <span className="t-label" id="crop-scope">
          {t('editor.crop.applyTo')}
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="crop-scope">
          <button
            type="button"
            role="radio"
            aria-checked={draft.scope === 'step'}
            onClick={() => setDraft({ ...draft, scope: 'step' })}
          >
            {t('editor.crop.thisStep')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={draft.scope === 'all'}
            onClick={() => setDraft({ ...draft, scope: 'all' })}
          >
            {t('editor.crop.all', { n: same.length })}
          </button>
        </div>
        {draft.scope === 'all' && others > 0 && (
          <p className="help">{t('editor.crop.allHelp', { count: others })}</p>
        )}
        <div className="crop-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDraft({ ...draft, ratio: 'free', rect: FULL_CROP })}
          >
            {t('editor.crop.reset')}
          </button>
          <span className="sp" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
            {t('editor.crop.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
