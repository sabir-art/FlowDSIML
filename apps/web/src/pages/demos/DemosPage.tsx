import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import './demos.css';

type Demo = Tables<'demos'>;
type Folder = Tables<'folders'>;
type Stats = { views: number; completions: number; visitors: number; leads: number };
type StatusFilter = 'all' | 'draft' | 'published';

export function DemosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, can } = useWorkspace();
  const ws = current!;
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<{
    published_demos: number;
    limits: { published_demos: number | null };
  } | null>(null);
  const [folder, setFolder] = useState<string | 'all' | 'none'>('all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
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
    // Vignettes : image de la première étape de chaque démo (URL signée).
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
    return (demos ?? []).filter(
      (d) =>
        (folder === 'all' || (folder === 'none' ? !d.folder_id : d.folder_id === folder)) &&
        (status === 'all' || d.status === status) &&
        (!needle || d.title.toLowerCase().includes(needle)),
    );
  }, [demos, folder, status, q]);

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

  async function addFolder() {
    const name = prompt(t('demos.folderName'));
    if (!name?.trim()) return;
    await run(async () => {
      check(await supabase.from('folders').insert({ workspace_id: ws.id, name: name.trim().slice(0, 80) }));
      await load();
    });
  }

  if (!demos) return <Loading />;
  const limit = usage?.limits?.published_demos;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t('demos.title')}</h1>
        {editable && (
          <div className="row">
            <Button variant="primary" onClick={() => void createDemo()}>
              + {t('demos.new')}
            </Button>
          </div>
        )}
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {usage && limit !== null && limit !== undefined && (
        <div className={`fd-alert ${usage.published_demos >= limit ? 'fd-alert--error' : ''}`}>
          {t('demos.usage', { used: usage.published_demos, limit })}
        </div>
      )}

      <div className="demos-layout">
        <nav className="folders" aria-label={t('demos.folders')}>
          <button className={folder === 'all' ? 'active' : ''} onClick={() => setFolder('all')}>
            {t('demos.allDemos')} <span>{demos.length}</span>
          </button>
          <button className={folder === 'none' ? 'active' : ''} onClick={() => setFolder('none')}>
            {t('demos.noFolder')} <span>{demos.filter((d) => !d.folder_id).length}</span>
          </button>
          {folders.map((f) => (
            <div key={f.id} className="folder-row">
              <button className={folder === f.id ? 'active' : ''} onClick={() => setFolder(f.id)}>
                📁 {f.name} <span>{demos.filter((d) => d.folder_id === f.id).length}</span>
              </button>
              {editable && (
                <span className="folder-actions">
                  <button
                    aria-label={t('demos.renameFolder', { name: f.name })}
                    onClick={() => {
                      const name = prompt(t('demos.folderName'), f.name);
                      if (name?.trim())
                        void run(async () => {
                          check(
                            await supabase
                              .from('folders')
                              .update({ name: name.trim().slice(0, 80) })
                              .eq('id', f.id),
                          );
                          await load();
                        });
                    }}
                  >
                    ✎
                  </button>
                  <button
                    aria-label={t('demos.deleteFolder', { name: f.name })}
                    onClick={() => {
                      if (!confirm(t('demos.confirmDeleteFolder', { name: f.name }))) return;
                      void run(async () => {
                        check(await supabase.from('folders').delete().eq('id', f.id));
                        if (folder === f.id) setFolder('all');
                        await load();
                      });
                    }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          ))}
          {editable && (
            <button className="folder-add" onClick={() => void addFolder()}>
              + {t('demos.newFolder')}
            </button>
          )}
        </nav>

        <section>
          <div className="toolbar">
            <input
              className="fd-input"
              style={{ maxWidth: 300 }}
              type="search"
              placeholder={t('demos.search')}
              aria-label={t('demos.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="fd-select"
              style={{ width: 'auto' }}
              aria-label={t('demos.status')}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">{t('demos.allStatuses')}</option>
              <option value="published">{t('status.published')}</option>
              <option value="draft">{t('status.draft')}</option>
            </select>
          </div>

          {demos.length === 0 ? (
            <Card>
              <h2 style={{ marginTop: 0 }}>{t('demos.emptyTitle')}</h2>
              <ol className="onboarding-steps">
                <li>{t('demos.emptyStep1')}</li>
                <li>{t('demos.emptyStep2')}</li>
                <li>{t('demos.emptyStep3')}</li>
              </ol>
              {editable && (
                <Button variant="primary" onClick={() => void createDemo()}>
                  {t('demos.emptyCta')}
                </Button>
              )}
            </Card>
          ) : visible.length === 0 ? (
            <p className="fd-muted">{t('demos.noMatch')}</p>
          ) : (
            <div className="grid-cards">
              {visible.map((d) => {
                const s = stats[d.id];
                return (
                  <article key={d.id} className="fd-card demo-card">
                    <Link to={`/demos/${d.id}/edit`} className="demo-cover" aria-label={d.title}>
                      {covers[d.id] ? <img src={covers[d.id]} alt="" loading="lazy" /> : <span>▶</span>}
                    </Link>
                    <div className="demo-body">
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <h3 title={d.title}>
                          <Link to={`/demos/${d.id}/edit`}>{d.title}</Link>
                        </h3>
                        <span className={`fd-badge status-${d.status}`}>{t(`status.${d.status}`)}</span>
                      </div>
                      <p className="fd-muted demo-meta">
                        {t('demos.stats', { views: s?.views ?? 0, leads: s?.leads ?? 0 })} ·{' '}
                        {new Date(d.updated_at).toLocaleDateString()}
                      </p>
                      <div className="row demo-actions">
                        <Link className="fd-btn fd-btn--sm" to={`/demos/${d.id}/share`}>
                          {t('editor.share')}
                        </Link>
                        <Link className="fd-btn fd-btn--sm" to={`/demos/${d.id}/analytics`}>
                          {t('nav.analytics')}
                        </Link>
                        {editable && (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                void run(async () => {
                                  check(await supabase.rpc('duplicate_demo', { p_demo: d.id }));
                                  await load();
                                })
                              }
                            >
                              {t('demos.duplicate')}
                            </Button>
                            <select
                              className="fd-select demo-move"
                              aria-label={t('demos.moveTo')}
                              value={d.folder_id ?? ''}
                              onChange={(e) =>
                                void run(async () => {
                                  check(
                                    await supabase
                                      .from('demos')
                                      .update({ folder_id: e.target.value || null })
                                      .eq('id', d.id),
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
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="btn-danger-ghost"
                              aria-label={t('demos.delete', { title: d.title })}
                              onClick={() => {
                                if (!confirm(t('demos.confirmDelete', { title: d.title }))) return;
                                void run(async () => {
                                  if (d.status === 'published')
                                    check(await supabase.rpc('unpublish_demo', { p_demo: d.id }));
                                  check(
                                    await supabase
                                      .from('demos')
                                      .update({ deleted_at: new Date().toISOString() })
                                      .eq('id', d.id),
                                  );
                                  await supabase.storage.from('published').remove([`${d.id}/latest.json`]);
                                  await load();
                                });
                              }}
                            >
                              ✕
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
