import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  themeSchema,
  type Hotspot,
  type LeadForm as LeadFormT,
  type Manifest,
  type Step,
} from '@flowdsiml/manifest';
import { applyVariables, richTextToHtml, type VariableValues } from '@flowdsiml/core';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Globe,
  Info,
  ListChecks,
  Pause,
  Play,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-preact';
import { backdropIndex, canAutoAdvance, checklistItems, choiceTarget, nextIndex } from './logic';
import { Checklist } from './Checklist';
import { Quiz } from './Quiz';
import { submitQuizAttempt } from './api';
import {
  beaconCenter,
  boxStyle,
  spotlightAnchor,
  spotlightVeilPath,
  themeVars,
  tipClass,
  zoomBox,
  zoomOrigin,
} from '@flowdsiml/player-core';
import { fmt, strings, type Dict } from './i18n';
import type { Tracker } from './api';
import { LeadForm } from './LeadForm';

interface Props {
  manifest: Manifest;
  values: VariableValues;
  tracker: Tracker;
  preview?: boolean;
  /** F2 : aperçu « Tester le quiz » ouvert directement sur le quiz. */
  startQuiz?: boolean;
  onLead: (
    form: LeadFormT,
    data: { email: string; fields: Record<string, string>; consent: boolean },
  ) => Promise<void>;
}

const GATE_KEY = (demoId: string) => `fd.gate.${demoId}`;
const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

/** Vrai sous 640 px : la bulle devient une feuille ancrée en bas (P3). */
function useMedia(q: string) {
  const [match, setMatch] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return match;
}
const useCompact = () => useMedia('(max-width: 639px)');

/** Couleurs du thème par défaut : seules celles-ci passent en sombre (une démo à la charte du client garde ses couleurs). */
const DEFAULT_THEME = themeSchema.parse({});
// Seul le cadre passe en sombre ; bulle, formulaire et cartes gardent la surface claire du thème (maquette)
const DARK = { '--p-bg': '#0B0D10', '--p-chrome': '#15191F', '--p-chrome-text': '#F3F5F8' };

export function Player({ manifest: m, values, tracker, preview, startQuiz, onLead }: Props) {
  // PY-3 : langue de l'interface du lecteur (le contenu de la démo reste dans sa langue)
  const [locale, setLocale] = useState<'fr' | 'en'>(m.locale === 'en' ? 'en' : 'fr');
  const t = strings(locale);
  const compact = useCompact();
  const prefersDark = useMedia('(prefers-color-scheme: dark)');
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
  /** Choix dont l'étape cible existe encore (un choix orphelin est ignoré). */
  const choices = step.options.choices.filter((c) => choiceTarget(m, c.action));
  /** Écran de fin (dernière étape de texte, sans quiz) : carte sur la capture précédente (PY-6, EDT-09). */
  const endText =
    step.kind !== 'image' && last && step.options.display !== 'popup' && !m.quiz && !choices.length;
  const popup = step.kind !== 'image' && (step.options.display === 'popup' || endText);
  const bgBlur = popup && (endText || step.options.background === 'blur');
  const backdrop = bgBlur ? backdropIndex(m, index) : null;
  const [visited, setVisited] = useState<Set<number>>(() => new Set());
  const prevIndex = useRef<number | null>(null);
  const markSeen = (i: number) => setVisited((v) => (v.has(i) ? v : new Set(v).add(i)));
  /** F2 : quiz du module (après la dernière étape) ; gardé monté pendant « Revoir l'étape ». */
  const [view, setView] = useState<'steps' | 'quiz'>(() => (startQuiz && m.quiz ? 'quiz' : 'steps'));
  const [quizOpened, setQuizOpened] = useState(() => !!(startQuiz && m.quiz));
  const [reviewing, setReviewing] = useState(false);
  const quizGate = !!m.quiz && m.quiz.required && m.quiz.mode === 'quiz';
  const QUIZ_KEY = `fd.quiz.${m.demoId}`;
  /** F1-3 : la checklist ne recouvre jamais la capture : à côté si la place le permet, sinon dans l'en-tête. */
  const [checklistDocked, setChecklistDocked] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !m.checklist) return;
    const measure = () => {
      const stage = root.querySelector('.p-stage, .p-text-step, .p-quiz-card') as HTMLElement | null;
      const free = stage ? (root.clientWidth - stage.getBoundingClientRect().width) / 2 : 0;
      setChecklistDocked(free < 260 + 32);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [index, view, m.checklist]);
  /** Choix « Fin de la démo » : écran de fin sans changer d'étape. */
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(() => !!m.autoplay?.enabled && !preview);

  useEffect(() => {
    tracker.track('demo_view');
  }, [tracker]);

  useEffect(() => {
    tracker.track('step_view', { stepId: step.id, stepIndex: index });
    // F1-4 : une étape (et donc un chapitre) est « vue » quand on la quitte
    const left = prevIndex.current;
    prevIndex.current = index;
    if (left !== null && left !== index) markSeen(left);
    // Un quiz obligatoire conditionne la fin du module (demo_complete à la réussite)
    if (last && !completed.current && !quizGate) {
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

  // F1 : lecture automatique, arrêtée sur un formulaire, un menu de choix ou la dernière étape.
  const autoplay = m.autoplay?.enabled ? m.autoplay : null;
  useEffect(() => {
    if (!autoplay || !playing || !canAutoAdvance(m, index, !!gateForm)) return;
    const id = setTimeout(() => go(index + 1), autoplay.delayMs);
    return () => clearTimeout(id);
  }, [autoplay, playing, index, gateForm]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(i: number | null) {
    if (i === m.steps.length && m.quiz) return openQuiz();
    if (i === null || i < 0 || i >= m.steps.length) return;
    setView('steps');
    setReviewing(false);
    setIndex(i);
    setMenu(false);
    setEnded(false);
  }

  function openQuiz() {
    markSeen(index); // fin du parcours : la dernière étape compte comme vue
    setQuizOpened(true);
    setView('quiz');
    setReviewing(false);
    setMenu(false);
    setEnded(false);
  }

  function quizAttemptsUsed() {
    try {
      return Number(localStorage.getItem(QUIZ_KEY) ?? '0') || 0;
    } catch {
      return 0;
    }
  }

  function onChoice(c: (typeof choices)[number]) {
    tracker.track('hotspot_click', {
      stepId: step.id,
      stepIndex: index,
      props: { choice: c.label.slice(0, 80) },
    });
    const target = choiceTarget(m, c.action);
    if (!target) return;
    if (target.kind === 'url') window.open(target.url, '_blank', 'noopener');
    else if (target.kind === 'end') {
      markSeen(index);
      setEnded(true);
      if (!completed.current) {
        completed.current = true;
        tracker.track('demo_complete', { stepIndex: index });
      }
    } else go(target.index);
  }

  function onHotspot(h: Hotspot) {
    tracker.track('hotspot_click', { stepId: step.id, hotspotId: h.id, stepIndex: index });
    if (h.action.type === 'url') {
      window.open(h.action.url, h.action.newTab ? '_blank' : '_top', 'noopener');
      return;
    }
    const n = nextIndex(m, index, h.action);
    if (n === null && h.action.type === 'next' && last) return m.quiz ? go(m.steps.length) : finish();
    go(n);
  }

  /** PY-6 : « Terminer » sur la dernière étape ouvre la carte de fin. */
  function finish() {
    markSeen(index);
    setEnded(true);
    setMenu(false);
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
      if (e.key === 'Escape') {
        if (menu) return setMenu(false);
        // Spec a2 §2 : Échap vaut « Suivant » sur une pop-up sans choix
        if (popup && !choices.length && !last && !gateForm) return go(index + 1);
      }
      if ((e.target as HTMLElement)?.closest?.('form') || gateForm || view === 'quiz') return;
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    }
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  // PLY-01 : thème sombre du système (refonte), quand la démo garde les couleurs par défaut
  const dark =
    prefersDark &&
    theme.background === DEFAULT_THEME.background &&
    theme.surface === DEFAULT_THEME.surface &&
    theme.text === DEFAULT_THEME.text;
  const style = {
    ...themeVars({ ...theme, ...(dark ? { background: DARK['--p-bg'] } : {}) }),
    ...(dark ? DARK : {}),
    // Cadre sombre : appel de l'en-tête et progression en prune clair, si la couleur principale est celle par défaut
    ...(dark && theme.primary === DEFAULT_THEME.primary ? { '--p-chrome-primary': '#CF86A9' } : {}),
  };

  const chapterOf = (s: Step) => m.chapters.find((c) => c.id === s.chapterId);
  const progress = ((index + 1) / m.steps.length) * 100;
  const items = m.checklist ? checklistItems(m, visited, index) : [];
  const tipProps = primary && {
    h: primary,
    html,
    sub,
    onCta,
    index,
    total: m.steps.length,
    finish: last && !m.quiz,
    onNext: () => onHotspot(primary),
    t,
  };

  return (
    <div class={`p-root ${compact ? 'is-compact' : ''}${dark ? ' is-dark' : ''}`} style={style} ref={rootRef}>
      {preview && <div class="p-preview">{t.preview}</div>}
      <header class="p-top" inert={!!gateForm}>
        {/* PY-1 : pastille du workspace (logo, sinon initiales), titre, méta */}
        <div class="p-id">
          {theme.logoUrl ? (
            <span class="p-ws">
              <img src={theme.logoUrl} alt="" />
            </span>
          ) : m.workspaceName ? (
            <span class="p-ws" aria-hidden="true">
              {initials(m.workspaceName)}
            </span>
          ) : null}
          <div class="p-id-text">
            <b class="p-title">{sub(m.title)}</b>
            <small class="p-meta">
              {m.workspaceName
                ? fmt(t as unknown as Record<string, string>, 'meta', {
                    ws: m.workspaceName,
                    count: m.steps.length,
                  })
                : fmt(t as unknown as Record<string, string>, 'metaSteps', { count: m.steps.length })}
            </small>
          </div>
        </div>
        <div class="p-top-acts">
          {m.checklist && items.length > 0 && !compact && checklistDocked && (
            <Checklist
              title={m.checklist.title}
              position="collapsed"
              items={items}
              t={t}
              sub={sub}
              onGo={go}
              docked
            />
          )}
          {/* PY-2 : « Chapitres » (si la démo a des chapitres), puis le CTA de la page */}
          {m.chapters.length > 0 && (
            <button
              class="p-btn p-btn-ghost p-btn-sm p-chapters-btn"
              aria-expanded={menu}
              aria-haspopup="menu"
              onClick={() => setMenu(!menu)}
            >
              <ListChecks {...ICON} size={16} />
              {t.chapters}
            </button>
          )}
          {m.cta && (
            <button
              class="p-btn p-btn-primary p-btn-sm p-top-cta"
              onClick={() => onCta(m.cta!.url, m.cta!.label)}
            >
              {sub(m.cta.label)}
              <span class="p-top-cta-icon">
                <ExternalLink {...ICON} size={16} />
              </span>
            </button>
          )}
        </div>
      </header>
      {menu && !gateForm && (
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
          if (view === 'quiz') return;
          go(x1 < x0 ? index + 1 : index - 1);
        }}
      >
        {reviewing && view === 'steps' && (
          <div class="p-review-bar">
            <button type="button" class="p-btn p-btn-primary p-btn-sm" onClick={openQuiz}>
              <ChevronLeft {...ICON} size={16} />
              {t.quiz.backToQuiz}
            </button>
          </div>
        )}
        {quizOpened && m.quiz && (
          <div class="p-quiz-wrap" hidden={view !== 'quiz'}>
            <Quiz
              quiz={m.quiz}
              module={m.title}
              t={t}
              sub={sub}
              stepNumber={(id) => {
                const i = id ? m.steps.findIndex((s) => s.id === id) : -1;
                return i >= 0 ? i + 1 : null;
              }}
              attemptsUsed={quizAttemptsUsed()}
              onSubmit={async (answers) => {
                if (preview) return null; // « Tester le quiz » : tentative non comptée
                const res = await submitQuizAttempt({
                  demoId: m.demoId,
                  versionId: m.versionId,
                  visitorId: tracker.visitorId,
                  sessionId: tracker.sessionId,
                  linkToken: tracker.linkToken,
                  answers: Object.entries(answers).map(([questionId, answerIds]) => ({
                    questionId,
                    answerIds,
                  })),
                });
                try {
                  localStorage.setItem(QUIZ_KEY, String(quizAttemptsUsed() + 1));
                } catch {
                  /* stockage indisponible */
                }
                if (res.passed && !completed.current) {
                  completed.current = true;
                  tracker.track('demo_complete', { stepIndex: m.steps.length - 1 });
                }
                return res;
              }}
              onReviewStep={(id) => {
                const i = m.steps.findIndex((s) => s.id === id);
                if (i < 0) return;
                setIndex(i);
                setView('steps');
                setReviewing(true);
              }}
              onRestartModule={() => go(0)}
              onFinish={() => {
                setView('steps');
                setEnded(true);
              }}
            />
          </div>
        )}
        {view === 'quiz' ? null : step.kind === 'image' && step.image ? (
          <ImageStep
            key={step.id}
            step={step}
            sub={sub}
            onHotspot={onHotspot}
            onCta={onCta}
            tip={!compact && !gateForm ? tipProps : undefined}
          />
        ) : (
          <>
            {popup && backdrop !== null && (
              <ImageStep
                key={`bg-${m.steps[backdrop]!.id}`}
                step={m.steps[backdrop]!}
                sub={sub}
                onHotspot={onHotspot}
                onCta={onCta}
                dimmed
              />
            )}
            {popup && backdrop === null && (
              <div
                class="p-popup-bg"
                style={{ background: step.options.background === 'color' ? step.options.bgColor : undefined }}
                aria-hidden="true"
              />
            )}
            <div
              class={`p-text-step${popup ? ' p-popup' : ''}${endText ? ' p-end-text' : ''}`}
              role={popup ? 'dialog' : undefined}
              aria-labelledby={`p-step-title-${step.id}`}
            >
              {popup && !endText && (
                <span class={`p-variant p-variant--${step.options.variant}`}>
                  {step.options.showIcon &&
                    (step.options.variant === 'instruction' ? (
                      <ClipboardList {...ICON} size={14} />
                    ) : (
                      <Info {...ICON} size={14} />
                    ))}
                  {step.options.variant === 'instruction' ? t.instruction : t.info}
                </span>
              )}
              <h1 id={`p-step-title-${step.id}`}>{sub(step.title)}</h1>
              {step.body && <div class="p-rich" dangerouslySetInnerHTML={{ __html: html(step.body) }} />}
              {choices.length > 0 && (
                <div class="p-choices" role="group" aria-label={t.choose}>
                  {choices.map((c, ci) => (
                    <button key={ci} class="p-choice" onClick={() => onChoice(c)} autoFocus={ci === 0}>
                      <span>{sub(c.label)}</span>
                      {c.action.type === 'url' ? (
                        <ExternalLink {...ICON} size={16} />
                      ) : (
                        <ChevronRight {...ICON} size={16} />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div class={`p-actions${endText ? ' p-card-acts--col' : ''}`}>
                {index > 0 && !endText && (
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
                {choices.length > 0 ? null : !last ? (
                  <button
                    class={`p-btn ${step.cta ? 'p-btn-ghost' : 'p-btn-primary'}`}
                    onClick={() => go(index + 1)}
                    autoFocus
                  >
                    {step.options.buttonLabel
                      ? sub(step.options.buttonLabel)
                      : index === 0
                        ? t.start
                        : t.next}
                    <ChevronRight {...ICON} size={16} />
                  </button>
                ) : m.quiz ? (
                  <button class="p-btn p-btn-primary" onClick={openQuiz} autoFocus>
                    {t.quiz.start}
                    <ChevronRight {...ICON} size={16} />
                  </button>
                ) : (
                  <button
                    class={`p-btn ${step.cta || !endText ? 'p-btn-ghost' : 'p-btn-secondary'}`}
                    onClick={() => go(0)}
                  >
                    <RotateCcw {...ICON} size={16} />
                    {t.restart}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        {ended && <div class="p-scrim" aria-hidden="true" />}
        {ended && (
          <div class="p-card p-end" role="dialog" aria-modal="true" aria-labelledby="p-end-title">
            <span class="p-end-chip" aria-hidden="true">
              <CheckCircle2 {...ICON} size={24} />
            </span>
            <h2 id="p-end-title">{t.endTitle}</h2>
            <p class="p-sub">
              {fmt(t as unknown as Record<string, string>, 'endBody', {
                count: m.steps.length,
                title: sub(m.title),
              })}
            </p>
            <div class="p-card-acts p-card-acts--col">
              {m.cta && (
                <button class="p-btn p-btn-primary" onClick={() => onCta(m.cta!.url, m.cta!.label)} autoFocus>
                  {sub(m.cta.label)}
                  <ExternalLink {...ICON} size={16} />
                </button>
              )}
              <button
                class={`p-btn ${m.cta ? 'p-btn-ghost' : 'p-btn-secondary'}`}
                onClick={() => go(0)}
                autoFocus={!m.cta}
              >
                <RotateCcw {...ICON} size={16} />
                {t.restart}
              </button>
            </div>
          </div>
        )}
        {m.checklist && items.length > 0 && !gateForm && !compact && !checklistDocked && (
          <Checklist
            title={m.checklist.title}
            position={m.checklist.position}
            items={items}
            t={t}
            sub={sub}
            onGo={go}
          />
        )}
        {gateForm && (
          <LeadForm
            form={gateForm}
            privacyUrl={m.privacyUrl}
            workspaceName={m.workspaceName}
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

      {/* PL6 : un seul overlay modal à la fois. Tant que le formulaire est ouvert, la bulle et la
          navigation sont retirées (rien ne permet de le contourner). */}
      {compact && tipProps && !gateForm && view === 'steps' && <Tooltip {...tipProps} sheet />}
      {compact && m.checklist && items.length > 0 && !gateForm && (
        <Checklist title={m.checklist.title} position="collapsed" items={items} t={t} sub={sub} onGo={go} />
      )}

      {/* PY-3 : une pilule centrée : ←, progression, « n / N », →, séparateur, langue, plein écran */}
      <nav
        class="p-controls"
        aria-label={t.nav}
        inert={!!gateForm || ended}
        aria-hidden={gateForm ? true : undefined}
      >
        <button
          class="p-icon-btn"
          onClick={() => go(index - 1)}
          disabled={index === 0 || view === 'quiz'}
          aria-label={t.prevStep}
        >
          <ArrowLeft {...ICON} />
        </button>
        {autoplay && (
          <button
            class="p-icon-btn p-play"
            onClick={() => setPlaying(!playing)}
            aria-pressed={playing}
            aria-label={playing ? t.pause : t.play}
          >
            {playing ? <Pause {...ICON} /> : <Play {...ICON} />}
          </button>
        )}
        <div
          class="p-progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={m.steps.length}
          aria-valuenow={view === 'quiz' ? m.steps.length : index + 1}
          aria-label={view === 'quiz' ? t.quiz.label : `${index + 1} ${t.of} ${m.steps.length}`}
        >
          <div style={{ width: `${view === 'quiz' ? 100 : progress}%` }} />
        </div>
        <span class="p-count" aria-hidden="true">
          {view === 'quiz' ? t.quiz.label : `${index + 1} / ${m.steps.length}`}
        </span>
        <button
          class="p-icon-btn"
          onClick={() => (last && !m.quiz ? finish() : go(index + 1))}
          disabled={(last && !m.quiz && (ended || endText)) || view === 'quiz'}
          aria-label={t.nextStep}
        >
          <ArrowRight {...ICON} />
        </button>
        <span class="p-sep" aria-hidden="true" />
        <button
          class="p-icon-btn p-icon-btn--ghost p-lang"
          onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
          aria-label={t.language}
          title={t.language}
        >
          <Globe {...ICON} />
        </button>
        {document.fullscreenEnabled && (
          <button
            class="p-icon-btn p-icon-btn--ghost p-fs"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
          >
            {fullscreen ? <Minimize2 {...ICON} /> : <Maximize2 {...ICON} />}
          </button>
        )}
      </nav>
      {theme.showBranding && <p class="p-branding">{t.madeWith}</p>}
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
  /** PY-6 : dernière étape sans quiz, le bouton devient « Terminer ». */
  finish: boolean;
  onNext: () => void;
  t: Dict;
};

function ImageStep({
  step,
  sub,
  onHotspot,
  onCta,
  tip,
  dimmed = false,
}: {
  step: Step;
  sub: (s: string) => string;
  onHotspot: (h: Hotspot) => void;
  onCta: (url: string, label: string) => void;
  tip?: TipProps;
  /** F1 : écran de fond d'une étape pop-up (assombri, sans pastille ni bulle). */
  dimmed?: boolean;
}) {
  const img = step.image!;
  const zoom = step.zoom;
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    const id = requestAnimationFrame(() => setZoomed(true));
    return () => cancelAnimationFrame(id);
  }, [zoom]);
  // PL2 : seule l'image (et ses zones floutées) est agrandie. Pastilles et bulle restent hors du calque
  // zoomé, à leur taille normale, positionnées en coordonnées écran ; l'origine est recalée pour que
  // le premier hotspot reste visible.
  const o = zoom ? zoomOrigin(zoom, step.hotspots[0]) : { x: 0.5, y: 0.5 };
  const scale = zoom && zoomed ? zoom.scale : 1;
  const transform = scale !== 1 ? `scale(${scale})` : 'none';
  const origin = `${o.x * 100}% ${o.y * 100}%`;
  const screen = <T extends Hotspot>(h: T): T => zoomBox(h, o, scale);

  return (
    <div
      class={`p-stage${dimmed ? ' is-backdrop' : ''}`}
      style={{ '--ratio': String(img.width / img.height) }}
    >
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
      </div>
      {!dimmed && step.hotspots.some((h) => h.style === 'spotlight') && (
        <svg class="p-veil" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d={spotlightVeilPath(step.hotspots.filter((h) => h.style === 'spotlight').map(screen))}
          />
        </svg>
      )}
      {!dimmed &&
        step.hotspots.map((h) =>
          h.style === 'spotlight' ? (
            <button
              key={h.id}
              class="p-spotlight"
              style={boxStyle(screen(h))}
              aria-label={sub(h.title)}
              onClick={() => onHotspot(h)}
            />
          ) : (
            <Beacon key={h.id} h={screen(h)} label={sub(h.title)} onClick={() => onHotspot(h)} />
          ),
        )}
      {!dimmed && tip && (tip.h.title || tip.h.body || tip.h.cta) && (
        <Tooltip
          {...tip}
          {...(tip.h.style === 'spotlight'
            ? (() => {
                const a = spotlightAnchor(screen(tip.h), tip.h.placement);
                return { h: { ...a.box, placement: a.placement } };
              })()
            : { h: screen(tip.h) })}
        />
      )}
      {dimmed && <div class="p-dim" aria-hidden="true" />}
      {!dimmed && !step.hotspots.length && step.cta && (
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
  finish,
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
      {/* PY-4 : pied « n / N » + bouton ; « Précédent » est dans la barre */}
      <div class="p-actions">
        <span class="p-tip-count">
          {index + 1} / {total}
        </span>
        {h.cta && (
          <button class="p-btn p-btn-primary p-btn-sm" onClick={() => onCta(h.cta!.url, h.cta!.label)}>
            {sub(h.cta.label)}
            <ExternalLink {...ICON} size={14} />
          </button>
        )}
        {h.action.type !== 'none' && !h.cta && (
          <button class="p-btn p-btn-primary p-btn-sm" onClick={onNext}>
            {finish && h.action.type === 'next' ? t.finish : t.next}
            <ChevronRight {...ICON} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Initiales du workspace pour la pastille de l'en-tête (PY-1). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // Sigle en tête (« DSI Missions Locales » → DSI), sinon initiales des deux premiers mots
  const first = words[0] ?? '';
  if (/^[A-ZÀ-Ý0-9]{2,4}$/.test(first)) return first;
  const out = words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [...first].slice(0, 2);
  return out.join('').toUpperCase();
}
