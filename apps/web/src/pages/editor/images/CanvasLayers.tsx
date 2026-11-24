import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import type { Selection, StepRow } from '../types';
import {
  LAYER_RADIUS,
  LAYER_SHADOW,
  fractionRatio,
  growRect,
  layerName,
  layerOpacity,
  moveRect,
  resizeRect,
  type ImageLayer,
  type Rect,
} from './layers';
import { useLayerEdit } from './useLayerActions';

const HANDLES = [
  ['nw', -1, -1],
  ['n', 0, -1],
  ['ne', 1, -1],
  ['e', 1, 0],
  ['se', 1, 1],
  ['s', 0, 1],
  ['sw', -1, 1],
  ['w', -1, 0],
] as const;

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'resize'; id: string; hx: -1 | 0 | 1; hy: -1 | 0 | 1; from: Rect };

/**
 * Retours client du 24/11 §1.2 : images ajoutées sur le canevas, au-dessus de la capture et sous les
 * flous. Elles ne se choisissent et ne se déplacent que quand l'outil Image est ouvert (`active`).
 * Souris : glisser pour déplacer, 8 poignées pour redimensionner (Maj inverse « Conserver les
 * proportions » le temps du geste). Clavier : flèches 1 % (Maj 10 %), Alt + flèches pour la taille,
 * Suppr pour retirer, Échap pour désélectionner.
 */
export function CanvasLayers({
  editor,
  step,
  frame,
  active,
  readOnly,
  selection,
  setSelection,
}: {
  editor: DemoEditor;
  step: StepRow;
  frame: RefObject<HTMLDivElement | null>;
  active: boolean;
  readOnly: boolean;
  selection: Selection;
  setSelection: (s: Selection) => void;
}) {
  const { t } = useTranslation();
  const act = useLayerEdit(editor, step, setSelection);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announce, setAnnounce] = useState('');
  const moved = useRef(false);
  const k = (l: ImageLayer, invert: boolean) =>
    (l.keep !== false) !== invert ? fractionRatio(l.ratio ?? 1, act.frameRatio) : null;
  const name = (l: ImageLayer) => layerName(l, t('editor.image.untitled'));
  const pct = (v: number) => Math.round(v * 100);

  function rel(e: { clientX: number; clientY: number }) {
    const b = frame.current!.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height };
  }
  function onMove(e: PointerEvent, l: ImageLayer) {
    if (!drag || drag.id !== l.id) return;
    const p = rel(e);
    moved.current = true;
    if (drag.kind === 'move') act.patch(l, moveRect(l, p.x - drag.dx - l.x, p.y - drag.dy - l.y));
    else act.patch(l, resizeRect(drag.from, drag.hx, drag.hy, p, k(l, e.shiftKey)));
  }
  function onKey(e: KeyboardEvent, l: ImageLayer) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelection({ kind: 'image', id: l.id });
      return;
    }
    if (e.key === 'Escape' && selection.kind === 'image') {
      e.preventDefault();
      e.stopPropagation();
      setSelection({ kind: 'step' });
      return;
    }
    if (readOnly) return;
    const d = e.shiftKey ? 0.1 : 0.01;
    const mv: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    };
    const m = mv[e.key];
    if (m) {
      e.preventDefault();
      e.stopPropagation();
      const next = e.altKey ? growRect(l, m[0], m[1], k(l, false)) : moveRect(l, m[0], m[1]);
      act.patch(l, next);
      setAnnounce(
        e.altKey
          ? t('editor.image.a11ySized', { w: pct(next.w), h: pct(next.h) })
          : t('editor.a11yMoved', { x: pct(next.x), y: pct(next.y) }),
      );
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      act.remove(l);
    }
  }

  return (
    <>
      {act.layers.map((l) => {
        if (l.hidden) return null;
        const url = editor.imageUrls[l.path];
        const on = active && selection.kind === 'image' && selection.id === l.id;
        // Arrondi de 12 px à l'échelle d'une capture de 1 280 px : en % de la boîte, sur chaque axe
        const rx = (LAYER_RADIUS / 1280 / l.w) * 100;
        const ry = ((LAYER_RADIUS / 1280) * act.frameRatio * 100) / l.h;
        return (
          <div
            key={l.id}
            className={`canvas-layer${on ? ' is-on' : ''}${active ? ' is-live' : ''}`}
            data-layer={l.id}
            {...(active
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'data-canvas-item': '',
                  'aria-label': t('editor.image.layerLabel', { name: name(l) }),
                  'aria-pressed': on,
                  onKeyDown: (e: KeyboardEvent) => onKey(e, l),
                }
              : {})}
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              width: `${l.w * 100}%`,
              height: `${l.h * 100}%`,
            }}
            onPointerDown={(e) => {
              if (!active || e.button !== 0) return;
              e.stopPropagation();
              setSelection({ kind: 'image', id: l.id });
              if (readOnly) return;
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              const p = rel(e);
              moved.current = false;
              setDrag({ kind: 'move', id: l.id, dx: p.x - l.x, dy: p.y - l.y });
            }}
            onPointerMove={(e) => onMove(e, l)}
            onPointerUp={() => setDrag(null)}
            onPointerCancel={() => setDrag(null)}
          >
            {url && (
              <img
                className="canvas-layer__img"
                src={url}
                alt={l.decorative ? '' : (l.alt ?? '')}
                draggable={false}
                style={{
                  opacity: layerOpacity(l) / 100,
                  borderRadius: l.rounded ? `${Math.min(50, rx)}% / ${Math.min(50, ry)}%` : undefined,
                  filter: l.shadow
                    ? `drop-shadow(0 ${LAYER_SHADOW.y}px ${LAYER_SHADOW.blur}px ${LAYER_SHADOW.color})`
                    : undefined,
                }}
              />
            )}
            {on &&
              !readOnly &&
              HANDLES.map(([pos, hx, hy]) => (
                <span
                  key={pos}
                  className={`canvas-layer__h canvas-layer__h--${pos}`}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    (e.currentTarget.parentElement as Element).setPointerCapture(e.pointerId);
                    setDrag({ kind: 'resize', id: l.id, hx, hy, from: { x: l.x, y: l.y, w: l.w, h: l.h } });
                  }}
                />
              ))}
          </div>
        );
      })}
      <span className="sr-only" role="status">
        {announce}
      </span>
    </>
  );
}
