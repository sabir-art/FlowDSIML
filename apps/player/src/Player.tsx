import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  themeSchema,
  type Hotspot,
  type LeadForm as LeadFormT,
  type Manifest,
  type Step,
} from '@flowdsiml/manifest';
import {
  applyVariables,
  buildNeedles,
  escapeHtml,
  markTermsInHtml,
  richTextToHtml,
  richTextToPlain,
  termsPresent,
  VAR_CLOSE,
  VAR_OPEN,
  type VariableValues,
} from '@flowdsiml/core';
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
  Notebook,
  RotateCcw,
} from 'lucide-preact';
import {
  abVariant,
  applyAb,
  backdropIndex,
  canAutoAdvance,
  checklistItems,
  choiceTarget,
  nextIndex,
  ruleTarget,
  tabChanged,
  tabsAt,
  type BranchMemory,
  quizAnswerPayload,
} from './logic';
import type { ComponentChildren } from 'preact';
import { Checklist } from './Checklist';
import { BeforeAfterStep } from './BeforeAfter';
import { VideoStep } from './VideoStep';
import { HtmlStep } from './HtmlStep';
import { GlossaryDrawer, GlossaryTip } from './Glossary';
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
  fontFaceCss,
} from '@flowdsiml/player-core';
import { fmt, strings, type Dict } from './i18n';
import type { QuizResult, TrackerLike } from './api';
import { LeadForm } from './LeadForm';

interface Props {
  manifest: Manifest;
  values: VariableValues;
  tracker: TrackerLike;
  preview?: boolean;
  /** F2 : aperçu « Tester le quiz » ouvert directement sur le quiz. */
  startQuiz?: boolean;
  /** L13 : reprise à une étape (« Bon retour »). */
  startStep?: number;
  /** L22 : mode présentation, piloté par l'app (vue présentateur, écran public). */
  present?: PresentState;
  /** L16 : correction du quiz hors ligne (paquet SCORM) à la place de submit_quiz_attempt. */
  scoreQuiz?: (answers: Record<string, string[]>, attemptsUsed: number) => Promise<QuizResult>;
  /** L16 : langue de l'interface imposée (?lang=fr|en, widget, paquet). */
  uiLocale?: 'fr' | 'en';
  onLead: (
    form: LeadFormT,
    data: { email: string; fields: Record<string, string>; consent: boolean },
  ) => Promise<void>;
}

/** L22 : état imposé par la vue présentateur. */
export interface PresentState {
  index: number;
  black: boolean;
  hideHotspots: boolean;
}

const GATE_KEY = (demoId: string) => `fd.gate.${demoId}`;
const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

/** Vrai sous 640 px : la bulle devient une feuille ancrée en bas (P3). */
export function useMedia(q: string) {
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

/** L22 : nombre maximal de sauts par règle dans une session (protection contre les boucles). */
const MAX_RULE_JUMPS = 50;

export function Player({
  manifest: raw,
  values,
  tracker,
  preview,
  startQuiz,
  startStep,
  onLead,
  present,
  scoreQuiz,
  uiLocale,
}: Props) {
  // L18 : test A/B. Variante tirée une fois par visiteur (jamais en aperçu : variante A), bulle
  // testée remplacée pour B, et chaque événement marqué de la variante.
  const variant = useMemo(() => {
    if (!raw.ab || preview) return 'A' as const;
    let store: Storage | null = null;
    try {
      store = localStorage;
    } catch {
      /* stockage indisponible */
    }
    return abVariant(raw.ab.testId, raw.ab.splitB, store);
  }, [raw.ab, preview]);
  const m = useMemo(() => applyAb(raw, variant), [raw, variant]);
  useEffect(() => {
    if (raw.ab && !preview) tracker.setBaseProps?.({ abt: raw.ab.testId, abv: variant });
  }, [raw.ab, preview, tracker, variant]);
  // PY-3 : langue de l'interface du lecteur (le contenu de la démo reste dans sa langue)
  const [locale, setLocale] = useState<'fr' | 'en'>(uiLocale ?? (m.locale === 'en' ? 'en' : 'fr'));
  const t = strings(locale);
  const narrow = useCompact();
  /** F7 : démo mobile : feuille du bas partout ; sur grand écran, dans un cadre de téléphone. */
  const mobile = m.device === 'mobile';
  const framed = mobile && !narrow;
  const compact = narrow || mobile;
  const prefersDark = useMedia('(prefers-color-scheme: dark)');
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.max(0, Math.min(startStep ?? 0, m.steps.length - 1)));
  // L22 : en présentation, l'étape est imposée par la vue présentateur
  useEffect(() => {
    if (present && present.index !== index && present.index >= 0 && present.index < m.steps.length)
      setIndex(present.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present?.index]);
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
  // L17 : glossaire. Termes repérés hors valeurs de variables et hors liens, jamais dans les titres ;
  // première occurrence de chaque terme dans l'étape (corps, bulles, notes Avant / Après, dans cet ordre).
  const glossary = useMemo(() => m.glossary ?? [], [m.glossary]);
  const needles = useMemo(() => buildNeedles(glossary, escapeHtml), [glossary]);
  const marked = (s: string) => richTextToHtml(applyVariables(s, values, defaults, [VAR_OPEN, VAR_CLOSE]));
  const stepTerms = useMemo(() => {
    const byText = new Map<string, Set<number>>();
    if (!needles.length) return byText;
    const s = m.steps[index]!;
    const used = new Set<number>();
    const fields = [
      s.body,
      ...s.hotspots.map((h) => h.body),
      s.beforeAfter?.notes.before,
      s.beforeAfter?.notes.after,
    ];
    for (const f of fields) {
      if (!f || byText.has(f)) continue;
      const before = new Set(used);
      markTermsInHtml(marked(f), needles, used);
      byText.set(f, new Set([...used].filter((i) => !before.has(i))));
    }
    return byText;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needles, index, values, defaults]);
  const html = (s: string) => {
    const own = stepTerms.get(s);
    if (!own || !own.size) return richTextToHtml(sub(s));
    const skip = new Set(glossary.map((_, i) => i).filter((i) => !own.has(i)));
    return markTermsInHtml(marked(s), needles, skip);
  };
  const presentTerms = useMemo(() => {
    if (!needles.length) return [];
    const texts = m.steps.flatMap((s) => [
      s.title,
      s.body,
      ...s.hotspots.flatMap((h) => [h.title, h.body]),
      s.beforeAfter?.notes.before ?? '',
      s.beforeAfter?.notes.after ?? '',
    ]);
    const found = termsPresent(
      texts.map((x) => escapeHtml(applyVariables(x, values, defaults, [VAR_OPEN, VAR_CLOSE]))),
      needles,
    );
    return glossary.filter((_, i) => found.has(i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needles, values, defaults]);
  const [glossOpen, setGlossOpen] = useState(false);
  const theme = m.theme;
  const gateForm =
    step.gateFormId && !gateDone.has(step.gateFormId)
      ? m.forms.find((f) => f.id === step.gateFormId)
      : undefined;
  /** L17 : une étape Avant / Après se comporte comme une capture (ni pop-up, ni écran de fin). */
  const visual =
    step.kind === 'image' || step.kind === 'before_after' || step.kind === 'video' || step.kind === 'html';
  const primary = step.kind === 'image' ? step.hotspots[0] : undefined;
  const last = index === m.steps.length - 1;
  /** Choix dont l'étape cible existe encore (un choix orphelin est ignoré). */
  const choices = step.options.choices.filter((c) => choiceTarget(m, c.action, index));
  /** Écran de fin (dernière étape de texte, sans quiz) : carte sur la capture précédente (PY-6, EDT-09). */
  const endText = !visual && last && step.options.display !== 'popup' && !m.quiz && !choices.length;
  const popup = !visual && (step.options.display === 'popup' || endText);
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
    const id = setTimeout(() => next(), autoplay.delayMs);
    return () => clearTimeout(id);
  }, [autoplay, playing, index, gateForm]); // eslint-disable-line react-hooks/exhaustive-deps

  // A11Y-03 : après un changement d'étape (bouton, flèches, Échap), le focus ne se perd pas sur la
  // page : s'il était dans l'ancienne bulle (démontée), il passe au titre de la nouvelle étape.
  // S'il est sur un bouton toujours présent (barre du bas), il y reste ; la zone live annonce l'étape.
  const firstStep = useRef(true);
  const presenting = Boolean(present);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    // L22 : en présentation, le lecteur est piloté de l'extérieur ; il ne prend jamais le focus
    // (sinon les raccourcis de la vue présentateur partiraient dans l'iframe).
    if (presenting) return;
    const id = requestAnimationFrame(() => {
      const root = rootRef.current;
      const a = document.activeElement;
      if (!root || (a && a !== document.body && a.isConnected && root.contains(a))) return;
      const target =
        root.querySelector<HTMLElement>('.p-tip-title, .p-step-h') ??
        root.querySelector<HTMLElement>('#p-main');
      target?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [index, view, presenting]);

  function go(i: number | null) {
    if (i === m.steps.length && m.quiz) return openQuiz();
    if (i === null || i < 0 || i >= m.steps.length) return;
    setView('steps');
    setReviewing(false);
    setIndex(i);
    setMenu(false);
    setEnded(false);
  }

  // ===== A8 : Sandbox (navigation libre entre pages HTML reliées) =====
  const sandbox = m.kind === 'sandbox' ? m.sandbox : null;
  /** Pages clés : choisies dans l'éditeur, sinon toutes les pages reliées. */
  const keyPages = useMemo(
    () =>
      sandbox
        ? sandbox.keyPages.length
          ? sandbox.keyPages.filter((id) => m.steps.some((s) => s.id === id))
          : (() => {
              // Par défaut : toutes les pages reliées (départ compris), comme le plan de l'éditeur
              const pages = m.steps.filter((s) => s.kind === 'html');
              const linked = new Set<string>(sandbox.start ? [sandbox.start] : []);
              for (const s of pages) {
                for (const o of s.html?.ops ?? []) if (o.op === 'link' && o.value) linked.add(o.value);
                if (sandbox.autoLink) for (const l of s.html?.links ?? []) linked.add(l.step);
              }
              return pages.filter((s) => linked.has(s.id)).map((s) => s.id);
            })()
        : [],
    [sandbox, m.steps],
  );
  const [seenPages, setSeenPages] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!sandbox || step.kind !== 'html') return;
    setSeenPages((v) => (v.has(step.id) ? v : new Set(v).add(step.id)));
  }, [sandbox, step]);
  useEffect(() => {
    // Complétion : « a vu les n pages clés »
    if (sandbox && keyPages.length && keyPages.every((id) => seenPages.has(id)) && !completed.current) {
      completed.current = true;
      tracker.track('demo_complete', { stepIndex: index });
    }
  }, [seenPages]); // eslint-disable-line react-hooks/exhaustive-deps
  function goStep(id: string) {
    const i = m.steps.findIndex((s) => s.id === id);
    if (i < 0) return;
    tracker.track('hotspot_click', { stepId: step.id, stepIndex: index, props: { link: i + 1 } });
    go(i);
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

  // L22 : mémoire de la session pour les règles de branchement (choix faits, réponses au quiz)
  const memory = useRef<BranchMemory>({ choices: {}, answers: {} });

  /** L22 : « Suivant » applique la première règle vraie de l'étape, sinon l'étape suivante. */
  // Garde-fou : plafond de sauts par règle dans la session (une règle mal conçue ne boucle pas sans fin)
  const ruleJumps = useRef(0);
  function next() {
    const rule = ruleTarget(m, index, memory.current);
    // Cible inconnue (étape d'une autre démo, supprimée…) : la règle est ignorée
    if (rule && ruleJumps.current < MAX_RULE_JUMPS && choiceTarget(m, rule, index)) {
      ruleJumps.current += 1;
      return follow(rule);
    }
    go(index + 1);
  }

  function onChoice(c: (typeof choices)[number]) {
    tracker.track('hotspot_click', {
      stepId: step.id,
      stepIndex: index,
      props: { choice: c.label.slice(0, 80) },
    });
    memory.current.choices[step.id] = choices.indexOf(c);
    follow(c.action);
  }

  function follow(action: (typeof choices)[number]['action']) {
    const target = choiceTarget(m, action, index);
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
    if (h.action.type === 'next' && ruleTarget(m, index, memory.current)) return next();
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
        // L16 : Échap traité ici n'est pas relayé à la page hôte (widget)
        if (menu) {
          e.preventDefault();
          return setMenu(false);
        }
        // Spec a2 §2 : Échap vaut « Suivant » sur une pop-up sans choix
        if (popup && !choices.length && !last && !gateForm) {
          e.preventDefault();
          return next();
        }
      }
      // L17 : les flèches d'un champ (curseur Avant / Après, recherche du glossaire) lui appartiennent
      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest?.('form, input, textarea, select, dialog') || gateForm || view === 'quiz') return;
      if (e.key === 'ArrowRight') next();
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
    // L12-05 : libellés de la bulle propres à l'étape (vides = ceux du thème)
    nextLabel: step.options.buttonLabel ? sub(step.options.buttonLabel) : '',
    prevLabel: step.options.prevLabel ? sub(step.options.prevLabel) : '',
    onPrev: step.options.showPrev && index > 0 ? () => go(index - 1) : undefined,
    t,
  };

  // A11Y-06 : alternative de la capture, qui situe l'écran (le texte de la bulle porte l'action)
  const shotTitle = richTextToPlain(sub(step.title || step.hotspots[0]?.title || '')).trim();
  const shotAlt = `${t.shotAlt} ${index + 1} ${t.of} ${m.steps.length}${shotTitle ? ` : ${shotTitle}` : ''}`;

  // L25-06 : onglets de la capture (barre du navigateur) et passage à un autre onglet
  const tabs = step.kind === 'image' ? tabsAt(m, index) : { tabs: [], active: 0 };
  const newTab = tabs.tabs.length > 0 && tabChanged(m, index);
  const activeTitle = tabs.tabs.find((x) => x.n === tabs.active)?.title ?? '';

  // L24 : annonce de l'étape aux lecteurs d'écran (zone toujours présente, texte mis à jour)
  const h0 = step.hotspots[0];
  const announce =
    view === 'quiz' || gateForm
      ? ''
      : [
          newTab ? t.newTab.replace('{{title}}', activeTitle) : '',
          `${t.stepWord} ${index + 1} ${t.of} ${m.steps.length}`,
          richTextToPlain(sub(h0?.title || step.title || '')),
          richTextToPlain(sub(h0?.body || step.body || '')),
        ]
          .filter(Boolean)
          .join('. ');

  return (
    <div
      class={`p-root ${compact ? 'is-compact' : ''}${mobile ? ' is-mobile' : ''}${framed ? ' is-framed' : ''}${dark ? ' is-dark' : ''}${present ? ' is-present' : ''}${present?.hideHotspots ? ' is-present-nohs' : ''}`}
      style={style}
      ref={rootRef}
    >
      {/* L18 : police de la médiathèque (WOFF2 https, URL contrôlée) */}
      {fontFaceCss(theme) && <style>{fontFaceCss(theme)}</style>}
      {present?.black && (
        <div class="p-black" role="status">
          {t.paused}
        </div>
      )}
      <p class="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      {preview && !present && <div class="p-preview">{t.preview}</div>}
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
            <h1 class="p-title">{sub(m.title)}</h1>
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
          {presentTerms.length > 0 && (
            <button
              class="p-btn p-btn-ghost p-btn-sm p-gloss-btn"
              aria-haspopup="dialog"
              onClick={() => setGlossOpen(true)}
            >
              <Notebook {...ICON} size={16} />
              {/* Spec §6 : sur mobile, bouton icône seul nommé « Glossaire » */}
              <span class={compact ? 'sr-only' : undefined}>{t.glossary}</span>
            </button>
          )}
          {m.cta && (
            <button
              class="p-btn p-btn-primary p-btn-sm p-top-cta"
              title={sub(m.cta.label)}
              onClick={() => onCta(m.cta!.url, m.cta!.label)}
            >
              <span class="p-top-cta-label">{sub(m.cta.label)}</span>
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

      <main
        id="p-main"
        tabIndex={-1}
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
                memory.current.answers = { ...memory.current.answers, ...answers };
                if (preview) return null; // « Tester le quiz » : tentative non comptée
                const res = scoreQuiz
                  ? await scoreQuiz(answers, quizAttemptsUsed())
                  : await submitQuizAttempt({
                      demoId: m.demoId,
                      versionId: m.versionId,
                      visitorId: tracker.visitorId,
                      sessionId: tracker.sessionId,
                      linkToken: tracker.linkToken,
                      answers: Object.entries(answers).map(([questionId, answerIds]) =>
                        quizAnswerPayload(m.quiz!, questionId, answerIds),
                      ),
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
        {view === 'quiz' ? null : step.kind === 'before_after' && step.image && step.beforeAfter ? (
          <BeforeAfterStep
            key={step.id}
            step={step}
            narrow={compact}
            t={t}
            sub={sub}
            html={html}
            stepLabel={`${index + 1} ${t.of} ${m.steps.length}`}
            nextLabel={
              step.options.buttonLabel
                ? sub(step.options.buttonLabel)
                : last
                  ? m.quiz
                    ? t.quiz.start
                    : t.finish
                  : t.next
            }
            onNext={last ? (m.quiz ? openQuiz : finish) : next}
          />
        ) : step.kind === 'video' && step.video ? (
          <VideoStep
            key={step.id}
            step={step}
            t={t}
            sub={sub}
            nextLabel={last ? (m.quiz ? t.quiz.start : t.finish) : t.next}
            onNext={last ? (m.quiz ? openQuiz : finish) : next}
            onPause={(n) =>
              tracker.track('step_view', { stepId: step.id, stepIndex: index, props: { pause: n } })
            }
          />
        ) : step.kind === 'html' && step.html ? (
          <>
            <HtmlStep
              key={step.id}
              step={step}
              t={t}
              sub={sub}
              sandbox={sandbox}
              nextLabel={last ? (m.quiz ? t.quiz.start : t.finish) : t.next}
              onNext={last ? (m.quiz ? openQuiz : finish) : next}
              onGo={goStep}
              status={
                sandbox && keyPages.length > 0
                  ? fmt(t.html as unknown as Record<string, string>, 'keyPages', {
                      seen: keyPages.filter((id) => seenPages.has(id)).length,
                      total: keyPages.length,
                    })
                  : undefined
              }
            />
          </>
        ) : step.kind === 'image' && step.image ? (
          <TabWindow tabs={tabs} changed={newTab} ratio={step.image.width / step.image.height}>
            <ImageStep
              key={step.id}
              step={step}
              sub={sub}
              onHotspot={onHotspot}
              onCta={onCta}
              tip={!compact && !gateForm && !ended ? tipProps : undefined}
              carry={index > 0 && m.steps[index - 1]?.zoom?.keep ? m.steps[index - 1]!.zoom : null}
              alt={shotAlt}
              tap={mobile ? t.mobile.tap : undefined}
              tapHere={t.mobile.tapHere}
            />
          </TabWindow>
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
              <h2 id={`p-step-title-${step.id}`} class="p-step-h" tabIndex={-1}>
                {sub(step.title)}
              </h2>
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
                    onClick={() => next()}
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
      </main>

      {needles.length > 0 && <GlossaryTip root={rootRef} terms={glossary} t={t} />}
      {glossOpen && <GlossaryDrawer terms={presentTerms} t={t} onClose={() => setGlossOpen(false)} />}

      {/* PL6 : un seul overlay modal à la fois. Tant que le formulaire est ouvert, la bulle et la
          navigation sont retirées (rien ne permet de le contourner). */}
      {compact && tipProps && !gateForm && !ended && view === 'steps' && (
        <Tooltip
          {...tipProps}
          sheet
          // F7 (L21-06) : hotspot dans le tiers bas de l'écran : la feuille passe en haut
          top={mobile && tipProps.h.y + tipProps.h.h / 2 > 2 / 3}
        />
      )}
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
          onClick={() => (last && !m.quiz ? finish() : next())}
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
  nextLabel: string;
  prevLabel: string;
  /** Présent si « Afficher « Précédent » » est activé et qu'une étape précède. */
  onPrev?: () => void;
  t: Dict;
};

function ImageStep({
  step,
  sub,
  onHotspot,
  onCta,
  tip,
  dimmed = false,
  carry = null,
  alt = '',
  tap,
  tapHere,
}: {
  step: Step;
  /** F7 : verbe « Touchez » des démos mobiles (sinon le titre seul). */
  tap?: string;
  tapHere?: string;
  /** A11Y-06 : alternative de la capture (vide pour un fond décoratif). */
  alt?: string;
  /** L12-02 : zoom de l'étape précédente marqué « garder », repris si cette étape n'a pas le sien. */
  carry?: Step['zoom'];
  sub: (s: string) => string;
  onHotspot: (h: Hotspot) => void;
  onCta: (url: string, label: string) => void;
  tip?: TipProps;
  /** F1 : écran de fond d'une étape pop-up (assombri, sans pastille ni bulle). */
  dimmed?: boolean;
}) {
  const img = step.image!;
  const zoom = step.zoom ?? carry;
  // Zoom repris de l'étape précédente, ou transition « Directe » : pas d'animation d'entrée
  const [zoomed, setZoomed] = useState(!step.zoom && !!carry);
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
      <div
        class={`p-zoom${zoom?.transition === 'instant' ? ' is-instant' : ''}`}
        style={{ transform, transformOrigin: origin }}
      >
        <img class="p-img" src={img.url} alt={alt} draggable={false} />
        {step.blurs.map((b, i) => (
          <div
            key={i}
            class={`p-blur${b.style === 'solid' ? ' p-blur--solid' : b.style === 'pixels' ? ' p-blur--pixels' : ''}`}
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              ...(b.style === 'solid' ? { background: b.color } : {}),
            }}
          >
            {b.style === 'solid' && b.text ? <span>{b.text}</span> : null}
          </div>
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
            <Beacon
              key={h.id}
              h={screen(h)}
              // F7 : « Touchez » pour une démo capturée au format mobile
              label={tap ? (h.title ? `${tap}\u202f: ${sub(h.title)}` : tapHere!) : sub(h.title)}
              onClick={() => onHotspot(h)}
            />
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

/**
 * L25-06 : fenêtre avec la barre d'onglets au-dessus de la capture (onglets déjà ouverts, celui de
 * l'étape actif). Au passage à un autre onglet, l'onglet s'active puis la capture apparaît
 * (animations retirées si le visiteur en demande moins). Sans onglets : la capture seule.
 */
function TabWindow({
  tabs,
  changed,
  ratio,
  children,
}: {
  tabs: { tabs: { n: number; title: string }[]; active: number };
  changed: boolean;
  ratio: number;
  children: ComponentChildren;
}) {
  if (!tabs.tabs.length) return <>{children}</>;
  return (
    <div class={`p-win${changed ? ' is-switch' : ''}`} style={{ '--ratio': String(ratio) }}>
      <div class="p-tabs" aria-hidden="true">
        <span class="p-tabs-dots">
          <i />
          <i />
          <i />
        </span>
        {tabs.tabs.map((x) => (
          <span key={x.n} class={`p-tab${x.n === tabs.active ? ' is-active' : ''}`}>
            <span class="p-tab-fav" />
            <span class="p-tab-t">{x.title || `#${x.n}`}</span>
          </span>
        ))}
      </div>
      {children}
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
  nextLabel,
  prevLabel,
  onPrev,
  t,
  sheet,
  top,
}: TipProps & { sheet?: boolean; top?: boolean }) {
  const pos: Record<string, string> = sheet ? {} : beaconCenter(h);
  return (
    <div
      class={sheet ? `p-sheet${top ? ' p-sheet--top' : ''}` : tipClass(h, h.placement)}
      style={pos}
      role="dialog"
      aria-label={sub(h.title)}
    >
      {h.title && (
        <div class="p-tip-title" tabIndex={-1}>
          {sub(h.title)}
        </div>
      )}
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
        {onPrev && (
          <button class="p-btn p-btn-ghost p-btn-sm p-tip-prev" onClick={onPrev}>
            {prevLabel || t.prev}
          </button>
        )}
        {h.action.type !== 'none' && !h.cta && (
          <button class="p-btn p-btn-primary p-btn-sm" onClick={onNext}>
            {nextLabel || (finish && h.action.type === 'next' ? t.finish : t.next)}
            <ChevronRight {...ICON} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Initiales du workspace pour la pastille de l'en-tête (PY-1). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // Sigle en tête (« DSI Missions Locales » → DSI), sinon initiales des deux premiers mots
  const first = words[0] ?? '';
  if (/^[A-ZÀ-Ý0-9]{2,4}$/.test(first)) return first;
  const out = words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [...first].slice(0, 2);
  return out.join('').toUpperCase();
}
