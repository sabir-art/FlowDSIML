/**
 * L41 §6 : Backlog en colonnes (À trier, Planifié, En cours, Fait ; Rejetés repliés), fiche d'un élément
 * en tiroir (enregistrement automatique), création d'un élément, et « Annoncer cette amélioration ? »
 * au passage à Fait. Ticket GitHub : lien seulement, aucun appel.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, ExternalLink, Megaphone, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Menu } from '../../components/Menu';
import { ARTICLES } from '../../help/articles';
import { consoleChanged } from './ConsolePage';
import { NewsEditor } from './ConsoleNews';
import {
  GITHUB_RE,
  PRIORITIES,
  STATUSES,
  WriteButton,
  articleTitle,
  exportCsv,
  rpcError,
  ticketNumber,
  useConsoleRole,
  type Comment,
  type Item,
  type ItemStatus,
  type Priority,
} from './shared';

const COLUMNS: ItemStatus[] = ['triage', 'planned', 'in_progress', 'done'];

export function Backlog() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { itemId } = useParams();
  const [items, setItems] = useState<Item[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<Item | null>(null);
  const [writing, setWriting] = useState<Item | null>(null);
  const [rejecting, setRejecting] = useState<Item | null>(null);
  const load = useCallback(() => {
    void supabase.rpc('console_items').then(({ data }) => setItems((data as unknown as Item[]) ?? []));
  }, []);
  useEffect(load, [load]);

  const move = async (it: Item, status: ItemStatus, rejectReason?: string) => {
    if (status === 'rejected' && !rejectReason) return setRejecting(it);
    const { error } = await supabase.rpc('console_update_item', {
      p_id: it.id,
      p_patch: { status, ...(rejectReason ? { rejectReason } : {}) },
    });
    if (error) return toast(rpcError(t, error.message));
    load();
    consoleChanged();
    if (status === 'done' && !it.announced) setAnnounce({ ...it, status });
  };

  if (!items)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  const rejected = items.filter((i) => i.status === 'rejected');
  return (
    <div className="console-stack">
      <h1 className="sr-only">{t('console.tabs.backlog')}</h1>
      <div className="console-card-head">
        <WriteButton className="fd-btn fd-btn--primary fd-btn--sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          {t('console.bl.new')}
        </WriteButton>
        <button
          type="button"
          className="fd-btn fd-btn--sm"
          onClick={() =>
            exportCsv(
              'backlog',
              'export.backlog',
              [
                'titre',
                'statut',
                'priorite',
                'article',
                'retours',
                'ticket',
                'motif_rejet',
                'cree',
                'modifie',
                'note',
              ],
              items.map((i) => [
                i.title,
                i.status,
                i.priority,
                i.article ?? '',
                i.feedback,
                i.githubUrl ?? '',
                i.rejectReason ?? '',
                i.createdAt,
                i.updatedAt,
                i.note,
              ]),
            )
          }
        >
          <Download aria-hidden="true" />
          {t('console.export')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="fd-card console-empty">
          <p>{t('console.bl.empty')}</p>
        </div>
      ) : (
        <div className="console-cols">
          {COLUMNS.map((col) => {
            const list = items.filter((i) => i.status === col);
            return (
              <section key={col} className="console-col" aria-labelledby={`col-${col}`}>
                <h2 id={`col-${col}`} className="console-col__t">
                  {t(`console.status.${col}`)} <span className="fd-muted">{list.length}</span>
                </h2>
                <ul className="console-col__list">
                  {list.map((it) => (
                    <li key={it.id}>
                      <Card
                        item={it}
                        fresh={fresh === it.id}
                        onOpen={() => navigate(`/console/backlog/${it.id}`)}
                        onMove={(s) => void move(it, s)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {rejected.length > 0 && (
        <details className="fd-card console-rejected">
          <summary>{t('console.bl.rejected', { count: rejected.length })}</summary>
          <ul>
            {rejected.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate(`/console/backlog/${it.id}`)}
                >
                  {it.title}
                </button>{' '}
                <span className="fd-muted">· {it.rejectReason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {creating && (
        <ItemDialog
          comments={[]}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setFresh(id);
            load();
            consoleChanged();
          }}
        />
      )}
      {itemId && (
        <ItemDrawer
          id={itemId}
          onClose={() => navigate('/console/backlog')}
          onChanged={load}
          onMove={(it, s) => void move(it, s)}
          onAnnounce={(it) => setWriting(it)}
        />
      )}
      {rejecting && (
        <RejectDialog
          onClose={() => setRejecting(null)}
          onConfirm={(reason) => {
            const it = rejecting;
            setRejecting(null);
            void move(it, 'rejected', reason);
          }}
        />
      )}
      {announce && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="an-t"
            aria-describedby="an-b"
          >
            <div className="modal-head">
              <h2 id="an-t">{t('console.bl.announceTitle')}</h2>
            </div>
            <div className="modal-body">
              <p id="an-b">{t('console.bl.announceBody')}</p>
            </div>
            <div className="modal-foot">
              <button type="button" className="fd-btn" autoFocus onClick={() => setAnnounce(null)}>
                {t('console.bl.later')}
              </button>
              <button
                type="button"
                className="fd-btn fd-btn--primary"
                onClick={() => {
                  setWriting(announce);
                  setAnnounce(null);
                }}
              >
                {t('console.bl.write')}
              </button>
            </div>
          </div>
        </div>
      )}
      {writing && (
        <NewsEditor
          news={null}
          item={writing}
          onClose={() => setWriting(null)}
          onSaved={() => {
            setWriting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Card({
  item,
  fresh,
  onOpen,
  onMove,
}: {
  item: Item;
  fresh: boolean;
  onOpen: () => void;
  onMove: (s: ItemStatus) => void;
}) {
  const { t } = useTranslation();
  const admin = useConsoleRole() === 'admin';
  const n = ticketNumber(item.githubUrl);
  return (
    <div className={`console-card${fresh ? ' is-fresh' : ''}`}>
      <button type="button" className="console-card__open" onClick={onOpen}>
        <b>
          {item.title}
          <span className="sr-only">{`, ${t(`console.status.${item.status}`)}, ${t('console.bl.priorityOf')} `}</span>
        </b>
        <span className="console-card__meta">
          <span className={`badge console-prio console-prio--${item.priority}`}>
            {t(`console.priority.${item.priority}`)}
          </span>
          <span>{t('console.bl.feedbackN', { count: item.feedback })}</span>
          {n && <span>#{n}</span>}
          {item.announced && <span className="badge badge-primary">{t('console.bl.announced')}</span>}
        </span>
        {item.article && <span className="console-card__art fd-muted">{articleTitle(item.article)}</span>}
      </button>
      {admin && (
        <Menu
          label={t('console.bl.cardMenu', { title: item.title })}
          items={STATUSES.filter((s) => s !== item.status).map((s) => ({
            label: t('console.bl.moveTo', { status: t(`console.status.${s}`) }),
            onSelect: () => onMove(s),
          }))}
        />
      )}
    </div>
  );
}

interface ItemDetail extends Item {
  announcedAt: string | null;
  feedbackList: Array<{ id: string; article: string; workspace: string; at: string; text: string | null }>;
  history: Array<{ status: ItemStatus; at: string; actor: string }>;
}

function ItemDrawer({
  id,
  onClose,
  onChanged,
  onMove,
  onAnnounce,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onMove: (it: Item, s: ItemStatus) => void;
  onAnnounce: (it: Item) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const admin = useConsoleRole() === 'admin';
  const [d, setD] = useState<ItemDetail | null>(null);
  const [saved, setSaved] = useState(true);
  const [ghErr, setGhErr] = useState(false);
  const timer = useRef<number>(undefined);
  const load = useCallback(() => {
    void supabase.rpc('console_item', { p_id: id }).then(({ data }) => {
      const r = data as unknown as
        | (Item & {
            feedback: ItemDetail['feedbackList'];
            announcedAt: string | null;
            history: ItemDetail['history'];
          })
        | null;
      if (r) setD({ ...r, feedback: r.feedback.length, feedbackList: r.feedback });
    });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Enregistrement automatique (600 ms après la dernière frappe)
  const patch = (p: Partial<Item>) => {
    if (!d || !admin) return;
    setD({ ...d, ...p });
    if ('githubUrl' in p) {
      const bad = !!p.githubUrl && !GITHUB_RE.test(p.githubUrl);
      setGhErr(bad);
      if (bad) return;
    }
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const { error } = await supabase.rpc('console_update_item', { p_id: id, p_patch: p as never });
      if (error) return toast(rpcError(t, error.message));
      setSaved(true);
      onChanged();
    }, 600);
  };
  if (!d) return null;
  const n = ticketNumber(d.githubUrl);
  return (
    <div
      className="modal-backdrop console-drawer-back"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="modal console-drawer" role="dialog" aria-modal="true" aria-labelledby="dr-t">
        <div className="modal-head">
          <span className="badge">{t(`console.status.${d.status}`)}</span>
          <h2 id="dr-t">{t('console.bl.item')}</h2>
          <span className="fd-muted" role="status">
            {saved ? t('console.bl.saved') : t('console.bl.saving')}
          </span>
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body fd-stack fd-stack--group">
          <div className="field">
            <label htmlFor="it-title">{t('console.bl.title')}</label>
            <input
              id="it-title"
              className="input"
              maxLength={120}
              readOnly={!admin}
              value={d.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
          <fieldset className="field">
            <legend>{t('console.bl.status')}</legend>
            <div className="fd-segmented console-status-group">
              {STATUSES.map((s) => (
                <WriteButton
                  key={s}
                  className=""
                  pressed={d.status === s}
                  onClick={() => d.status !== s && onMove(d, s)}
                >
                  {t(`console.status.${s}`)}
                </WriteButton>
              ))}
            </div>
            {d.status === 'rejected' && d.rejectReason && (
              <p className="help">{t('console.bl.reason', { reason: d.rejectReason })}</p>
            )}
          </fieldset>
          <div className="field">
            <label htmlFor="it-prio">{t('console.bl.priority')}</label>
            <select
              id="it-prio"
              className="input"
              disabled={!admin}
              value={d.priority}
              onChange={(e) => patch({ priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`console.priority.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="it-art">{t('console.bl.article')}</label>
            <select
              id="it-art"
              className="input"
              disabled={!admin}
              value={d.article ?? ''}
              onChange={(e) => patch({ article: e.target.value || null })}
            >
              <option value="">{t('console.bl.noArticle')}</option>
              {ARTICLES.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="it-gh">
              {t('console.bl.ticket')} <span className="opt">{t('plans.optional')}</span>
            </label>
            <input
              id="it-gh"
              className="input"
              type="url"
              inputMode="url"
              readOnly={!admin}
              value={d.githubUrl ?? ''}
              aria-invalid={ghErr || undefined}
              aria-describedby="it-gh-h"
              onChange={(e) => patch({ githubUrl: e.target.value.trim() || null })}
            />
            <span className="help" id="it-gh-h">
              {ghErr ? t('console.bl.ticketInvalid') : t('console.bl.ticketHelp')}
            </span>
            {n && !ghErr && (
              <a className="link-button" href={d.githubUrl!} target="_blank" rel="noopener noreferrer">
                {t('console.bl.openTicket', { n })}
                <ExternalLink aria-hidden="true" />
              </a>
            )}
          </div>
          <div className="field">
            <label htmlFor="it-note">{t('console.bl.note')}</label>
            <textarea
              id="it-note"
              className="input"
              rows={3}
              maxLength={2000}
              readOnly={!admin}
              value={d.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </div>
          {d.status === 'done' && !d.announced && (
            <WriteButton className="fd-btn" onClick={() => onAnnounce(d)}>
              <Megaphone aria-hidden="true" />
              {t('console.bl.announce')}
            </WriteButton>
          )}
          <section aria-labelledby="it-fb">
            <h3 id="it-fb" className="console-h3">
              {t('console.bl.grouped', { count: d.feedbackList.length })}
            </h3>
            <ul className="console-mini">
              {d.feedbackList.map((f) => (
                <li key={f.id}>
                  <span className="fd-muted">
                    {articleTitle(f.article)} · {f.workspace || t('console.fb.deletedSpace')} ·{' '}
                    {formatDate(f.at)}
                  </span>
                  <p>{f.text ?? t('console.bl.commentDeleted')}</p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="it-hist">
            <h3 id="it-hist" className="console-h3">
              {t('console.bl.history')}
            </h3>
            <ul className="console-mini">
              {d.history.map((h, i) => (
                <li key={i}>
                  {t(`console.status.${h.status}`)} · {h.actor} · {formatDateTime(h.at)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}

/** « Créer un élément » (depuis un commentaire) et « Nouvel élément ». */
export function ItemDialog({
  comments,
  onClose,
  onCreated,
}: {
  comments: Comment[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const first = comments[0];
  const [title, setTitle] = useState(first ? first.text.slice(0, 120) : '');
  const [priority, setPriority] = useState<Priority>('medium');
  const [article, setArticle] = useState(first?.article ?? '');
  const [gh, setGh] = useState('');
  const [busy, setBusy] = useState(false);
  const ghBad = !!gh.trim() && !GITHUB_RE.test(gh.trim());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || ghBad) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('console_create_item', {
      p_title: title.trim(),
      p_priority: priority,
      p_article: article || null,
      p_github_url: gh.trim() || null,
      p_comments: comments.map((c) => c.id),
    });
    setBusy(false);
    if (error) return toast(rpcError(t, error.message));
    toast(comments.length ? t('console.bl.createdLinked') : t('console.bl.created'));
    onCreated(data as string);
  }
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ni-t" onSubmit={submit}>
        <div className="modal-head">
          <h2 id="ni-t">{comments.length ? t('console.fb.createItem') : t('console.bl.new')}</h2>
        </div>
        <div className="modal-body fd-stack">
          <div className="field">
            <label htmlFor="ni-title">{t('console.bl.title')}</label>
            <input
              id="ni-title"
              className="input"
              required
              maxLength={120}
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ni-prio">{t('console.bl.priority')}</label>
            <select
              id="ni-prio"
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`console.priority.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ni-art">{t('console.bl.article')}</label>
            <select
              id="ni-art"
              className="input"
              value={article}
              onChange={(e) => setArticle(e.target.value)}
            >
              <option value="">{t('console.bl.noArticle')}</option>
              {ARTICLES.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ni-gh">
              {t('console.bl.ticket')} <span className="opt">{t('plans.optional')}</span>
            </label>
            <input
              id="ni-gh"
              className="input"
              type="url"
              value={gh}
              aria-invalid={ghBad || undefined}
              aria-describedby="ni-gh-h"
              onChange={(e) => setGh(e.target.value)}
            />
            <span className="help" id="ni-gh-h">
              {ghBad ? t('console.bl.ticketInvalid') : t('console.bl.ticketHelp')}
            </span>
          </div>
          {first && (
            <blockquote className="console-quote">
              <span className="fd-muted">{t('console.bl.attached')}</span>
              {first.text}
            </blockquote>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="fd-btn fd-btn--primary" disabled={busy || !title.trim() || ghBad}>
            {t('console.bl.create')}
          </button>
        </div>
      </form>
    </div>
  );
}

function RejectDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rj-t"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onConfirm(reason.trim());
        }}
      >
        <div className="modal-head">
          <h2 id="rj-t">{t('console.bl.rejectTitle')}</h2>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="rj-r">{t('console.bl.rejectReason')}</label>
            <textarea
              id="rj-r"
              className="input"
              rows={3}
              required
              maxLength={280}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="fd-btn fd-btn--danger" disabled={!reason.trim()}>
            {t('console.bl.reject')}
          </button>
        </div>
      </form>
    </div>
  );
}
