import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { withRestLocale } from '../../i18n';
import {
  Archive,
  ArrowUpDown,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Download,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Layers,
  Lock,
  LayoutGrid,
  Link2,
  List,
  Pencil,
  Plus,
  Presentation,
  Search,
  Send,
  Share2,
  Tag,
  Trash2,
  User,
  Users,
  Map as MapIcon,
  Shapes,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Empty, PageHeader, Select, Status } from '@flowdsiml/ui';
import { NoMatch } from '../../components/empty/NoMatch';
import { ExtensionDialog } from '../../components/ExtensionDialog';
import { completionRate, contentType, countTrend, rateTrend, type ContentType } from '@flowdsiml/core';
import { TypeBadge } from '../../components/TypeBadge';
import { TrendBadge } from '../../components/kpi/KpiTabs';
import { supabase } from '../../lib/supabase';
import type { StepRow } from '../editor/types';
import { check, useAction } from '../../lib/useAction';
import { formatDateTime, formatNumber, formatRelativeShort } from '../../lib/format';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { LoadError, LoadStatus, SlowLine, useMainBusy, useSkeleton } from '../../components/Skeleton';
import { DemosSkeleton } from './DemosSkeleton';
import { Menu, type MenuItem } from '../../components/Menu';
import { useToast } from '../../components/Toast';
import { publicDemoUrl } from '../../lib/embed';
import { createDemoFromImages } from './importImages';
import { OnboardingCard, useOnboarding } from './OnboardingCard';
import { loadHome, type Stats } from './home';
import { useShareRules } from '../../lib/shareRules';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FilterMenu, ListToolbar } from '../../components/toolbar/ListToolbar';
import { CardTags, TagFilter, TagsDialog, useWorkspaceTags } from '../../components/Tags';
import './demos.css';
import { DEMO_DRAG, FolderColumn, type Scope } from './FolderColumn';
import { PanneauIcon } from '../../components/PanneauIcon';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { LazyNotificationBell } from '../../components/notifications/LazyNotificationBell';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const CrumbLink = (p: { to: string; className?: string; title?: string; children?: ReactNode }) => (
  <Link {...p} />
);

// L32 : boîtes de dialogue chargées à l'ouverture (hors du chargement initial de la page)
// L33 : boîtes ouvertes au clic, hors du premier rendu ; leur code est demandé une fois la page affichée
const newDemoChunk = () => import('./NewDemoDialog');
const templatesChunk = () => import('./TemplatesDialog');
const NewDemoDialog = lazy(() => newDemoChunk().then((m) => ({ default: m.NewDemoDialog })));
const TemplatesDialog = lazy(() => templatesChunk().then((m) => ({ default: m.TemplatesDialog })));
const FolderAccessDialog = lazy(() =>
  import('./FolderAccessDialog').then((m) => ({ default: m.FolderAccessDialog })),
);
const GenerateDialog = lazy(() =>
  import('../../components/ai/GenerateDialog').then((m) => ({ default: m.GenerateDialog })),
);

/** Vrai dès la première ouverture : la boîte reste ensuite montée (fermeture et retour du focus inchangés). */
function useMountedOnce(open: boolean) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return open || mounted;
}

const ExportDialog = lazy(() =>
  withRestLocale(() => import('../export/ExportDialog')).then((m) => ({ default: m.ExportDialog })),
);
const DistributeDialog = lazy(() =>
  withRestLocale(() => import('../share/DistributeDialog')).then((m) => ({ default: m.DistributeDialog })),
);

type Demo = Tables<'demos'>;
type FolderRow = Tables<'folders'>;
type Kpis = Stats;
type StatusFilter = 'all' | 'draft' | 'published';
type Sort = 'updated' | 'created' | 'title' | 'views';

type TypeFilter = 'all' | 'captures' | 'html';

/**
 * Page Démos ; L48-G §4 : la même page sert le Sandbox (/sandbox), filtrée sur kind = sandbox, avec ses
 * propres titres ; Démos regroupe les démos guidées (captures et HTML), avec un filtre Type et un badge.
 */
export function DemosPage({ sandbox = false }: { sandbox?: boolean }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, can } = useWorkspace();
  const ws = current!;
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const onb = useOnboarding({ deferred: true });
  // L32 : erreur de la requête de démarrage (carte d'erreur, « Réessayer »)
  const [loadError, setLoadError] = useState(false);
  const rules = useShareRules(ws.id);
  // L27-07 : démos bloquées par les règles (mot de passe exigé, aucun défini) : « Accès à régler »
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  /** L48-G : liens sans page de chaque Sandbox (même calcul que le plan, deadLinks). */
  const [deadCounts, setDeadCounts] = useState<Record<string, number>>({});
  const [htmlCounts, setHtmlCounts] = useState<Record<string, number>>({});
  /** L48-G §2 : type de contenu d'une démo de la liste. */
  const typeOf = (d: Demo): ContentType =>
    contentType(d, { total: stepCounts[d.id] ?? 0, html: htmlCounts[d.id] ?? 0 });
  const [ctype, setCtype] = useState<TypeFilter>('all');
  /** DSH-10 : date de la dernière publication, pour le badge « Modifiée ». */
  const [publishedAt, setPublishedAt] = useState<Record<string, string>>({});
  // L48-A §2 : entrée choisie dans l'adresse (?dossier={id}, ?vue=mes-demos, ?vue=archivees)
  const [params, setParams] = useSearchParams();
  const vue = params.get('vue');
  const scope: Scope =
    vue === 'mes-demos' ? 'mine' : vue === 'archivees' ? 'archived' : (params.get('dossier') ?? 'all');
  /** Dossier choisi (« none » : sans dossier), sinon « all ». */
  const folder = scope === 'mine' || scope === 'archived' ? 'all' : scope;
  const setFolder = (s: Scope) => {
    const next = new URLSearchParams(params);
    next.delete('vue');
    next.delete('dossier');
    if (s === 'mine') next.set('vue', 'mes-demos');
    else if (s === 'archived') next.set('vue', 'archivees');
    else if (s !== 'all') next.set('dossier', s);
    setParams(next, { replace: true });
  };
  /** Toutes les entrées hors Archivées excluent les démos archivées. */
  const inScope = (d: Demo, s: Scope = scope) =>
    s === 'archived'
      ? d.status === 'archived'
      : d.status !== 'archived' &&
        (s === 'all' ||
          (s === 'mine' ? d.created_by === user?.id : s === 'none' ? !d.folder_id : d.folder_id === s));
  // L48-A §3 : « Créé par » (tous, moi, ou un membre)
  const [author, setAuthor] = useState<'all' | 'me' | string>('all');
  const [people, setPeople] = useState<Array<{ user_id: string; full_name: string; email: string }>>([]);
  useEffect(() => {
    void supabase
      .rpc('list_members', { p_workspace: ws.id })
      .then(({ data }) =>
        setPeople((data ?? []) as Array<{ user_id: string; full_name: string; email: string }>),
      );
  }, [ws.id]);
  const byAuthor = (d: Demo) => author === 'all' || d.created_by === (author === 'me' ? user?.id : author);
  // L48-A §2 : colonne Dossiers au-dessus de 1 024 px ; repli gardé pour la personne
  const wide = useMediaQuery('(min-width: 1024px)');
  const colKey = `fd.folders.hidden.${user?.id ?? ''}`;
  const [colHidden, setColHidden] = useState(() => {
    try {
      return localStorage.getItem(colKey) === '1';
    } catch {
      return false;
    }
  });
  const hideCol = (h: boolean) => {
    setColHidden(h);
    try {
      localStorage.setItem(colKey, h ? '1' : '0');
    } catch {
      /* préférence non gardée */
    }
  };
  // Retours client 21/11 §2 : ≥ 1 280 px, colonne ou rail selon le choix gardé ; 1 024 à 1 279 px, rail
  // par défaut et tiroir de 280 px par-dessus le contenu (choix non gardé)
  const xl = useMediaQuery('(min-width: 1280px)');
  const [drawer, setDrawer] = useState(false);
  const colCollapsed = xl ? colHidden : !drawer;
  // Lot 2 : sous 1 024 px, la bascule « Dossiers » est dans la barre mobile et ouvre un tiroir
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById('topbar-slot')), []);
  const foldersBtn = useRef<HTMLButtonElement>(null);
  const toggleCol = useCallback(() => {
    if (xl) hideCol(!colHidden);
    else setDrawer((o) => !o);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hideCol ne change qu'avec colKey
  }, [xl, colHidden]);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [extension, setExtension] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('updated');
  // DSH-02 : affichage grille / liste, mémorisé dans ce navigateur
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('fd.demos.view') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const chooseView = (v: 'grid' | 'list') => {
    setView(v);
    try {
      localStorage.setItem('fd.demos.view', v);
    } catch {
      /* stockage indisponible */
    }
  };
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<Demo | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [distributing, setDistributing] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null);
  // L27-09 : accès par dossier (administrateurs ; ouvert à tous les espaces depuis L48-A)
  const [folderAccess, setFolderAccess] = useState<FolderRow | null>(null);
  const [hidden, setHidden] = useState<Record<string, number>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [pendingMove, setPendingMove] = useState<{ demoId: string; folderId: string; n: number } | null>(
    null,
  );
  const [moving, setMoving] = useState<Demo | null>(null);
  // L12-07 : étiquettes des démos (filtre, pastilles, menu de la carte)
  const tagStore = useWorkspaceTags(ws.id);
  // L52 §1 : filtre Étiquettes dans l'adresse (?etiquettes=id1,id2), combiné à ?dossier= et ?vue=
  // État local (la case suit le clic sans attendre la navigation), recopié depuis l'adresse quand elle change
  const urlTags = params.get('etiquettes') ?? '';
  const [tagFilter, setTagState] = useState<string[]>(() => urlTags.split(',').filter(Boolean));
  useEffect(() => setTagState(urlTags.split(',').filter(Boolean)), [urlTags]);
  const setTagFilter = (ids: string[]) => {
    setTagState(ids);
    const next = new URLSearchParams(params);
    if (ids.length) next.set('etiquettes', ids.join(','));
    else next.delete('etiquettes');
    setParams(next, { replace: true });
  };
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [tagging, setTagging] = useState<Demo | null>(null);
  const { error, run } = useAction();
  const editable = can('demo.edit');
  const [kpis, setKpis] = useState<{ cur: Kpis; prev: Kpis | null } | null>(null);

  const load = useCallback(async () => {
    // L32 : une seule lecture (dashboard_home) pour la liste, les dossiers, les indicateurs et les cartes
    let h;
    try {
      h = await loadHome({ id: ws.id });
    } catch {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    onb.provide(h.onboarding);
    setMemberCount(h.memberCount);
    setLockedIds(new Set(h.locked));
    // Liste et indicateurs affichés ensemble (aucun saut de mise en page au chargement)
    setFolders(h.folders);
    setHidden(h.hidden);
    setStats(Object.fromEntries(h.overview.map((r) => [r.demo_id, r])));
    setStepCounts(h.stepCounts);
    setHtmlCounts(h.htmlCounts);
    setPublishedAt(h.publishedAt);
    // L48-G §4 : Démos sans les Sandbox ; Sandbox seulement les Sandbox
    const list = h.demos.filter((d) => (d.kind === 'sandbox') === sandbox);
    setDemos(list);
    if (sandbox && list.length)
      void supabase
        .from('steps')
        .select('id, demo_id, kind, html_meta, html_ops')
        .in(
          'demo_id',
          list.map((d) => d.id),
        )
        .eq('kind', 'html')
        .then(async ({ data }) => {
          // Calcul du plan chargé à la demande (page Sandbox seulement)
          const { deadLinks } = await import('../editor/html/sandboxGraph');
          const by = new Map<string, StepRow[]>();
          for (const r of (data ?? []) as unknown as StepRow[])
            by.set(r.demo_id, [...(by.get(r.demo_id) ?? []), r]);
          setDeadCounts(
            Object.fromEntries(list.map((d) => [d.id, deadLinks(by.get(d.id) ?? [], d.sandbox).dead.length])),
          );
        });
    if (h.kpis.cur) setKpis({ cur: h.kpis.cur, prev: h.kpis.prev });
    else {
      // Repli sur la somme de workspace_overview si workspace_kpis manque
      const sum = (k: keyof Kpis) => h.overview.reduce((acc, r) => acc + Number(r[k] ?? 0), 0);
      setKpis({
        cur: {
          views: sum('views'),
          visitors: sum('visitors'),
          completions: sum('completions'),
          leads: sum('leads'),
        },
        prev: null,
      });
    }
    // Couvertures : URL signées après l'affichage de la liste
    const first = Object.entries(h.covers);
    if (first.length) {
      const signed = await supabase.storage.from('captures').createSignedUrls(
        first.map(([, path]) => path),
        3600,
      );
      const byPath = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]));
      setCovers(Object.fromEntries(first.map(([demoId, path]) => [demoId, byPath.get(path) ?? ''])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onb.provide est stable (useCallback)
  }, [ws.id]);

  useEffect(() => {
    setDemos(null);
    void load();
  }, [load]);
  const sk = useSkeleton(!demos || !onb.ready);
  // L32 : hauteur de la prise en main à la dernière visite (place réservée dans le squelette)
  const onbKey = `fd.onb.h.${ws.id}`;
  const onbHeight = useMemo(() => {
    try {
      return Number(localStorage.getItem(onbKey)) || 0;
    } catch {
      return 0;
    }
  }, [onbKey]);
  useEffect(() => {
    if (sk.phase !== 'content') return;
    const h = Math.round(document.querySelector('.onb-card')?.getBoundingClientRect().height ?? 0);
    try {
      localStorage.setItem(onbKey, String(h));
    } catch {
      /* stockage indisponible : pas de place réservée */
    }
  }, [sk.phase, onbKey, onb.state]);
  useMainBusy((!demos || !onb.ready || sk.phase !== 'content') && !loadError);
  const retry = () => {
    setLoadError(false);
    setDemos(null);
    void load();
  };

  const visible = useMemo(() => {
    const matchTags = (demoId: string) => {
      const own = new Set(tagStore.links.filter((l) => l.demo_id === demoId).map((l) => l.tag_id));
      return tagMode === 'all' ? tagFilter.every((x) => own.has(x)) : tagFilter.some((x) => own.has(x));
    };
    const needle = q.trim().toLowerCase();
    const list = (demos ?? []).filter(
      (d) =>
        inScope(d) &&
        byAuthor(d) &&
        (status === 'all' || d.status === status) &&
        (ctype === 'all' || typeOf(d) === ctype) &&
        (!needle || d.title.toLowerCase().includes(needle)) &&
        (tagFilter.length === 0 || matchTags(d.id)),
    );
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title, i18n.language));
    if (sort === 'created') return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === 'views')
      return [...list].sort((a, b) => (stats[b.id]?.views ?? 0) - (stats[a.id]?.views ?? 0));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inScope et byAuthor suivent scope, author, user
  }, [
    demos,
    scope,
    author,
    user,
    status,
    ctype,
    htmlCounts,
    stepCounts,
    q,
    sort,
    stats,
    i18n.language,
    tagFilter,
    tagMode,
    tagStore.links,
  ]);

  const [newOpen, setNewOpen] = useState(false);
  const [generating, setGenerating] = useState<{ folder: string | null } | null>(null);
  // REV-04 : « Démarrer » de l'onboarding arrive ici avec ?new=1 et ouvre « Nouvelle démo »
  useEffect(() => {
    if (params.get('new') !== '1') return;
    setNewOpen(true);
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);
  // L26-04 : bibliothèque de modèles (dossier choisi dans « Nouvelle démo »)
  const [tplFolder, setTplFolder] = useState<string | null | undefined>(undefined);
  const newMounted = useMountedOnce(newOpen);
  const tplMounted = useMountedOnce(tplFolder !== undefined);
  // L33 : code des boîtes « Nouvelle démo » et « Modèles » demandé une fois la page affichée
  useEffect(() => {
    const id = window.setTimeout(() => {
      void newDemoChunk();
      void templatesChunk();
    }, 2000);
    return () => window.clearTimeout(id);
  }, []);
  const openNew = () => setNewOpen(true);
  // NAV-03 : ⌘K (ou Ctrl K) place le focus dans la recherche du PageHeader
  const searchRef = useRef<HTMLInputElement>(null);
  /** Sous 768 px, la recherche est un bouton d'icône qui ouvre le champ à la place du titre. */
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const anyPublished = (demos ?? []).some((d) => d.status === 'published');

  async function moveDemo(demoId: string, target: string, undo = true) {
    const before = demos?.find((d) => d.id === demoId)?.folder_id ?? '';
    await run(async () => {
      check(
        await supabase
          .from('demos')
          .update({ folder_id: target || null })
          .eq('id', demoId),
      );
      await load();
      // L48-A §2 : « Annuler » remet la démo dans son dossier d'origine
      toast(
        t('toast.moved', { folder: folders.find((f) => f.id === target)?.name ?? t('demos.noFolder') }),
        undo
          ? { label: t('common.undo'), onClick: () => void moveDemo(demoId, before, false), durationMs: 8000 }
          : undefined,
      );
    });
  }
  /** Dépôt (glisser ou menu) : confirmation avant un dossier restreint (L27-09). */
  const requestMove = (demoId: string, target: string) => {
    if (demos?.find((d) => d.id === demoId)?.folder_id === (target || null)) return;
    if (target && (hidden[target] ?? 0) > 0) {
      setPendingMove({ demoId, folderId: target, n: hidden[target]! });
      return;
    }
    void moveDemo(demoId, target);
  };

  /** REV-06 : une démo à partir d'images (une étape par image), depuis « Nouvelle démo » ou la tuile. */
  async function importImages(files: File[], folderId: string | null) {
    const id = await run(async () =>
      createDemoFromImages({
        workspaceId: ws.id,
        userId: user!.id,
        folderId,
        title: t('demos.untitled'),
        files,
      }),
    );
    if (!id) return;
    setNewOpen(false);
    toast(t('editor.importWarnMany', { count: files.length }), undefined, { tone: 'warning' });
    // L38-8 : l'éditeur s'ouvre en mode guidé (outil Hotspot et aide)
    navigate(`/demos/${id}/edit?guide=1`);
  }

  async function createDemo(folderId: string | null = folder !== 'all' && folder !== 'none' ? folder : null) {
    const d = await run(async () =>
      check(
        await supabase
          .from('demos')
          .insert({
            workspace_id: ws.id,
            title: t('demos.untitled'),
            created_by: user!.id,
            folder_id: folderId,
          })
          .select()
          .single(),
      ),
    );
    if (d) navigate(`/demos/${d.id}/edit`);
  }

  async function saveFolder(e?: FormEvent) {
    e?.preventDefault();
    const name = (renaming ? renaming.name : (newFolder ?? '')).trim().slice(0, 80);
    if (!name) return;
    await run(async () => {
      if (renaming) check(await supabase.from('folders').update({ name }).eq('id', renaming.id));
      else
        check(
          await supabase.from('folders').insert({ workspace_id: ws.id, name, parent_id: newFolderParent }),
        );
      toast(renaming ? t('toast.folderRenamed') : t('toast.folderCreated', { name }));
      setRenaming(null);
      setNewFolder(null);
      await load();
    });
  }

  const scopeName =
    scope === 'all'
      ? null
      : scope === 'mine'
        ? t(sandbox ? 'sandboxPage.mine' : 'folders.mine')
        : scope === 'archived'
          ? t('folders.archived')
          : scope === 'none'
            ? t('demos.noFolder')
            : (folders.find((f) => f.id === scope)?.name ?? null);
  // L32 : squelette (même géométrie que la page), erreur et délais (docs/ux/specs/l32-squelettes.md)
  function pageHead(loading: boolean) {
    const root = sandbox ? t('sandboxPage.title') : t('demos.title');
    const searchLabel = t(sandbox ? 'sandboxPage.search' : 'demos.search');
    const dir = folders.find((f) => f.id === scope) ?? null;
    return (
      <PageHeader
        title={scopeName ?? root}
        /* NAV-03 : fil d'Ariane « Démos › {entrée} » ; le lien sans paramètre revient à toutes les démos */
        crumbs={scopeName ? [{ label: root, to: sandbox ? '/sandbox' : '/' }] : []}
        mobileBack={
          scopeName
            ? { to: sandbox ? '/sandbox' : '/', ariaLabel: t('folders.backTo', { page: root }) }
            : undefined
        }
        labels={{ breadcrumb: t('folders.breadcrumb') }}
        as={CrumbLink}
        tools={<LazyNotificationBell />}
        actions={
          <>
            {!scopeName && (
              <button
                type="button"
                className="fd-btn fd-btn--ghost fd-btn--icon ph-search-btn"
                aria-label={searchLabel}
                aria-expanded={searchOpen}
                onClick={() => {
                  setSearchOpen(true);
                  // Le champ apparaît au rendu suivant : le focus y va dès qu'il est affiché
                  requestAnimationFrame(() => searchRef.current?.focus());
                }}
              >
                <Search aria-hidden="true" />
              </button>
            )}
            {!scopeName && (
              <label className={`ph-search${searchOpen || q ? ' is-open' : ''}`}>
                <span className="sr-only">{searchLabel}</span>
                <Search size={16} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder={searchLabel}
                  aria-keyshortcuts="Control+K Meta+K"
                  value={q}
                  aria-disabled={loading || undefined}
                  readOnly={loading}
                  onChange={(e) => setQ(e.target.value)}
                  onBlur={() => setSearchOpen(false)}
                />
                <kbd aria-hidden="true">{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
              </label>
            )}
            {dir && can('workspace.settings') && (
              <Button className="ph-wide" icon={<Lock />} onClick={() => setFolderAccess(dir)}>
                {t('folders.access')}
              </Button>
            )}
            {dir && editable && (
              <Menu
                label={t('folders.actions', { name: dir.name })}
                align="end"
                items={[
                  {
                    label: t('demos.rename'),
                    icon: <Pencil />,
                    onSelect: () => setRenaming({ id: dir.id, name: dir.name }),
                  },
                  ...(can('workspace.settings')
                    ? [
                        {
                          label: t('folderAccess.menu'),
                          icon: <Lock />,
                          onSelect: () => setFolderAccess(dir),
                        },
                      ]
                    : []),
                  'separator',
                  {
                    label: t('demos.deleteFolderShort'),
                    icon: <Trash2 />,
                    danger: true,
                    onSelect: () => setFolderToDelete(dir),
                  },
                ]}
              />
            )}
            {/* L48-B : liste vide, une seule action principale (au centre de l'état vide) */}
            {editable && !(demos && demos.length === 0) && (
              <Button
                variant="primary"
                icon={<Plus />}
                /* Sous 768 px le libellé visible est court ; le nom accessible reste complet */
                aria-label={sandbox ? t('sandboxPage.new') : t('demos.new')}
                onClick={openNew}
              >
                <span className="ph-wide">{sandbox ? t('sandboxPage.new') : t('demos.new')}</span>
                <span className="ph-narrow">{t(sandbox ? 'sandboxPage.newShort' : 'demos.newShort')}</span>
              </Button>
            )}
          </>
        }
      />
    );
  }
  /** Cadre de la page : PageHeader sur toute la largeur, contenu sur 1 200 px au plus. */
  const frame = (body: ReactNode) => (
    <div className="demos-layout" data-gap-exempt="">
      <div className="demos-main">
        {pageHead(true)}
        <div className="stack page-wide demos-wrap">{body}</div>
      </div>
    </div>
  );
  if (loadError || (sk.timedOut && !demos))
    return frame(<LoadError title={t('loading.demosError')} body={t('loading.errorBody')} onRetry={retry} />);
  if (!demos || !onb.ready || sk.phase !== 'content')
    return frame(
      <>
        <LoadStatus loading busy={t('loading.demos')} done="" longLoad={false} />
        {sk.phase === 'skeleton' && <DemosSkeleton onboardingHeight={onbHeight} />}
        {sk.slow && <SlowLine onRetry={retry} />}
      </>,
    );

  /** DSH-10 : publiée puis modifiée (changements non publiés). */
  const isModified = (d: Demo) =>
    d.status === 'published' &&
    !!publishedAt[d.id] &&
    new Date(d.updated_at).getTime() - new Date(publishedAt[d.id]!).getTime() > 2000;
  const statusOf = (d: Demo) => (isModified(d) ? 'modified' : d.status);
  // Audit L50 X4 : statut en texte avec un point de 8 px (publiée, modifiée, brouillon)
  const toneOf = (d: Demo) =>
    statusOf(d) === 'published' ? 'success' : statusOf(d) === 'modified' ? 'warning' : 'neutral';

  async function copyLink(d: Demo) {
    try {
      await navigator.clipboard.writeText(publicDemoUrl(d.id));
      toast(t('toast.linkCopied'));
    } catch {
      /* presse-papiers indisponible : rien à annoncer */
    }
  }
  const duplicate = (d: Demo) =>
    void run(async () => {
      check(await supabase.rpc('duplicate_demo', { p_demo: d.id }));
      await load();
      toast(t('toast.duplicated'));
    });
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  const menuFor = (d: Demo): Array<MenuItem | 'separator'> => [
    { label: t('demos.openEditor'), icon: <Pencil />, onSelect: () => navigate(`/demos/${d.id}/edit`) },
    {
      label: t('present.button'),
      icon: <Presentation />,
      disabled: !stepCounts[d.id],
      onSelect: () => navigate(`/demos/${d.id}/edit?present=1`),
    },
    { label: t('editor.share'), icon: <Share2 />, onSelect: () => navigate(`/demos/${d.id}/share`) },
    ...(can('demo.edit') && d.status !== 'archived'
      ? [{ label: t('distribute.menu'), icon: <Send />, onSelect: () => setDistributing(d.id) }]
      : []),
    { label: t('nav.analytics'), icon: <BarChart3 />, onSelect: () => navigate(`/demos/${d.id}/analytics`) },
    {
      label: t('export.menu'),
      icon: <Download />,
      // L27 : exports hors de l'app interdits par les règles de l'espace
      disabled: !rules.exports_allowed,
      hint: rules.exports_allowed ? undefined : t('rules.errExports'),
      onSelect: () => setExporting(d.id),
    },
    {
      label: t('demos.copyLink'),
      icon: <Link2 />,
      disabled: d.status !== 'published',
      onSelect: () => void copyLink(d),
    },
    ...(editable
      ? ([
          'separator',
          {
            label: t('demos.duplicate'),
            icon: <Copy />,
            end: <kbd className="menu-kbd">{mod}+D</kbd>,
            onSelect: () => duplicate(d),
          },
          { label: t('tags.title'), icon: <Tag />, onSelect: () => setTagging(d) },
          { label: t('demos.moveTo'), icon: <FolderInput />, onSelect: () => setMoving(d) },
          {
            label: t('demos.archive'),
            icon: <Archive />,
            disabled: true,
            end: <span className="soon-text">{t('shell.soon')}</span>,
            onSelect: () => {},
          },
          'separator',
          { label: t('common.delete'), icon: <Trash2 />, danger: true, onSelect: () => setToDelete(d) },
        ] as Array<MenuItem | 'separator'>)
      : []),
  ];

  // DSH-09 : les compteurs suivent le dossier affiché
  const inView = demos.filter((d) => inScope(d) && byAuthor(d));
  const counts = {
    all: inView.length,
    published: inView.filter((d) => d.status === 'published').length,
    draft: inView.filter((d) => d.status === 'draft').length,
  };
  const inFolder = (id: Scope) => demos.filter((d) => inScope(d, id)).length;
  /** Compteur d'une entrée de la colonne : suit le filtre de statut (sauf Archivées). */
  const colCount = (s: Scope) =>
    demos.filter((d) => inScope(d, s) && (s === 'archived' || status === 'all' || d.status === status))
      .length;
  const demoDrag = (d: Demo) =>
    editable
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData(DEMO_DRAG, d.id);
            e.dataTransfer.effectAllowed = 'move';
          },
        }
      : {};
  const openFolder = folders.find((f) => f.id === scope) ?? null;
  const sortLabels: Record<Sort, string> = {
    updated: t('demos.sortUpdated'),
    created: t('demos.sortCreated'),
    title: t('demos.sortTitle'),
    views: t('demos.sortViews'),
  };
  return (
    <div className="demos-layout" data-gap-exempt="">
      {!wide &&
        slot &&
        createPortal(
          <button
            ref={foldersBtn}
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon"
            aria-label={t('folders.title')}
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <PanneauIcon />
          </button>,
          slot,
        )}
      {!wide && drawer && (
        <div className="fcol-sheet">
          <FolderColumn
            folders={folders}
            scope={scope}
            count={colCount}
            editable={editable}
            canManageAccess={can('workspace.settings')}
            onSelect={(s) => {
              setFolder(s);
              setDrawer(false);
            }}
            collapsed={false}
            overlay
            onToggle={() => {
              setDrawer(false);
              foldersBtn.current?.focus();
            }}
            onNew={(parent) => {
              setDrawer(false);
              setNewFolderParent(parent);
              setNewFolder('');
            }}
            onRename={(f) => {
              setDrawer(false);
              setRenaming({ id: f.id, name: f.name });
            }}
            onAccess={(f) => {
              setDrawer(false);
              setFolderAccess(f);
            }}
            onDelete={(f) => {
              setDrawer(false);
              setFolderToDelete(f);
            }}
            onDropDemo={requestMove}
            sandbox={sandbox}
          />
        </div>
      )}
      {wide && (
        <div className={`fcol-slot${colCollapsed || !xl ? ' fcol-slot--rail' : ''}`}>
          <FolderColumn
            folders={folders}
            scope={scope}
            count={colCount}
            editable={editable}
            canManageAccess={can('workspace.settings')}
            onSelect={(s) => {
              setFolder(s);
              if (!xl) setDrawer(false);
            }}
            collapsed={colCollapsed}
            overlay={!xl}
            onToggle={toggleCol}
            onNew={(parent) => {
              setNewFolderParent(parent);
              setNewFolder('');
            }}
            onRename={(f) => setRenaming({ id: f.id, name: f.name })}
            onAccess={setFolderAccess}
            onDelete={setFolderToDelete}
            onDropDemo={requestMove}
            sandbox={sandbox}
          />
        </div>
      )}
      <div className="demos-main">
        {pageHead(false)}
        <div className={`stack page-wide demos-wrap${scopeName ? ' demos-wrap--scoped' : ''}`}>
          <Suspense fallback={null}>
            {exporting && <ExportDialog demoId={exporting} onClose={() => setExporting(null)} />}
            {distributing && <DistributeDialog demoId={distributing} onClose={() => setDistributing(null)} />}
          </Suspense>
          <LoadStatus loading={false} longLoad={sk.longLoad} busy="" done={t('loading.demosDone')} />
          {error && <Alert kind="error">{error}</Alert>}

          {/* L48-B §4 : indicateurs masqués tant qu'aucune démo n'est publiée */}
          {kpis && anyPublished && !sandbox && scope === 'all' && (
            <nav className="kpi-short" aria-label={t('kpi.shortcuts')}>
              {(
                [
                  [
                    'views',
                    t('kpi.views'),
                    formatNumber(kpis.cur.views),
                    countTrend(kpis.cur.views, kpis.prev?.views ?? 0),
                  ],
                  [
                    'visitors',
                    t('kpi.visitorsUnique'),
                    formatNumber(kpis.cur.visitors),
                    countTrend(kpis.cur.visitors, kpis.prev?.visitors ?? 0),
                  ],
                  [
                    'completion',
                    t('kpi.completion'),
                    `${Math.round(completionRate(kpis.cur.visitors, kpis.cur.completions) * 100)} %`,
                    rateTrend(
                      completionRate(kpis.cur.visitors, kpis.cur.completions),
                      kpis.prev ? completionRate(kpis.prev.visitors, kpis.prev.completions) : 0,
                      kpis.prev?.visitors ?? 0,
                    ),
                  ],
                  [
                    'leads',
                    t('kpi.leads'),
                    formatNumber(kpis.cur.leads),
                    countTrend(kpis.cur.leads, kpis.prev?.leads ?? 0),
                  ],
                ] as const
              ).map(([k, label, value, trend]) => (
                // Indicateur : écarts internes de 4 px (maquette du lot 2)
                <Link key={k} className="kpi-sc" to={`/analytics?indicateur=${k}`} data-gap-exempt="">
                  <span className="kpi-tab__l">{label}</span>
                  <span className="kpi-tab__v">{value}</span>
                  {kpis.prev ? (
                    <TrendBadge trend={trend} days={30} />
                  ) : (
                    <span className="kpi-trend">{'\u00a0'}</span>
                  )}
                  <span className="kpi-sc__go" aria-hidden="true">
                    <span className="kpi-sc__go-t">{t('kpi.analytics')}</span>
                    <ArrowRight />
                  </span>
                  <span className="sr-only">{t('kpi.seeAnalytics')}</span>
                </Link>
              ))}
            </nav>
          )}

          {/* L26-01 : « Prise en main de votre espace », après les indicateurs (L32 §2) */}
          {!sandbox && scope === 'all' && (
            <OnboardingCard
              onb={onb}
              onCapture={openNew}
              latestDemoId={demos[0]?.id ?? null}
              publishedDemoId={demos.find((d) => d.status === 'published')?.id ?? null}
              collapsedByDefault={demos.length === 0}
            />
          )}

          <section aria-labelledby="demos-list-title" className="demos-section">
            <div className="demos-list-head">
              {/* Lot 2 : dans un dossier, le titre est le nombre de démos, suivi de qui voit le dossier */}
              <h2 id="demos-list-title" className="demos-list-title">
                {scopeName
                  ? t('demos.resultCount', { count: visible.length })
                  : sandbox
                    ? t('sandboxPage.all')
                    : t('demos.allDemos')}
              </h2>
              {openFolder ? (
                <span className="demos-list-count">
                  {openFolder.restricted
                    ? t('folderAccess.visibleBy', { count: memberCount - (hidden[openFolder.id] ?? 0) })
                    : t('folders.visibleAll')}
                </span>
              ) : (
                !scopeName &&
                demos.length > 0 && (
                  <span className="demos-list-count" aria-hidden="true">
                    {t('demos.resultCount', { count: visible.length })}
                  </span>
                )
              )}
            </div>
            {/* L40 : Statut, Dossier, Étiquettes et Réinitialiser à gauche ; tri et affichage à droite */}
            {/* L48-B §4 : pas de barre de liste tant qu'il n'y a aucune démo */}
            {demos.length > 0 && (
              <ListToolbar
                className="list-toolbar--cq"
                activeCount={
                  (status !== 'all' ? 1 : 0) +
                  (ctype !== 'all' ? 1 : 0) +
                  (scope !== 'all' && !wide ? 1 : 0) +
                  (author !== 'all' ? 1 : 0) +
                  (tagFilter.length ? 1 : 0)
                }
                onReset={() => {
                  setStatus('all');
                  setCtype('all');
                  if (!wide) setFolder('all');
                  setAuthor('all');
                  setTagFilter([]);
                }}
                status={t('demos.resultCount', { count: visible.length })}
                lead={
                  <>
                    <div className="fd-segmented" role="group" aria-label={t('demos.status')}>
                      {(['all', 'published', 'draft'] as StatusFilter[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={status === k}
                          onClick={() => setStatus(k)}
                        >
                          {t(`demos.filter_${k}`)} · {counts[k]}
                        </button>
                      ))}
                    </div>
                  </>
                }
                filters={
                  <>
                    {/* L48-G §4 : Type (pas sur la page Sandbox), en menu : la barre reste sur une ligne */}
                    {!sandbox && (
                      <FilterMenu
                        icon={<Shapes />}
                        compact
                        label={t('ctype.filter')}
                        value={ctype === 'all' ? t('ctype.all') : t(`ctype.short.${ctype}`)}
                        active={ctype !== 'all'}
                        items={(['all', 'captures', 'html'] as TypeFilter[]).map((k) => ({
                          label: k === 'all' ? t('ctype.all') : t(`ctype.short.${k}`),
                          icon: ctype === k ? <Check /> : <span />,
                          onSelect: () => setCtype(k),
                        }))}
                      />
                    )}
                    {!wide && (
                      <FilterMenu
                        icon={<Folder />}
                        label={t('demos.folderLabel')}
                        value={
                          folder === 'all'
                            ? t('toolbar.all')
                            : folder === 'none'
                              ? t('demos.noFolder')
                              : (folders.find((f) => f.id === folder)?.name ?? t('toolbar.all'))
                        }
                        active={folder !== 'all'}
                        items={[
                          {
                            label: `${t('demos.allFolders')} · ${inFolder('all')}`,
                            icon: scope === 'all' ? <Check /> : <Layers />,
                            onSelect: () => setFolder('all'),
                          },
                          {
                            label: `${t(sandbox ? 'sandboxPage.mine' : 'folders.mine')} · ${inFolder('mine')}`,
                            icon: scope === 'mine' ? <Check /> : <User />,
                            onSelect: () => setFolder('mine'),
                          },
                          {
                            label: `${t('demos.noFolder')} · ${inFolder('none')}`,
                            icon: folder === 'none' ? <Check /> : <FolderOpen />,
                            onSelect: () => setFolder('none'),
                          },
                          ...(folders.length ? (['separator'] as const) : []),
                          ...folders.map((f) => ({
                            label: `${f.name} · ${inFolder(f.id)}`,
                            icon: folder === f.id ? <Check /> : <Folder />,
                            // L27-09 : dossier restreint (cadenas, nombre de membres qui le voient)
                            end: f.restricted ? (
                              <span
                                role="img"
                                aria-label={t('folderAccess.restricted')}
                                title={t('folderAccess.visibleBy', {
                                  count: memberCount - (hidden[f.id] ?? 0),
                                })}
                              >
                                <Lock size={14} aria-hidden="true" />
                              </span>
                            ) : undefined,
                            onSelect: () => setFolder(f.id),
                          })),
                          'separator',
                          {
                            label: `${t('folders.archived')} · ${inFolder('archived')}`,
                            icon: scope === 'archived' ? <Check /> : <Archive />,
                            onSelect: () => setFolder('archived'),
                          },
                          ...(editable
                            ? ([
                                'separator',
                                {
                                  label: t('demos.newFolder'),
                                  icon: <FolderPlus />,
                                  onSelect: () => {
                                    setNewFolderParent(null);
                                    setNewFolder('');
                                  },
                                },
                                ...(current && folder !== 'all' && folder !== 'none'
                                  ? [
                                      {
                                        label: t('demos.renameFolder', {
                                          name: folders.find((f) => f.id === folder)?.name ?? '',
                                        }),
                                        icon: <Pencil />,
                                        onSelect: () => {
                                          const f = folders.find((x) => x.id === folder);
                                          if (f) setRenaming({ id: f.id, name: f.name });
                                        },
                                      },
                                      ...(can('workspace.settings')
                                        ? [
                                            {
                                              label: t('folderAccess.menu'),
                                              icon: <Lock />,
                                              onSelect: () =>
                                                setFolderAccess(folders.find((x) => x.id === folder) ?? null),
                                            },
                                          ]
                                        : []),
                                      {
                                        label: t('demos.deleteFolderShort'),
                                        icon: <Trash2 />,
                                        danger: true,
                                        onSelect: () =>
                                          setFolderToDelete(folders.find((x) => x.id === folder) ?? null),
                                      },
                                    ]
                                  : []),
                              ] as Array<MenuItem | 'separator'>)
                            : []),
                        ]}
                      />
                    )}
                    <FilterMenu
                      icon={<Users />}
                      label={t('folders.author')}
                      value={
                        author === 'all'
                          ? t('toolbar.all')
                          : author === 'me'
                            ? t('folders.me')
                            : (people.find((p) => p.user_id === author)?.full_name ?? t('toolbar.all'))
                      }
                      active={author !== 'all'}
                      items={[
                        {
                          label: t('toolbar.all'),
                          icon: author === 'all' ? <Check /> : <span />,
                          onSelect: () => setAuthor('all'),
                        },
                        {
                          label: t('folders.me'),
                          icon: author === 'me' ? <Check /> : <span />,
                          onSelect: () => setAuthor('me'),
                        },
                        ...(people.some((p) => p.user_id !== user?.id) ? (['separator'] as const) : []),
                        ...people
                          .filter((p) => p.user_id !== user?.id)
                          .map((p) => ({
                            label: p.full_name || p.email,
                            icon: author === p.user_id ? <Check /> : <span />,
                            onSelect: () => setAuthor(p.user_id),
                          })),
                      ]}
                    />
                    <TagFilter
                      store={tagStore}
                      selected={tagFilter}
                      setSelected={setTagFilter}
                      mode={tagMode}
                      setMode={setTagMode}
                      manage={editable}
                    />
                  </>
                }
                end={
                  <>
                    <FilterMenu
                      sort
                      align="end"
                      icon={<ArrowUpDown />}
                      label={t('demos.sortLabel')}
                      value={sortLabels[sort]}
                      items={(Object.keys(sortLabels) as Sort[]).map((k) => ({
                        label: sortLabels[k],
                        icon: sort === k ? <Check /> : <span />,
                        onSelect: () => setSort(k),
                      }))}
                    />
                    <div
                      className="fd-segmented fd-segmented--icons"
                      role="radiogroup"
                      aria-label={t('demos.view')}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={view === 'grid'}
                        aria-label={t('demos.viewGrid')}
                        title={t('demos.viewGrid')}
                        onClick={() => chooseView('grid')}
                      >
                        <LayoutGrid aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={view === 'list'}
                        aria-label={t('demos.viewList')}
                        title={t('demos.viewList')}
                        onClick={() => chooseView('list')}
                      >
                        <List aria-hidden="true" />
                      </button>
                    </div>
                  </>
                }
              />
            )}

            {demos.length === 0 && sandbox ? (
              <Empty
                icon={<MapIcon />}
                title={t('sandboxPage.emptyTitle')}
                body={t('sandboxPage.emptyBody')}
                action={
                  editable ? (
                    <Button variant="primary" icon={<Plus />} onClick={openNew}>
                      {t('sandboxPage.new')}
                    </Button>
                  ) : undefined
                }
              />
            ) : demos.length === 0 ? (
              // L48-B : une seule action au centre, « Nouvelle démo », et « Voir un exemple » (pas encore de
              // démo d'exemple : lien désactivé, « Bientôt » en texte)
              <Empty
                icon={<LayoutGrid />}
                title={editable ? t('demos.empty.title') : t('demos.empty.titleViewer')}
                body={editable ? t('demos.empty.body') : t('demos.empty.bodyViewer')}
                action={
                  editable ? (
                    <Button variant="primary" icon={<Plus />} onClick={openNew}>
                      {t('demos.new')}
                    </Button>
                  ) : undefined
                }
                secondary={
                  editable ? (
                    <span className="demos-example">
                      <span className="link-button" role="link" aria-disabled="true">
                        {t('demos.empty.example')}
                      </span>{' '}
                      <span className="soon-text">{t('shell.soon')}</span>
                    </span>
                  ) : undefined
                }
              />
            ) : visible.length === 0 && inView.length === 0 && scope === 'archived' ? (
              <Empty
                icon={<Archive />}
                title={t('demos.empty.archivedTitle')}
                body={t('demos.empty.archivedBody')}
              />
            ) : visible.length === 0 && inView.length === 0 && folder !== 'all' ? (
              <Empty
                icon={<FolderOpen />}
                title={t('demos.empty.folderTitle')}
                body={t('demos.empty.folderBody', { folder: scopeName ?? '' })}
                action={
                  editable ? (
                    <Button variant="primary" icon={<Plus />} onClick={openNew}>
                      {t('demos.empty.folderAction')}
                    </Button>
                  ) : undefined
                }
              />
            ) : visible.length === 0 ? (
              <NoMatch
                what="demo"
                query={q}
                filters={
                  (status !== 'all' ? 1 : 0) +
                  (ctype !== 'all' ? 1 : 0) +
                  (author !== 'all' ? 1 : 0) +
                  (tagFilter.length ? 1 : 0) +
                  (scope !== 'all' && !wide ? 1 : 0)
                }
                onReset={() => {
                  setQ('');
                  setStatus('all');
                  setCtype('all');
                  setAuthor('all');
                  setTagFilter([]);
                  if (!wide) setFolder('all');
                }}
              />
            ) : view === 'list' ? (
              <div className="fd-card demo-table-wrap">
                <table className="demo-table">
                  <caption className="sr-only">{t('demos.listCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('demos.colName')}</th>
                      {!sandbox && (
                        <th scope="col" className="dt-md">
                          {t('ctype.col')}
                        </th>
                      )}
                      <th scope="col" className="dt-md">
                        {t('demos.colStatus')}
                      </th>
                      {/* Décision UX du 22/11 : Dossier et Complétion masquées sous 1 280 px */}
                      <th scope="col" className="dt-xl">
                        {t('demos.colFolder')}
                      </th>
                      <th scope="col">{t('tags.title')}</th>
                      <th scope="col" className="r dt-md">
                        {t('demos.colViews')}
                      </th>
                      <th scope="col" className="r dt-xl">
                        {t('demos.colCompletion')}
                      </th>
                      <th scope="col">{t('demos.colUpdated')}</th>
                      <th scope="col">
                        <span className="sr-only">{t('demos.colActions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((d) => {
                      const s = stats[d.id];
                      const rate = s ? Math.round(completionRate(s.visitors, s.completions) * 100) : 0;
                      return (
                        <tr key={d.id} {...demoDrag(d)}>
                          <td>
                            <span className="dt-name">
                              <span className="dt-thumb" aria-hidden="true">
                                {covers[d.id] ? <img src={covers[d.id]} alt="" loading="lazy" /> : null}
                              </span>
                              <Link to={`/demos/${d.id}/edit`}>{d.title}</Link>
                            </span>
                          </td>
                          {!sandbox && (
                            <td className="dt-md">
                              <TypeBadge type={typeOf(d)} />
                            </td>
                          )}
                          <td className="dt-md">
                            <Status size="sm" tone={toneOf(d)}>
                              {t(`status.${statusOf(d)}`)}
                            </Status>
                            {lockedIds.has(d.id) && (
                              <Status size="sm" tone="warning" title={t('rules.accessToFixHelp')}>
                                {t('rules.accessToFix')}
                              </Status>
                            )}
                          </td>
                          <td className="fd-muted dt-xl">
                            {folders.find((f) => f.id === d.folder_id)?.name ?? '—'}
                          </td>
                          <td>
                            <CardTags demo={d} store={tagStore} editable={editable} list />
                          </td>
                          <td className="r num dt-md">{formatNumber(s?.views ?? 0)}</td>
                          <td className="r nowrap dt-xl">
                            <span className="dt-rate">
                              <span className="dt-bar" aria-hidden="true">
                                <span style={{ width: `${rate}%` }} />
                              </span>
                              <span className="num">{rate} %</span>
                            </span>
                          </td>
                          <td className="fd-muted nowrap">
                            <time dateTime={d.updated_at} title={formatDateTime(d.updated_at)}>
                              {formatRelativeShort(d.updated_at)}
                            </time>
                          </td>
                          <td className="r">
                            <Menu label={t('demos.actions', { title: d.title })} items={menuFor(d)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="demo-grid">
                {visible.map((d) => {
                  const s = stats[d.id];
                  return (
                    <li
                      key={d.id}
                      {...demoDrag(d)}
                      className="fd-card demo-card"
                      onKeyDown={(e) => {
                        // DSH-05 : ⌘D / Ctrl+D duplique la démo dont la carte a le focus
                        if (editable && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
                          e.preventDefault();
                          duplicate(d);
                        }
                      }}
                    >
                      {!sandbox && <TypeBadge type={typeOf(d)} cover />}
                      <div
                        className={`demo-cover${covers[d.id] ? ' fd-player-scope' : ''}`}
                        aria-hidden="true"
                      >
                        {covers[d.id] ? (
                          <img src={covers[d.id]} alt="" loading="lazy" />
                        ) : (
                          <span className="demo-cover-empty">
                            <span className="fake fd-player-scope" />
                            <span className="dot" style={dotPosition(d.id)} />
                          </span>
                        )}
                      </div>
                      <div className="demo-body">
                        <div className="demo-head">
                          <h3>
                            {/* Lien étendu : toute la carte est cliquable */}
                            <Link className="demo-link" to={`/demos/${d.id}/edit`}>
                              {d.title}
                            </Link>
                          </h3>
                          <Menu label={t('demos.actions', { title: d.title })} items={menuFor(d)} />
                        </div>
                        <div className="demo-meta">
                          <Status size="sm" tone={toneOf(d)}>
                            {t(`status.${statusOf(d)}`)}
                          </Status>
                          {lockedIds.has(d.id) && (
                            <Status size="sm" tone="warning" title={t('rules.accessToFixHelp')}>
                              {t('rules.accessToFix')}
                            </Status>
                          )}
                          <span>
                            {/* L48-G §4 : un Sandbox dit toujours son nombre de pages */}
                            {sandbox && <>{t('sandboxPage.pages', { count: stepCounts[d.id] ?? 0 })} · </>}
                            {sandbox && (deadCounts[d.id] ?? 0) > 0 && (
                              <>
                                <span className="sb-dead-count">
                                  {t('sandboxPage.deadLinks', { count: deadCounts[d.id] })}
                                </span>{' '}
                                ·{' '}
                              </>
                            )}
                            {d.status === 'published' ? (
                              <>
                                {t('demos.views', { count: s?.views ?? 0, n: formatNumber(s?.views ?? 0) })} ·{' '}
                                {t('demos.leads', { count: s?.leads ?? 0, n: formatNumber(s?.leads ?? 0) })}{' '}
                                ·{' '}
                              </>
                            ) : (
                              !sandbox && <>{t('demos.steps', { count: stepCounts[d.id] ?? 0 })} · </>
                            )}
                            <time dateTime={d.updated_at} title={formatDateTime(d.updated_at)}>
                              {formatRelativeShort(d.updated_at)}
                            </time>
                          </span>
                        </div>
                        <CardTags demo={d} store={tagStore} editable={editable} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {tagging && <TagsDialog demo={tagging} store={tagStore} onClose={() => setTagging(null)} />}
          <Suspense fallback={null}>
            {/* L30-05 : démo générée depuis un plan texte (langue de l'interface) */}
            {generating && (
              <GenerateDialog
                ws={ws.id}
                userId={user!.id}
                folderId={generating.folder}
                lang={i18n.language.startsWith('en') ? 'en' : 'fr'}
                onClose={() => setGenerating(null)}
              />
            )}
            {newMounted && (
              <NewDemoDialog
                open={newOpen}
                folders={folders}
                defaultFolder={folder !== 'all' && folder !== 'none' ? folder : null}
                onClose={() => setNewOpen(false)}
                initialType={sandbox ? 'sandbox' : undefined}
                onEmpty={async (f) => {
                  setNewOpen(false);
                  await createDemo(f);
                }}
                onImport={importImages}
                ws={ws.id}
                onGenerate={(f) => {
                  setNewOpen(false);
                  setGenerating({ folder: f });
                }}
                onTemplate={(f) => {
                  setNewOpen(false);
                  setTplFolder(f);
                }}
                onExtension={() => {
                  setNewOpen(false);
                  setExtension(true);
                }}
              />
            )}
            {tplMounted && (
              <TemplatesDialog
                open={tplFolder !== undefined}
                workspaceId={ws.id}
                folderId={tplFolder ?? null}
                canManage={can('demo.edit')}
                onClose={() => setTplFolder(undefined)}
                onCreated={(id) => {
                  setTplFolder(undefined);
                  toast(t('templates.created'));
                  navigate(`/demos/${id}/edit`);
                }}
              />
            )}
          </Suspense>
          <ConfirmDialog
            open={newFolder !== null || renaming !== null}
            title={renaming ? t('demos.renameFolder', { name: '' }).trim() : t('demos.newFolder')}
            body={
              // REV-11 : pas de formulaire imbriqué : Entrée soumet le formulaire de la modale (onConfirm)
              <label className="fd-field">
                <span className="sr-only">{t('demos.folderName')}</span>
                <input
                  className="fd-input"
                  autoFocus
                  maxLength={80}
                  placeholder={t('demos.folderName')}
                  value={renaming ? renaming.name : (newFolder ?? '')}
                  onChange={(e) =>
                    renaming
                      ? setRenaming({ ...renaming, name: e.target.value })
                      : setNewFolder(e.target.value)
                  }
                />
              </label>
            }
            confirmLabel={t('common.save')}
            onClose={() => {
              setNewFolder(null);
              setRenaming(null);
            }}
            onConfirm={() => saveFolder()}
          />
          <ConfirmDialog
            open={!!toDelete}
            title={t('demos.deleteTitle', { title: toDelete?.title ?? '' })}
            body={t('demos.confirmDelete', { title: toDelete?.title ?? '' })}
            confirmLabel={t('demos.deleteDemo')}
            danger
            onClose={() => setToDelete(null)}
            onConfirm={() =>
              run(async () => {
                const d = toDelete!;
                if (d.status === 'published') check(await supabase.rpc('unpublish_demo', { p_demo: d.id }));
                check(
                  await supabase
                    .from('demos')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', d.id),
                );
                await supabase.storage.from('published').remove([`${d.id}/latest.json`]);
                await load();
                toast(t('toast.demoDeleted'));
              }).then(() => undefined)
            }
          />
          <ConfirmDialog
            open={!!folderToDelete}
            title={t('demos.deleteFolder', { name: folderToDelete?.name ?? '' })}
            body={t(sandbox ? 'sandboxPage.confirmDeleteFolder' : 'demos.confirmDeleteFolder', {
              name: folderToDelete?.name ?? '',
            })}
            confirmLabel={t('common.delete')}
            danger
            onClose={() => setFolderToDelete(null)}
            onConfirm={() =>
              run(async () => {
                check(await supabase.from('folders').delete().eq('id', folderToDelete!.id));
                if (folder === folderToDelete!.id) setFolder('all');
                await load();
                toast(t('toast.folderDeleted'));
              }).then(() => undefined)
            }
          />
          {folderAccess && (
            <Suspense fallback={null}>
              <FolderAccessDialog
                folder={folderAccess}
                onClose={() => setFolderAccess(null)}
                onSaved={() => {
                  toast(t('folderAccess.saved'));
                  void load();
                }}
              />
            </Suspense>
          )}
          {extension && <ExtensionDialog onClose={() => setExtension(false)} />}
          <ConfirmDialog
            open={!!pendingMove}
            title={t('demos.moveTo')}
            body={pendingMove ? t('folderAccess.moveWarn', { count: pendingMove.n }) : ''}
            confirmLabel={t('folderAccess.moveConfirm')}
            onClose={() => setPendingMove(null)}
            onConfirm={async () => {
              const m = pendingMove!;
              setPendingMove(null);
              await moveDemo(m.demoId, m.folderId);
            }}
          />
          <ConfirmDialog
            open={!!moving}
            title={t('demos.moveTo')}
            body={
              moving && (
                <Select
                  aria-label={t('demos.moveTo')}
                  defaultValue={moving.folder_id ?? ''}
                  onChange={(e) => {
                    const target = e.target.value;
                    // L27-09 : confirmation avant de déplacer une démo vers un dossier restreint
                    if (target && (hidden[target] ?? 0) > 0) {
                      setPendingMove({ demoId: moving.id, folderId: target, n: hidden[target]! });
                      setMoving(null);
                      return;
                    }
                    void moveDemo(moving.id, target);
                  }}
                >
                  <option value="">{t('demos.noFolder')}</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              )
            }
            confirmLabel={t('common.close')}
            onClose={() => setMoving(null)}
            onConfirm={() => undefined}
          />
        </div>
      </div>
    </div>
  );
}

/** Position stable du point chaud d'une vignette sans capture (comme les vignettes de la maquette). */
function dotPosition(id: string) {
  let h = 0;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return { left: `${22 + (h % 46)}%`, top: `${30 + ((h >>> 8) % 34)}%` };
}
