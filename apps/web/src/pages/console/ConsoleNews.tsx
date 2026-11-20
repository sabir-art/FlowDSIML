/**
 * L41 §7.1 : Nouveautés (console). Annonces publiées et brouillons ; rédaction avec aperçu côté
 * client ; retrait (masque l'annonce chez les clients). Ni nom de client ni donnée d'un espace.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { ARTICLES } from '../../help/articles';
import { WriteButton, articleTitle, rpcError, type Item } from './shared';

export interface News {
  id: string;
  title: string;
  body: string;
  article: string | null;
  itemId: string | null;
  itemTitle: string | null;
  state: 'draft' | 'published' | 'withdrawn';
  publishedAt: string | null;
  updatedAt: string;
}

export function NewsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [list, setList] = useState<News[] | null>(null);
  const [editing, setEditing] = useState<News | 'new' | null>(null);
  const [preview, setPreview] = useState(false);
  const [dialog, ask] = useConfirm();
  const load = useCallback(() => {
    void supabase.rpc('console_news').then(({ data }) => setList((data as unknown as News[]) ?? []));
  }, []);
  useEffect(load, [load]);
  if (!list)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  const published = list.filter((n) => n.state === 'published');
  const drafts = list.filter((n) => n.state === 'draft');
  const withdraw = async (n: News) => {
    const ok = await ask({
      title: t('console.nw.withdrawTitle'),
      body: t('console.nw.withdrawBody'),
      confirmLabel: t('console.nw.withdraw'),
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('console_withdraw_news', { p_id: n.id });
    if (error) return toast(rpcError(t, error.message));
    load();
  };
  const section = (title: string, items: News[]) => (
    <section className="console-stack" aria-label={title}>
      <h2 className="console-h2">{title}</h2>
      {items.length === 0 ? (
        <p className="fd-muted">{t('console.nw.empty')}</p>
      ) : (
        <ul className="console-news">
          {items.map((n) => (
            <li key={n.id} className="fd-card console-news__card">
              <p className="fd-muted">{n.publishedAt ? formatDate(n.publishedAt) : t('console.nw.draft')}</p>
              <h3 className="console-h3">{n.title}</h3>
              <p>{n.body}</p>
              <p className="fd-muted">
                {n.article ? t('console.nw.helpLink', { title: articleTitle(n.article) }) : ''}
                {n.article ? ' · ' : ''}
                {n.itemTitle ? t('console.nw.fromItem', { title: n.itemTitle }) : t('console.nw.free')}
              </p>
              <div className="console-comment__acts">
                <WriteButton className="fd-btn fd-btn--sm" onClick={() => setEditing(n)}>
                  {t('console.nw.edit')}
                </WriteButton>
                {n.state === 'published' && (
                  <WriteButton className="fd-btn fd-btn--ghost fd-btn--sm" onClick={() => void withdraw(n)}>
                    {t('console.nw.withdraw')}
                  </WriteButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <div className="console-stack">
      {dialog}
      <h1 className="sr-only">{t('console.tabs.news')}</h1>
      <div className="console-card-head">
        <WriteButton className="fd-btn fd-btn--primary fd-btn--sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          {t('console.nw.new')}
        </WriteButton>
        <button type="button" className="fd-btn fd-btn--sm" onClick={() => setPreview(true)}>
          {t('console.nw.preview')}
        </button>
      </div>
      {list.length === 0 && <p className="fd-card console-empty">{t('console.nw.none')}</p>}
      {section(t('console.nw.published', { count: published.length }), published)}
      {section(t('console.nw.drafts', { count: drafts.length }), drafts)}
      {editing && (
        <NewsEditor
          news={editing === 'new' ? null : editing}
          item={null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {preview && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setPreview(false)}>
          <div className="modal console-preview" role="dialog" aria-modal="true" aria-labelledby="pv-t">
            <div className="modal-head">
              <h2 id="pv-t">{t('console.nw.clientView')}</h2>
            </div>
            <div className="modal-body console-stack">
              {published.length === 0 ? (
                <p className="fd-muted">{t('news.empty')}</p>
              ) : (
                published.map((n) => (
                  <NewsPreview key={n.id} title={n.title} body={n.body} article={n.article} />
                ))
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="fd-btn" autoFocus onClick={() => setPreview(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewsPreview({ title, body, article }: { title: string; body: string; article: string | null }) {
  const { t } = useTranslation();
  return (
    <article className="fd-card news-card">
      <p className="news-card__meta">
        <span>{formatDate(new Date().toISOString())}</span>
        <span className="badge badge-primary">{t('news.new')}</span>
      </p>
      <h3 className="news-card__t">{title || '…'}</h3>
      <p className="news-card__b">{body || '…'}</p>
      {article && <span className="fd-link">{t('news.readArticle', { title: articleTitle(article) })}</span>}
    </article>
  );
}

/** Rédaction d'une annonce (aperçu côté client à droite). */
export function NewsEditor({
  news,
  item,
  onClose,
  onSaved,
}: {
  news: News | null;
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [title, setTitle] = useState(news?.title ?? item?.title ?? '');
  const [body, setBody] = useState(news?.body ?? '');
  const [article, setArticle] = useState(news?.article ?? item?.article ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const save = async (publish: boolean) => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('console_save_news', {
      p_id: news?.id ?? null,
      p_title: title.trim(),
      p_body: body.trim(),
      p_article: article || null,
      p_item: news?.itemId ?? item?.id ?? null,
      p_publish: publish,
    });
    setBusy(false);
    if (error) return toast(rpcError(t, error.message));
    toast(publish ? t('console.nw.publishedToast') : t('console.nw.savedToast'));
    onSaved();
  };
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal console-news-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ne-t"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <div className="modal-head">
          <h2 id="ne-t">{news ? t('console.nw.editTitle') : t('console.nw.writeTitle')}</h2>
        </div>
        <div className="modal-body console-news-editor__body">
          <div className="fd-stack">
            <div className="field">
              <label htmlFor="ne-title">{t('console.nw.title')}</label>
              <input
                id="ne-title"
                className="input"
                required
                maxLength={90}
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ne-body">{t('console.nw.text')}</label>
              <textarea
                id="ne-body"
                className="input"
                required
                rows={5}
                maxLength={400}
                aria-describedby="ne-body-h"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <span className="help" id="ne-body-h">
                {t('console.nw.textHelp')} {t('console.nw.count', { n: body.length })}
              </span>
            </div>
            <div className="field">
              <label htmlFor="ne-art">
                {t('console.nw.link')} <span className="opt">{t('plans.optional')}</span>
              </label>
              <select
                id="ne-art"
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
            <p className="help">{t('console.nw.audience')}</p>
          </div>
          <div className="console-news-editor__preview" aria-label={t('console.nw.clientView')} role="group">
            <span className="fd-muted">{t('console.nw.clientView')}</span>
            <NewsPreview title={title} body={body} article={article || null} />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fd-btn"
            disabled={busy || !title.trim() || !body.trim()}
            onClick={() => void save(false)}
          >
            {t('console.nw.saveDraft')}
          </button>
          <button
            type="submit"
            className="fd-btn fd-btn--primary"
            disabled={busy || !title.trim() || !body.trim()}
          >
            {t('console.nw.publish')}
          </button>
        </div>
      </form>
    </div>
  );
}
