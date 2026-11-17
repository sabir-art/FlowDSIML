import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  Eye,
  Mail,
  Route,
  Users,
  Copy,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
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
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './demos.css';

type Demo = Tables<'demos'>;
type FolderRow = Tables<'folders'>;
type Stats = { views: number; completions: number; visitors: number; leads: number };
type Kpis = Stats;
type StatusFilter = 'all' | 'draft' | 'published';
type Sort = 'updated' | 'title' | 'views';

export function DemosPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, can } = useWorkspace();
  const ws = current!;
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  const [folder, setFolder] = useState<string | 'all' | 'none'>('all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('updated');
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<Demo | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null);
  const [moving, setMoving] = useState<Demo | null>(null);
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
    setDemos(list);
    setFolders(f.data ?? []);
    setStats(
      Object.fromEntries(((o.data ?? []) as Array<Stats & { demo_id: string }>).map((r) => [r.demo_id, r])),
    );
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
        .select('demo_id')
        .in(
          'demo_id',
          list.map((x) => x.id),
        );
      const n: Record<string, number> = {};
      for (const r of all.data ?? []) n[r.demo_id] = (n[r.demo_id] ?? 0) + 1;
      setStepCounts(n);
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
    const needle = q.trim().toLowerCase();
    const list = (demos ?? []).filter(
      (d) =>
        (folder === 'all' || (folder === 'none' ? !d.folder_id : d.folder_id === folder)) &&
        (status === 'all' || d.status === status) &&
        (!needle || d.title.toLowerCase().includes(needle)),
    );
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title, i18n.language));
    if (sort === 'views')
      return [...list].sort((a, b) => (stats[b.id]?.views ?? 0) - (stats[a.id]?.views ?? 0));
    return list;
  }, [demos, folder, status, q, sort, stats, i18n.language]);

  async function createDemo() {
    const d = await run(async () =>
      check(
        await supabase
          .from('demos')
          .insert({
            workspace_id: ws.id,
            title: t('demos.untitled'),
            created_by: user!.id,
            folder_id: folder !== 'all' && folder !== 'none' ? folder : null,
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
      setRenaming(null);
      setNewFolder(null);
      await load();
    });
  }

  if (!demos) return <Loading />;

  const menuFor = (d: Demo): Array<MenuItem | 'separator'> => [
    { label: t('demos.edit'), icon: <Pencil />, onSelect: () => navigate(`/demos/${d.id}/edit`) },
    { label: t('editor.share'), icon: <Share2 />, onSelect: () => navigate(`/demos/${d.id}/share`) },
    { label: t('nav.analytics'), icon: <BarChart3 />, onSelect: () => navigate(`/demos/${d.id}/analytics`) },
    ...(editable
      ? ([
          'separator',
          {
            label: t('demos.duplicate'),
            icon: <Copy />,
            onSelect: () =>
              void run(async () => {
                check(await supabase.rpc('duplicate_demo', { p_demo: d.id }));
                await load();
              }),
          },
          { label: t('demos.moveTo'), icon: <FolderInput />, onSelect: () => setMoving(d) },
          'separator',
          { label: t('common.delete'), icon: <Trash2 />, danger: true, onSelect: () => setToDelete(d) },
        ] as Array<MenuItem | 'separator'>)
      : []),
  ];

  const counts = {
    all: demos.length,
    published: demos.filter((d) => d.status === 'published').length,
    draft: demos.filter((d) => d.status === 'draft').length,
  };
  const inFolder = (id: string | 'none') =>
    demos.filter((d) => (id === 'none' ? !d.folder_id : d.folder_id === id)).length;
  const kpi = {
    deltaLabel: t('analytics.vsPreviousDays', { count: 30 }),
    noDeltaLabel: t('analytics.noComparison'),
  };
  const sortLabels: Record<Sort, string> = {
    updated: t('demos.sortUpdated'),
    title: t('demos.sortTitle'),
    views: t('demos.sortViews'),
  };
  return (
    <div className="stack page-wide">
      <header className="page-head page-head--refonte">
        <div className="page-head__titles">
          <h1>{t('demos.title')}</h1>
          <p className="page-head__sub">{t('demos.subtitle')}</p>
        </div>
        <div className="page-head__actions">
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
            <Button variant="primary" size="lg" icon={<Plus />} onClick={() => void createDemo()}>
              {t('demos.new')}
            </Button>
          )}
        </div>
      </header>
      {error && <Alert kind="error">{error}</Alert>}

      {kpis && (
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
          <Card>
            <h2 className="card-title">{t('demos.emptyTitle')}</h2>
            <ol className="onboarding-steps">
              <li>{t('demos.emptyStep1')}</li>
              <li>{t('demos.emptyStep2')}</li>
              <li>{t('demos.emptyStep3')}</li>
            </ol>
            {editable && (
              <Button icon={<Plus />} onClick={() => void createDemo()}>
                {t('demos.emptyCta')}
              </Button>
            )}
          </Card>
        ) : visible.length === 0 ? (
          <p className="fd-muted">{t('demos.noMatch')}</p>
        ) : (
          <ul className="demo-grid">
            {visible.map((d) => {
              const s = stats[d.id];
              return (
                <li key={d.id} className="fd-card demo-card">
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
                      <span className={`fd-badge status-${d.status}`}>{t(`status.${d.status}`)}</span>
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
                  </div>
                </li>
              );
            })}
            {editable && (
              <li className="demo-new">
                <button type="button" className="demo-new__btn" onClick={() => void createDemo()}>
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

      <ConfirmDialog
        open={newFolder !== null || renaming !== null}
        title={renaming ? t('demos.renameFolder', { name: '' }).trim() : t('demos.newFolder')}
        body={
          <form onSubmit={saveFolder}>
            <input
              className="fd-input"
              autoFocus
              maxLength={80}
              aria-label={t('demos.folderName')}
              placeholder={t('demos.folderName')}
              value={renaming ? renaming.name : (newFolder ?? '')}
              onChange={(e) =>
                renaming ? setRenaming({ ...renaming, name: e.target.value }) : setNewFolder(e.target.value)
              }
            />
          </form>
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
        confirmLabel={t('common.delete')}
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
          }).then(() => undefined)
        }
      />
      <ConfirmDialog
        open={!!moving}
        title={t('demos.moveTo')}
        body={
          moving && (
            <Select
              aria-label={t('demos.moveTo')}
              defaultValue={moving.folder_id ?? ''}
              onChange={(e) =>
                void run(async () => {
                  check(
                    await supabase
                      .from('demos')
                      .update({ folder_id: e.target.value || null })
                      .eq('id', moving.id),
                  );
                  await load();
                })
              }
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
