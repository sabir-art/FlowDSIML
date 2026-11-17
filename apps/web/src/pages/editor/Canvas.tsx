import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { applyVariables, escapeHtml, richTextToHtml } from '@flowdsiml/core';
import { themeSchema } from '@flowdsiml/manifest';
import {
  beaconCenter,
  boxStyle,
  spotlightAnchor,
  spotlightVeilPath,
  themeVars,
  tipClass,
} from '@flowdsiml/player-core';
import { ChevronRight, ClipboardList, Info } from 'lucide-react';
import type { Rect } from '@flowdsiml/manifest';
import type { DemoEditor } from './useDemoEditor';
import { withVariablePills } from './RichTextField';
import {
  asAction,
  asCta,
  asRects,
  asSettings,
  asStepOptions,
  asZoom,
  type Selection,
  type StepRow,
} from './types';

export type Tool = 'select' | 'hotspot' | 'blur';

interface Props {
  editor: DemoEditor;
  step: StepRow;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  readOnly: boolean;
  onEditForm?: () => void;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const r4 = (v: number) => Math.round(v * 10000) / 10000;

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'resize'; id: string }
  | { kind: 'draw'; x0: number; y0: number; rect: Rect }
  | { kind: 'blur-move'; index: number; dx: number; dy: number };

export function Canvas({
  editor,
  step,
  tool,
  setTool,
  selection,
  setSelection,
  readOnly,
  onEditForm,
}: Props) {
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

  const [announce, setAnnounce] = useState('');
  const pct = (v: number) => Math.round(v * 100);

  /** Clavier (ED1) : Entrée sélectionne, flèches déplacent de 1 % (Maj : 5 %), Suppr supprime. */
  function onItemKey(e: ReactKeyboardEvent, kind: 'hotspot' | 'blur', id: string, index: number) {
    const isHot = kind === 'hotspot';
    const rect = isHot ? hotspots.find((h) => h.id === id)! : blurs[index]!;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelection(isHot ? { kind: 'hotspot', id } : { kind: 'blur', index });
      setAnnounce(t('editor.a11ySelected', { x: pct(rect.x), y: pct(rect.y) }));
      return;
    }
    if (readOnly) return;
    const delta = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      e.stopPropagation();
      const x = r4(clamp(rect.x + mv[0], 0, 1 - rect.w));
      const y = r4(clamp(rect.y + mv[1], 0, 1 - rect.h));
      if (isHot) editor.updateHotspot(id, { x, y });
      else {
        const next = blurs.slice();
        next[index] = { ...rect, x, y };
        editor.updateStep(step.id, { blurs: next });
      }
      setAnnounce(t('editor.a11yMoved', { x: pct(x), y: pct(y) }));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      if (isHot) void editor.deleteHotspot(id);
      else editor.updateStep(step.id, { blurs: blurs.filter((_, i) => i !== index) });
      setSelection({ kind: 'step' });
      setAnnounce(t('editor.a11yDeleted'));
    }
  }

  // ED8 : formulaire de lead visible sur le canevas
  const gateForm = step.gate_form_id ? editor.forms.find((f) => f.id === step.gate_form_id) : undefined;
  const formChip = gateForm && (
    <div className="canvas-form-chip">
      <ClipboardList size={16} aria-hidden="true" />
      <span>{t('editor.formOnStep', { title: gateForm.title })}</span>
      {onEditForm && (
        <button type="button" className="fd-btn fd-btn--sm fd-btn--ghost" onClick={onEditForm}>
          {t('editor.editForm')}
        </button>
      )}
    </div>
  );

  if (step.kind === 'text' || !step.image_path) {
    const opts = asStepOptions(step.options);
    const popup = step.kind === 'text' && opts.display === 'popup';
    const card = (
      <>
        {popup && (
          <span className={`canvas-variant canvas-variant--${opts.variant}`}>
            {opts.showIcon &&
              (opts.variant === 'instruction' ? (
                <ClipboardList size={14} aria-hidden="true" />
              ) : (
                <Info size={14} aria-hidden="true" />
              ))}
            {t(
              opts.variant === 'instruction'
                ? 'editor.advanced.popup.variantInstruction'
                : 'editor.advanced.popup.variantInfo',
            )}
          </span>
        )}
        <h2>{step.title || t('editor.untitled')}</h2>
        <div dangerouslySetInnerHTML={{ __html: richTextToHtml(step.body) }} />
        {opts.choices.length > 0 && (
          <ul className="canvas-choices" aria-label={t('editor.advanced.choice.title')}>
            {opts.choices.map((c, i) => (
              <li key={i}>
                <span>{c.label || t('editor.advanced.choice.option', { n: i + 1 })}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </>
    );
    // F1-2 : fond « Capture floutée » = dernière étape image précédente, floutée comme dans le player
    const here = editor.steps.findIndex((x) => x.id === step.id);
    const prevImage = [...editor.steps.slice(0, Math.max(0, here))]
      .reverse()
      .find((x) => x.kind === 'image' && x.image_path);
    const bgUrl =
      popup && opts.background === 'blur' && prevImage ? editor.imageUrls[prevImage.image_path!] : undefined;
    return (
      // F1-1 : le canevas suit le thème de la démo (clair), pas le thème sombre de l'app
      <div
        className={`canvas-text fd-player-scope${popup ? ' canvas-text--popup' : ''}`}
        style={popup && opts.background === 'color' ? { background: opts.bgColor } : undefined}
        onPointerDown={() => setSelection({ kind: 'step' })}
      >
        {bgUrl && <img className="canvas-popup-bg" src={bgUrl} alt="" aria-hidden="true" />}
        {formChip}
        {popup ? <div className="canvas-popup">{card}</div> : card}
      </div>
    );
  }
  const spotlightMode = asSettings(editor.demo?.settings).mode === 'spotlight';
  const isSpot = (h: { style: string }) => spotlightMode || h.style === 'spotlight';

  const url = editor.imageUrls[step.image_path];
  // Aperçu WYSIWYG (ED2) : mêmes classes et même thème que le player.
  const theme = themeSchema.parse(asSettings(editor.demo?.settings).theme ?? {});
  const defaults = Object.fromEntries(editor.variables.map((v) => [v.key, v.default_value]));
  const sub = (txt: string) => applyVariables(txt, {}, defaults);
  const tipHotspot =
    (selection.kind === 'hotspot' ? hotspots.find((h) => h.id === selection.id) : undefined) ?? hotspots[0];
  const stepIndex = editor.steps.findIndex((x) => x.id === step.id);
  // Spotlight : la bulle est ancrée au bord de la zone éclairée, comme dans le player
  const tipAnchor =
    tipHotspot && isSpot(tipHotspot)
      ? (() => {
          const a = spotlightAnchor(tipHotspot, tipHotspot.placement);
          return { ...a.box, placement: a.placement };
        })()
      : tipHotspot;
  const ratio = `${step.image_width ?? 16} / ${step.image_height ?? 10}`;
  return (
    <div
      ref={frame}
      className={`canvas-frame fd-player-scope tool-${tool}`}
      style={{ aspectRatio: ratio, ...themeVars(theme) }}
      onPointerDown={onFrameDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {formChip}
      {url ? (
        <img src={url} alt={step.title || t('editor.untitled')} draggable={false} />
      ) : (
        <div className="canvas-missing">{t('common.loading')}</div>
      )}

      {blurs.map((b, i) => (
        <div
          key={`b${i}`}
          className={`canvas-blur ${selection.kind === 'blur' && selection.index === i ? 'selected' : ''}`}
          role="button"
          tabIndex={0}
          data-canvas-item=""
          aria-label={t('editor.blurN', { n: i + 1 })}
          aria-pressed={selection.kind === 'blur' && selection.index === i}
          onKeyDown={(e) => onItemKey(e, 'blur', '', i)}
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

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      {hotspots.some(isSpot) && (
        <svg className="p-veil" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path fillRule="evenodd" d={spotlightVeilPath(hotspots.filter(isSpot))} />
        </svg>
      )}
      {hotspots.filter(isSpot).map((h) => (
        <span
          key={`s-${h.id}`}
          className="p-spotlight canvas-spotlight"
          style={boxStyle(h)}
          aria-hidden="true"
        />
      ))}
      {hotspots
        .filter((h) => !isSpot(h))
        .map((h) => (
          <span
            key={`b-${h.id}`}
            className={`p-beacon canvas-beacon ${h.pulse ? 'p-pulse' : ''}`}
            style={beaconCenter(h)}
            aria-hidden="true"
          >
            <span className="p-beacon-dot" />
          </span>
        ))}
      {tipHotspot &&
        tool === 'select' &&
        !drag &&
        (tipHotspot.title || tipHotspot.body || asCta(tipHotspot.cta)) && (
          <div
            className={`${tipClass(tipAnchor!, tipAnchor!.placement)} canvas-tip`}
            style={beaconCenter(tipAnchor!)}
            aria-hidden="true"
          >
            {/* Maquette EDT-01 : compteur en haut, variables en pastilles (valeurs dans l'Aperçu) */}
            <span className="p-tip-count canvas-tip-count">
              {stepIndex + 1} / {editor.steps.length}
            </span>
            {tipHotspot.title && (
              <div
                className="p-tip-title"
                dangerouslySetInnerHTML={{ __html: withVariablePills(escapeHtml(tipHotspot.title)) }}
              />
            )}
            {tipHotspot.body && (
              <div
                className="p-rich"
                dangerouslySetInnerHTML={{ __html: withVariablePills(richTextToHtml(tipHotspot.body)) }}
              />
            )}
            <div className="p-actions">
              <span />
              {asCta(tipHotspot.cta) ? (
                <span className="p-btn p-btn-primary p-btn-sm">{sub(asCta(tipHotspot.cta)!.label)}</span>
              ) : (
                asAction(tipHotspot.action).type !== 'none' && (
                  <span className="p-btn p-btn-primary p-btn-sm">
                    {t('editor.previewNext')}
                    <ChevronRight size={14} aria-hidden="true" />
                  </span>
                )
              )}
            </div>
          </div>
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
            tabIndex={0}
            data-canvas-item=""
            aria-pressed={selected}
            aria-label={`${t('editor.hotspot', { n: i + 1 })}${h.title ? ` : ${h.title}` : ''}`}
            onKeyDown={(e) => onItemKey(e, 'hotspot', h.id, i)}
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
