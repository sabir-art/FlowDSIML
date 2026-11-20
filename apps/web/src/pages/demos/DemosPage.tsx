import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ArrowUpRight,
  BarChart3,
  Check,
  Copy,
  Download,
  Eye,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Layers,
  Lock,
  LayoutGrid,
  Link2,
  List,
  Mail,
  Pencil,
  Plus,
  Presentation,
  Route,
  Search,
  Send,
  Share2,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card, Select } from '@flowdsiml/ui';
import { completionRate } from '@flowdsiml/core';
import { StatTile, variation } from '../../components/charts';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { formatDateTime, formatNumber, formatRelativeShort } from '../../lib/format';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { Menu, type MenuItem } from '../../components/Menu';
import { useToast } from '../../components/Toast';
import { publicDemoUrl } from '../../lib/embed';
import { createDemoFromImages } from './importImages';
import { NewDemoDialog } from './NewDemoDialog';
import { TemplatesDialog } from './TemplatesDialog';
import { OnboardingCard, useOnboarding } from './OnboardingCard';
import { FolderAccessDialog } from './FolderAccessDialog';
import { useShareRules } from '../../lib/shareRules';
import { ExportDialog } from '../export/ExportDialog';
import { DistributeDialog } from '../share/DistributeDialog';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ManageTagsDialog, TagChip, TagFilter, TagsDialog, useWorkspaceTags } from '../../components/Tags';
import './demos.css';
import { GenerateDialog } from '../../components/ai/GenerateDialog';
import { NotificationBell } from '../../components/notifications/NotificationBell';

type Demo = Tables<'demos'>;
type FolderRow = Tables<'folders'>;
type Stats = { views: number; completions: number; visitors: number; leads: number };
type Kpis = Stats;
type StatusFilter = 'all' | 'draft' | 'published';
type Sort = 'updated' | 'created' | 'title' | 'views';

export function DemosPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, can } = useWorkspace();
  const ws = current!;
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const onb = useOnboarding();
  useEffect(() => {
    void supabase
      .from('plans')
      .select('limits')
      .eq('code', ws.plan_code)
      .maybeSingle()
      .then(({ data }) => setEnterprise(!!(data?.limits as { share_rules?: boolean } | null)?.share_rules));
    void supabase
      .rpc('list_members', { p_workspace: ws.id })
      .then(({ data }) => setMemberCount((data ?? []).length));
  }, [ws.id, ws.plan_code]);
  const rules = useShareRules(ws.id);
  // L27-07 : démos bloquées par les règles (mot de passe exigé, aucun défini) : « Accès à régler »
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  /** DSH-10 : date de la dernière publication, pour le badge « Modifiée ». */
  const [publishedAt, setPublishedAt] = useState<Record<string, string>>({});
  const [folder, setFolder] = useState<string | 'all' | 'none'>('all');
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
  // L27-09 : accès par dossier (administrateurs, plan Enterprise)
  const [folderAccess, setFolderAccess] = useState<FolderRow | null>(null);
  const [enterprise, setEnterprise] = useState(false);
  const [hidden, setHidden] = useState<Record<string, number>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [pendingMove, setPendingMove] = useState<{ demoId: string; folderId: string; n: number } | null>(
    null,
  );
  const [moving, setMoving] = useState<Demo | null>(null);
  // L12-07 : étiquettes des démos (filtre, pastilles, menu de la carte)
  const tagStore = useWorkspaceTags(ws.id);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [tagging, setTagging] = useState<Demo | null>(null);
  const [managingTags, setManagingTags] = useState(false);
  const { error, run } = useAction();
  const editable = can('demo.edit');
  const [kpis, setKpis] = useState<{ cur: Kpis; prev: Kpis | null } | null>(null);

  const load = useCallback(async () => {
    const [d, f, o] = await Promise.all([
      supabase
        .from('demos')
        .select('*')
        .eq('workspace_id', ws.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
      supabase.from('folders').select('*').eq('workspace_id', ws.id).order('name'),
      supabase.rpc('workspace_overview', { p_workspace: ws.id, p_days: 30 }),
    ]);
    const list = d.data ?? [];
    const lk = await supabase
      .from('demo_access')
      .select('demo_id')
      .eq('workspace_id', ws.id)
      .eq('locked_by_rules', true);
    setLockedIds(new Set((lk.data ?? []).map((x) => x.demo_id)));
    // KPI du workspace sur 30 jours (et les 30 précédents pour les variations). Repli sur la somme
    // de workspace_overview si la RPC workspace_kpis (migration 130800) n'est pas encore en place.
    const now = Date.now();
    const iso = (days: number) => new Date(now - days * 86400_000).toISOString();
    const [cur, prev] = await Promise.all([
      supabase.rpc('workspace_kpis', {
        p_workspace: ws.id,
        p_from: iso(30),
        p_to: new Date(now).toISOString(),
      }),
      supabase.rpc('workspace_kpis', { p_workspace: ws.id, p_from: iso(60), p_to: iso(30) }),
    ]);
    // Liste et indicateurs affichés ensemble (aucun saut de mise en page au chargement)
    setFolders(f.data ?? []);
    // Dossiers restreints : membres qui ne les voient pas (infobulle, confirmation de déplacement)
    const restrictedIds = (f.data ?? []).filter((x) => x.restricted).map((x) => x.id);
    const counts = await Promise.all(
      restrictedIds.map((id) =>
        supabase.rpc('folder_hidden_count', { p_folder: id }).then((r) => [id, r.data ?? 0] as const),
      ),
    );
    setHidden(Object.fromEntries(counts));
    setStats(
      Object.fromEntries(((o.data ?? []) as Array<Stats & { demo_id: string }>).map((r) => [r.demo_id, r])),
    );
    setDemos(list);
    if (!cur.error && cur.data)
      setKpis({ cur: cur.data as unknown as Kpis, prev: (prev.data as unknown as Kpis) ?? null });
    else {
      const rows = (o.data ?? []) as Array<Stats>;
      const sum = (k: keyof Kpis) => rows.reduce((acc, r) => acc + Number(r[k] ?? 0), 0);
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
    if (list.length) {
      const all = await supabase
        .from('steps')
        .select('demo_id, page_url')
        .in(
          'demo_id',
          list.map((x) => x.id),
        );
      const n: Record<string, number> = {};
      for (const r of all.data ?? []) n[r.demo_id] = (n[r.demo_id] ?? 0) + 1;
      setStepCounts(n);
      // Date de publication de la version en ligne (même règle que la barre de l'éditeur)
      const versions = list
        .filter((x) => x.status === 'published' && x.current_version_id)
        .map((x) => x.current_version_id!);
      if (versions.length) {
        const v = await supabase.from('demo_versions').select('demo_id, published_at').in('id', versions);
        setPublishedAt(
          Object.fromEntries(
            (v.data ?? []).filter((r) => r.published_at).map((r) => [r.demo_id, r.published_at!]),
          ),
        );
      }
      const s = await supabase
        .from('steps')
        .select('demo_id, image_path, position')
        .in(
          'demo_id',
          list.map((x) => x.id),
        )
        .not('image_path', 'is', null)
        .order('position');
      const first = new Map<string, string>();
      for (const r of s.data ?? [])
        if (r.image_path && !first.has(r.demo_id)) first.set(r.demo_id, r.image_path);
      if (first.size) {
        const signed = await supabase.storage.from('captures').createSignedUrls([...first.values()], 3600);
        const byPath = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]));
        setCovers(Object.fromEntries([...first].map(([demoId, path]) => [demoId, byPath.get(path) ?? ''])));
      }
    }
  }, [ws.id]);

  useEffect(() => {
    setDemos(null);
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const matchTags = (demoId: string) => {
      const own = new Set(tagStore.links.filter((l) => l.demo_id === demoId).map((l) => l.tag_id));
      return tagMode === 'all' ? tagFilter.every((x) => own.has(x)) : tagFilter.some((x) => own.has(x));
    };
    const needle = q.trim().toLowerCase();
    const list = (demos ?? []).filter(
      (d) =>
        (folder === 'all' || (folder === 'none' ? !d.folder_id : d.folder_id === folder)) &&
        (status === 'all' || d.status === status) &&
        (!needle || d.title.toLowerCase().includes(needle)) &&
        (tagFilter.length === 0 || matchTags(d.id)),
    );
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title, i18n.language));
    if (sort === 'created') return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === 'views')
      return [...list].sort((a, b) => (stats[b.id]?.views ?? 0) - (stats[a.id]?.views ?? 0));
    return list;
  }, [demos, folder, status, q, sort, stats, i18n.language, tagFilter, tagMode, tagStore.links]);

  const [newOpen, setNewOpen] = useState(false);
  const [generating, setGenerating] = useState<{ folder: string | null } | null>(null);
  // REV-04 : « Démarrer » de l'onboarding arrive ici avec ?new=1 et ouvre « Nouvelle démo »
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') !== '1') return;
    setNewOpen(true);
    setParams({}, { replace: true });
  }, [params, setParams]);
  // L26-04 : bibliothèque de modèles (dossier choisi dans « Nouvelle démo »)
  const [tplFolder, setTplFolder] = useState<string | null | undefined>(undefined);
  const openNew = () => setNewOpen(true);
  const anyPublished = (demos ?? []).some((d) => d.status === 'published');

  async function moveDemo(demoId: string, target: string) {
    await run(async () => {
      check(
        await supabase
          .from('demos')
          .update({ folder_id: target || null })
          .eq('id', demoId),
      );
      await load();
      toast(t('toast.moved', { folder: folders.find((f) => f.id === target)?.name ?? t('demos.noFolder') }));
    });
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
      else check(await supabase.from('folders').insert({ workspace_id: ws.id, name }));
      toast(renaming ? t('toast.folderRenamed') : t('toast.folderCreated', { name }));
      setRenaming(null);
      setNewFolder(null);
      await load();
    });
  }

  if (!demos || !onb.ready) return <Loading />;

  /** DSH-10 : publiée puis modifiée (changements non publiés). */
  const isModified = (d: Demo) =>
    d.status === 'published' &&
    !!publishedAt[d.id] &&
    new Date(d.updated_at).getTime() - new Date(publishedAt[d.id]!).getTime() > 2000;
  const statusOf = (d: Demo) => (isModified(d) ? 'modified' : d.status);

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
            end: <span className="fd-badge menu-soon">{t('shell.soon')}</span>,
            onSelect: () => {},
          },
          'separator',
          { label: t('common.delete'), icon: <Trash2 />, danger: true, onSelect: () => setToDelete(d) },
        ] as Array<MenuItem | 'separator'>)
      : []),
  ];

  // DSH-09 : les compteurs suivent le dossier affiché
  const inView = demos.filter(
    (d) => folder === 'all' || (folder === 'none' ? !d.folder_id : d.folder_id === folder),
  );
  const counts = {
    all: inView.length,
    published: inView.filter((d) => d.status === 'published').length,
    draft: inView.filter((d) => d.status === 'draft').length,
  };
  const inFolder = (id: string | 'none') =>
    demos.filter((d) => (id === 'none' ? !d.folder_id : d.folder_id === id)).length;
  const kpi = {
    deltaLabel: t('analytics.vsPreviousDays', { count: 30 }),
    noDeltaLabel: t('analytics.noComparison'),
  };
  const sortLabels: Record<Sort, string> = {
    updated: t('demos.sortUpdated'),
    created: t('demos.sortCreated'),
    title: t('demos.sortTitle'),
    views: t('demos.sortViews'),
  };
  return (
    <div className="stack page-wide">
      {exporting && <ExportDialog demoId={exporting} onClose={() => setExporting(null)} />}
      {distributing && <DistributeDialog demoId={distributing} onClose={() => setDistributing(null)} />}
      <header className="page-head page-head--refonte">
        <div className="page-head__titles">
          <h1>{t('demos.title')}</h1>
          <p className="page-head__sub">{t('demos.subtitle')}</p>
        </div>
        <div className="page-head__actions">
          <NotificationBell />
          <label className="search-pill">
            <Search aria-hidden="true" />
            <input
              className="fd-input"
              type="search"
              placeholder={t('demos.search')}
              aria-label={t('demos.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {editable && (
            <Button variant="primary" size="lg" icon={<Plus />} onClick={openNew}>
              {t('demos.new')}
            </Button>
          )}
        </div>
      </header>
      {error && <Alert kind="error">{error}</Alert>}

      {/* L26-01 : « Prise en main de votre espace » (remplace « Premiers pas ») */}
      <OnboardingCard
        onb={onb}
        onCapture={openNew}
        latestDemoId={demos[0]?.id ?? null}
        publishedDemoId={demos.find((d) => d.status === 'published')?.id ?? null}
      />

      {/* REV-05 : pas d'indicateurs à zéro tant qu'aucune démo n'est publiée */}
      {kpis && !anyPublished && demos.length > 0 && (
        <p className="fd-muted stats-later">{t('demos.statsLater')}</p>
      )}
      {kpis && anyPublished && (
        <section className="stat-row" aria-label={t('analytics.kpis', { count: 30 })}>
          <StatTile
            hero
            icon={<Eye />}
            label={t('demos.kpiViews')}
            value={formatNumber(kpis.cur.views)}
            action={
              <Link
                to="/analytics"
                className="fd-btn fd-btn--round fd-btn--inverse fd-btn--sm kpi-action"
                aria-label={t('demos.seeAnalytics')}
              >
                <ArrowUpRight aria-hidden="true" />
              </Link>
            }
            delta={kpis.prev ? variation(kpis.cur.views, kpis.prev.views) : undefined}
            {...kpi}
          />
          <StatTile
            icon={<Users />}
            label={t('analytics.visitors')}
            value={formatNumber(kpis.cur.visitors)}
            delta={kpis.prev ? variation(kpis.cur.visitors, kpis.prev.visitors) : undefined}
            {...kpi}
          />
          <StatTile
            icon={<Route />}
            label={t('analytics.completion')}
            value={`${Math.round(completionRate(kpis.cur.visitors, kpis.cur.completions) * 100)} %`}
            deltaAbs={
              kpis.prev
                ? kpis.prev.visitors > 0
                  ? {
                      value: Math.round(
                        (completionRate(kpis.cur.visitors, kpis.cur.completions) -
                          completionRate(kpis.prev.visitors, kpis.prev.completions)) *
                          100,
                      ),
                      unit: t('demos.pts'),
                    }
                  : null
                : undefined
            }
            {...kpi}
          />
          <StatTile
            icon={<Mail />}
            label={t('analytics.leads')}
            value={formatNumber(kpis.cur.leads)}
            deltaAbs={kpis.prev ? { value: kpis.cur.leads - kpis.prev.leads } : undefined}
            {...kpi}
          />
        </section>
      )}

      <section aria-labelledby="demos-list-title" className="demos-section">
        <div className="filter-bar">
          <h2 id="demos-list-title">{t('demos.allDemos')}</h2>
          <div className="fd-segmented" role="group" aria-label={t('demos.status')}>
            {(['all', 'published', 'draft'] as StatusFilter[]).map((k) => (
              <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>
                {t(`demos.filter_${k}`)} · {counts[k]}
              </button>
            ))}
          </div>
          <div className="filter-bar__end">
            <Menu
              label={t('demos.folders')}
              trigger={{
                icon: <Folder />,
                text:
                  folder === 'all'
                    ? t('demos.folders')
                    : folder === 'none'
                      ? t('demos.noFolder')
                      : (folders.find((f) => f.id === folder)?.name ?? t('demos.folders')),
                chevron: true,
              }}
              items={[
                {
                  label: `${t('demos.allFolders')} · ${demos.length}`,
                  icon: folder === 'all' ? <Check /> : <Layers />,
                  onSelect: () => setFolder('all'),
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
                      title={t('folderAccess.visibleBy', { count: memberCount - (hidden[f.id] ?? 0) })}
                    >
                      <Lock size={14} aria-hidden="true" />
                    </span>
                  ) : undefined,
                  onSelect: () => setFolder(f.id),
                })),
                ...(editable
                  ? ([
                      'separator',
                      { label: t('demos.newFolder'), icon: <FolderPlus />, onSelect: () => setNewFolder('') },
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
                                    disabled: !enterprise,
                                    hint: enterprise ? undefined : t('rules.errPlan'),
                                    end: enterprise ? undefined : (
                                      <span className="fd-badge menu-soon">Enterprise</span>
                                    ),
                                    onSelect: () =>
                                      setFolderAccess(folders.find((x) => x.id === folder) ?? null),
                                  },
                                ]
                              : []),
                            {
                              label: t('demos.deleteFolderShort'),
                              icon: <Trash2 />,
                              danger: true,
                              onSelect: () => setFolderToDelete(folders.find((x) => x.id === folder) ?? null),
                            },
                          ]
                        : []),
                    ] as Array<MenuItem | 'separator'>)
                  : []),
              ]}
            />
            <TagFilter
              store={tagStore}
              selected={tagFilter}
              setSelected={setTagFilter}
              mode={tagMode}
              setMode={setTagMode}
              onManage={editable ? () => setManagingTags(true) : undefined}
            />
            <div className="fd-segmented view-seg" role="radiogroup" aria-label={t('demos.view')}>
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
            <Menu
              label={t('demos.sort')}
              trigger={{ text: sortLabels[sort], chevron: true }}
              items={(Object.keys(sortLabels) as Sort[]).map((k) => ({
                label: sortLabels[k],
                icon: sort === k ? <Check /> : <span />,
                onSelect: () => setSort(k),
              }))}
            />
          </div>
        </div>

        {demos.length === 0 ? (
          // REV-05 : une phrase et « Nouvelle démo » ; les étapes sont dans la prise en main (L26-01)
          <Card className="demos-empty">
            <h2 className="card-title">{t('demos.emptyTitle')}</h2>
            <p className="fd-muted">{editable ? t('demos.emptyBody') : t('demos.emptyBodyViewer')}</p>
            {editable && (
              <Button variant="primary" icon={<Plus />} onClick={openNew}>
                {t('demos.new')}
              </Button>
            )}
          </Card>
        ) : visible.length === 0 && inView.length === 0 && folder !== 'all' ? (
          // DSH-09 : dossier vide (carte de la maquette)
          <div className="fd-card empty-folder">
            <svg className="illu" viewBox="0 0 140 100" aria-hidden="true">
              <rect x="10" y="14" width="120" height="76" rx="10" className="illu-bg" />
              <path
                d="M28 70c14 0 18-22 34-22s20-18 36-18"
                fill="none"
                className="illu-path"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="2 7"
              />
              <circle cx="28" cy="70" r="6" className="illu-dot" />
              <circle cx="62" cy="48" r="6" className="illu-dot" />
              <circle cx="98" cy="30" r="9" className="illu-hot" />
              <circle cx="98" cy="30" r="3.5" fill="#fff" />
            </svg>
            <h3>{t('demos.emptyFolderTitle')}</h3>
            <p className="fd-muted">{t('demos.emptyFolderBody')}</p>
            {editable && (
              <Button variant="primary" icon={<Plus />} onClick={openNew}>
                {t('demos.new')}
              </Button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <p className="fd-muted">{t('demos.noMatch')}</p>
        ) : view === 'list' ? (
          <div className="fd-card demo-table-wrap">
            <table className="demo-table">
              <caption className="sr-only">{t('demos.listCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('demos.colName')}</th>
                  <th scope="col">{t('demos.colStatus')}</th>
                  <th scope="col">{t('demos.colFolder')}</th>
                  <th scope="col" className="r">
                    {t('demos.colViews')}
                  </th>
                  <th scope="col" className="r">
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
                    <tr key={d.id}>
                      <td>
                        <span className="dt-name">
                          <span className="dt-thumb" aria-hidden="true">
                            {covers[d.id] ? <img src={covers[d.id]} alt="" loading="lazy" /> : null}
                          </span>
                          <Link to={`/demos/${d.id}/edit`}>{d.title}</Link>
                        </span>
                        {tagStore.tagsOf(d.id).length > 0 && (
                          <span className="tg-row tg-row--list" aria-label={t('tags.title')}>
                            {tagStore.tagsOf(d.id).map((x) => (
                              <TagChip key={x.id} tag={x} />
                            ))}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`fd-badge status-${statusOf(d)}`}>{t(`status.${statusOf(d)}`)}</span>
                        {lockedIds.has(d.id) && (
                          <span className="fd-badge fd-badge--warning" title={t('rules.accessToFixHelp')}>
                            {t('rules.accessToFix')}
                          </span>
                        )}
                      </td>
                      <td className="fd-muted">{folders.find((f) => f.id === d.folder_id)?.name ?? '—'}</td>
                      <td className="r num">{formatNumber(s?.views ?? 0)}</td>
                      <td className="r">
                        <span className="dt-rate">
                          <span className="dt-bar" aria-hidden="true">
                            <span style={{ width: `${rate}%` }} />
                          </span>
                          <span className="num">{rate} %</span>
                        </span>
                      </td>
                      <td className="fd-muted">
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
                  className="fd-card demo-card"
                  onKeyDown={(e) => {
                    // DSH-05 : ⌘D / Ctrl+D duplique la démo dont la carte a le focus
                    if (editable && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
                      e.preventDefault();
                      duplicate(d);
                    }
                  }}
                >
                  <div className={`demo-cover${covers[d.id] ? ' fd-player-scope' : ''}`} aria-hidden="true">
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
                      <span className={`fd-badge status-${statusOf(d)}`}>{t(`status.${statusOf(d)}`)}</span>
                      {lockedIds.has(d.id) && (
                        <span className="fd-badge fd-badge--warning" title={t('rules.accessToFixHelp')}>
                          {t('rules.accessToFix')}
                        </span>
                      )}
                      <span>
                        {d.status === 'published' ? (
                          <>
                            {t('demos.views', { count: s?.views ?? 0, n: formatNumber(s?.views ?? 0) })} ·{' '}
                            {t('demos.leads', { count: s?.leads ?? 0, n: formatNumber(s?.leads ?? 0) })}{' '}
                            ·{' '}
                          </>
                        ) : (
                          <>{t('demos.steps', { count: stepCounts[d.id] ?? 0 })} · </>
                        )}
                        <time dateTime={d.updated_at} title={formatDateTime(d.updated_at)}>
                          {formatRelativeShort(d.updated_at)}
                        </time>
                      </span>
                    </div>
                    {tagStore.tagsOf(d.id).length > 0 && (
                      <div className="tg-row" aria-label={t('tags.title')}>
                        {tagStore.tagsOf(d.id).map((x) => (
                          <TagChip key={x.id} tag={x} />
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {editable && (
              <li className="demo-new">
                <button type="button" className="demo-new__btn" onClick={openNew}>
                  <span className="fd-btn fd-btn--round" aria-hidden="true">
                    <Plus />
                  </span>
                  <strong>{t('demos.new')}</strong>
                  <span className="fd-muted">{t('demos.newHint')}</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </section>

      {tagging && <TagsDialog demo={tagging} store={tagStore} onClose={() => setTagging(null)} />}
      {managingTags && <ManageTagsDialog store={tagStore} onClose={() => setManagingTags(false)} />}
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
      <NewDemoDialog
        open={newOpen}
        folders={folders}
        defaultFolder={folder !== 'all' && folder !== 'none' ? folder : null}
        onClose={() => setNewOpen(false)}
        onEmpty={async (f) => {
          setNewOpen(false);
          await createDemo(f);
        }}
        onImport={async (files, f) => {
          const id = await run(async () =>
            createDemoFromImages({
              workspaceId: ws.id,
              userId: user!.id,
              folderId: f,
              title: t('demos.untitled'),
              files,
            }),
          );
          if (!id) return;
          setNewOpen(false);
          toast(t('editor.importWarnMany', { count: files.length }), undefined, { tone: 'warning' });
          navigate(`/demos/${id}/edit`);
        }}
        ws={ws.id}
        onGenerate={(f) => {
          setNewOpen(false);
          setGenerating({ folder: f });
        }}
        onTemplate={(f) => {
          setNewOpen(false);
          setTplFolder(f);
        }}
      />
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
                renaming ? setRenaming({ ...renaming, name: e.target.value }) : setNewFolder(e.target.value)
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
              await supabase.from('demos').update({ deleted_at: new Date().toISOString() }).eq('id', d.id),
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
        body={t('demos.confirmDeleteFolder', { name: folderToDelete?.name ?? '' })}
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
        <FolderAccessDialog
          folder={folderAccess}
          onClose={() => setFolderAccess(null)}
          onSaved={() => {
            toast(t('folderAccess.saved'));
            void load();
          }}
        />
      )}
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
  );
}

/** Position stable du point chaud d'une vignette sans capture (comme les vignettes de la maquette). */
function dotPosition(id: string) {
  let h = 0;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return { left: `${22 + (h % 46)}%`, top: `${30 + ((h >>> 8) % 34)}%` };
}
