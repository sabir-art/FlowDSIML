import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Hotspot, LeadForm as LeadFormT, Manifest, Step } from '@flowdsiml/manifest';
import { applyVariables, richTextToHtml, type VariableValues } from '@flowdsiml/core';
import { nextIndex, resolvePlacement } from './logic';
import { strings } from './i18n';
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

export function Player({ manifest: m, values, tracker, preview, onLead }: Props) {
  const t = strings(m.locale);
  const [index, setIndex] = useState(0);
  const [gateDone, setGateDone] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(GATE_KEY(m.demoId)) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const [menu, setMenu] = useState(false);
  const completed = useRef(false);
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

  useEffect(() => {
    tracker.track('demo_view');
  }, [tracker]);

  useEffect(() => {
    tracker.track('step_view', { stepId: step.id, stepIndex: index });
    if (index === m.steps.length - 1 && !completed.current) {
      completed.current = true;
      tracker.track('demo_complete', { stepIndex: index });
    }
    if (gateForm) tracker.track('form_view', { stepId: step.id, stepIndex: index });
    // Préchargement de l'image suivante
    const next = m.steps[index + 1]?.image?.url;
    if (next) new Image().src = next;
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest?.('form')) return;
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    }
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const style = {
    '--p-primary': theme.primary,
    '--p-bg': theme.background,
    '--p-surface': theme.surface,
    '--p-text': theme.text,
    '--p-radius': `${theme.radius}px`,
    fontFamily: theme.fontFamily,
  } as Record<string, string>;

  const chapterOf = (s: Step) => m.chapters.find((c) => c.id === s.chapterId);
  const progress = ((index + 1) / m.steps.length) * 100;

  return (
    <div class="p-root" style={style}>
      {preview && <div class="p-preview">{t.preview}</div>}
      <div class="p-top">
        {theme.logoUrl ? (
          <img class="p-logo" src={theme.logoUrl} alt="" />
        ) : (
          <span class="p-title">{sub(m.title)}</span>
        )}
        <span class="p-count" aria-live="polite">
          {index + 1} {t.of} {m.steps.length}
        </span>
        {m.chapters.length > 0 && (
          <button class="p-btn p-btn-ghost" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            ☰ {t.chapters}
          </button>
        )}
      </div>
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

      <div class="p-stage-wrap">
        {step.kind === 'image' && step.image ? (
          <ImageStep
            key={step.id}
            step={step}
            html={html}
            sub={sub}
            onHotspot={onHotspot}
            onCta={onCta}
            index={index}
            total={m.steps.length}
            onPrev={() => go(index - 1)}
            t={t}
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
                </button>
              )}
              {index < m.steps.length - 1 ? (
                <button
                  class={`p-btn ${step.cta ? 'p-btn-ghost' : 'p-btn-primary'}`}
                  onClick={() => go(index + 1)}
                  autoFocus
                >
                  {index === 0 ? t.start : t.next}
                </button>
              ) : (
                <button class="p-btn p-btn-ghost" onClick={() => go(0)}>
                  {t.restart}
                </button>
              )}
            </div>
          </div>
        )}
        {gateForm && (
          <LeadForm
            form={gateForm}
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

      <div
        class="p-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={m.steps.length}
        aria-valuenow={index + 1}
      >
        <div style={{ width: `${progress}%` }} />
      </div>
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

function ImageStep({
  step,
  html,
  sub,
  onHotspot,
  onCta,
  index,
  total,
  onPrev,
  t,
}: {
  step: Step;
  html: (s: string) => string;
  sub: (s: string) => string;
  onHotspot: (h: Hotspot) => void;
  onCta: (url: string, label: string) => void;
  index: number;
  total: number;
  onPrev: () => void;
  t: ReturnType<typeof strings>;
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
  const primary = step.hotspots[0];

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
          <button
            key={h.id}
            class={`p-hotspot ${h.pulse ? 'p-pulse' : ''}`}
            style={{
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              width: `${h.w * 100}%`,
              height: `${h.h * 100}%`,
            }}
            aria-label={sub(h.title) || t.next}
            onClick={() => onHotspot(h)}
          />
        ))}
        {primary && (primary.title || primary.body || primary.cta) && (
          <Tooltip
            h={primary}
            html={html}
            sub={sub}
            onCta={onCta}
            index={index}
            total={total}
            onPrev={onPrev}
            onNext={() => onHotspot(primary)}
            t={t}
          />
        )}
      </div>
      {!primary && step.cta && (
        <button
          class="p-btn p-btn-primary p-floating-cta"
          onClick={() => onCta(step.cta!.url, step.cta!.label)}
        >
          {sub(step.cta.label)}
        </button>
      )}
    </div>
  );
}

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
}: {
  h: Hotspot;
  html: (s: string) => string;
  sub: (s: string) => string;
  onCta: (url: string, label: string) => void;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  t: ReturnType<typeof strings>;
}) {
  const place = resolvePlacement(h.placement, h);
  const cx = (h.x + h.w / 2) * 100;
  const pos: Record<string, string> =
    place === 'bottom'
      ? { top: `${(h.y + h.h) * 100}%`, left: `${cx}%` }
      : place === 'top'
        ? { bottom: `${(1 - h.y) * 100}%`, left: `${cx}%` }
        : place === 'right'
          ? { left: `${(h.x + h.w) * 100}%`, top: `${(h.y + h.h / 2) * 100}%` }
          : { right: `${(1 - h.x) * 100}%`, top: `${(h.y + h.h / 2) * 100}%` };
  // Évite que la bulle sorte du cadre horizontalement.
  const shift =
    place === 'top' || place === 'bottom' ? (cx < 20 ? 'p-tip-shift-r' : cx > 80 ? 'p-tip-shift-l' : '') : '';
  return (
    <div class={`p-tip p-tip-${place} ${shift}`} style={pos} role="dialog" aria-label={sub(h.title)}>
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
          </button>
        )}
        {h.action.type !== 'none' && !h.cta && (
          <button class="p-btn p-btn-primary p-btn-sm" onClick={onNext}>
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
