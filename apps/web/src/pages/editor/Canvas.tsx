import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { richTextToHtml } from '@flowdsiml/core';
import type { Rect } from '@flowdsiml/manifest';
import type { DemoEditor } from './useDemoEditor';
import { asRects, asZoom, type Selection, type StepRow } from './types';

export type Tool = 'select' | 'hotspot' | 'blur';

interface Props {
  editor: DemoEditor;
  step: StepRow;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  readOnly: boolean;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const r4 = (v: number) => Math.round(v * 10000) / 10000;

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'resize'; id: string }
  | { kind: 'draw'; x0: number; y0: number; rect: Rect }
  | { kind: 'blur-move'; index: number; dx: number; dy: number };

export function Canvas({ editor, step, tool, setTool, selection, setSelection, readOnly }: Props) {
  const { t } = useTranslation();
  const frame = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const hotspots = editor.hotspots.filter((h) => h.step_id === step.id);
  const blurs = asRects(step.blurs);
  const zoom = asZoom(step.zoom);

  function rel(e: { clientX: number; clientY: number }) {
    const b = frame.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) };
  }

  async function onFrameDown(e: ReactPointerEvent) {
    if (readOnly || e.button !== 0) return;
    const p = rel(e);
    if (tool === 'hotspot') {
      const h = await editor.addHotspot(step.id, p.x, p.y, t('editor.newHotspot'));
      if (h) setSelection({ kind: 'hotspot', id: h.id });
      setTool('select');
    } else if (tool === 'blur') {
      (e.target as Element).setPointerCapture(e.pointerId);
      setDrag({ kind: 'draw', x0: p.x, y0: p.y, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
    } else {
      setSelection({ kind: 'step' });
    }
  }

  function onMove(e: ReactPointerEvent) {
    if (!drag) return;
    const p = rel(e);
    if (drag.kind === 'move') {
      const h = hotspots.find((x) => x.id === drag.id)!;
      editor.updateHotspot(drag.id, {
        x: r4(clamp(p.x - drag.dx, 0, 1 - h.w)),
        y: r4(clamp(p.y - drag.dy, 0, 1 - h.h)),
      });
    } else if (drag.kind === 'resize') {
      const h = hotspots.find((x) => x.id === drag.id)!;
      editor.updateHotspot(drag.id, {
        w: r4(clamp(p.x - h.x, 0.01, 1 - h.x)),
        h: r4(clamp(p.y - h.y, 0.01, 1 - h.y)),
      });
    } else if (drag.kind === 'draw') {
      setDrag({
        ...drag,
        rect: {
          x: Math.min(drag.x0, p.x),
          y: Math.min(drag.y0, p.y),
          w: Math.abs(p.x - drag.x0),
          h: Math.abs(p.y - drag.y0),
        },
      });
    } else if (drag.kind === 'blur-move') {
      const b = blurs[drag.index]!;
      const next = blurs.slice();
      next[drag.index] = {
        ...b,
        x: r4(clamp(p.x - drag.dx, 0, 1 - b.w)),
        y: r4(clamp(p.y - drag.dy, 0, 1 - b.h)),
      };
      editor.updateStep(step.id, { blurs: next });
    }
  }

  function onUp() {
    if (drag?.kind === 'draw' && drag.rect.w > 0.01 && drag.rect.h > 0.01) {
      const r = { x: r4(drag.rect.x), y: r4(drag.rect.y), w: r4(drag.rect.w), h: r4(drag.rect.h) };
      editor.updateStep(step.id, { blurs: [...blurs, r] });
      setSelection({ kind: 'blur', index: blurs.length });
      setTool('select');
    }
    setDrag(null);
  }

  if (step.kind === 'text' || !step.image_path) {
    return (
      <div className="canvas-text" onPointerDown={() => setSelection({ kind: 'step' })}>
        <h2>{step.title || t('editor.untitled')}</h2>
        <div dangerouslySetInnerHTML={{ __html: richTextToHtml(step.body) }} />
      </div>
    );
  }

  const url = editor.imageUrls[step.image_path];
  const ratio = `${step.image_width ?? 16} / ${step.image_height ?? 10}`;
  return (
    <div
      ref={frame}
      className={`canvas-frame tool-${tool}`}
      style={{ aspectRatio: ratio }}
      onPointerDown={onFrameDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <div className="canvas-missing">{t('common.loading')}</div>
      )}

      {blurs.map((b, i) => (
        <div
          key={`b${i}`}
          className={`canvas-blur ${selection.kind === 'blur' && selection.index === i ? 'selected' : ''}`}
          style={{
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            width: `${b.w * 100}%`,
            height: `${b.h * 100}%`,
          }}
          onPointerDown={(e) => {
            if (readOnly || tool !== 'select') return;
            e.stopPropagation();
            (e.target as Element).setPointerCapture(e.pointerId);
            const p = rel(e);
            setSelection({ kind: 'blur', index: i });
            setDrag({ kind: 'blur-move', index: i, dx: p.x - b.x, dy: p.y - b.y });
          }}
        />
      ))}
      {drag?.kind === 'draw' && (
        <div
          className="canvas-blur drawing"
          style={{
            left: `${drag.rect.x * 100}%`,
            top: `${drag.rect.y * 100}%`,
            width: `${drag.rect.w * 100}%`,
            height: `${drag.rect.h * 100}%`,
          }}
        />
      )}

      {zoom && (
        <div
          className="canvas-zoom"
          title={t('editor.zoomArea')}
          style={{
            left: `${clamp(zoom.x - 0.5 / zoom.scale) * 100}%`,
            top: `${clamp(zoom.y - 0.5 / zoom.scale) * 100}%`,
            width: `${(100 / zoom.scale).toFixed(2)}%`,
            height: `${(100 / zoom.scale).toFixed(2)}%`,
          }}
        />
      )}

      {hotspots.map((h, i) => {
        const selected = selection.kind === 'hotspot' && selection.id === h.id;
        return (
          <div
            key={h.id}
            className={`canvas-hotspot ${selected ? 'selected' : ''}`}
            style={{
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              width: `${h.w * 100}%`,
              height: `${h.h * 100}%`,
            }}
            role="button"
            aria-label={h.title || t('editor.hotspot', { n: i + 1 })}
            onPointerDown={(e) => {
              if (tool !== 'select') return;
              e.stopPropagation();
              setSelection({ kind: 'hotspot', id: h.id });
              if (readOnly) return;
              (e.target as Element).setPointerCapture(e.pointerId);
              const p = rel(e);
              setDrag({ kind: 'move', id: h.id, dx: p.x - h.x, dy: p.y - h.y });
            }}
          >
            <span className="canvas-hotspot-n">{i + 1}</span>
            {selected && !readOnly && (
              <span
                className="canvas-handle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.target as Element).setPointerCapture(e.pointerId);
                  setDrag({ kind: 'resize', id: h.id });
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
