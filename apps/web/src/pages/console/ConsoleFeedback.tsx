/**
 * L41 §5 : Retours. « Articles » (satisfaction par article, moins bien notés d'abord) et
 * « Commentaires » (créer un élément, rattacher à…, classer sans suite, supprimer).
 * Jamais l'identité de la personne qui a répondu : seuls l'article, la page et le nom de l'espace.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Archive, Building2, Check, CircleDot, Download, Link2, Plus, Trash2 } from 'lucide-react';
import { FilterMenu } from '../../components/toolbar/ListToolbar';
import { supabase } from '../../lib/supabase';
import { formatDate, formatNumber } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { Menu } from '../../components/Menu';
import { MIN_ANSWERS, satisfaction } from './ConsoleOverview';
import { ItemDialog } from './ConsoleBacklog';
import { consoleChanged } from './ConsolePage';
import {
  WriteButton,
  articleSection,
  articleTitle,
  exportCsv,
  rpcError,
  useConsoleRole,
  type Comment,
  type Item,
} from './shared';

const PERIODS = [30, 90, 365] as const;

interface ArticleRow {
  article: string;
  yes: number;
  no: number;
  comments: number;
  items: number;
}

export function Feedback() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const view = params.get('vue') === 'commentaires' ? 'comments' : 'articles';
  const article = params.get('article');
  const [days, setDays] = useState<number>(90);
  const [ws, setWs] = useState('');
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    void supabase.rpc('console_workspaces').then(({ data }) => setWorkspaces((data as never) ?? []));
  }, []);
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  return (
    <div className="console-stack">
      <h1 className="sr-only">{t('console.tabs.feedback')}</h1>
      <div className="console-bar-row">
        <div className="fd-segmented" role="group" aria-label={t('console.fb.view')}>
          <button type="button" aria-pressed={view === 'articles'} onClick={() => set('vue', null)}>
            {t('console.fb.articles')}
          </button>
          <button type="button" aria-pressed={view === 'comments'} onClick={() => set('vue', 'commentaires')}>
            {t('console.fb.comments')}
          </button>
        </div>
        {/* L41-02 K4 : filtre « Espace : Tous » comme les barres de liste (L40) */}
        <FilterMenu
          icon={<Building2 />}
          label={t('console.fb.space')}
          value={workspaces.find((w) => w.id === ws)?.name ?? t('console.fb.all')}
          active={!!ws}
          items={[
            { label: t('console.fb.all'), icon: ws ? <span /> : <Check />, onSelect: () => setWs('') },
            ...workspaces.map((w) => ({
              label: w.name,
              icon: ws === w.id ? <Check /> : <span />,
              onSelect: () => setWs(w.id),
            })),
          ]}
        />
        {article && (
          <button type="button" className="fd-btn fd-btn--sm" onClick={() => set('article', null)}>
            {t('console.fb.articleFilter', { title: articleTitle(article) })} ×
          </button>
        )}
        <div className="fd-segmented console-bar-row__end" role="group" aria-label={t('console.fb.period')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>
              {t(`console.fb.p${p}`)}
            </button>
          ))}
        </div>
      </div>
      {view === 'articles' ? (
        <Articles days={days} ws={ws} onOpen={(a) => setParams({ vue: 'commentaires', article: a })} />
      ) : (
        <Comments days={days} ws={ws} article={article} />
      )}
    </div>
  );
}

function Articles({ days, ws, onOpen }: { days: number; ws: string; onOpen: (a: string) => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ArticleRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    void supabase
      .rpc('console_articles', { p_days: days, p_workspace: ws || null })
      .then(({ data }) => setRows((data as unknown as ArticleRow[]) ?? []));
  }, [days, ws]);
  // Moins bien notés d'abord ; moins de 5 réponses : après, avec « Peu de réponses »
  const sorted = useMemo(
    () =>
      [...(rows ?? [])].sort((a, b) => {
        const fa = a.yes + a.no >= MIN_ANSWERS;
        const fb = b.yes + b.no >= MIN_ANSWERS;
        if (fa !== fb) return fa ? -1 : 1;
        return satisfaction(a) - satisfaction(b);
      }),
    [rows],
  );
  if (!rows)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  if (!rows.length) return <p className="fd-card console-empty">{t('console.fb.emptyPeriod')}</p>;
  return (
    <section className="fd-card">
      <div className="console-card-head">
        <h2 className="console-h2">{t('console.fb.byArticle')}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--sm"
          onClick={() =>
            exportCsv(
              'retours-articles',
              'export.articles',
              ['article', 'rubrique', 'oui', 'non', 'satisfaction', 'commentaires', 'elements_ouverts'],
              sorted.map((r) => [
                r.article,
                articleSection(r.article),
                r.yes,
                r.no,
                Math.round(satisfaction(r) * 100),
                r.comments,
                r.items,
              ]),
            )
          }
        >
          <Download aria-hidden="true" />
          {t('console.export')}
        </button>
      </div>
      <div className="table-wrap">
        <table className="table console-table">
          <caption className="sr-only">{t('console.fb.byArticle')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('console.fb.article')}</th>
              <th scope="col" className="r">
                {t('console.fb.yes')}
              </th>
              <th scope="col" className="r">
                {t('console.fb.no')}
              </th>
              <th scope="col" aria-sort="ascending">
                {t('console.ov.satisfaction')}
              </th>
              <th scope="col" className="r">
                {t('console.fb.comments')}
              </th>
              <th scope="col" className="r">
                {t('console.tabs.backlog')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const sat = Math.round(satisfaction(r) * 100);
              return (
                <tr key={r.article}>
                  <th scope="row">
                    <button type="button" className="link-button" onClick={() => onOpen(r.article)}>
                      {articleTitle(r.article)}
                    </button>
                    <small className="console-sub">{articleSection(r.article)}</small>
                  </th>
                  <td className="r t-num">{formatNumber(r.yes)}</td>
                  <td className="r t-num">{formatNumber(r.no)}</td>
                  <td>
                    <span className="console-watch__sat">
                      <span className="console-bar" aria-hidden="true">
                        <span style={{ width: `${sat}%` }} />
                      </span>
                      {sat} %{/* L41-02 K5 : en texte, pas en pastille */}
                      {r.yes + r.no < MIN_ANSWERS && <span className="fd-muted">{t('console.fb.few')}</span>}
                    </span>
                  </td>
                  <td className="r t-num">{formatNumber(r.comments)}</td>
                  <td className="r t-num">{formatNumber(r.items)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Comments({ days, ws, article }: { days: number; ws: string; article: string | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const admin = useConsoleRole() === 'admin';
  const [list, setList] = useState<Comment[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState<Comment[] | null>(null);
  const [linking, setLinking] = useState<string[] | null>(null);
  const [dialog, ask] = useConfirm();
  const load = useCallback(() => {
    void supabase
      .rpc('console_comments', { p_days: days, p_workspace: ws || null, p_article: article })
      .then(({ data }) => setList((data as unknown as Comment[]) ?? []));
    void supabase.rpc('console_items').then(({ data }) => setItems((data as unknown as Item[]) ?? []));
  }, [days, ws, article]);
  useEffect(load, [load]);
  const after = () => {
    setSelected([]);
    load();
    consoleChanged();
  };
  const setStatus = async (ids: string[], status: 'new' | 'archived', undo = true) => {
    const { error } = await supabase.rpc('console_set_comments', { p_comments: ids, p_status: status });
    if (error) return toast(rpcError(t, error.message));
    after();
    if (status === 'archived' && undo)
      toast(t('console.fb.archived', { count: ids.length }), {
        label: t('console.undo'),
        durationMs: 8000,
        onClick: () => void setStatus(ids, 'new', false),
      });
  };
  const link = async (ids: string[], item: Item) => {
    const { data, error } = await supabase.rpc('console_link_comments', { p_item: item.id, p_comments: ids });
    if (error) return toast(rpcError(t, error.message));
    setLinking(null);
    after();
    toast(t('console.fb.linked', { title: item.title, count: data as number }), {
      label: t('console.undo'),
      durationMs: 8000,
      onClick: () => void setStatus(ids, 'new', false),
    });
  };
  const remove = async (c: Comment) => {
    const ok = await ask({
      title: t('console.fb.deleteTitle'),
      body: t('console.fb.deleteBody'),
      confirmLabel: t('console.fb.delete'),
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('console_delete_comment', { p_comment: c.id });
    if (error) return toast(rpcError(t, error.message));
    after();
  };
  if (!list)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  const fresh = list.filter((c) => c.status === 'new');
  return (
    <section className="console-stack" aria-label={t('console.fb.comments')}>
      {dialog}
      <div className="console-card-head">
        <p className="fd-muted" role="status">
          {selected.length
            ? t('console.fb.selected', { count: selected.length })
            : t('console.fb.newCount', { count: fresh.length })}
        </p>
        {selected.length > 0 && (
          <WriteButton className="fd-btn fd-btn--sm" onClick={() => setLinking(selected)}>
            <Link2 aria-hidden="true" />
            {t('console.fb.linkTo')}
          </WriteButton>
        )}
        <button
          type="button"
          className="fd-btn fd-btn--sm"
          onClick={() =>
            exportCsv(
              'retours-commentaires',
              'export.comments',
              ['date', 'article', 'page', 'espace', 'commentaire', 'statut', 'element'],
              list.map((c) => [c.at, c.article, c.page, c.workspace, c.text, c.status, c.itemTitle ?? '']),
            )
          }
        >
          <Download aria-hidden="true" />
          {t('console.export')}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="fd-card console-empty">
          {fresh.length ? t('console.fb.emptyPeriod') : t('console.fb.allRead')}
        </p>
      ) : (
        <ul className="console-comments">
          {list.map((c) => (
            <li key={c.id} className="fd-card console-comment">
              <div className="console-comment__head">
                {c.status === 'new' && admin && (
                  <input
                    type="checkbox"
                    aria-label={t('console.fb.select', { title: articleTitle(c.article) })}
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))
                    }
                  />
                )}
                <b>{articleTitle(c.article)}</b>
                <span className="fd-muted">
                  {c.page
                    ? t('console.fb.page', { page: t(`help.page.${c.page}`, { defaultValue: c.page }) })
                    : ''}
                  {c.workspace ? ` · ${c.workspace}` : ` · ${t('console.fb.deletedSpace')}`} ·{' '}
                  {formatDate(c.at)}
                </span>
              </div>
              <p className="console-comment__text">{c.text}</p>
              <div className="console-comment__foot">
                {c.status === 'new' && (
                  <span className="console-status">
                    <CircleDot aria-hidden="true" />
                    {t('console.fb.statusNew')}
                  </span>
                )}
                {c.status === 'linked' && (
                  <span className="console-status">
                    <Link2 aria-hidden="true" />
                    {t('console.fb.statusLinked', { title: c.itemTitle ?? '' })}
                  </span>
                )}
                {c.status === 'archived' && (
                  <span className="console-status">
                    <Archive aria-hidden="true" />
                    {t('console.fb.statusArchived')}
                  </span>
                )}
                <span className="console-comment__acts">
                  {c.status === 'new' ? (
                    <>
                      <WriteButton
                        className="fd-btn fd-btn--primary fd-btn--sm"
                        onClick={() => setCreating([c])}
                      >
                        <Plus aria-hidden="true" />
                        {t('console.fb.createItem')}
                      </WriteButton>
                      <WriteButton className="fd-btn fd-btn--sm" onClick={() => setLinking([c.id])}>
                        {t('console.fb.linkTo')}
                      </WriteButton>
                      <WriteButton
                        className="fd-btn fd-btn--ghost fd-btn--sm"
                        onClick={() => void setStatus([c.id], 'archived')}
                      >
                        {t('console.fb.archive')}
                      </WriteButton>
                    </>
                  ) : (
                    <WriteButton
                      className="fd-btn fd-btn--ghost fd-btn--sm"
                      onClick={() => void setStatus([c.id], 'new', false)}
                    >
                      {c.status === 'linked' ? t('console.fb.unlink') : t('console.fb.reopen')}
                    </WriteButton>
                  )}
                  {admin && (
                    <Menu
                      label={t('console.fb.more', { title: articleTitle(c.article) })}
                      items={[
                        {
                          label: t('console.fb.delete'),
                          icon: <Trash2 />,
                          danger: true,
                          onSelect: () => void remove(c),
                        },
                      ]}
                    />
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="fd-muted console-note">{t('console.fb.retention')}</p>
      {creating && (
        <ItemDialog
          comments={creating}
          onClose={() => setCreating(null)}
          onCreated={() => {
            setCreating(null);
            after();
          }}
        />
      )}
      {linking && (
        <LinkDialog
          items={items.filter((i) => i.status !== 'done' && i.status !== 'rejected')}
          article={list.find((c) => c.id === linking[0])?.article ?? null}
          count={linking.length}
          onPick={(it) => void link(linking, it)}
          onClose={() => setLinking(null)}
        />
      )}
    </section>
  );
}

/** « Rattacher à… » : éléments ouverts, ceux du même article en premier. */
function LinkDialog({
  items,
  article,
  count,
  onPick,
  onClose,
}: {
  items: Item[];
  article: string | null;
  count: number;
  onPick: (it: Item) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const list = items
    .filter((i) => i.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.article === article) - Number(a.article === article));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal console-link" role="dialog" aria-modal="true" aria-labelledby="cl-t">
        <div className="modal-head">
          <h2 id="cl-t">{t('console.fb.linkTitle', { count })}</h2>
        </div>
        <div className="modal-body fd-stack">
          <input
            className="input"
            type="search"
            autoFocus
            aria-label={t('console.fb.searchItem')}
            placeholder={t('console.fb.searchItem')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {list.length === 0 ? (
            <p className="fd-muted">{t('console.bl.empty')}</p>
          ) : (
            <ul className="console-link__list">
              {list.map((it) => (
                <li key={it.id}>
                  <button type="button" className="console-link__opt" onClick={() => onPick(it)}>
                    <b>{it.title}</b>
                    <span className="fd-muted">
                      {t(`console.status.${it.status}`)} · {t('console.bl.feedbackN', { count: it.feedback })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
