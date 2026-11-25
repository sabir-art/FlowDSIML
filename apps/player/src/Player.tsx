import { APP_ORIGIN } from './config';
import { openExternal } from './openExternal';
import { ModalBox } from './modalFocus';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_FRAME,
  freeSpotlightRadius,
  themeSchema,
  type Frame,
  type FreeSpotlight,
  type Hotspot,
  type LeadForm as LeadFormT,
  type Manifest,
  type Step,
} from '@flowdsiml/manifest';
import {
  applyUrlVariables,
  applyVariables,
  variablesFromForm,
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
  AppWindow,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Expand,
  ExternalLink,
  Flashlight,
  Globe,
  Info,
  ListChecks,
  Pause,
  Play,
  Maximize2,
  Minimize2,
  Notebook,
  RotateCcw,
  RotateCw,
  ImageOff,
  ZoomIn,
  Captions,
  Volume2,
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
  datasetRow,
  datasetVars,
  withDataset,
  tabChanged,
  tabsAt,
  type BranchMemory,
  quizAnswerPayload,
  maskStyle,
} from './logic';
import type { ComponentChildren } from 'preact';
import { Checklist } from './Checklist';
import { BeforeAfterStep } from './BeforeAfter';
import { VideoStep } from './VideoStep';
import { HtmlStep } from './HtmlStep';
import { GuideBubble, GuidePill, ring } from './SandboxGuide';
import { advance, GUIDE_START, guideKey, guidePath, guideView, readGuide, type GuideState } from './guide';
import { InfoDialog } from './InfoDialog';
import { VoiceLine, VoiceLineContext, type VoiceLineState } from './VoiceLine';
import { GlossaryDrawer, GlossaryTip } from './Glossary';
import { Quiz, ringVars } from './Quiz';
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
  TYPING_MS,
  asCrop,
  cropImageStyle,
  croppedSize,
  scrollOffset,
  scrollPlan,
  stackWindowHint,
} from '@flowdsiml/player-core';
import { fmt, strings, type Dict } from './i18n';
import type { QuizResult, TrackerLike } from './api';
import { LeadForm } from './LeadForm';
import { CenterNext, type FromCenter } from './CenterNext';

interface Props {
  manifest: Manifest;
  values: VariableValues;
  /** L25-13 : ligne du jeu de données imposée par le lien personnalisé. */
  datasetRowIndex?: number | null;
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
  /** L38-4 : module ouvert depuis le centre de formation (fin : module suivant, retour au centre). */
  fromCenter?: FromCenter | null;
  /** L26-08 : bouton « Informations » (mesure des visites, refus) quand la mesure est active. */
  measureInfo?: boolean;
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
  values: rawValues,
  datasetRowIndex = null,
  tracker,
  preview,
  startQuiz,
  startStep,
  onLead,
  present,
  scoreQuiz,
  uiLocale,
  measureInfo = false,
  fromCenter = null,
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
  // L25-09 : ligne du jeu de données (lien personnalisé ou ligne 1) ; ses variables passent après l'URL
  const dsRow = useMemo(
    () =>
      m.dataset
        ? datasetRowIndex !== null && m.dataset.rows[datasetRowIndex]
          ? m.dataset.rows[datasetRowIndex]!
          : datasetRow(m.dataset, rawValues)
        : null,
    [m.dataset, rawValues, datasetRowIndex],
  );
  // L46-bis : valeurs saisies dans un formulaire, pour la session seulement ; l'adresse et le lien
  // personnalisé (rawValues) ne sont jamais écrasés
  const [formVars, setFormVars] = useState<VariableValues>({});
  const values = useMemo(
    () => ({ ...(m.dataset ? datasetVars(m.dataset, dsRow) : {}), ...formVars, ...rawValues }),
    [m.dataset, dsRow, formVars, rawValues],
  );
  useEffect(() => {
    if (raw.ab && !preview) tracker.setBaseProps?.({ abt: raw.ab.testId, abv: variant });
  }, [raw.ab, preview, tracker, variant]);
  // PY-3 : langue de l'interface du lecteur (le contenu de la démo reste dans sa langue)
  const [locale, setLocale] = useState<'fr' | 'en'>(uiLocale ?? (m.locale === 'en' ? 'en' : 'fr'));
  const t = strings(locale);
  const narrow = useCompact();
  /** F7 : démo mobile : feuille du bas partout ; sur grand écran, dans un cadre de téléphone. */
  const mobile = m.device === 'mobile';
  // L25-03 : cadre du téléphone masquable dans l'éditeur
  const framed = mobile && !narrow && m.theme.frame?.phone !== false;
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
  // Fenêtre fermée par Échap : la capture n'est plus voilée, « Rouvrir la fenêtre » reste dans la barre
  const [winClosed, setWinClosed] = useState(false);
  // Projecteur libre coupé par le visiteur
  const [spotOff, setSpotOff] = useState(false);
  const winBox = useRef<HTMLDivElement>(null);
  const winPill = useRef<HTMLButtonElement>(null);
  const winFoot = useRef<HTMLDivElement>(null);
  const completed = useRef(false);
  const touchX = useRef<number | null>(null);
  const step = m.steps[index]!;
  // L38-11 / MOB-01 M5 : cadrage automatique sur petit écran ; « Voir tout l'écran » sous la capture
  const autoZoom =
    narrow &&
    !mobile &&
    step.kind === 'image' &&
    !step.zoom &&
    !(index > 0 && m.steps[index - 1]?.zoom?.keep) &&
    step.hotspots.length > 0;
  const [fullShot, setFullShot] = useState(false);
  useEffect(() => setFullShot(false), [index]);
  // L28-03 : voix off. Son coupé au départ (règle des navigateurs) ; « Activer le son » vaut pour la session
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return sessionStorage.getItem('fd.voice.sound') === '1';
    } catch {
      return false;
    }
  });
  // EXT-02 §6.4 : sous-titres affichés par défaut selon le réglage de la démo ; le visiteur garde la main
  const [voiceCc, setVoiceCc] = useState(m.voice.captions);
  /** La ligne audio est affichée dans une bulle : la barre n'a plus ses boutons de voix. */
  const [voiceHosted, setVoiceHosted] = useState(false);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const defaults = useMemo(
    () => Object.fromEntries(m.variables.map((v) => [v.key, v.default])),
    [m.variables],
  );
  const sub = (s: string) => applyVariables(s, values, defaults);
  // L17 : glossaire. Termes repérés hors valeurs de variables et hors liens, jamais dans les titres ;
  // première occurrence de chaque terme dans l'étape (corps, bulles, notes Avant / Après, dans cet ordre).
  const glossary = useMemo(() => m.glossary ?? [], [m.glossary]);
  const needles = useMemo(() => buildNeedles(glossary, escapeHtml), [glossary]);
  // Les variables sont remplacées par le rendu lui-même : une valeur reste du texte, jamais un lien
  const marked = (s: string) => richTextToHtml(s, { values, defaults, wrap: [VAR_OPEN, VAR_CLOSE] });
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
    if (!own || !own.size) return richTextToHtml(s, { values, defaults });
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
  const [infoOpen, setInfoOpen] = useState(false);
  const theme = m.theme;
  const gateForm =
    step.gateFormId && !gateDone.has(step.gateFormId)
      ? m.forms.find((f) => f.id === step.gateFormId)
      : undefined;
  /** L17 : une étape Avant / Après se comporte comme une capture (ni pop-up, ni écran de fin). */
  const visual =
    step.kind === 'image' || step.kind === 'before_after' || step.kind === 'video' || step.kind === 'html';
  // Démo guidée : une étape HTML porte la même bulle qu'une capture (posée sur l'élément visé)
  const primary =
    step.kind === 'image' || (step.kind === 'html' && m.kind !== 'sandbox') ? step.hotspots[0] : undefined;
  const last = index === m.steps.length - 1;
  /** Choix dont l'étape cible existe encore (un choix orphelin est ignoré). */
  const choices = step.options.choices.filter((c) => choiceTarget(m, c.action, index));
  /** Écran de fin (dernière étape de texte, sans quiz) : carte sur la capture précédente (PY-6, EDT-09). */
  /** EXT-02 §6.1 : étape « Fenêtre » (image + texte), ouverte sur la capture précédente voilée. */
  const win = !visual && step.options.display === 'window';
  // Chaque étape « Fenêtre » s'ouvre à l'arrivée
  useEffect(() => setWinClosed(false), [index]);
  // Fenêtre modale : le focus y entre à l'ouverture (bouton principal), même venu de la barre du bas
  const winOpen = win && !winClosed;
  useEffect(() => {
    if (!winOpen) return;
    const id = requestAnimationFrame(() =>
      winBox.current?.querySelector<HTMLElement>('.p-dwin__foot .p-btn-primary')?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, [winOpen, index]);
  // Pied de la fenêtre : si « Échap pour fermer » ne tient pas à côté des boutons, il passe dessous (12 px)
  useEffect(() => {
    const foot = winFoot.current;
    if (!winOpen || !foot) return;
    const fit = () => stackWindowHint(foot);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(foot);
    return () => ro.disconnect();
  }, [winOpen, index, locale]);
  const endText = !visual && !win && last && step.options.display !== 'popup' && !m.quiz && !choices.length;
  const popup = !visual && (step.options.display === 'popup' || endText);
  const bgBlur = popup && (endText || step.options.background === 'blur');
  const backdrop = bgBlur || win ? backdropIndex(m, index) : null;
  const [visited, setVisited] = useState<Set<number>>(() => new Set());
  const prevIndex = useRef<number | null>(null);
  const markSeen = (i: number) => setVisited((v) => (v.has(i) ? v : new Set(v).add(i)));
  /** F2 : quiz du module (après la dernière étape) ; gardé monté pendant « Revoir l'étape ». */
  const [view, setView] = useState<'steps' | 'quiz'>(() => (startQuiz && m.quiz ? 'quiz' : 'steps'));
  // L28-03 : voix off de l'étape affichée (ni pendant un formulaire, ni sur le quiz)
  const voice = view === 'steps' && !gateForm ? step.voice : null;
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
                for (const o of s.html?.ops ?? [])
                  if (o.op === 'link' && typeof o.value === 'string' && o.value) linked.add(o.value);
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

  // ===== A8 : guide optionnel du Sandbox (bulles par-dessus les pages, état gardé pour la session) =====
  const guide = useMemo(() => guidePath(m), [m]);
  const gn = guide.length;
  const [gs, setGsRaw] = useState<GuideState>(() => {
    try {
      return readGuide(sessionStorage.getItem(guideKey(m.demoId)), gn);
    } catch {
      return GUIDE_START;
    }
  });
  const setGs = (v: GuideState) => {
    setGsRaw(v);
    try {
      sessionStorage.setItem(guideKey(m.demoId), JSON.stringify(v));
    } catch {
      /* stockage indisponible : l'état vit le temps de la page */
    }
  };
  const gv = guideView(gs, guide, step.id, sandbox?.start ?? null);
  const pillRef = useRef<HTMLButtonElement>(null);
  // La pastille change de forme avec l'état : le focus lui est rendu après le rendu
  const focusPill = useRef(false);
  useEffect(() => {
    if (focusPill.current) pillRef.current?.focus();
    focusPill.current = false;
  }, [gs]);
  const shownSteps = useRef(new Set<number>());
  const gBubble = gv.kind === 'guide' ? gv.bubble : null;
  // L30-05 : démo guidée, étape HTML : sa première bulle, posée sur l'élément visé (même ancrage)
  const htmlBubble =
    !sandbox && step.kind === 'html' && step.hotspots[0]
      ? { page: step.id, advance: 'click' as const, hotspot: step.hotspots[0] }
      : null;
  const point = gBubble ?? htmlBubble;
  useEffect(() => {
    if (gBubble && !shownSteps.current.has(gs.k)) {
      shownSteps.current.add(gs.k);
      tracker.track('guide_step', { stepId: step.id, stepIndex: index, props: { index: gs.k } });
    }
  }, [gBubble, gs.k]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Aller à une page du guide, sans compter un clic de lien. */
  const goGuidePage = (id: string) => {
    const i = m.steps.findIndex((s) => s.id === id);
    if (i >= 0 && i !== index) go(i);
  };
  const guideNext = () => {
    const v = advance(gs, gn);
    setGs(v);
    if (v.mode === 'done') tracker.track('guide_done', { stepId: step.id, stepIndex: index });
  };
  const guideSkip = (at: 'skip' | 'quit') => {
    setGs({ ...gs, mode: 'off' });
    tracker.track('guide_skip', { stepId: step.id, stepIndex: index, props: { at } });
    focusPill.current = true;
  };
  const guideBack = () => {
    setGs({ k: gs.k, mode: 'on' });
    goGuidePage(guide[gs.k]!.page);
  };
  // Échap ferme la bulle et met le guide en pause ; le focus revient sur la pastille
  const gOpen = gv.kind === 'guide' && (!!gv.bubble || !!gv.startsOn);
  useEffect(() => {
    if (!gOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      focusPill.current = true;
      setGs({ k: gs.k, mode: 'hold' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [gOpen, gs.k]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // L25-10 : variables (lien personnalisé, formulaire) et variante A/B lues par les règles
    const rule = ruleTarget(m, index, { ...memory.current, vars: values, variant });
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
    if (target.kind === 'url') openExternal(applyUrlVariables(target.url, values, defaults), '_blank');
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
      openExternal(applyUrlVariables(h.action.url, values, defaults), h.action.newTab ? '_blank' : '_top');
      return;
    }
    if (h.action.type === 'next' && ruleTarget(m, index, { ...memory.current, vars: values, variant }))
      return next();
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
    // L46-bis : variables de l'adresse encodées (paramètre vide si aucune valeur)
    openExternal(applyUrlVariables(url, values, defaults), '_blank');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }

  // Changement d'étape : la voix s'arrête ; elle repart à l'arrivée si le son est actif et la voix automatique
  useEffect(() => {
    const a = voiceRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    if (voice && soundOn && voice.autoplay) void a.play().catch(() => undefined);
  }, [step.id, voice, soundOn]);
  function enableSound() {
    setSoundOn(true);
    try {
      sessionStorage.setItem('fd.voice.sound', '1');
    } catch {
      /* stockage indisponible */
    }
    // Lecture lancée dans le geste de l'utilisateur (autorisée par le navigateur)
    if (voice?.autoplay) void voiceRef.current?.play().catch(() => undefined);
  }
  // EXT-02 §6.4 : ligne audio de la bulle (réglage « Lecteur audio : Bulle », par défaut)
  const voiceLine = useMemo<VoiceLineState | null>(
    () =>
      voice && m.voice.player === 'bubble'
        ? {
            audio: voiceRef,
            stepId: step.id,
            durationMs: voice.durationMs,
            cc: voiceCc,
            onCc: () => setVoiceCc((c) => !c),
            onPlay: () => {
              setSoundOn(true);
              try {
                sessionStorage.setItem('fd.voice.sound', '1');
              } catch {
                /* stockage indisponible */
              }
            },
            onHosted: setVoiceHosted,
            labels: { play: t.voice.play, pause: t.voice.pause, captions: t.voice.captions },
          }
        : null,
    [voice, m.voice.player, step.id, voiceCc, t],
  );
  function toggleVoice() {
    const a = voiceRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => undefined);
    else a.pause();
  }

  // Clavier : écouteur posé une fois, gestionnaire courant lu dans une ref (mis à jour à chaque rendu),
  // pour qu'une touche reçue entre un rendu et son effet ne voie jamais l'étape précédente
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyHandler.current = function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      // L16 : Échap traité ici n'est pas relayé à la page hôte (widget)
      if (menu) {
        e.preventDefault();
        return setMenu(false);
      }
      // EXT-02 §6.1 : Échap ferme la fenêtre (ne vaut pas « Suivant ») ; le focus va à « Rouvrir la fenêtre »
      if (win && !winClosed && !gateForm) {
        e.preventDefault();
        setWinClosed(true);
        requestAnimationFrame(() => winPill.current?.focus());
        return;
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
    // L28-03 : C masque ou affiche les sous-titres de la voix off
    if ((e.key === 'c' || e.key === 'C') && voice && !e.ctrlKey && !e.metaKey && !e.altKey)
      setVoiceCc((v) => !v);
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') go(index - 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

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
    ...ringVars(theme.primary, theme.surface, theme.text),
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
  // L29 §3.5 : texte alternatif saisi sur l'étape, sinon « Capture n sur N : titre »
  const shotAlt =
    step.alt?.trim() ||
    `${t.shotAlt} ${index + 1} ${t.of} ${m.steps.length}${shotTitle ? ` : ${shotTitle}` : ''}`;

  // L25-06 : onglets de la capture (barre du navigateur) et passage à un autre onglet
  const tabs = step.kind === 'image' ? tabsAt(m, index) : { tabs: [], active: 0 };
  const newTab = tabs.tabs.length > 0 && tabChanged(m, index);
  const activeTitle = tabs.tabs.find((x) => x.n === tabs.active)?.title ?? '';

  // L24 : annonce de l'étape aux lecteurs d'écran (zone toujours présente, texte mis à jour)
  const h0 = sandbox ? undefined : step.hotspots[0];
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

  // A8 : annonce de l'étape du guide, dans la même zone que l'annonce de l'étape
  const guideLive = gBubble
    ? fmt(t.guide as unknown as Record<string, string>, 'live', {
        k: gs.k + 1,
        n: gn,
        title: richTextToPlain(sub(gBubble.hotspot.title || gBubble.hotspot.body)),
      })
    : gv.kind === 'guide' && gv.done
      ? t.guide.done
      : '';
  const liveSeen = useRef({ announce: '', guide: '', text: '' });
  if (liveSeen.current.announce !== announce || liveSeen.current.guide !== guideLive) {
    const prev = liveSeen.current;
    // Celle qui vient de changer ; si les deux changent ensemble, le guide (plus précis) passe en premier
    const text =
      prev.guide !== guideLive && guideLive
        ? guideLive
        : prev.announce !== announce && announce
          ? announce
          : guideLive || announce;
    liveSeen.current = { announce, guide: guideLive, text };
  }
  const liveText = liveSeen.current.text;

  return (
    <VoiceLineContext.Provider value={voiceLine}>
      <div
        class={`p-root ${compact ? 'is-compact' : ''}${mobile ? ' is-mobile' : ''}${framed ? ' is-framed' : ''}${dark ? ' is-dark' : ''}${present ? ' is-present' : ''}${present?.hideHotspots ? ' is-present-nohs' : ''}`}
        style={style}
        ref={rootRef}
        // L30-03 : langue du contenu (copies traduites) ; l'arabe se lit de droite à gauche
        lang={m.locale}
        dir={m.locale === 'ar' ? 'rtl' : undefined}
      >
        {/* L18 : police de la médiathèque (WOFF2 https, URL contrôlée) */}
        {fontFaceCss(theme) && <style>{fontFaceCss(theme)}</style>}
        {present?.black && (
          <div class="p-black" role="status">
            {t.paused}
          </div>
        )}
        {/* Une seule zone d'annonce : l'étape, ou l'étape du guide (A8 : la bulle ne prend pas le focus).
            Deux zones parlaient en même temps ; la dernière annonce qui change l'emporte. */}
        <p class="sr-only" aria-live="polite" aria-atomic="true">
          {liveText}
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
            {gv.kind === 'guide' && (
              <GuidePill
                t={t}
                view={gv}
                k={gs.k}
                n={gn}
                short={compact}
                btnRef={pillRef}
                onBack={guideBack}
                onRestart={() => {
                  setGs(GUIDE_START);
                  goGuidePage(guide[0]!.page);
                }}
                onQuit={() => guideSkip('quit')}
              />
            )}
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
            {measureInfo && (
              <button
                class="p-btn p-btn-ghost p-btn-sm p-info-btn"
                aria-haspopup="dialog"
                aria-label={t.infoBtn}
                onClick={() => setInfoOpen(true)}
              >
                <Info {...ICON} size={16} />
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
          class={`p-stage-wrap${win ? (winClosed ? ' is-win-closed' : ' is-win-open') : ''}`}
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
                  // L25-10 : score lu par les règles « Score du quiz »
                  memory.current.score = res.score;
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
            <HtmlWindow
              on={!sandbox}
              frame={mobile ? { ...DEFAULT_FRAME, style: 'none' } : theme.frame}
              title={m.title}
              ratio={(step.html.viewport?.w ?? 1280) / (step.html.viewport?.h ?? 800)}
            >
              <HtmlStep
                key={step.id}
                step={withDataset(step, m.dataset, dsRow)}
                t={t}
                sub={sub}
                sandbox={sandbox}
                onGo={goStep}
                target={
                  point
                    ? {
                        sel: point.hotspot.sel,
                        rect: {
                          x: point.hotspot.x,
                          y: point.hotspot.y,
                          w: point.hotspot.w,
                          h: point.hotspot.h,
                        },
                      }
                    : null
                }
                onAddZone={
                  preview
                    ? () =>
                        // Aperçu en onglet (opener) ou intégré dans l'éditeur (parent) : l'éditeur ouvre l'étape
                        (window.opener ?? (window.parent !== window ? window.parent : null))?.postMessage(
                          { type: 'fd:preview-add-zone', stepId: step.id },
                          APP_ORIGIN,
                        )
                    : undefined
                }
                onHit={() => {
                  if (gBubble?.advance === 'click') guideNext();
                  // L30-05 : démo guidée, clic sur l'élément visé : étape suivante
                  else if (htmlBubble) (last ? (m.quiz ? openQuiz : finish) : next)();
                }}
                overlay={
                  gv.kind === 'guide' && (gv.bubble || gv.startsOn || gv.done)
                    ? (box, found) => (
                        <GuideBubble
                          t={t}
                          sub={sub}
                          html={html}
                          point={gv.bubble}
                          box={gv.bubble ? box : null}
                          found={found}
                          k={gs.k}
                          n={gn}
                          sheet={compact}
                          startsOn={
                            gv.startsOn ? sub(m.steps.find((s) => s.id === gv.startsOn)?.title ?? '') : null
                          }
                          done={gv.done}
                          onNext={guideNext}
                          onSkip={() => guideSkip('skip')}
                          onGo={() => goGuidePage(guide[0]!.page)}
                          onClose={() => {
                            setGs({ k: gs.k, mode: 'closed' });
                          }}
                        />
                      )
                    : htmlBubble
                      ? // Démo guidée : l'élément visé est entouré, et la bulle est celle des captures
                        // (titre, texte, « n / N », « Suivant ») ; sur petit écran, la feuille du bas
                        (box) =>
                          box && (
                            <>
                              <div class="p-gd-ring" style={ring(box)} aria-hidden="true" />
                              {!compact && tipProps && !gateForm && !ended && (
                                <Tooltip {...tipProps} h={{ ...tipProps.h, ...box }} />
                              )}
                            </>
                          )
                      : undefined
                }
                status={
                  sandbox && keyPages.length > 0
                    ? fmt(t.html as unknown as Record<string, string>, 'keyPages', {
                        seen: keyPages.filter((id) => seenPages.has(id)).length,
                        total: keyPages.length,
                      })
                    : undefined
                }
              />
            </HtmlWindow>
          ) : step.kind === 'image' && step.image ? (
            <>
              <TabWindow
                tabs={tabs}
                changed={newTab}
                frame={mobile ? { ...DEFAULT_FRAME, style: 'none' } : theme.frame}
                title={m.title}
                ratio={(() => {
                  const c = croppedSize(step.image, asCrop(step.options.crop));
                  return c.width / c.height;
                })()}
              >
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
                  missing={{ text: t.imgMissing, retry: t.retry }}
                  autoZoom={autoZoom && !fullShot}
                  free={spotOff ? null : m.spotlight}
                />
              </TabWindow>
              {autoZoom && (
                <button type="button" class="p-autozoom" onClick={() => setFullShot((f) => !f)}>
                  {fullShot ? <ZoomIn {...ICON} size={16} /> : <Expand {...ICON} size={16} />}
                  {fullShot ? t.zoomOnSpot : t.seeFullScreen}
                </button>
              )}
            </>
          ) : win ? (
            <>
              {backdrop !== null ? (
                <ImageStep
                  key={`bg-${m.steps[backdrop]!.id}`}
                  step={m.steps[backdrop]!}
                  sub={sub}
                  onHotspot={onHotspot}
                  onCta={onCta}
                  dimmed
                />
              ) : (
                <div
                  class="p-popup-bg p-dwin-plain"
                  style={{
                    background: step.options.background === 'color' ? step.options.bgColor : undefined,
                  }}
                  aria-hidden="true"
                />
              )}
              {!winClosed && (
                <div class="p-dwin-veil">
                  <div
                    ref={winBox}
                    class={`p-dwin${step.image ? '' : ' p-dwin--text'}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`p-step-title-${step.id}`}
                    onKeyDown={(e) => {
                      // Focus piégé : Tab boucle dans la fenêtre
                      if (e.key !== 'Tab') return;
                      const f = [
                        ...(winBox.current?.querySelectorAll<HTMLElement>(
                          'button:not(:disabled), a[href], [tabindex="0"]',
                        ) ?? []),
                      ];
                      if (!f.length) return;
                      const first = f[0]!;
                      const lastEl = f[f.length - 1]!;
                      const at = f.indexOf(document.activeElement as HTMLElement);
                      if (e.shiftKey && at <= 0) {
                        e.preventDefault();
                        lastEl.focus();
                      } else if (!e.shiftKey && at === f.length - 1) {
                        e.preventDefault();
                        first.focus();
                      }
                    }}
                  >
                    {step.image && (
                      <div class="p-dwin__img">
                        <img
                          src={step.image.url}
                          alt={sub(step.options.imageAlt)}
                          aria-hidden={step.options.imageAlt ? undefined : true}
                          draggable={false}
                        />
                      </div>
                    )}
                    <div class="p-dwin__body">
                      <span class="p-dwin__count">
                        {fmt(t as unknown as Record<string, string>, 'stepOf', {
                          n: index + 1,
                          total: m.steps.length,
                        })}
                      </span>
                      <h2 id={`p-step-title-${step.id}`} class="p-step-h" tabIndex={-1}>
                        {sub(step.title)}
                      </h2>
                      {step.body && (
                        <div class="p-rich" dangerouslySetInnerHTML={{ __html: html(step.body) }} />
                      )}
                      <VoiceLine />
                      <div class="p-dwin__foot" ref={winFoot}>
                        <span class="p-dwin__hint">{t.escToClose}</span>
                        <div class="p-dwin__btns">
                          {index > 0 && (
                            <button class="p-btn p-btn-ghost" onClick={() => go(index - 1)}>
                              {t.prev}
                            </button>
                          )}
                          <button
                            class="p-btn p-btn-primary"
                            onClick={() => (last ? (m.quiz ? openQuiz() : finish()) : next())}
                            autoFocus
                          >
                            {step.options.buttonLabel ? sub(step.options.buttonLabel) : t.next}
                            <ChevronRight {...ICON} size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
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
                  style={{
                    background: step.options.background === 'color' ? step.options.bgColor : undefined,
                  }}
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
                <VoiceLine />
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
                    <>
                      {fromCenter && (
                        <CenterNext from={fromCenter} demoId={m.demoId} done={completed.current} t={t} />
                      )}
                      <button
                        class={
                          fromCenter
                            ? 'p-link p-link--muted'
                            : `p-btn ${step.cta || !endText ? 'p-btn-ghost' : 'p-btn-secondary'}`
                        }
                        onClick={() => go(0)}
                      >
                        <RotateCcw {...ICON} size={16} />
                        {t.restart}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
          {ended && <div class="p-scrim" aria-hidden="true" />}
          {ended && (
            <ModalBox class="p-card p-end" labelledby="p-end-title">
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
                {fromCenter && (
                  <CenterNext from={fromCenter} demoId={m.demoId} done={completed.current} t={t} />
                )}
                {m.cta && (
                  <button
                    class={`p-btn ${fromCenter ? 'p-btn-ghost' : 'p-btn-primary'}`}
                    onClick={() => onCta(m.cta!.url, m.cta!.label)}
                    autoFocus={!fromCenter}
                  >
                    {sub(m.cta.label)}
                    <ExternalLink {...ICON} size={16} />
                  </button>
                )}
                <button
                  class={
                    fromCenter ? 'p-link p-link--muted' : `p-btn ${m.cta ? 'p-btn-ghost' : 'p-btn-secondary'}`
                  }
                  onClick={() => go(0)}
                  autoFocus={!m.cta && !fromCenter}
                >
                  <RotateCcw {...ICON} size={16} />
                  {t.restart}
                </button>
              </div>
            </ModalBox>
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
              rich={(x) => richTextToHtml(x, { values, defaults })}
              onSkip={() => markGate(gateForm.id)}
              onSubmit={async (data) => {
                await onLead(gateForm, data);
                setFormVars((v) => ({ ...v, ...variablesFromForm(data.fields) }));
                tracker.track('form_submit', { stepId: step.id, stepIndex: index });
                markGate(gateForm.id);
              }}
            />
          )}
        </main>

        {needles.length > 0 && <GlossaryTip root={rootRef} terms={glossary} t={t} />}
        {glossOpen && <GlossaryDrawer terms={presentTerms} t={t} onClose={() => setGlossOpen(false)} />}
        {infoOpen && <InfoDialog t={t} privacyUrl={m.privacyUrl} onClose={() => setInfoOpen(false)} />}

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

        {voice && (
          <>
            <audio ref={voiceRef} src={voice.src} preload="auto" aria-label={t.voice.label} />
            {voiceCc && voice.transcript && (
              <p class="p-voice-cc" lang={locale}>
                {sub(voice.transcript)}
              </p>
            )}
          </>
        )}
        {/* PY-3 : une pilule centrée : ←, progression, « n / N », →, séparateur, langue, plein écran */}
        <nav
          class="p-controls"
          aria-label={t.nav}
          inert={!!gateForm || ended || winOpen}
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
            <div style={{ transform: `translateX(${(view === 'quiz' ? 100 : progress) - 100}%)` }} />
          </div>
          <span class="p-count" aria-hidden="true">
            {view === 'quiz' ? t.quiz.label : `${index + 1} / ${m.steps.length}`}
          </span>
          {win && winClosed && (
            <button
              ref={winPill}
              class="p-dwin-reopen"
              onClick={() => setWinClosed(false)}
              aria-label={t.reopenWindow}
            >
              <AppWindow {...ICON} size={16} />
              <span>{t.reopenWindow}</span>
            </button>
          )}
          <button
            class="p-icon-btn"
            onClick={() => (last && !m.quiz ? finish() : next())}
            disabled={(last && !m.quiz && (ended || endText)) || view === 'quiz'}
            aria-label={t.nextStep}
          >
            <ArrowRight {...ICON} />
          </button>
          {voice && !voiceHosted && !soundOn && (
            <button class="p-sound-btn" onClick={enableSound}>
              <Volume2 {...ICON} />
              {t.voice.enableSound}
            </button>
          )}
          {voice && !voiceHosted && soundOn && !voice.autoplay && (
            <button class="p-icon-btn p-icon-btn--ghost" onClick={toggleVoice} aria-label={t.voice.listen}>
              <Volume2 {...ICON} />
            </button>
          )}
          {m.spotlight && (
            // EXT-02 §6.3 : le visiteur peut couper le projecteur (choix gardé pour la session de lecture)
            <button
              class="p-icon-btn p-icon-btn--ghost p-freespot-btn"
              onClick={() => setSpotOff(!spotOff)}
              aria-pressed={!spotOff}
              aria-label={t.spotlight}
            >
              <Flashlight {...ICON} />
            </button>
          )}
          {voice && !voiceHosted && (
            <button
              class="p-icon-btn p-icon-btn--ghost p-cc"
              onClick={() => setVoiceCc(!voiceCc)}
              aria-pressed={voiceCc}
              aria-label={t.voice.captions}
              aria-keyshortcuts="C"
            >
              <Captions {...ICON} />
            </button>
          )}
          <span class="p-sep" aria-hidden="true" />
          <button
            class="p-icon-btn p-icon-btn--ghost p-lang"
            onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
            aria-label={t.language}
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
    </VoiceLineContext.Provider>
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

/**
 * MOTION-01 §3 « Lecteur : changement d'étape » : dernière capture affichée (étape image), gardée d'une
 * étape à l'autre pour le fondu croisé. L'étape suivante la superpose à la sienne et l'efface en 200 ms.
 */
let lastShot: { url: string; style: Record<string, string | number> | undefined; at: number } | null = null;

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
  missing,
  autoZoom,
  free = null,
}: {
  step: Step;
  /** EXT-02 §6.3 : projecteur libre de la démo (null : désactivé, ou coupé par le visiteur). */
  free?: FreeSpotlight | null;
  /** L38-11 : cadrage automatique autour du hotspot (petit écran) ; la bascule est sous la capture. */
  autoZoom?: boolean;
  /** L36 : capture introuvable (démo supprimée, réseau coupé) : message et bouton Réessayer. */
  missing?: { text: string; retry: string };
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
  // L36 : une capture qui ne charge pas laisse un message à sa place ; nouvel essai au clic ou au retour du
  // réseau (l'adresse a pu être renouvelée entre-temps). Pastilles et navigation restent utilisables.
  const [broken, setBroken] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!broken) return;
    const again = () => {
      setBroken(false);
      setTries((n) => n + 1);
    };
    addEventListener('online', again);
    return () => removeEventListener('online', again);
  }, [broken]);
  // L38-11 : sur petit écran, sans zoom réglé par l'auteur, la zone du premier hotspot est agrandie
  // (×2) pour que les libellés du logiciel restent lisibles ; « Voir tout l'écran » (sous la capture,
  // MOB-01 M5) revient à la capture entière. Sans animation si l'utilisateur réduit les animations.
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const h0 = step.hotspots[0];
  const auto = useMemo(
    () =>
      autoZoom && !step.zoom && !carry && h0
        ? {
            x: h0.x + h0.w / 2,
            y: h0.y + h0.h / 2,
            scale: 2,
            transition: reducedMotion ? ('instant' as const) : ('smooth' as const),
            keep: false,
          }
        : null,
    [autoZoom, step.zoom, carry, h0, reducedMotion],
  );
  const zoom = step.zoom ?? carry ?? auto;
  // Zoom repris de l'étape précédente, ou transition « Directe » : pas d'animation d'entrée
  const [zoomed, setZoomed] = useState((!step.zoom && !!carry) || (!!auto && reducedMotion));
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
  // MOTION-01 §6 : quand le zoom change, pastilles et bulle rejoignent leur place par `translate`
  // (même durée et même courbe que le calque zoomé), jamais par une transition de left/top. La zone du
  // projecteur change aussi de taille : elle reste masquée pendant le zoom, puis apparaît en fondu.
  const placed = useRef(new Map<Element, { x: number; y: number; w: number; h: number }>());
  const still = reducedMotion || zoom?.transition === 'instant';
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    const read = (name: string) => {
      const v = getComputedStyle(root).getPropertyValue(name).trim();
      return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : 0;
    };
    const ms = read('--p-motion-duration-zoom');
    const fade = read('--p-motion-duration-fast');
    const next = new Map<Element, { x: number; y: number; w: number; h: number }>();
    for (const el of root.querySelectorAll<HTMLElement>(
      ':scope > .p-beacon, :scope > .p-tip, :scope > .p-spotlight',
    )) {
      const now = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      const was = placed.current.get(el);
      const zone = el.classList.contains('p-spotlight');
      const moved =
        !!was && (was.x !== now.x || was.y !== now.y || (zone && (was.w !== now.w || was.h !== now.h)));
      if (was && moved && !still && ms > 0) {
        if (zone)
          el.animate([{ opacity: 0 }, { opacity: 0, offset: ms / (ms + fade) }, { opacity: 1 }], {
            duration: ms + fade,
            easing: 'linear',
          });
        else
          el.animate([{ translate: `${was.x - now.x}px ${was.y - now.y}px` }, { translate: '0px 0px' }], {
            duration: ms,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
            composite: 'add',
          });
      }
      next.set(el, now);
    }
    placed.current = next;
  });

  // L25-04/05 : animation de l'étape (saisie ou défilement), jouée avant la pastille et la bulle
  const anim = dimmed ? undefined : step.options.animation;
  const fp = step.options.fullPage;
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const typed = anim?.type === 'typing' && anim.field ? sub(anim.text) : null;
  // L25-02 : capture recadrée (la page entière ne l'est pas : pas de défilement sur une capture recadrée)
  const crop = asCrop(step.options.crop);
  const shown = croppedSize(img, crop);
  // Fondu croisé : la capture de l'étape quittée (à l'instant) reste au-dessus de la nouvelle, puis
  // s'efface dès que la nouvelle est chargée. Jamais au premier affichage ni en mouvement réduit.
  const [leaving, setLeaving] = useState(() =>
    !dimmed && !reducedMotion && lastShot && lastShot.url !== img.url && Date.now() - lastShot.at < 1500
      ? { url: lastShot.url, style: lastShot.style, go: false }
      : null,
  );
  // Étape atteinte depuis une autre (pas le premier affichage) : la bulle entre en fondu
  const [stepChange] = useState(() => !dimmed && !reducedMotion && !!lastShot && lastShot.url !== img.url);
  useEffect(() => {
    if (dimmed) return;
    const mine = { url: img.url, style: cropImageStyle(crop) as Record<string, string | number> | undefined };
    lastShot = { ...mine, at: Date.now() };
    // L'étape est quittée : l'heure du départ borne le fondu (pas de capture d'il y a longtemps)
    return () => {
      lastShot = { ...mine, at: Date.now() };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la capture de l'étape ne change pas
  }, [img.url, dimmed]);
  useEffect(() => {
    if (!leaving) return;
    // Capture qui ne charge pas : l'ancienne ne reste pas indéfiniment
    const id = window.setTimeout(() => setLeaving(null), 1500);
    return () => window.clearTimeout(id);
  }, [leaving]);
  const scroll = anim?.type === 'scroll' && fp?.url && !crop ? scrollPlan(fp, anim) : null;
  const animated = !reduced && (typed !== null || (scroll !== null && scroll.distance > 0));
  const [phase, setPhase] = useState<'run' | 'go' | 'done'>(animated ? 'run' : 'done');
  const [chars, setChars] = useState(animated ? 0 : Number.MAX_SAFE_INTEGER);
  useEffect(() => {
    if (phase === 'done') return;
    if (typed !== null && anim?.type === 'typing') {
      const total = [...typed].length;
      let n = 0;
      const id = setInterval(() => {
        n += 1;
        setChars(n);
        if (n >= total) {
          clearInterval(id);
          setPhase('done');
        }
      }, TYPING_MS[anim.speed]);
      return () => clearInterval(id);
    }
    if (scroll && anim?.type === 'scroll') {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('go')));
      const end = setTimeout(() => setPhase('done'), anim.duration * 1000 + 120);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(end);
      };
    }
    setPhase('done');
    return undefined;
    // L'animation se joue une fois, à l'arrivée sur l'étape
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const playing = phase !== 'done';

  // EXT-02 §6.3 : projecteur libre. Le halo suit le pointeur (souris) ; au clavier, au toucher, avant le
  // premier mouvement et quand le pointeur quitte la capture, il se place sur l'élément de l'étape.
  // Étape sans hotspot : pas de voile. Le style Spotlight des hotspots est alors ignoré.
  const stage = useRef<HTMLDivElement>(null);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const [stageW, setStageW] = useState(0);
  const target = step.hotspots[0] ? screen(step.hotspots[0]) : null;
  const freeOn = !!free && !dimmed && !playing && !!target;
  useEffect(() => {
    const el = stage.current;
    if (!freeOn || !el) return;
    const fit = () => setStageW(el.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [freeOn]);
  const fixed = !!free?.fixedOnReducedMotion && reduced;
  const at =
    freeOn && !fixed && ptr
      ? ptr
      : target
        ? { x: target.x + target.w / 2, y: target.y + target.h / 2 }
        : null;
  const isSpot = (h: Hotspot) => !freeOn && h.style === 'spotlight';

  return (
    <div
      ref={stage}
      class={`p-stage${dimmed ? ' is-backdrop' : ''}${stepChange ? ' is-step-change' : ''}`}
      style={{ '--ratio': String(shown.width / shown.height) }}
      onPointerMove={
        freeOn && !fixed
          ? (e) => {
              if (e.pointerType !== 'mouse') return;
              const r = e.currentTarget.getBoundingClientRect();
              if (r.width && r.height)
                setPtr({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
            }
          : undefined
      }
      onPointerLeave={freeOn ? () => setPtr(null) : undefined}
    >
      <div
        class={`p-zoom${zoom?.transition === 'instant' ? ' is-instant' : ''}`}
        style={{ transform, transformOrigin: origin }}
      >
        {broken ? (
          <div class="p-img-missing" role="status">
            <ImageOff size={22} aria-hidden="true" />
            {missing && <p>{missing.text}</p>}
            {missing && (
              <button
                type="button"
                class="p-btn p-btn-secondary"
                onClick={() => {
                  setBroken(false);
                  setTries((n) => n + 1);
                }}
              >
                <RotateCw size={16} aria-hidden="true" />
                {missing.retry}
              </button>
            )}
          </div>
        ) : (
          <img
            key={tries}
            class="p-img"
            src={img.url}
            alt={alt}
            draggable={false}
            style={cropImageStyle(crop)}
            onLoad={() => setLeaving((l) => (l ? { ...l, go: true } : l))}
            onError={() => {
              setBroken(true);
              setLeaving(null);
            }}
          />
        )}
        {leaving && (
          <img
            class={`p-img-out${leaving.go ? ' is-go' : ''}`}
            src={leaving.url}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={leaving.style}
            onAnimationEnd={() => setLeaving(null)}
          />
        )}
        {scroll && fp && playing && (
          <div class="p-scroll" aria-hidden="true">
            <img
              src={fp.url}
              alt=""
              draggable={false}
              style={{
                transform: `translateY(${scrollOffset(fp, phase === 'go' ? scroll.to : scroll.from)})`,
                transitionDuration: `${anim?.type === 'scroll' ? anim.duration : 1.2}s`,
              }}
            />
          </div>
        )}
        {typed !== null && anim?.type === 'typing' && anim.field && (
          <>
            <div
              class={`p-type${playing ? ' is-typing' : ''}`}
              style={boxStyle(anim.field)}
              aria-hidden="true"
            >
              <span>{[...typed].slice(0, chars).join('')}</span>
              {playing && <i class="p-caret" />}
            </div>
            <span class="sr-only">{typed}</span>
          </>
        )}
        {/* Images ajoutées : dessinées dans l'aperçu ; incrustées dans la capture une fois publiées, il
            n'en reste alors que la place et le texte alternatif pour les lecteurs d'écran */}
        {(step.options.images ?? []).map((l, i) =>
          l.hidden ? null : l.url ? (
            <img
              key={`l${i}`}
              class="p-layer"
              src={l.url}
              alt={l.decorative ? '' : (l.alt ?? '')}
              draggable={false}
              style={{
                ...boxStyle(l),
                opacity: (l.opacity ?? 100) / 100,
                borderRadius: l.rounded
                  ? `${Math.min(50, (12 / 1280 / l.w) * 100)}% / ${Math.min(50, ((12 / 1280) * (shown.width / shown.height) * 100) / l.h)}%`
                  : undefined,
                filter: l.shadow ? 'drop-shadow(0 4px 12px rgb(16 24 40 / 0.18))' : undefined,
              }}
            />
          ) : l.alt && !l.decorative ? (
            <span key={`l${i}`} class="p-layer" role="img" aria-label={l.alt} style={boxStyle(l)} />
          ) : null,
        )}
        {step.blurs.map((b, i) => (
          <div
            key={i}
            class={`p-blur${b.style === 'solid' ? ' p-blur--solid' : b.style === 'pixels' ? ' p-blur--pixels' : ''}`}
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              ...maskStyle(b, img.width / img.height),
              ...(b.style === 'solid' ? { background: b.color } : {}),
            }}
          >
            {b.style === 'solid' && b.text ? <span>{b.text}</span> : null}
          </div>
        ))}
      </div>
      {freeOn && at && (
        <div
          class={`p-freespot${ptr && !fixed ? ' is-follow' : ''}${fixed ? ' is-fixed' : ''}`}
          style={{
            '--fx': `${Math.round(at.x * 10000) / 100}%`,
            '--fy': `${Math.round(at.y * 10000) / 100}%`,
            '--fr': `${Math.round(freeSpotlightRadius(free!.size, stageW || 1280))}px`,
            '--fd': String(free!.dim / 100),
          }}
          aria-hidden="true"
        />
      )}
      {!dimmed && !playing && step.hotspots.some(isSpot) && (
        <svg class="p-veil" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path fill-rule="evenodd" d={spotlightVeilPath(step.hotspots.filter(isSpot).map(screen))} />
        </svg>
      )}
      {!dimmed &&
        !playing &&
        step.hotspots.map((h) =>
          isSpot(h) ? (
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
      {!dimmed && !playing && tip && (tip.h.title || tip.h.body || tip.h.cta) && (
        <Tooltip
          {...tip}
          {...(isSpot(tip.h)
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
 * L25-03 : cadre du navigateur autour de la capture (style, barre d'adresse, onglets, boutons de
 * fenêtre), réglé pour la démo. L25-06 : onglets de la capture, celui de l'étape actif ; au passage à
 * un autre onglet, l'onglet s'active puis la capture apparaît (sans animation si le visiteur en
 * demande moins). Manifeste sans cadre (avant L25) : barre seulement s'il y a des onglets.
 */
function TabWindow({
  tabs,
  changed,
  ratio,
  frame,
  title,
  children,
}: {
  tabs: { tabs: { n: number; title: string }[]; active: number };
  changed: boolean;
  ratio: number;
  frame?: Frame;
  title: string;
  children: ComponentChildren;
}) {
  const f = frame ?? (tabs.tabs.length ? { ...DEFAULT_FRAME, addressBar: false } : null);
  if (!f || f.style === 'none') return <>{children}</>;
  const minimal = f.style === 'minimal';
  const list = tabs.tabs.length ? tabs.tabs : f.tabs ? [{ n: 1, title: f.tabTitle || title }] : [];
  const active = tabs.tabs.length ? tabs.active : 1;
  const withTabs = !minimal && list.length > 0;
  const dots = f.windowButtons && !minimal && (
    <span class="p-tabs-dots">
      <i />
      <i />
      <i />
    </span>
  );
  const address = f.addressBar && <span class="p-addr">{f.address}</span>;
  const bar = minimal ? 26 : (withTabs ? 36 : 0) + (f.addressBar || !withTabs ? (withTabs ? 30 : 36) : 0);
  return (
    <div
      class={`p-win p-win--${f.style}${changed ? ' is-switch' : ''}`}
      style={{ '--ratio': String(ratio), '--bar': `${bar}px` }}
    >
      <div class="p-chrome" aria-hidden="true">
        {withTabs ? (
          <>
            <div class="p-tabs">
              {dots}
              {list.map((x) => (
                <span key={x.n} class={`p-tab${x.n === active ? ' is-active' : ''}`}>
                  <span class="p-tab-fav" />
                  <span class="p-tab-t">{x.title || `#${x.n}`}</span>
                </span>
              ))}
            </div>
            {f.addressBar && <div class="p-addr-row">{address}</div>}
          </>
        ) : (
          <div class="p-tabs p-tabs--addr">
            {dots}
            {address}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Pastille pulsée de 20 px au centre de la zone ; cible cliquable de 44 px minimum (P2). */
function Beacon({ h, label, onClick }: { h: Hotspot; label: string; onClick: () => void }) {
  // L21-06 : sur mobile, une cible plus large que 44 px est entourée en entier (rectangle arrondi)
  const ref = useRef<HTMLButtonElement>(null);
  const [ring, setRing] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const stage = ref.current?.parentElement;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = h.w * stage.clientWidth;
      const hh = h.h * stage.clientHeight;
      setRing(w > 44 || hh > 44 ? { w: Math.max(44, w + 8), h: Math.max(44, hh + 8) } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [h.w, h.h]);
  return (
    <button
      ref={ref}
      class={`p-beacon ${h.pulse ? 'p-pulse' : ''}${ring ? ' is-wide' : ''}`}
      style={{
        ...beaconCenter(h),
        ...(ring ? { '--ring-w': `${Math.round(ring.w)}px`, '--ring-h': `${Math.round(ring.h)}px` } : {}),
      }}
      aria-label={label}
      onClick={onClick}
    >
      <span class="p-beacon-dot" />
    </button>
  );
}

/** Démo guidée : la page HTML prend le cadre de navigateur des captures ; en Sandbox, pas de cadre. */
function HtmlWindow({
  on,
  frame,
  title,
  ratio,
  children,
}: {
  on: boolean;
  frame?: Frame;
  title: string;
  ratio: number;
  children: ComponentChildren;
}) {
  if (!on) return <>{children}</>;
  return (
    <TabWindow tabs={{ tabs: [], active: 0 }} changed={false} frame={frame} title={title} ratio={ratio}>
      {children}
    </TabWindow>
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
      {/* EXT-02 §6.4 : lecteur de la voix dans la bulle, sous le texte */}
      <VoiceLine />
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
