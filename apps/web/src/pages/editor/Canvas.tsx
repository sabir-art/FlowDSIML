import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  type CSSProperties,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast';
import { freeSpotlightRadius, themeSchema, MASK_INTENSITY } from '@flowdsiml/manifest';
import {
  beaconCenter,
  boxStyle,
  spotlightAnchor,
  spotlightVeilPath,
  themeVars,
  tipClass,
  asCrop,
  cropImageStyle,
  croppedSize,
  stackWindowHint,
} from '@flowdsiml/player-core';
import { ChevronRight, ImagePlus, ClipboardList, ExternalLink, Info, Move, RotateCcw } from 'lucide-react';
import type { Rect } from '@flowdsiml/manifest';
import type { DemoEditor } from './useDemoEditor';
import { useVarCatalog } from '../../lib/varCatalog';
import { usePreviewMode, varPreview } from './vars/varPreview';
import { textOn } from '../../lib/publish';
import { BeforeAfterCanvas } from './BeforeAfterEditor';
import { VideoCanvas } from './video/VideoCanvas';
import { HtmlCanvas } from './html/HtmlCanvas';
import { AnimationMarks } from './capture/AnimationMarks';
import { fieldAt } from './capture/animation';
import { CanvasLayers } from './images/CanvasLayers';
import {
  asAction,
  asCta,
  asMasks,
  freeSpotlightOf,
  maskCss,
  asSettings,
  asStepOptions,
  asZoom,
  type Selection,
  type StepRow,
} from './types';

/** L25-04 : « field » = choix du champ de la saisie animée (un clic sur le canevas). */
export type Tool = 'select' | 'hotspot' | 'blur' | 'field';

interface Props {
  editor: DemoEditor;
  step: StepRow;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  readOnly: boolean;
  onEditForm?: () => void;
  /** EDT-08 : pastille masquée quand l'aperçu du formulaire est affiché. */
  hideFormChip?: boolean;
  /** L48-E (E4) : fenêtre du flou, sans points d'intérêt ni leur cadre (seulement l'écran et les zones). */
  hideHotspots?: boolean;
  /** L18-02 : variante B affichée sur le canevas (texte de la bulle testée remplacé). */
  abPreview?: { hotspotId: string; title: string; body: string; cta: unknown } | null;
  /** EXT-02 §6.3 : outil « Projecteur » ouvert et activé : halo fixe sur le premier hotspot. */
  freeSpot?: { size: number; dim: number } | null;
  /** Outil Image ouvert : les images ajoutées se choisissent et se déplacent sur le canevas. */
  layersActive?: boolean;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const r4 = (v: number) => Math.round(v * 10000) / 10000;

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'resize'; id: string }
  | { kind: 'draw'; x0: number; y0: number; rect: Rect }
  | { kind: 'blur-move'; index: number; dx: number; dy: number }
  /** EDT-07 : redimensionnement d'une zone de flou par l'un de ses 4 coins (coin opposé fixe). */
  | { kind: 'blur-resize'; index: number; ax: number; ay: number }
  /** L12-02 : déplacement du cadre de zoom (décalage du pointeur au centre) ou redimensionnement. */
  | { kind: 'zoom-move'; dx: number; dy: number }
  | { kind: 'zoom-resize'; ax: number; ay: number };

export function Canvas({
  editor,
  step,
  tool,
  setTool,
  selection,
  setSelection,
  readOnly,
  onEditForm,
  hideFormChip,
  hideHotspots = false,
  abPreview,
  freeSpot = null,
  layersActive = false,
}: Props) {
  const { t } = useTranslation();
  // L46 : variables remplacées par les exemples (ou les replis) dans le canevas, jamais de {{…}}
  const varCatalog = useVarCatalog(editor.variables);
  const vp = varPreview(varCatalog, editor.variables, usePreviewMode());
  const frame = useRef<HTMLDivElement>(null);
  // EXT-02 §6.3 : largeur affichée de la capture, pour le rayon du halo d'aperçu
  const [frameW, setFrameW] = useState(0);
  useEffect(() => {
    const el = frame.current;
    if (!freeSpot || !el) return;
    const fit = () => setFrameW(el.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [freeSpot]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const hotspots = hideHotspots ? [] : editor.hotspots.filter((h) => h.step_id === step.id);
  const blurs = asMasks(step.blurs);
  const zoom = asZoom(step.zoom);
  // Champs du zoom au-delà de x, y, scale (transition, garder) conservés à chaque modification
  const zoomRaw = (step.zoom ?? {}) as Record<string, unknown>;

  function rel(e: { clientX: number; clientY: number }) {
    const b = frame.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) };
  }

  async function onFrameDown(e: ReactPointerEvent) {
    if (readOnly || e.button !== 0) return;
    const p = rel(e);
    if (tool === 'hotspot') {
      // L38-9 : bulle posée sans titre ; « Cliquez ici » n'est qu'un exemple (placeholder du champ)
      const h = await editor.addHotspot(step.id, p.x, p.y, '');
      if (h) setSelection({ kind: 'hotspot', id: h.id });
      setTool('select');
    } else if (tool === 'field') {
      // L25-04 : champ de la saisie animée choisi sur le canevas
      const opts = (step.options ?? {}) as Record<string, unknown>;
      const anim = opts.animation as { type?: string } | undefined;
      if (anim?.type === 'typing')
        editor.updateStep(step.id, {
          options: {
            ...opts,
            animation: { ...anim, field: fieldAt(p.x, p.y), fieldLabel: '' },
          } as StepRow['options'],
        });
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
    } else if (drag.kind === 'blur-resize') {
      const next = blurs.slice();
      const x = Math.min(drag.ax, p.x);
      const y = Math.min(drag.ay, p.y);
      next[drag.index] = {
        ...next[drag.index]!,
        x: r4(x),
        y: r4(y),
        w: r4(Math.max(0.01, Math.abs(p.x - drag.ax))),
        h: r4(Math.max(0.01, Math.abs(p.y - drag.ay))),
      };
      editor.updateStep(step.id, { blurs: next });
    } else if (drag.kind === 'zoom-move' && zoom) {
      editor.updateStep(step.id, {
        zoom: { ...zoomRaw, ...zoomCenter(p.x - drag.dx, p.y - drag.dy, zoom.scale) },
      });
    } else if (drag.kind === 'zoom-resize' && zoom) {
      const size = Math.max(Math.abs(p.x - drag.ax), Math.abs(p.y - drag.ay));
      const scale = Math.round(clamp(1 / Math.max(size, 0.01), 1.2, 4) * 10) / 10;
      const half = 0.5 / scale;
      const cx = drag.ax + (p.x >= drag.ax ? half : -half);
      const cy = drag.ay + (p.y >= drag.ay ? half : -half);
      editor.updateStep(step.id, { zoom: { ...zoomRaw, scale, ...zoomCenter(cx, cy, scale) } });
    }
  }

  /** Centre du zoom borné pour que le cadre reste dans l'image. */
  function zoomCenter(x: number, y: number, scale: number) {
    const half = 0.5 / scale;
    return { x: r4(clamp(x, half, 1 - half)), y: r4(clamp(y, half, 1 - half)) };
  }

  /** L12-02 : flèches pour déplacer le cadre (1 %, Maj : 10 %). */
  function onZoomKey(e: ReactKeyboardEvent) {
    if (!zoom || readOnly) return;
    const d = e.shiftKey ? 0.1 : 0.01;
    const mv: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    };
    const m = mv[e.key];
    if (!m) return;
    e.preventDefault();
    e.stopPropagation();
    editor.updateStep(step.id, {
      zoom: { ...zoomRaw, ...zoomCenter(zoom.x + m[0], zoom.y + m[1], zoom.scale) },
    });
  }

  function onUp() {
    if (drag?.kind === 'draw' && drag.rect.w > 0.01 && drag.rect.h > 0.01) {
      // EXT-02 §6.2 : une nouvelle zone part de l'intensité par défaut (12 px)
      const r = {
        x: r4(drag.rect.x),
        y: r4(drag.rect.y),
        w: r4(drag.rect.w),
        h: r4(drag.rect.h),
        intensity: MASK_INTENSITY.initial,
      };
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
        next[index] = { ...blurs[index]!, x, y };
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
  const formChip = gateForm && !hideFormChip && (
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

  // L17-02 : étape Avant / Après (aperçu des deux captures, sans outils)
  if (step.kind === 'before_after')
    return (
      <BeforeAfterCanvas
        editor={editor}
        step={step}
        readOnly={readOnly}
        onSelect={() => setSelection({ kind: 'step' })}
      />
    );

  // F7 (L21-03) : étape vidéo (canevas et montage, sans outils de capture)
  if (step.kind === 'video') return <VideoCanvas editor={editor} step={step} readOnly={readOnly} />;

  // A8 (L20-01) : étape HTML (éditeur d'éléments, sans outils de capture)
  if (step.kind === 'html')
    return <HtmlCanvas editor={editor} step={step} readOnly={readOnly} setSelection={setSelection} />;

  // L26-04 : étape « À capturer » (modèle) : cadre pointillé, titre et « Capturer cette étape »
  if (step.kind === 'image' && !step.image_path && step.to_capture)
    return <ToCaptureCanvas editor={editor} step={step} readOnly={readOnly} />;

  if (step.kind === 'text' || !step.image_path) {
    const opts = asStepOptions(step.options);
    const here = editor.steps.findIndex((x) => x.id === step.id);
    // Écran de fin, comme le lecteur (PY-6, EDT-09) : dernière étape de texte, sans quiz ni choix,
    // en carte sur la capture précédente assombrie, avec bouton principal et « Recommencer »
    const endText =
      step.kind === 'text' &&
      here === editor.steps.length - 1 &&
      opts.display === 'screen' &&
      !editor.questions.length &&
      !opts.choices.length;
    const popup = step.kind === 'text' && (opts.display === 'popup' || endText);
    const stepCta = asCta(step.cta);
    // EXT-02 §6.1 : étape « Fenêtre », comme dans le lecteur (image à gauche, texte, pied)
    if (step.kind === 'text' && opts.display === 'window') {
      const prev = [...editor.steps.slice(0, Math.max(0, here))]
        .reverse()
        .find((x) => x.kind === 'image' && x.image_path);
      const bg = prev ? editor.imageUrls[prev.image_path!] : undefined;
      const img = step.image_path ? editor.imageUrls[step.image_path] : undefined;
      return (
        <div
          className="canvas-text canvas-text--popup canvas-text--window fd-player-scope"
          style={themeVars(themeSchema.parse(asSettings(editor.demo?.settings).theme ?? {}))}
          onPointerDown={() => setSelection({ kind: 'step' })}
        >
          {bg && <img className="canvas-popup-bg canvas-window-bg" src={bg} alt="" aria-hidden="true" />}
          {formChip}
          <div className={`canvas-window${step.image_path ? '' : ' canvas-window--text'}`}>
            {step.image_path && (
              <div className="canvas-window__img">{img && <img src={img} alt={opts.imageAlt} />}</div>
            )}
            <div className="canvas-window__body">
              <span className="canvas-window__mu">
                {t('editor.window.stepOf', { n: here + 1, total: editor.steps.length })}
              </span>
              <h2>{vp.text(step.title) || t('editor.untitled')}</h2>
              <div dangerouslySetInnerHTML={{ __html: vp.html(step.body) }} />
              <div
                className="canvas-window__foot"
                // Même règle que le lecteur : l'aide passe sous les boutons quand la ligne est trop courte
                ref={(el) => {
                  if (el) stackWindowHint(el);
                }}
              >
                <span className="canvas-window__mu">{t('editor.window.esc')}</span>
                <div className="canvas-window__btns">
                  {here > 0 && <span className="p-btn p-btn-ghost">{t('editor.window.prev')}</span>}
                  <span className="p-btn p-btn-primary">
                    {vp.text(opts.buttonLabel) || t('editor.advanced.popup.buttonPlaceholder')}
                    <ChevronRight size={16} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    const card = (
      <>
        {popup && !endText && (
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
        <h2>{vp.text(step.title) || t('editor.untitled')}</h2>
        <div dangerouslySetInnerHTML={{ __html: vp.html(step.body) }} />
        {/* A2-02 : bouton de la pop-up, comme dans le lecteur (vide = « Suivant ») */}
        {popup && !endText && opts.choices.length === 0 && (
          <div className="canvas-popup-acts">
            <span className="p-btn p-btn-primary">
              {vp.text(opts.buttonLabel) || t('editor.advanced.popup.buttonPlaceholder')}
            </span>
          </div>
        )}
        {endText && (
          <div className="canvas-end-acts">
            {stepCta && (
              <span className="p-btn p-btn-primary">
                {stepCta.label}
                <ExternalLink size={16} aria-hidden="true" />
              </span>
            )}
            <span className={`p-btn ${stepCta ? 'p-btn-ghost' : 'p-btn-secondary'}`}>
              <RotateCcw size={16} aria-hidden="true" />
              {t('editor.end.restart')}
            </span>
          </div>
        )}
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
    const prevImage = [...editor.steps.slice(0, Math.max(0, here))]
      .reverse()
      .find((x) => x.kind === 'image' && x.image_path);
    const bgUrl =
      popup && (endText || opts.background === 'blur') && prevImage
        ? editor.imageUrls[prevImage.image_path!]
        : undefined;
    return (
      // F1-1 : le canevas suit le thème de la démo (clair), pas le thème sombre de l'app
      <div
        className={`canvas-text fd-player-scope${popup ? ' canvas-text--popup' : ''}${endText ? ' canvas-text--end' : ''}`}
        style={{
          // Variables du lecteur (--p-primary…) pour les boutons de la carte, comme sur les étapes image
          ...themeVars(themeSchema.parse(asSettings(editor.demo?.settings).theme ?? {})),
          ...(popup && opts.background === 'color' && !endText ? { background: opts.bgColor } : {}),
        }}
        onPointerDown={() => setSelection({ kind: 'step' })}
      >
        {bgUrl && <img className="canvas-popup-bg" src={bgUrl} alt="" aria-hidden="true" />}
        {formChip}
        {popup ? <div className={`canvas-popup${endText ? ' canvas-end' : ''}`}>{card}</div> : card}
      </div>
    );
  }
  const spotlightMode = asSettings(editor.demo?.settings).mode === 'spotlight';
  // Projecteur libre activé : le style Spotlight des hotspots est ignoré, comme dans le lecteur
  const freeEnabled = freeSpotlightOf(asSettings(editor.demo?.settings)).enabled;
  const isSpot = (h: { style: string }) => !freeEnabled && (spotlightMode || h.style === 'spotlight');

  const url = editor.imageUrls[step.image_path];
  // Aperçu WYSIWYG (ED2) : mêmes classes et même thème que le player.
  const theme = themeSchema.parse(asSettings(editor.demo?.settings).theme ?? {});
  const sub = vp.text;
  const tipBase =
    (selection.kind === 'hotspot' ? hotspots.find((h) => h.id === selection.id) : undefined) ?? hotspots[0];
  const tipHotspot =
    tipBase && abPreview && abPreview.hotspotId === tipBase.id
      ? { ...tipBase, title: abPreview.title, body: abPreview.body, cta: abPreview.cta as typeof tipBase.cta }
      : tipBase;
  const stepIndex = editor.steps.findIndex((x) => x.id === step.id);
  // Spotlight : la bulle est ancrée au bord de la zone éclairée, comme dans le player
  const tipAnchor =
    tipHotspot && isSpot(tipHotspot)
      ? (() => {
          const a = spotlightAnchor(tipHotspot, tipHotspot.placement);
          return { ...a.box, placement: a.placement };
        })()
      : tipHotspot;
  // L25-02 : capture recadrée (l'image entière est placée dans le cadre affiché)
  const crop = asCrop(asStepOptions(step.options).crop);
  const shown = croppedSize({ width: step.image_width ?? 1600, height: step.image_height ?? 1000 }, crop);
  const ratio = `${shown.width} / ${shown.height}`;
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
        <img
          src={url}
          alt={step.title || t('editor.untitled')}
          // L32 : image de l'étape affichée en priorité haute (vignettes du rail en différé)
          fetchPriority="high"
          draggable={false}
          style={cropImageStyle(crop)}
        />
      ) : (
        <div className="canvas-missing">{t('common.loading')}</div>
      )}

      {/* L25-04/05 : repères et aperçu de l'animation de l'étape */}
      <AnimationMarks step={step} urls={editor.imageUrls} />

      {/* Images ajoutées : au-dessus de la capture, sous les flous, les hotspots, la bulle et le projecteur */}
      {step.kind === 'image' && (
        <CanvasLayers
          editor={editor}
          step={step}
          frame={frame}
          active={layersActive && tool === 'select'}
          readOnly={readOnly}
          selection={selection}
          setSelection={setSelection}
        />
      )}

      {blurs.map((b, i) => (
        <div
          key={`b${i}`}
          className={`canvas-blur${b.style === 'solid' ? ' canvas-blur--solid' : b.style === 'pixels' ? ' canvas-blur--pixels' : ''} ${selection.kind === 'blur' && selection.index === i ? 'selected' : ''}`}
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
            ...maskCss(b, (step.image_width ?? 16) / (step.image_height ?? 10)),
            ...(b.style === 'solid'
              ? { background: b.color ?? '#2A2F3A', color: textOn(b.color ?? '#2A2F3A') }
              : {}),
          }}
          onPointerDown={(e) => {
            if (readOnly || tool !== 'select') return;
            e.stopPropagation();
            (e.target as Element).setPointerCapture(e.pointerId);
            const p = rel(e);
            setSelection({ kind: 'blur', index: i });
            setDrag({ kind: 'blur-move', index: i, dx: p.x - b.x, dy: p.y - b.y });
          }}
        >
          {b.style === 'solid' && b.text ? <span className="canvas-mask-text">{b.text}</span> : null}
          {selection.kind === 'blur' && selection.index === i && (
            <>
              <span className="canvas-blur-tag">
                {b.style === 'solid' ? t('editor.maskTag') : t('editor.blurTag')}
              </span>
              {!readOnly &&
                (
                  [
                    [0, 0],
                    [1, 0],
                    [0, 1],
                    [1, 1],
                  ] as const
                ).map(([cx, cy]) => (
                  <span
                    key={`${cx}${cy}`}
                    className={`canvas-blur-handle h${cx}${cy}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture(e.pointerId);
                      // Coin opposé fixe
                      setDrag({
                        kind: 'blur-resize',
                        index: i,
                        ax: cx ? b.x : b.x + b.w,
                        ay: cy ? b.y : b.y + b.h,
                      });
                    }}
                  />
                ))}
            </>
          )}
        </div>
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
          className={`canvas-zoom${tool === 'select' && !readOnly ? ' is-live' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label={t('editor.zoomArea')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(zoom.x * 100)}
          aria-valuetext={t('editor.zoomPos', {
            pct: Math.round(zoom.scale * 100),
            x: Math.round(zoom.x * 100),
            y: Math.round(zoom.y * 100),
          })}
          onKeyDown={onZoomKey}
          style={{
            left: `${clamp(zoom.x - 0.5 / zoom.scale) * 100}%`,
            top: `${clamp(zoom.y - 0.5 / zoom.scale) * 100}%`,
            width: `${(100 / zoom.scale).toFixed(2)}%`,
            height: `${(100 / zoom.scale).toFixed(2)}%`,
          }}
          onPointerDown={(e) => {
            if (readOnly || tool !== 'select' || e.button !== 0) return;
            e.stopPropagation();
            (e.target as Element).setPointerCapture(e.pointerId);
            const p = rel(e);
            setDrag({ kind: 'zoom-move', dx: p.x - zoom.x, dy: p.y - zoom.y });
          }}
        >
          <span className="canvas-zoom-tag">
            {t('editor.zoomTag', { pct: Math.round(zoom.scale * 100) })}
          </span>
          {tool === 'select' && !readOnly && (
            <>
              <span className="canvas-zoom-move" aria-hidden="true">
                <Move size={16} />
              </span>
              {(
                [
                  [0, 0],
                  [1, 0],
                  [0, 1],
                  [1, 1],
                ] as const
              ).map(([cx, cy]) => (
                <span
                  key={`${cx}${cy}`}
                  className={`canvas-blur-handle h${cx}${cy}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.target as Element).setPointerCapture(e.pointerId);
                    const half = 0.5 / zoom.scale;
                    // Coin opposé fixe
                    setDrag({
                      kind: 'zoom-resize',
                      ax: cx ? zoom.x - half : zoom.x + half,
                      ay: cy ? zoom.y - half : zoom.y + half,
                    });
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      {freeSpot && hotspots[0] && (
        <span
          className="p-freespot is-fixed canvas-freespot"
          style={
            {
              '--fx': `${(hotspots[0].x + hotspots[0].w / 2) * 100}%`,
              '--fy': `${(hotspots[0].y + hotspots[0].h / 2) * 100}%`,
              '--fr': `${Math.round(freeSpotlightRadius(freeSpot.size, frameW || 1280))}px`,
              '--fd': String(freeSpot.dim / 100),
            } as CSSProperties
          }
          aria-hidden="true"
        />
      )}
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
                dangerouslySetInnerHTML={{ __html: vp.plainHtml(tipHotspot.title) }}
              />
            )}
            {tipHotspot.body && (
              <div className="p-rich" dangerouslySetInnerHTML={{ __html: vp.html(tipHotspot.body) }} />
            )}
            <div className="p-actions">
              <span />
              {/* L12-05 : libellés saisis montrés tout de suite dans la bulle */}
              {asStepOptions(step.options).showPrev && stepIndex > 0 && (
                <span className="p-btn p-btn-ghost p-btn-sm">
                  {asStepOptions(step.options).prevLabel || t('editor.hs.prev')}
                </span>
              )}
              {asCta(tipHotspot.cta) ? (
                <span className="p-btn p-btn-primary p-btn-sm">{sub(asCta(tipHotspot.cta)!.label)}</span>
              ) : (
                asAction(tipHotspot.action).type !== 'none' && (
                  <span className="p-btn p-btn-primary p-btn-sm">
                    {vp.text(asStepOptions(step.options).buttonLabel) ||
                      (stepIndex === editor.steps.length - 1
                        ? t('editor.hs.finish')
                        : t('editor.previewNext'))}
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

/** L26-04 : étape « À capturer ». La capture vient de l'extension (capture guidée) ou d'une image. */
function ToCaptureCanvas({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: DemoEditor['steps'][number];
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const todo = editor.steps.filter((s) => s.to_capture && !s.image_path);
  const n = todo.findIndex((s) => s.id === step.id) + 1;
  return (
    <div className="canvas-tocapture">
      <div className="canvas-tocapture-frame">
        <span className="fd-badge canvas-tocapture-badge">{t('editor.toCapture.badge')}</span>
        <h2>{step.title || t('editor.untitled')}</h2>
        <p className="fd-muted">{t('editor.toCapture.order', { n, total: todo.length })}</p>
        {!readOnly && (
          <>
            <button
              type="button"
              className="fd-btn fd-btn--primary"
              aria-controls="canvas-file"
              onClick={() => file.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              {t('editor.toCapture.button')}
            </button>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son bouton */
              id="canvas-file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                // REV-07 : avertissement à l'import (aucune détection automatique)
                if (f)
                  void editor
                    .captureStep(step.id, f)
                    .then((r) => r && toast(t('editor.importWarn'), undefined, { tone: 'warning' }));
              }}
            />
            <p className="canvas-tocapture-help">
              {t('editor.toCapture.help', { title: editor.demo?.title ?? '' })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
