import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Check,
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
  X,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card, Select } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { Menu, type MenuItem } from '../../components/Menu';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './demos.css';

type Demo = Tables<'demos'>;
type FolderRow = Tables<'folders'>;
type Stats = { views: number; completions: number; visitors: number; leads: number };
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
  const [usage, setUsage] = useState<{
    published_demos: number;
    limits: { published_demos: number | null };
  } | null>(null);
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

  const load = useCallback(async () => {
    const [d, f, o, u] = await Promise.all([
      supabase
        .from('demos')
        .select('*')
        .eq('workspace_id', ws.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
      supabase.from('folders').select('*').eq('workspace_id', ws.id).order('name'),
      supabase.rpc('workspace_overview', { p_workspace: ws.id, p_days: 30 }),
      supabase.rpc('workspace_usage', { p_workspace: ws.id }),
    ]);
    const list = d.data ?? [];
    setDemos(list);
    setFolders(f.data ?? []);
    setStats(
      Object.fromEntries(((o.data ?? []) as Array<Stats & { demo_id: string }>).map((r) => [r.demo_id, r])),
    );
    setUsage(u.data as never);
    if (list.length) {
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

  async function saveFolder(e: FormEvent) {
    e.preventDefault();
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
  const limit = usage?.limits?.published_demos;

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

  const folderInput = (value: string, onChange: (v: string) => void, onCancel: () => void) => (
    <form className="folder-form" onSubmit={saveFolder}>
      <input
        className="fd-input"
        autoFocus
        maxLength={80}
        aria-label={t('demos.folderName')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <Button type="submit" size="sm" variant="ghost" icon={<Check />} aria-label={t('common.save')} />
      <Button size="sm" variant="ghost" icon={<X />} aria-label={t('common.cancel')} onClick={onCancel} />
    </form>
  );

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t('demos.title')}</h1>
        {editable && (
          <Button variant="primary" icon={<Plus />} onClick={() => void createDemo()}>
            {t('demos.new')}
          </Button>
        )}
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {usage && limit !== null && limit !== undefined && (
        <Alert kind={usage.published_demos >= limit ? 'error' : 'info'}>
          {t('demos.usage', { used: usage.published_demos, limit })}
        </Alert>
      )}

      <div className="demos-layout">
        <nav className="folders" aria-label={t('demos.folders')}>
          <button
            className={folder === 'all' ? 'active' : ''}
            aria-current={folder === 'all'}
            onClick={() => setFolder('all')}
          >
            <Layers size={16} aria-hidden="true" />
            {t('demos.allDemos')}
            <span className="count">{demos.length}</span>
          </button>
          <button
            className={folder === 'none' ? 'active' : ''}
            aria-current={folder === 'none'}
            onClick={() => setFolder('none')}
          >
            <FolderOpen size={16} aria-hidden="true" />
            {t('demos.noFolder')}
            <span className="count">{demos.filter((d) => !d.folder_id).length}</span>
          </button>
          {folders.map((f) =>
            renaming?.id === f.id ? (
              <div key={f.id}>
                {folderInput(
                  renaming.name,
                  (name) => setRenaming({ id: f.id, name }),
                  () => setRenaming(null),
                )}
              </div>
            ) : (
              <div key={f.id} className="folder-row">
                <button
                  className={folder === f.id ? 'active' : ''}
                  aria-current={folder === f.id}
                  onClick={() => setFolder(f.id)}
                >
                  <Folder size={16} aria-hidden="true" />
                  <span className="folder-name">{f.name}</span>
                  <span className="count">{demos.filter((d) => d.folder_id === f.id).length}</span>
                </button>
                {editable && (
                  <Menu
                    label={t('demos.folderActions', { name: f.name })}
                    items={[
                      {
                        label: t('demos.rename'),
                        icon: <Pencil />,
                        onSelect: () => setRenaming({ id: f.id, name: f.name }),
                      },
                      {
                        label: t('common.delete'),
                        icon: <Trash2 />,
                        danger: true,
                        onSelect: () => setFolderToDelete(f),
                      },
                    ]}
                  />
                )}
              </div>
            ),
          )}
          {editable &&
            (newFolder !== null ? (
              folderInput(newFolder, setNewFolder, () => setNewFolder(null))
            ) : (
              <button className="folder-add" onClick={() => setNewFolder('')}>
                <FolderPlus size={16} aria-hidden="true" />
                {t('demos.newFolder')}
              </button>
            ))}
        </nav>

        <section aria-label={t('demos.title')}>
          <div className="toolbar">
            <div className="search">
              <Search size={16} aria-hidden="true" />
              <input
                className="fd-input"
                type="search"
                placeholder={t('demos.search')}
                aria-label={t('demos.search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select
              inline
              aria-label={t('demos.status')}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">{t('demos.allStatuses')}</option>
              <option value="published">{t('status.published')}</option>
              <option value="draft">{t('status.draft')}</option>
            </Select>
            <Select
              inline
              aria-label={t('demos.sort')}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="updated">{t('demos.sortUpdated')}</option>
              <option value="title">{t('demos.sortTitle')}</option>
              <option value="views">{t('demos.sortViews')}</option>
            </Select>
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
            <ul className="grid-cards demo-grid">
              {visible.map((d) => {
                const s = stats[d.id];
                return (
                  <li key={d.id} className="fd-card demo-card">
                    <div className="demo-cover" aria-hidden="true">
                      {covers[d.id] ? (
                        <img src={covers[d.id]} alt="" loading="lazy" />
                      ) : (
                        <span className="demo-cover-empty">
                          <svg viewBox="0 0 120 48" className="demo-trail">
                            <path d="M12 38c18 0 22-14 48-14s30-14 48-14" />
                            <circle cx="12" cy="38" r="5" />
                            <circle cx="60" cy="24" r="5" />
                            <circle cx="108" cy="10" r="7" className="demo-trail-hot" />
                          </svg>
                          <span className="demo-cover-title">{d.title}</span>
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
                          {t('demos.views', { count: s?.views ?? 0, n: formatNumber(s?.views ?? 0) })} ·{' '}
                          {t('demos.leads', { count: s?.leads ?? 0, n: formatNumber(s?.leads ?? 0) })}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={d.updated_at} title={formatDateTime(d.updated_at)}>
                          {formatRelative(d.updated_at)}
                        </time>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

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
