import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Hotspot, LeadForm as LeadFormT, Manifest, Step } from '@flowdsiml/manifest';
import { applyVariables, richTextToHtml, type VariableValues } from '@flowdsiml/core';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  List,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-preact';
import { nextIndex } from './logic';
import { beaconCenter, themeVars, tipClass } from '@flowdsiml/player-core';
import { strings, type Dict } from './i18n';
import type { Tracker } from './api';
import { LeadForm } from './LeadForm';

interface Props {
  manifest: Manifest;
  values: VariableValues;
  tracker: Tracker;
  preview?: boolean;
  onLead: (
    form: LeadFormT,
    data: { email: string; fields: Record<string, string>; consent: boolean },
  ) => Promise<void>;
}

const GATE_KEY = (demoId: string) => `fd.gate.${demoId}`;
const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

/** Vrai sous 640 px : la bulle devient une feuille ancrée en bas (P3). */
function useCompact() {
  const q = '(max-width: 639px)';
  const [compact, setCompact] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

export function Player({ manifest: m, values, tracker, preview, onLead }: Props) {
  const t = strings(m.locale);
  const compact = useCompact();
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [gateDone, setGateDone] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(GATE_KEY(m.demoId)) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const [menu, setMenu] = useState(false);
  const completed = useRef(false);
  const touchX = useRef<number | null>(null);
  const step = m.steps[index]!;
  const defaults = useMemo(
    () => Object.fromEntries(m.variables.map((v) => [v.key, v.default])),
    [m.variables],
  );
  const sub = (s: string) => applyVariables(s, values, defaults);
  const html = (s: string) => richTextToHtml(sub(s));
  const theme = m.theme;
  const gateForm =
    step.gateFormId && !gateDone.has(step.gateFormId)
      ? m.forms.find((f) => f.id === step.gateFormId)
      : undefined;
  const primary = step.kind === 'image' ? step.hotspots[0] : undefined;
  const last = index === m.steps.length - 1;

  useEffect(() => {
    tracker.track('demo_view');
  }, [tracker]);

  useEffect(() => {
    tracker.track('step_view', { stepId: step.id, stepIndex: index });
    if (last && !completed.current) {
      completed.current = true;
      tracker.track('demo_complete', { stepIndex: index });
    }
    if (gateForm) tracker.track('form_view', { stepId: step.id, stepIndex: index });
    const next = m.steps[index + 1]?.image?.url;
    if (next) new Image().src = next;
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  function go(i: number | null) {
    if (i === null || i < 0 || i >= m.steps.length) return;
    setIndex(i);
    setMenu(false);
  }

  function onHotspot(h: Hotspot) {
    tracker.track('hotspot_click', { stepId: step.id, hotspotId: h.id, stepIndex: index });
    if (h.action.type === 'url') {
      window.open(h.action.url, h.action.newTab ? '_blank' : '_top', 'noopener');
      return;
    }
    go(nextIndex(m, index, h.action));
  }

  function onCta(url: string, label: string) {
    tracker.track('cta_click', { stepId: step.id, stepIndex: index, props: { label: label.slice(0, 80) } });
    window.open(url, '_blank', 'noopener');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest?.('form')) return;
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    }
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const style = themeVars(theme);

  const chapterOf = (s: Step) => m.chapters.find((c) => c.id === s.chapterId);
  const progress = ((index + 1) / m.steps.length) * 100;
  const tipProps = primary && {
    h: primary,
    html,
    sub,
    onCta,
    index,
    total: m.steps.length,
    onPrev: () => go(index - 1),
    onNext: () => onHotspot(primary),
    t,
  };

  return (
    <div class={`p-root ${compact ? 'is-compact' : ''}`} style={style} ref={rootRef}>
      {preview && <div class="p-preview">{t.preview}</div>}
      <header class="p-top">
        {theme.logoUrl ? <img class="p-logo" src={theme.logoUrl} alt="" /> : null}
        <span class="p-title">{sub(m.title)}</span>
        {m.cta && (
          <button
            class="p-btn p-btn-primary p-btn-sm p-top-cta"
            onClick={() => onCta(m.cta!.url, m.cta!.label)}
          >
            {sub(m.cta.label)}
            <ExternalLink {...ICON} size={14} />
          </button>
        )}
        {m.chapters.length > 0 && (
          <button
            class="p-icon-btn"
            aria-expanded={menu}
            aria-label={t.chapters}
            onClick={() => setMenu(!menu)}
          >
            <List {...ICON} />
          </button>
        )}
      </header>
      {menu && (
        <nav class="p-menu" aria-label={t.chapters}>
          {m.chapters.map((c) => {
            const i = m.steps.findIndex((s) => s.chapterId === c.id);
            return (
              <button
                key={c.id}
                class="p-menu-item"
                disabled={i < 0}
                aria-current={chapterOf(step)?.id === c.id}
                onClick={() => go(i)}
              >
                {sub(c.title)}
              </button>
            );
          })}
        </nav>
      )}

      <div
        class="p-stage-wrap"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const x0 = touchX.current;
          const x1 = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (x0 === null || x1 === undefined || Math.abs(x1 - x0) < 50 || gateForm) return;
          go(x1 < x0 ? index + 1 : index - 1);
        }}
      >
        {step.kind === 'image' && step.image ? (
          <ImageStep
            key={step.id}
            step={step}
            sub={sub}
            onHotspot={onHotspot}
            onCta={onCta}
            tip={!compact ? tipProps : undefined}
          />
        ) : (
          <div class="p-text-step">
            <h1>{sub(step.title)}</h1>
            {step.body && <div class="p-rich" dangerouslySetInnerHTML={{ __html: html(step.body) }} />}
            <div class="p-actions">
              {index > 0 && (
                <button class="p-btn p-btn-ghost" onClick={() => go(index - 1)}>
                  {t.prev}
                </button>
              )}
              {step.cta && (
                <button class="p-btn p-btn-primary" onClick={() => onCta(step.cta!.url, step.cta!.label)}>
                  {sub(step.cta.label)}
                  <ExternalLink {...ICON} size={16} />
                </button>
              )}
              {!last ? (
                <button
                  class={`p-btn ${step.cta ? 'p-btn-ghost' : 'p-btn-primary'}`}
                  onClick={() => go(index + 1)}
                  autoFocus
                >
                  {index === 0 ? t.start : t.next}
                  <ChevronRight {...ICON} size={16} />
                </button>
              ) : (
                <button class="p-btn p-btn-ghost" onClick={() => go(0)}>
                  <RotateCcw {...ICON} size={16} />
                  {t.restart}
                </button>
              )}
            </div>
          </div>
        )}
        {gateForm && (
          <LeadForm
            form={gateForm}
            privacyUrl={m.privacyUrl}
            t={t}
            sub={sub}
            onSkip={() => markGate(gateForm.id)}
            onSubmit={async (data) => {
              await onLead(gateForm, data);
              tracker.track('form_submit', { stepId: step.id, stepIndex: index });
              markGate(gateForm.id);
            }}
          />
        )}
      </div>

      {compact && tipProps && <Tooltip {...tipProps} sheet />}

      <footer class="p-controls">
        <button class="p-icon-btn" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t.prev}>
          <ChevronLeft {...ICON} />
        </button>
        <div
          class="p-progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={m.steps.length}
          aria-valuenow={index + 1}
          aria-label={`${index + 1} ${t.of} ${m.steps.length}`}
        >
          <div style={{ width: `${progress}%` }} />
        </div>
        <span class="p-count" aria-hidden="true">
          {index + 1}/{m.steps.length}
        </span>
        <button class="p-icon-btn" onClick={() => go(index + 1)} disabled={last} aria-label={t.next}>
          <ChevronRight {...ICON} />
        </button>
        {document.fullscreenEnabled && (
          <button
            class="p-icon-btn"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
          >
            {fullscreen ? <Minimize2 {...ICON} /> : <Maximize2 {...ICON} />}
          </button>
        )}
      </footer>
      {theme.showBranding && (
        <a
          class="p-branding"
          href="https://github.com/sabir-art/FlowDSIML"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.madeWith}
        </a>
      )}
    </div>
  );

  function markGate(id: string) {
    const next = new Set(gateDone).add(id);
    setGateDone(next);
    try {
      sessionStorage.setItem(GATE_KEY(m.demoId), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }
}

type TipProps = {
  h: Hotspot;
  html: (s: string) => string;
  sub: (s: string) => string;
  onCta: (url: string, label: string) => void;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  t: Dict;
};

function ImageStep({
  step,
  sub,
  onHotspot,
  onCta,
  tip,
}: {
  step: Step;
  sub: (s: string) => string;
  onHotspot: (h: Hotspot) => void;
  onCta: (url: string, label: string) => void;
  tip?: TipProps;
}) {
  const img = step.image!;
  const zoom = step.zoom;
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    const id = requestAnimationFrame(() => setZoomed(true));
    return () => cancelAnimationFrame(id);
  }, [zoom]);
  const transform = zoom && zoomed ? `scale(${zoom.scale})` : 'none';
  const origin = zoom ? `${zoom.x * 100}% ${zoom.y * 100}%` : '50% 50%';

  return (
    <div class="p-stage" style={{ '--ratio': String(img.width / img.height) }}>
      <div class="p-zoom" style={{ transform, transformOrigin: origin }}>
        <img class="p-img" src={img.url} alt={sub(step.title)} draggable={false} />
        {step.blurs.map((b, i) => (
          <div
            key={i}
            class="p-blur"
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
            }}
          />
        ))}
        {step.hotspots.map((h) => (
          <Beacon key={h.id} h={h} label={sub(h.title)} onClick={() => onHotspot(h)} />
        ))}
        {tip && (tip.h.title || tip.h.body || tip.h.cta) && <Tooltip {...tip} />}
      </div>
      {!step.hotspots.length && step.cta && (
        <button
          class="p-btn p-btn-primary p-floating-cta"
          onClick={() => onCta(step.cta!.url, step.cta!.label)}
        >
          {sub(step.cta.label)}
          <ExternalLink {...ICON} size={16} />
        </button>
      )}
    </div>
  );
}

/** Pastille pulsée de 20 px au centre de la zone ; cible cliquable de 44 px minimum (P2). */
function Beacon({ h, label, onClick }: { h: Hotspot; label: string; onClick: () => void }) {
  return (
    <button
      class={`p-beacon ${h.pulse ? 'p-pulse' : ''}`}
      style={beaconCenter(h)}
      aria-label={label}
      onClick={onClick}
    >
      <span class="p-beacon-dot" />
    </button>
  );
}

/** Bulle avec flèche pointant la pastille ; en mode compact, feuille ancrée en bas (hors image). */
function Tooltip({
  h,
  html,
  sub,
  onCta,
  index,
  total,
  onPrev,
  onNext,
  t,
  sheet,
}: TipProps & { sheet?: boolean }) {
  const pos: Record<string, string> = sheet ? {} : beaconCenter(h);
  return (
    <div
      class={sheet ? 'p-sheet' : tipClass(h, h.placement)}
      style={pos}
      role="dialog"
      aria-label={sub(h.title)}
    >
      {h.title && <div class="p-tip-title">{sub(h.title)}</div>}
      {h.body && <div class="p-rich" dangerouslySetInnerHTML={{ __html: html(h.body) }} />}
      <div class="p-actions">
        <span class="p-tip-count">
          {index + 1}/{total}
        </span>
        {index > 0 && (
          <button class="p-btn p-btn-ghost p-btn-sm" onClick={onPrev}>
            {t.prev}
          </button>
        )}
        {h.cta && (
          <button class="p-btn p-btn-primary p-btn-sm" onClick={() => onCta(h.cta!.url, h.cta!.label)}>
            {sub(h.cta.label)}
            <ExternalLink {...ICON} size={14} />
          </button>
        )}
        {h.action.type !== 'none' && !h.cta && (
          <button class="p-btn p-btn-primary p-btn-sm" onClick={onNext}>
            {t.next}
            <ChevronRight {...ICON} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
