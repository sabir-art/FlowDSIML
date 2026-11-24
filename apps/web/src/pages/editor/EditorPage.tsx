import { SettingsTab } from './panels/SettingsTab';
import { FormPanel } from './panels/FormPanel';
import { FormPreview } from './FormPreview';
import {
  CircleHelp,
  Clock,
  Copy,
  LayoutTemplate,
  Download,
  ListChecks,
  ImagePlus,
  Upload,
  Keyboard,
  PenLine,
  Presentation,
  Redo2,
  Search,
  Send,
  Share2,
  Undo2,
  Languages,
  Lightbulb,
  Pencil,
} from 'lucide-react';
import {
  EditorRail,
  SHORTCUT_ORDER,
  TOOL_KEY,
  TOOL_ORDER,
  ToolPanel,
  savedTool,
  type ToolId,
} from './EditorRail';
import { HotspotsTool } from './panels/HotspotsTool';
import { BlurModal } from './BlurModal';
import { SpotlightPanel } from './panels/SpotlightPanel';
import { AssistantPanel } from '../../components/ai/AssistantPanel';
import { SuggestionsPanel } from '../../components/ai/SuggestionsPanel';
import { TranslateDialog } from '../../components/ai/TranslateDialog';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useToast } from '../../components/Toast';
import { activityOf, type EditTable, type PresencePayload } from './presence/presence';
import { usePresenceCalm, usePresenceChannel } from './presence/usePresence';
import { CoBanner, PresenceStack, RemoteCursors } from './presence/PresenceUI';
import { useShowCursors } from './presence/showCursors';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../lib/errors';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useDemoEditor } from './useDemoEditor';
import { Canvas, type Tool } from './Canvas';
import { PreviewSwitch } from './vars/varPreview';
import { SandboxPlan } from './html/SandboxPlan';
import { ChecklistPreview } from './ChecklistPreview';
import { BrowserBar } from './capture/BrowserBar';
import { demoFrame } from './capture/FrameFields';
import { CropCanvas, CropPanel, cropDraftFor, type CropDraft } from './capture/Crop';
import { StepList } from './StepList';
import { useStepComments } from './comments/useStepComments';
import { CommentsDock, readDock, storeDock, type DockState } from './comments/CommentsDock';
import { useDockFit, useScrollable } from './comments/useDockFit';
import { useStageFlip } from './useStageFlip';
import { useAuth } from '../../auth/AuthProvider';
import { StepPanel } from './panels/StepPanel';
import { AbCanvasSwitch, asVariantB, useAbTest } from './ab/AbTest';
import { fontFaceCss } from '@flowdsiml/player-core';
import { themeSchema } from '@flowdsiml/manifest';
import { asSettings, asStepOptions, freeSpotlightOf } from './types';
import { ThemePanel } from './panels/ThemePanel';
import { buildDraftManifest, sandboxOf } from './draftManifest';
import type { Selection } from './types';
import { PublishButton } from './PublishButton';
import { useShareRules } from '../../lib/shareRules';
import { PreviewDialog } from './PreviewDialog';
import { ColumnGrip, useColumn, type ColumnBounds } from '../../components/ColumnGrip';

const STEPS_BOUNDS: ColumnBounds = { min: 232, max: 360, def: 264 };
/** Ancienne préférence (bouton de l'en-tête) : « 0 » voulait dire replié. */
function stepsClosedBefore() {
  try {
    return localStorage.getItem('fd.editor.steps') === '0';
  } catch {
    return false;
  }
}
import { PresentDialog } from '../present/PresentDialog';
import { FindBar } from './FindBar';
import { ShortcutsDialog, isMac } from './ShortcutsDialog';
import type { Manifest } from '@flowdsiml/manifest';
import '@flowdsiml/player-core/player-core.css';
import './editor.css';
import { Menu } from '../../components/Menu';
import { SaveTemplateDialog } from './SaveTemplateDialog';
import { LoadError, LoadStatus, SlowLine, useSkeleton } from '../../components/Skeleton';
import { EditorSkeleton, storeEditorGeometry } from './EditorSkeleton';
import { EditorNarrowView } from './EditorNarrow';
import { GuideBar } from './GuideBar';
import { useNarrow } from '../../lib/useNarrow';
import { useHelp } from '../../help/HelpProvider';
import { supabase } from '../../lib/supabase';
import { DatasetDialog } from './data/DatasetDialog';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import { BackButton, Select } from '@flowdsiml/ui';

// L32 : boîtes de dialogue chargées à l'ouverture (hors du chargement initial de la page)
const ExportDialog = lazy(() => import('../export/ExportDialog').then((m) => ({ default: m.ExportDialog })));
const DistributeDialog = lazy(() =>
  import('../share/DistributeDialog').then((m) => ({ default: m.DistributeDialog })),
);

type Zoom = 'fit' | '50' | '100';

const CrumbLink = (p: { to: string; className?: string; title?: string; children?: ReactNode }) => (
  <Link {...p} />
);

export function EditorPage() {
  const { t } = useTranslation();
  const { demoId = '' } = useParams();
  const { can, current: ws } = useWorkspace();
  const rules = useShareRules(ws?.id);
  const rawEditor = useDemoEditor(demoId);
  const { user } = useAuth();
  const toast = useToast();
  const comments = useStepComments(demoId, ws?.id, user?.id);

  // L22-08 : présence (canal privé demo:<id>), modifications des autres fusionnées champ par champ
  const presence = usePresenceChannel(demoId, user?.id);
  const others = usePresenceCalm(presence.store);
  const [showCursors, setShowCursors] = useShowCursors();
  const names: Record<string, string> = Object.fromEntries(
    Object.values(comments.authors).map((a) => [a.user_id, a.full_name || a.email]),
  );
  const replacePicker = useRef<HTMLInputElement>(null);
  /** Étape dont on remplace la capture (menu de l'étape) ; à défaut, l'étape affichée. */
  const replaceTarget = useRef<string | null>(null);
  const [stageDrop, setStageDrop] = useState(false);
  /** Mes dernières modifications par ligne et champ (pour signaler un écrasement). */
  const myEdits = useRef(new Map<string, number>());
  const noteEdit = (tb: EditTable, id: string, fields: string[]) => {
    const at = Date.now();
    for (const f of fields) myEdits.current.set(`${tb}:${id}:${f}`, at);
    if (fields[0]) presence.update({ e: { tb, id, f: fields[0], at }, t: at });
  };
  const editor = useMemo(
    () => ({
      ...rawEditor,
      updateStep: (id: string, patch: Parameters<typeof rawEditor.updateStep>[1]) => {
        noteEdit('steps', id, Object.keys(patch));
        rawEditor.updateStep(id, patch);
      },
      updateHotspot: (id: string, patch: Parameters<typeof rawEditor.updateHotspot>[1]) => {
        noteEdit('hotspots', id, Object.keys(patch));
        rawEditor.updateHotspot(id, patch);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawEditor],
  );
  const seenEdits = useRef(new Map<string, number>());
  useEffect(() => {
    for (const p of others) {
      const e = p.e;
      if (!e || (seenEdits.current.get(p.u) ?? 0) >= e.at) continue;
      const first = !seenEdits.current.has(p.u);
      seenEdits.current.set(p.u, e.at);
      if (first && Date.now() - e.at > 5000) continue; // modification ancienne, déjà dans le chargement
      const key = `${e.tb}:${e.id}:${e.f}`;
      const mine = myEdits.current.get(key);
      // Mes champs modifiés il y a moins de 3 s restent (enregistrement en cours)
      const keep = [...myEdits.current]
        .filter(([k, at]) => k.startsWith(`${e.tb}:${e.id}:`) && Date.now() - at < 3000)
        .map(([k]) => k.split(':')[2]!);
      void supabase
        .from(e.tb)
        .select('*')
        .eq('id', e.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) rawEditor.mergeRemote(e.tb, data as Record<string, unknown> & { id: string }, keep);
        });
      if (mine && e.at > mine && Date.now() - mine < 10 * 60_000) {
        myEdits.current.delete(key);
        toast(t('presence.conflict', { name: names[p.u] || t('presence.someone') }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [others]);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  // L25-02 : brouillon du recadrage (cadre et panneau)
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  // L25-04 : « Choisir un champ » du panneau Animation (clic suivant sur le canevas)
  useEffect(() => {
    const on = () => setTool('field');
    window.addEventListener('fd:pick-field', on);
    return () => window.removeEventListener('fd:pick-field', on);
  }, []);
  // L38-10 : « Étape suivante » de la voix off : étape suivante, sur sa première bulle s'il y en a une ;
  // sans bulle, l'outil « Voix off » de l'étape, pour enchaîner les enregistrements
  useEffect(() => {
    const on = () => {
      const i = Math.min(index + 1, editor.steps.length - 1);
      const next = editor.steps[i];
      if (!next || i === index) return;
      setIndex(i);
      const first = editor.hotspots
        .filter((h) => h.step_id === next.id)
        .sort((a, b) => a.position - b.position)[0];
      if (first) setSelection({ kind: 'hotspot', id: first.id });
      else {
        setSelection({ kind: 'step' });
        setPanel('voice');
      }
    };
    window.addEventListener('fd:next-step', on);
    return () => window.removeEventListener('fd:next-step', on);
  }, [index, editor.steps, editor.hotspots]);
  // L38-8 : « Ajouter un hotspot » du panneau Étape
  useEffect(() => {
    const on = () => setTool('hotspot');
    window.addEventListener('fd:add-hotspot', on);
    return () => window.removeEventListener('fd:add-hotspot', on);
  }, []);
  // L18 : police de la médiathèque (règle @font-face contrôlée)
  const fontCss = editor.demo
    ? fontFaceCss(themeSchema.parse(asSettings(editor.demo.settings).theme ?? {}))
    : '';
  // L18 : test A/B en cours de la démo
  const ab = useAbTest(demoId);
  const [selection, setSelection] = useState<Selection>({ kind: 'step' });
  /** Outils du rail visibles (Assistant : éditeurs), dans l'ordre (raccourcis Alt + 1 à 9). */
  const railOrder = TOOL_ORDER.filter((x) => x !== 'assistant' || can('demo.edit'));
  const [params] = useSearchParams();
  // L48-E §3 : outil du rail ouvert (un seul panneau) ; ANA-09 : ?tab=settings ouvre les Réglages
  const [panel, setPanelState] = useState<ToolId | null>(() =>
    params.get('tab') === 'settings' ? 'settings' : savedTool(),
  );
  // Retours client 21/11 §1 : panneau Commentaires sous le canevas. Un lien vers un commentaire
  // (?outil=commentaires, ?comment=) l'ouvre sans changer l'état retenu.
  const [dock, setDockState] = useState<DockState>(() => {
    const d = readDock();
    return params.get('outil') === 'commentaires' || params.get('comment') ? { ...d, open: true } : d;
  });
  const setDock = (next: (d: DockState) => DockState) =>
    setDockState((d) => {
      const n = next(d);
      storeDock(n);
      return n;
    });
  const toggleDock = () => setDock((d) => ({ ...d, open: !d.open }));
  const setPanel = (p: ToolId | null) => {
    setPanelState(p);
    if (p && p !== 'blur' && p !== 'assistant')
      try {
        localStorage.setItem(TOOL_KEY, p);
      } catch {
        /* préférence non gardée */
      }
    // Le titre du panneau prend le focus à l'ouverture ; l'Assistant donne le focus à son champ (L30-08)
    if (p)
      requestAnimationFrame(() =>
        (p === 'assistant'
          ? document.querySelector<HTMLElement>('[data-tool-panel="assistant"] textarea')
          : document.getElementById('ed-tool-title')
        )?.focus(),
      );
  };
  const panelRef = useRef(panel);
  panelRef.current = panel;
  // L26-02 : les articles « Sur cette page » de l'aide suivent l'outil ouvert
  const help = useHelp();
  const setHelpTab = help?.setEditorTab;
  const helpTab = panel === 'design' ? 'design' : panel === 'settings' ? 'settings' : 'step';
  useEffect(() => {
    setHelpTab?.(helpTab);
    return () => setHelpTab?.(null);
  }, [helpTab, setHelpTab]);
  // L48-E §4 : modale « Flouter des zones » (zone choisie à l'ouverture)
  const [blurOpen, setBlurOpen] = useState<{ index?: number } | null>(null);
  const readOnly = !can('demo.edit');
  const narrow = useNarrow(1024);
  const [previewManifest, setPreviewManifest] = useState<Manifest | null>(null);
  /**
   * COL-02 (COMP-01 §19) : colonne Étapes de 232 à 360 px (264 par défaut), repliée en rail de 48 px par la
   * poignée de son bord ; largeur et repli gardés sur ce navigateur (ancien choix « replié » repris).
   */
  const stepsCol = useColumn('fd.editor.stepscol', STEPS_BOUNDS, stepsClosedBefore());
  const [stepsDrag, setStepsDrag] = useState(false);
  const stepsCollapsed = stepsCol.closed;
  /** P1-1 : « Lire depuis ici » : étape de départ de l'aperçu. */
  const [previewStart, setPreviewStart] = useState<number | undefined>(undefined);
  // L12 : rechercher-remplacer (pastilles du rail) et modale des raccourcis
  const [findOpen, setFindOpen] = useState(false);
  const [findHits, setFindHits] = useState<Record<number, number>>({});
  const [keysOpen, setKeysOpen] = useState(false);
  const [zoom, setZoom] = useState<Zoom>('fit');
  // A8 (L20-02) : plan du Sandbox (démo de pages HTML reliées)
  const sandbox = editor.demo?.kind === 'sandbox';
  const [planView, setPlanView] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // L26-05 : enregistrer comme modèle
  const [savingTpl, setSavingTpl] = useState(false);
  // L16 : « Diffuser » (menu « … », aussi ouvert par #/demos/:id/distribute → ?distribute=1)
  const [translating, setTranslating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [distributing, setDistributing] = useState(() => params.get('distribute') === '1');
  // L22-02 : « Présenter » (aussi ouvert depuis le menu d'une démo par ?present=1)
  // L22-05 : lien d'une notification (?step=…&comment=…) → étape choisie une fois chargée
  const focusStep = params.get('step');
  const focusComment = params.get('comment');
  const [stepApplied, setStepApplied] = useState(false);
  useEffect(() => {
    if (stepApplied || !focusStep || !editor.steps.length) return;
    const i = editor.steps.findIndex((st) => st.id === focusStep);
    if (i >= 0) setIndex(i);
    setStepApplied(true);
  }, [stepApplied, focusStep, editor.steps]);
  const [presenting, setPresenting] = useState(() => params.get('present') === '1');
  // L38-8 : guidage après un import d'images (?guide=1) : outil Hotspot actif dès l'étape 1
  const [guide, setGuide] = useState(() => params.get('guide') === '1');
  useEffect(() => {
    if (guide) setTool('hotspot');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const navigate = useNavigate();
  const versionId = editor.demo?.current_version_id;
  useEffect(() => {
    if (!versionId) return setPublishedAt(null);
    void supabase
      .from('demo_versions')
      .select('published_at')
      .eq('id', versionId)
      .maybeSingle()
      .then(({ data }) => setPublishedAt(data?.published_at ?? null));
  }, [versionId]);

  const step = editor.steps[Math.min(index, editor.steps.length - 1)];
  // EXT-02 §6.3 : projecteur libre de la démo (aperçu dans le canevas quand l'outil est ouvert)
  const freeSpot = freeSpotlightOf(asSettings(editor.demo?.settings));
  // MEDIA-01 : remplacer la capture d'une étape (menu, bouton du panneau, dépôt sur la carte ou le canevas)
  const canDropImage = !readOnly && step?.kind === 'image';
  const replaceImage = (stepId: string, file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast(t('editor.replaceBadType'), undefined, { tone: 'warning' });
      return;
    }
    void editor.captureStep(stepId, file).then((r) => {
      if (r) toast(t('editor.importWarn'), undefined, { tone: 'warning' });
    });
  };
  // L25-02 : changer d'étape quitte le recadrage (le brouillon appartient à l'étape)
  useEffect(() => {
    setSelection((cur) => (cur.kind === 'crop' ? { kind: 'step' } : cur));
  }, [step?.id]);
  useEffect(() => {
    presence.update({ s: step?.id ?? null, t: Date.now() });
  }, [step?.id, presence]);
  useEffect(() => {
    let lastActive = Date.now();
    const active = () => {
      if (Date.now() - lastActive > 20_000) {
        lastActive = Date.now();
        presence.update({ t: lastActive });
      }
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.('.ed-tool')) return;
      lastActive = Date.now();
      presence.update({ a: activityOf(el.id), t: lastActive });
    };
    const onBlur = (e: FocusEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.ed-tool')) presence.update({ a: null });
    };
    const onMove = (e: PointerEvent) => {
      active();
      const frame = document.querySelector<HTMLElement>('.canvas-frame');
      const r = frame?.getBoundingClientRect();
      const inside =
        r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      presence.update({
        c: inside
          ? [+((e.clientX - r.left) / r.width).toFixed(3), +((e.clientY - r.top) / r.height).toFixed(3)]
          : null,
      });
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('keydown', active);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('keydown', active);
    };
  }, [presence]);
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);
  const stageInner = useRef<HTMLDivElement>(null);
  useDockFit(stageInner, dock.open, zoom === 'fit', [dock.height, step?.id, selection, step?.kind]);
  const stageScrolls = useScrollable(stageInner, [step?.id, dock.open, dock.height, zoom]);
  useEffect(() => {
    setFrameEl(document.querySelector<HTMLElement>('.canvas-frame'));
  }, [step?.id, rawEditor.loading, narrow]);
  const byStep: Record<string, PresencePayload[]> = {};
  for (const p of others) if (p.s) (byStep[p.s] ||= []).push(p);
  const firstBubble = step
    ? editor.hotspots.filter((h) => h.step_id === step.id).sort((a, b) => a.position - b.position)[0]?.id
    : undefined;
  const stepIndexOf = (id: string | null) => editor.steps.findIndex((st) => st.id === id);

  // Changement d'étape → sélection de l'étape. Sauf le formulaire de lead, qui se sélectionne en même
  // temps que l'étape qu'il précède, et une bulle de la nouvelle étape (« Étape suivante » de la voix
  // off ouvre l'étape sur sa première bulle, L38-10).
  useEffect(
    () =>
      setSelection((s) =>
        (s.kind === 'form' && editor.steps[index]?.gate_form_id === s.id) ||
        (s.kind === 'hotspot' &&
          editor.hotspots.find((h) => h.id === s.id)?.step_id === editor.steps[index]?.id)
          ? s
          : { kind: 'step' },
      ),
    [index], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selectedForm =
    selection.kind === 'form' ? editor.forms.find((f) => f.id === selection.id) : undefined;
  // MOTION-01 §2 : la scène suit l'ouverture et la fermeture des panneaux (après l'ajustement au dock)
  const panelOpen = !!(selectedForm || (panel && panel !== 'blur'));
  useStageFlip(stageInner, `${panelOpen ? 1 : 0}|${dock.open ? 1 : 0}|${zoom}`);
  // Le panneau n'entre en mouvement qu'après un geste : jamais d'animation au premier affichage
  const [panelMoves, setPanelMoves] = useState(false);
  // L48-E §3 : lien avec le canevas. Un point choisi ouvre « Points d'intérêt » ; une zone floutée
  // ouvre la modale du flou sur cette zone ; le recadrage a son panneau.
  useEffect(() => {
    if (selection.kind === 'hotspot') setPanelState('hotspots');
    else if (selection.kind === 'crop') setPanelState('crop');
    else if (selection.kind === 'blur') {
      setBlurOpen({ index: selection.index });
      setSelection({ kind: 'step' });
      setTool('select');
    }
  }, [selection]);

  // Raccourcis clavier : flèches pour naviguer, Suppr pour le hotspot sélectionné.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // L12 : raccourcis globaux, actifs même pendant la saisie
      if (mod && key === 'f' && !e.altKey) {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        !!(e.target as HTMLElement)?.isContentEditable;
      // §1 du 21/11 : Alt + C ouvre ou ferme les Commentaires, aussi depuis leur champ de saisie
      // (sauf sur Mac, où Option + C tape « ç »)
      if (e.altKey && !mod && !e.shiftKey && e.code === 'KeyC' && !(isMac && typing)) {
        e.preventDefault();
        toggleDock();
        return;
      }
      if (typing) return;
      // Ctrl Entrée : aperçu (hors saisie, où il sert à envoyer un commentaire)
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        setPreviewManifest(buildDraftManifest(editor, ws?.name ?? ''));
        return;
      }
      // Annuler / rétablir (le champ en cours de saisie garde son propre Ctrl Z)
      if (mod && key === 'z' && !readOnly) {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && key === 'y' && !readOnly) {
        e.preventDefault();
        editor.redo();
        return;
      }
      // L48-E §2 : Alt + 1 à 9 ouvre les outils du rail (jamais pendant la saisie, vérifié plus haut)
      if (e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) {
        const id = railOrder.filter((x) => SHORTCUT_ORDER.includes(x))[Number(e.code.slice(5)) - 1];
        if (id) {
          e.preventDefault();
          document.querySelector<HTMLButtonElement>(`.ed-rail button[data-tool="${id}"]`)?.click();
        }
        return;
      }
      if (mod || e.altKey) return;
      // Raccourcis à une lettre : jamais pendant la saisie (vérifié plus haut)
      if (e.key === '?') {
        e.preventDefault();
        setKeysOpen(true);
        return;
      }
      // L17 : pas d'outil hotspot ni flou sur une étape Avant / Après
      if (
        !readOnly &&
        (key === 'h' || key === 'b') &&
        step?.kind !== 'before_after' &&
        step?.kind !== 'video'
      ) {
        // L48-E §4 : B ouvre la modale du flou (capture seulement)
        if (key === 'b') {
          if (step?.kind === 'image') setBlurOpen({});
          return;
        }
        setTool((cur) => (cur === 'hotspot' ? 'select' : 'hotspot'));
        return;
      }
      const target = e.target as HTMLElement;
      if (target?.closest?.('.cm, #fd-portal, .ed-rail')) return;
      // Flèches et Suppr d'un élément du canevas sont gérées par l'élément ; Échap reste global (L48-E §3)
      if (target?.closest?.('[data-canvas-item]') && e.key !== 'Escape') return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight')
        setIndex((i) => Math.min(i + 1, editor.steps.length - 1));
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.kind === 'hotspot' && !readOnly) {
        void editor.deleteHotspot(selection.id);
        setSelection({ kind: 'step' });
      }
      if (e.key === 'Escape') {
        setTool('select');
        setSelection({ kind: 'step' });
        // L48-E §3 : Échap ferme le panneau et rend le focus à l'outil
        if (panelRef.current && !document.querySelector('dialog[open]')) {
          const id = panelRef.current;
          setPanelState(null);
          requestAnimationFrame(() =>
            document.querySelector<HTMLButtonElement>(`.ed-rail button[data-tool="${id}"]`)?.focus(),
          );
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- railOrder suit les droits
  }, [editor, selection, readOnly, ws, step?.kind]);

  // L32 : squelette (même géométrie), erreur, délais (docs/ux/specs/l32-squelettes.md §3-4)
  const sk = useSkeleton(editor.loading);
  const ready = sk.phase === 'content' && !!editor.demo && !narrow;
  useEffect(() => {
    if (ready) storeEditorGeometry(demoId);
  }, [ready, demoId]);

  if (narrow)
    return <EditorNarrowView editor={editor} comments={comments} index={index} setIndex={setIndex} />;
  const backToDemos = (primary = false) => (
    <Link to="/" className={`fd-btn${primary ? ' fd-btn--primary' : ''}`}>
      {t('loading.backToDemos')}
    </Link>
  );
  if ((editor.loading || sk.phase !== 'content') && !(sk.timedOut && editor.loading))
    return (
      <EditorSkeleton
        demoId={demoId}
        showBlocks={sk.phase === 'skeleton'}
        status={<LoadStatus loading busy={t('loading.editor')} done="" longLoad={false} />}
        after={sk.slow && <SlowLine onRetry={() => void editor.reload()} />}
      />
    );
  if (editor.loadError || editor.loading)
    return (
      <EditorSkeleton demoId={demoId} showBlocks={false}>
        <LoadError
          title={t('loading.editorError')}
          body={t('loading.errorBody')}
          onRetry={() => void editor.reload()}
          extra={backToDemos()}
        />
      </EditorSkeleton>
    );
  // Démo introuvable ou accès retiré : même message (ne jamais révéler si elle existe)
  if (editor.notFound || !editor.demo)
    return (
      <EditorSkeleton demoId={demoId} showBlocks={false}>
        <LoadError
          title={t('loading.unavailableTitle')}
          body={t('loading.unavailableBody')}
          extra={backToDemos(true)}
        />
      </EditorSkeleton>
    );

  function preview(from?: number) {
    setPreviewStart(typeof from === 'number' ? from : undefined);
    setPreviewManifest(buildDraftManifest(editor, ws?.name ?? ''));
  }

  const safeIndex = Math.min(index, editor.steps.length - 1);
  // Modifications non publiées : démo modifiée après sa publication (ou jamais publiée)
  const unpublished =
    editor.demo.status !== 'published' ||
    (publishedAt !== null && Date.parse(editor.demo.updated_at) > Date.parse(publishedAt) + 2000);
  /** Auteur de la démo (ligne sous le titre), quand son nom est connu. */
  const author = editor.demo.created_by ? (names[editor.demo.created_by] ?? null) : null;
  // L48-E §2 : outils sans objet pour l'étape : visibles, désactivés, avec la raison
  const capOnly = t('editor.rail.why.capture');
  const noStep = step ? undefined : t('editor.rail.why.noStep');
  const why: Partial<Record<ToolId, string>> = step
    ? {
        cta: step.kind === 'before_after' || step.kind === 'video' ? t('editor.rail.why.cta') : undefined,
        // A8 : sur une page de Sandbox avec guide, les points sont les bulles du guide
        // A8 / L30-05 : sur une page HTML, les points sont les bulles posées sur un élément (guide du
        // Sandbox activé, ou étape de démo guidée qui porte déjà une bulle, générée depuis une capture HTML)
        hotspots:
          step.kind === 'image' ||
          (step.kind === 'html' &&
            (sandbox
              ? sandboxOf(editor.demo!.sandbox, editor.steps).guide
              : editor.hotspots.some((h) => h.step_id === step.id)))
            ? undefined
            : capOnly,
        next: asStepOptions(step.options).choices.length ? t('editor.rail.why.next') : undefined,
        blur: step.kind !== 'image' ? capOnly : undefined,
        zoom:
          step.kind === 'html' ? t('editor.rail.why.zoomHtml') : step.kind !== 'image' ? capOnly : undefined,
        crop: readOnly
          ? t('editor.rail.why.readOnly')
          : step.kind === 'html'
            ? t('editor.rail.why.cropHtml')
            : step.kind !== 'image' || !step.image_path
              ? capOnly
              : undefined,
        image: readOnly ? t('editor.rail.why.readOnly') : step.kind !== 'image' ? capOnly : undefined,
      }
    : {
        step: noStep,
        cta: noStep,
        hotspots: noStep,
        voice: noStep,
        next: noStep,
        blur: noStep,
        zoom: noStep,
        crop: noStep,
        image: noStep,
      };
  function closePanel() {
    if (selectedForm) return setSelection({ kind: 'step' });
    const id = panel;
    if (id === 'hotspots') setTool('select');
    if (id === 'crop' || id === 'hotspots') setSelection({ kind: 'step' });
    setPanelState(null);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`.ed-rail button[data-tool="${id}"]`)?.focus(),
    );
  }
  function toggleTool(id: ToolId) {
    setPanelMoves(true);
    // Retour client P1 du 21/11 : l'Assistant s'ouvre dans l'emplacement des panneaux, comme les autres
    if (id === 'assistant') setSuggesting(false);
    if (id === 'blur') return setBlurOpen({});
    if (id === panel && !selectedForm) return closePanel();
    if (selectedForm || panel === 'crop' || panel === 'hotspots') setSelection({ kind: 'step' });
    setTool(id === 'hotspots' ? 'hotspot' : 'select');
    if (id === 'crop' && step) {
      setCropDraft(cropDraftFor(step));
      setSelection({ kind: 'crop' });
    }
    setPanel(id);
  }
  function panelBody() {
    if (selectedForm)
      return (
        <FormPanel
          editor={editor}
          readOnly={readOnly}
          form={selectedForm}
          onBack={() => setSelection({ kind: 'step' })}
          onMove={(i) => {
            setSelection({ kind: 'form', id: selectedForm.id });
            setIndex(i);
          }}
        />
      );
    if (panel === 'design') return <ThemePanel editor={editor} readOnly={readOnly} />;
    if (panel === 'spotlight') return <SpotlightPanel editor={editor} readOnly={readOnly} />;
    if (panel === 'assistant')
      return ws && can('demo.edit') ? (
        <AssistantPanel
          editor={editor}
          ws={ws.id}
          stepIndex={Math.min(index, Math.max(0, editor.steps.length - 1))}
          onClose={closePanel}
        />
      ) : null;
    if (panel === 'settings')
      return (
        <SettingsTab
          editor={editor}
          readOnly={readOnly}
          showCursors={showCursors}
          onShowCursors={setShowCursors}
          onOpenForm={(i, id) => {
            setSelection({ kind: 'form', id });
            setIndex(i);
          }}
        />
      );
    if (!step || !panel) return <p className="help">{t('editor.empty')}</p>;
    const reason = why[panel];
    if (reason) return <p className="help ed-tool__why">{reason}</p>;
    if (panel === 'hotspots')
      return (
        <HotspotsTool
          editor={editor}
          step={step}
          selection={selection}
          setSelection={setSelection}
          readOnly={readOnly}
          onAdd={() => setTool('hotspot')}
        />
      );
    if (panel === 'crop')
      return selection.kind === 'crop' && cropDraft ? (
        <CropPanel
          editor={editor}
          step={step}
          draft={cropDraft}
          setDraft={setCropDraft}
          onClose={() => closePanel()}
        />
      ) : null;
    const section =
      panel === 'cta' || panel === 'voice' || panel === 'next' || panel === 'zoom' || panel === 'image'
        ? panel
        : 'step';
    return (
      <>
        {panel === 'image' && (
          <div className="sec">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-controls="editorpage-file"
              onClick={() => {
                replaceTarget.current = null;
                replacePicker.current?.click();
              }}
            >
              <ImagePlus aria-hidden="true" />
              {t('editor.toolReplace')}
            </button>
          </div>
        )}
        <StepPanel editor={editor} step={step} index={index} readOnly={readOnly} ab={ab} section={section} />
      </>
    );
  }

  return (
    <main className="mk ed" id="main" aria-busy="false">
      <LoadStatus loading={false} longLoad={sk.longLoad} busy="" done={t('loading.editorDone')} />
      {/* L25-09 : modale « Jeu de données » (Réglages ou graphique) */}
      <DatasetDialog editor={editor} readOnly={readOnly} />
      <Suspense fallback={null}>
        {exporting && demoId && <ExportDialog demoId={demoId} onClose={() => setExporting(false)} />}
      </Suspense>
      {savingTpl && demoId && (
        <SaveTemplateDialog
          demoId={demoId}
          demoTitle={editor.demo?.title ?? ''}
          onClose={() => setSavingTpl(false)}
          onSaved={() => {
            setSavingTpl(false);
            toast(t('templates.save.done'));
          }}
        />
      )}
      {suggesting && ws && can('demo.edit') && (
        <SuggestionsPanel
          editor={editor}
          ws={ws.id}
          onClose={() => setSuggesting(false)}
          onOpenStep={(id) => {
            const i = editor.steps.findIndex((st) => st.id === id);
            if (i >= 0) {
              setIndex(i);
              setSelection({ kind: 'step' });
              setPanel('step');
            }
          }}
        />
      )}
      {translating && ws && can('demo.edit') && (
        <TranslateDialog editor={editor} ws={ws.id} onClose={() => setTranslating(false)} />
      )}
      <Suspense fallback={null}>
        {distributing && demoId && can('demo.edit') && (
          <DistributeDialog demoId={demoId} onClose={() => setDistributing(false)} />
        )}
      </Suspense>
      {presenting && demoId && editor.steps.length > 0 && (
        <PresentDialog
          demoId={demoId}
          title={editor.demo.title || t('demos.untitled')}
          steps={editor.steps.map((st) => st.title ?? '')}
          onClose={() => setPresenting(false)}
        />
      )}
      {/* PAGE-01 §16.1 : variante éditeur de la barre commune ; le h1 de la page est dans la barre */}
      <header className="fd-page-header fd-page-header--editor ed-bar" data-tip-side="bottom">
        <h1 className="sr-only">
          {t('editor.pageTitle', { title: editor.demo.title || t('demos.untitled') })}
        </h1>
        {/* Lot 3 : retour « Démos », filet, titre modifiable sur place (crayon), puis auteur, statut et
            enregistrement sur une ligne de 12 px */}
        <div className="ed-bar__l">
          <BackButton to="/" label={t('demos.title')} ariaLabel={t('editor.backToDemos')} as={CrumbLink} />
          <span className="ed-vsep" aria-hidden="true" />
          {/* §18.6 : titre et ligne d'état forment un bloc (19 + 15 px, maquette du lot 3) */}
          <div className="ed-tt" data-gap-exempt="">
            <label className="ed-tt__h">
              <input
                className="ed-title"
                aria-label={t('editor.demoTitle')}
                maxLength={160}
                disabled={readOnly}
                value={editor.demo.title}
                /* Titre tronqué par « … » quand la place manque : l'infobulle le donne en entier */
                title={editor.demo.title}
                /* Le champ suit la longueur du titre : le crayon reste collé au texte */
                size={Math.max(4, Math.min(48, editor.demo.title.length + 1))}
                onChange={(e) => editor.updateDemo({ title: e.target.value })}
              />
              {!readOnly && <Pencil className="ed-tt__pen" size={16} aria-hidden="true" />}
            </label>
            {/* L48-E §6 : état en texte : auteur · statut · « Enregistré » */}
            <span className="ed-state" data-gap-exempt="">
              {author && (
                <>
                  <span className="ed-state__author">{author}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span
                className={`ed-state__st${editor.demo.status === 'published' && !unpublished ? ' is-pub' : ''}`}
              >
                <i aria-hidden="true" />
                {unpublished
                  ? editor.demo.status === 'published'
                    ? t('editor.unpublishedChanges')
                    : t('editor.notPublished')
                  : t(`status.${editor.demo.status}`)}
              </span>
              <span aria-hidden="true">·</span>
              <span role="status" aria-live="polite">
                {t(`editor.save_${editor.saveState === 'idle' ? 'saved' : editor.saveState}`)}
              </span>
            </span>
          </div>
        </div>
        {/* Lot 3 : onglets segmentés au centre. Édition et Aperçu basculent sur place ; Analytics et Leads
            ouvrent les pages de la démo */}
        <div className="ed-tabs">
          <div className="ed-tabs__modes" role="radiogroup" aria-label={t('editor.mode')}>
            {/* EDT-12 : le segmenté passe sur « Aperçu » pendant l'aperçu */}
            <button
              type="button"
              aria-checked={!previewManifest}
              role="radio"
              onClick={() => setPreviewManifest(null)}
            >
              {t('editor.modeEdit')}
            </button>
            <button
              type="button"
              aria-checked={!!previewManifest}
              role="radio"
              onClick={() => preview()}
              disabled={!editor.steps.length}
            >
              {t('editor.preview')}
            </button>
          </div>
          <Link to={`/demos/${demoId}/analytics`}>{t('nav.analytics')}</Link>
          <Link to={`/demos/${demoId}/analytics?indicateur=leads`}>{t('kpi.leads')}</Link>
        </div>
        <div className="ed-bar__r">
          {user && (
            <PresenceStack
              others={others}
              names={names}
              stepIndexOf={stepIndexOf}
              me={{ id: user.id, name: names[user.id] || user.email || '?' }}
              myStep={safeIndex}
              onGo={(i) => {
                setIndex(i);
                setSelection({ kind: 'step' });
              }}
            />
          )}
          {/* L12 : annuler / rétablir (Ctrl Z, Ctrl Maj Z) */}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={t('editor.undo')}
            title={`${t('editor.undo')} (${isMac ? '⌘' : 'Ctrl'} Z)`}
            disabled={readOnly || !editor.canUndo}
            onClick={() => editor.undo()}
          >
            <Undo2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={t('editor.redo')}
            title={`${t('editor.redo')} (${isMac ? '⌘' : 'Ctrl'} ${t('editor.keys.shift')} Z)`}
            disabled={readOnly || !editor.canRedo}
            onClick={() => editor.redo()}
          >
            <Redo2 aria-hidden="true" />
          </button>
          <Menu
            label={t('editor.more')}
            items={[
              // L48-E §6 : Présenter, Diffuser, Exporter, Traduire, Rédiger, Quiz, Rechercher ; puis l'aide
              {
                label: t('present.button'),
                icon: <Presentation />,
                disabled: !editor.steps.length,
                onSelect: () => setPresenting(true),
              },
              ...(can('demo.edit')
                ? [{ label: t('distribute.menu'), icon: <Send />, onSelect: () => setDistributing(true) }]
                : []),
              {
                label: t('export.menu'),
                icon: <Download />,
                // L27 : exports hors de l'app interdits par les règles de l'espace
                disabled: !rules.exports_allowed,
                hint: rules.exports_allowed ? undefined : t('rules.errExports'),
                onSelect: () => setExporting(true),
              },
              // L30-03 : copie traduite (Assistance IA)
              ...(can('demo.edit')
                ? [
                    {
                      label: t('ai.translate.menu'),
                      icon: <Languages />,
                      onSelect: () => setTranslating(true),
                    },
                  ]
                : []),
              // L30-02 : « Rédiger les textes » ouvre le menu Assistance IA de la première bulle de l'étape
              {
                label: t('editor.aiWriter'),
                icon: <PenLine />,
                disabled: !firstBubble,
                hint: firstBubble ? undefined : t('ai.write.noBubble'),
                onSelect: () => {
                  if (!firstBubble) return;
                  setSelection({ kind: 'hotspot', id: firstBubble });
                  window.setTimeout(
                    () =>
                      document
                        .querySelector<HTMLButtonElement>('.ai-write .menu-trigger, .ai-entry')
                        ?.focus(),
                    50,
                  );
                },
              },
              // L30-04 : suggestions de l'IA (l'ancienne ampoule de l'en-tête)
              ...(can('demo.edit') && ws
                ? [
                    {
                      label: t('ai.suggest.open_btn'),
                      icon: <Lightbulb />,
                      onSelect: () => {
                        if (panel === 'assistant') setPanelState(null);
                        setSuggesting(true);
                      },
                    },
                  ]
                : []),
              {
                label:
                  t('editor.quiz.open') + (editor.questions.length ? ` (${editor.questions.length})` : ''),
                icon: <ListChecks />,
                onSelect: () => navigate(`/demos/${demoId}/quiz`),
              },
              {
                label: t('editor.find.label'),
                icon: <Search />,
                end: <kbd className="menu-kbd">{isMac ? '⌘' : 'Ctrl'} F</kbd>,
                onSelect: () => setFindOpen(true),
              },
              'separator',
              {
                label: t('editor.shortcuts'),
                icon: <Keyboard />,
                end: <kbd className="menu-kbd">?</kbd>,
                onSelect: () => setKeysOpen(true),
              },
              ...(help
                ? [
                    {
                      label: t('help.open'),
                      icon: <CircleHelp />,
                      end: <kbd className="menu-kbd">F1</kbd>,
                      onSelect: () => help.toggle(),
                    },
                  ]
                : []),
              {
                label: t('editor.versions'),
                icon: <Clock />,
                disabled: true,
                end: <span className="menu-soon-text">{t('shell.soon')}</span>,
                onSelect: () => undefined,
              },
              ...(can('demo.edit')
                ? ([
                    'separator',
                    {
                      label: t('editor.duplicateDemo'),
                      icon: <Copy />,
                      onSelect: () =>
                        void supabase.rpc('duplicate_demo', { p_demo: demoId }).then(({ data }) => {
                          const id =
                            typeof data === 'string' ? data : (data as unknown as { id?: string } | null)?.id;
                          navigate(id ? `/demos/${id}/edit` : '/');
                        }),
                    },
                    {
                      label: t('templates.save.menu'),
                      icon: <LayoutTemplate />,
                      onSelect: () => setSavingTpl(true),
                    },
                  ] as const)
                : []),
            ]}
          />
          <Link className="btn btn-secondary btn-sm" to={`/demos/${demoId}/share`}>
            <Share2 aria-hidden="true" />
            {t('editor.share')}
          </Link>
          {can('demo.publish') && (
            <span className="ed-publish">
              <PublishButton
                editor={editor}
                republishLabel={t('publish.publish')}
                onReviewStep={(i) => {
                  setIndex(i);
                  setSelection({ kind: 'step' });
                  setPanel('step');
                }}
                onRename={() =>
                  requestAnimationFrame(() => {
                    const el = document.querySelector<HTMLInputElement>('.ed-title');
                    el?.focus();
                    el?.select();
                  })
                }
                onPlan={sandbox ? () => setPlanView(true) : undefined}
              />
            </span>
          )}
        </div>
      </header>
      {editor.lastError != null && (
        <div className="ed-error">
          <div className="alert alert-danger" role="alert">
            {errorMessage(t, editor.lastError)}
          </div>
        </div>
      )}
      <div
        className={`ed-body${stepsDrag ? ' is-col-drag' : ''}`}
        style={{ '--rail-w': `${stepsCol.width}px` } as CSSProperties}
      >
        <nav
          id="etapes"
          className={`rail${stepsCollapsed ? ' rail--collapsed' : ''}`}
          aria-label={t('editor.steps')}
        >
          <StepList
            collapsed={stepsCollapsed}
            editor={editor}
            current={index}
            onSelect={(i) => {
              setIndex(i);
              setSelection({ kind: 'step' });
            }}
            readOnly={readOnly}
            onPlayFrom={(i) => preview(i)}
            onReplaceImage={(i, file) => {
              const s = editor.steps[i];
              if (!s) return;
              if (file) return replaceImage(s.id, file);
              replaceTarget.current = s.id;
              replacePicker.current?.click();
            }}
            onEdit={(i) => {
              setIndex(i);
              setSelection({ kind: 'step' });
              setPanel('step');
            }}
            findHits={findOpen ? findHits : undefined}
            openComments={comments.openByStep}
            presence={byStep}
            presenceNames={names}
            selectedFormId={selectedForm?.id ?? null}
            onSelectForm={(i, id) => {
              setSelection({ kind: 'form', id });
              setIndex(i);
            }}
          />
        </nav>
        <ColumnGrip
          controls="etapes"
          width={stepsCol.width}
          closed={stepsCollapsed}
          bounds={STEPS_BOUNDS}
          labels={{
            collapse: t('editor.collapseSteps'),
            expand: t('editor.expandSteps'),
            width: t('editor.stepsWidth'),
          }}
          onWidth={stepsCol.setWidth}
          onClosed={stepsCol.setClosed}
          onDragging={setStepsDrag}
        />
        <section
          className={`stage${stageDrop ? ' is-file-over' : ''}`}
          aria-label={t('editor.canvas')}
          id="canvas"
          // MEDIA-01 : une image déposée sur le canevas remplace la capture de l'étape affichée
          onDragOver={(e) => {
            if (!canDropImage || !e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setStageDrop(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setStageDrop(false);
          }}
          onDrop={(e) => {
            if (!canDropImage || !e.dataTransfer.files.length) return;
            e.preventDefault();
            setStageDrop(false);
            if (step) replaceImage(step.id, e.dataTransfer.files[0]!);
          }}
        >
          {stageDrop && (
            <span className="fd-drop__veil stage-drop" aria-hidden="true">
              <Upload />
              {t('dropzone.dropBlock')}
            </span>
          )}
          <div className="row stage-head">
            <span className="t-caption muted">
              {selectedForm
                ? `${t('editor.leadForm')} · ${t('editor.form.beforeStepShort', { n: safeIndex + 1 })}`
                : step
                  ? `${t('editor.stepN', { n: safeIndex + 1 })} · ${step.title || t('editor.untitled')}`
                  : ''}
            </span>
            <span className="grow" />
            {sandbox && (
              <div
                className="segmented stage-view"
                role="radiogroup"
                aria-label={t('editor.sandbox.viewLabel')}
              >
                {(['page', 'plan'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={(v === 'plan') === planView}
                    onClick={() => setPlanView(v === 'plan')}
                  >
                    {v === 'plan' ? t('editor.sandbox.viewPlan') : t('editor.sandbox.viewPage')}
                  </button>
                ))}
              </div>
            )}
            <Select
              size="sm"
              className="stage-zoom"
              aria-label={t('editor.zoom')}
              value={zoom}
              onChange={(e) => setZoom(e.target.value as Zoom)}
            >
              <option value="fit">{t('editor.zoomFit')}</option>
              <option value="50">50 %</option>
              <option value="100">100 %</option>
            </Select>
          </div>
          {findOpen && (
            <FindBar
              editor={editor}
              readOnly={readOnly}
              onHits={setFindHits}
              onClose={() => setFindOpen(false)}
              onGoto={(i, hotspotId) => {
                setIndex(i);
                setSelection(hotspotId ? { kind: 'hotspot', id: hotspotId } : { kind: 'step' });
                if (!hotspotId) setPanel('step');
              }}
            />
          )}
          {keysOpen && <ShortcutsDialog onClose={() => setKeysOpen(false)} />}
          <CoBanner others={others} stepId={step?.id ?? null} names={names} />
          {showCursors && (
            <RemoteCursors store={presence.store} stepId={step?.id ?? null} names={names} frame={frameEl} />
          )}
          <div className="stage-main">
            <div className="stage-inner" ref={stageInner} tabIndex={stageScrolls ? 0 : undefined}>
              {step && ab.test?.step_id === step.id && <AbCanvasSwitch ab={ab} />}
              {sandbox && planView ? (
                <SandboxPlan
                  editor={editor}
                  readOnly={readOnly}
                  onOpen={(i) => {
                    if (i >= 0) setIndex(i);
                    setSelection({ kind: 'step' });
                    setPlanView(false);
                  }}
                  onEditBubble={(i, id) => {
                    if (i >= 0) setIndex(i);
                    setSelection({ kind: 'hotspot', id });
                    setPlanView(false);
                  }}
                />
              ) : step ? (
                <>
                  {guide && !readOnly && (
                    <GuideBar
                      editor={editor}
                      index={safeIndex}
                      tool={tool}
                      onNext={(i) => {
                        setIndex(i);
                        setSelection({ kind: 'step' });
                        setTool('hotspot');
                      }}
                      onHide={() => setGuide(false)}
                    />
                  )}
                  {step.kind === 'html' && <div id="html-crumbs-slot" className="html-crumbs-slot" />}
                  <PreviewSwitch
                    visible={
                      /\{\{/.test(step.title + step.body) ||
                      editor.hotspots.some((h) => h.step_id === step.id && /\{\{/.test(h.title + h.body))
                    }
                  />
                  <div className={`frame fd-player-scope frame--${zoom}`}>
                    {step.kind !== 'html' && <ChecklistPreview editor={editor} index={safeIndex} />}
                    {/* L18 : police de la médiathèque appliquée au canevas, comme dans le lecteur */}
                    {fontCss && <style>{fontCss}</style>}
                    <BrowserBar
                      steps={editor.steps}
                      index={safeIndex}
                      frame={demoFrame(editor)}
                      demoTitle={editor.demo?.title ?? ''}
                    />
                    <div className="shot">
                      {selection.kind === 'crop' && cropDraft && step.kind === 'image' ? (
                        <CropCanvas
                          step={step}
                          url={step.image_path ? editor.imageUrls[step.image_path] : undefined}
                          draft={cropDraft}
                          setDraft={setCropDraft}
                        />
                      ) : (
                        <Canvas
                          editor={editor}
                          step={step}
                          tool={tool}
                          setTool={setTool}
                          selection={selection}
                          setSelection={setSelection}
                          readOnly={readOnly}
                          onEditForm={() =>
                            step.gate_form_id && setSelection({ kind: 'form', id: step.gate_form_id })
                          }
                          hideFormChip={!!selectedForm}
                          freeSpot={panel === 'spotlight' && freeSpot.enabled ? freeSpot : null}
                          abPreview={
                            ab.test && ab.view === 'B' && ab.test.step_id === step.id && ab.test.hotspot_id
                              ? {
                                  hotspotId: ab.test.hotspot_id,
                                  title: asVariantB(ab.test.variant_b).title ?? '',
                                  body: asVariantB(ab.test.variant_b).body ?? '',
                                  cta: asVariantB(ab.test.variant_b).cta ?? null,
                                }
                              : null
                          }
                        />
                      )}
                      {selectedForm && <FormPreview form={selectedForm} editor={editor} />}
                    </div>
                  </div>
                  {step.kind === 'video' && <div id="video-tl-slot" className="video-tl-slot" />}
                </>
              ) : (
                <div className="muted">{t('editor.empty')}</div>
              )}
              {tool !== 'select' && <p className="muted canvas-hint">{t(`editor.hint_${tool}`)}</p>}
            </div>
          </div>
          <CommentsDock
            stepId={step?.id ?? null}
            stepIndex={safeIndex}
            api={comments}
            myId={user?.id}
            focusComment={focusComment}
            open={dock.open}
            height={dock.height}
            onToggle={toggleDock}
            onHeight={(height) => setDock((d) => ({ ...d, height }))}
          />
        </section>
        {/* L48-E §3 : panneau de l'outil actif (un seul à la fois), puis le rail d'outils */}
        {panelOpen && (
          <ToolPanel
            enter={panelMoves}
            id={selectedForm ? 'form' : panel!}
            title={selectedForm ? t('editor.leadForm') : t(`editor.rail.${panel}`)}
            onClose={closePanel}
          >
            {panelBody()}
          </ToolPanel>
        )}
        <EditorRail
          active={selectedForm ? null : panel}
          onToggle={toggleTool}
          disabled={why}
          hidden={can('demo.edit') ? [] : ['assistant']}
        />
        {blurOpen && step && step.kind === 'image' && (
          <BlurModal
            editor={editor}
            step={step}
            readOnly={readOnly}
            initial={blurOpen.index}
            onClose={() => setBlurOpen(null)}
          />
        )}
        {/* REV-06 : remplacer l'image de l'étape (image importée, signalée et comptée au bilan RGPD) */}
        <input
          ref={replacePicker}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son bouton */
          id="editorpage-file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          aria-label={t('editor.toolReplace')}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            const id = replaceTarget.current ?? step?.id;
            replaceTarget.current = null;
            if (f && id) replaceImage(id, f);
          }}
        />
      </div>
      <PreviewDialog
        manifest={previewManifest}
        startStep={previewStart}
        onClose={() => {
          setPreviewManifest(null);
          setPreviewStart(undefined);
        }}
        // EXT-02 §3.3 : l'aperçu se ferme sur l'étape sans zone, prête à recevoir un lien
        onAddZone={(stepId) => {
          const i = editor.steps.findIndex((s) => s.id === stepId);
          setPreviewManifest(null);
          setPreviewStart(undefined);
          if (i < 0) return;
          setIndex(i);
          setSelection({ kind: 'step' });
          setPanel('step');
          toast(t('editor.html.addZoneHint'));
        }}
      />
    </main>
  );
}
