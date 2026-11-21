/**
 * L26-02 / L26-03 : tiroir d'aide (aside nommé « Aide », non modal, 400 px, plein écran sous 640 px).
 * Sections : « Sur cette page · {{page}} » (articles et visite guidée), « Raccourcis », pied de contact.
 * La recherche remplace les sections (résultats annoncés en aria-live). Un article s'ouvre dans le tiroir.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, CircleHelp, Keyboard, Play, Search, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { ShortcutsDialog } from '../pages/editor/ShortcutsDialog';
import { Markdown } from './Markdown';
import { TourDialog } from './TourDialog';
import { PAGE_TOUR, loadTours } from './tours';
import { Academy } from './Academy';
import { usePlatformRole } from '../pages/console/platform';
import { supportContact, supportHref } from '../lib/support';
import {
  PAGE_ARTICLES,
  articleBySlug,
  highlight,
  pageFor,
  searchArticles,
  visibleArticles,
  termsOf,
  type Article,
} from './articles';
import './help.css';
import { Status } from '@flowdsiml/ui';

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((s, i) =>
        s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

export function HelpDrawer({
  onClose,
  editorTab,
  initialArticle = null,
}: {
  onClose: () => void;
  editorTab: string | null;
  initialArticle?: string | null;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { current, can } = useWorkspace();
  const ws = current!;
  const navigate = useNavigate();
  // L26-01 : « Reprendre la prise en main » quand la personne l'a masquée
  const [resume, setResume] = useState(false);
  useEffect(() => {
    if (!can('demo.edit')) return;
    void supabase
      .from('onboarding_prefs')
      .select('hidden_at')
      .eq('workspace_id', ws.id)
      .maybeSingle()
      .then(({ data }) => setResume(!!data?.hidden_at));
  }, [ws.id, can]);
  const reopenOnboarding = async () => {
    await supabase.from('onboarding_prefs').delete().eq('workspace_id', ws.id);
    setResume(false);
    window.dispatchEvent(new Event('fd:onboarding'));
    onClose();
    navigate('/');
  };
  const page = pageFor(pathname, editorTab);
  const [q, setQ] = useState('');
  const [article, setArticle] = useState<Article | null>(() => {
    // Ouverture directe : jamais un article réservé à la console (le rôle n'est pas encore connu)
    const a = initialArticle ? articleBySlug(initialArticle) : null;
    return a?.audience === 'all' ? a : null;
  });
  const [tour, setTour] = useState<{ id: string; title: string } | null>(null);
  const [touring, setTouring] = useState(false);
  const [keys, setKeys] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const lastLink = useRef<string | null>(null);

  // Focus dans la recherche à l'ouverture (sur « Retour » quand un article est ouvert d'emblée) ;
  // Échap ferme (sauf fenêtre ouverte par-dessus)
  useEffect(() => (initialArticle ? back.current : search.current)?.focus(), [initialArticle]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Visite guidée de la page (démo statique embarquée), « Bientôt » si elle n'existe pas encore
  useEffect(() => {
    setTour(null);
    if (!page) return;
    void loadTours().then((list) => {
      const e = list.find((x) => x.key === PAGE_TOUR[page]);
      setTour(e ? { id: e.id, title: e.title } : null);
    });
  }, [page]);

  // L48-A §5 : « Contacter la DSI », masqué tant que le lien du support est vide
  const contact = supportContact(ws.settings);
  const contactHref = supportHref(ws.settings);

  const terms = useMemo(() => termsOf(q), [q]);
  // L41 : l'article de la console n'apparaît qu'aux comptes qui ont un rôle dans la console
  const consoleRole = usePlatformRole();
  const results = useMemo(
    () => (terms.length ? searchArticles(q, visibleArticles(!!consoleRole)) : null),
    [q, terms.length, consoleRole],
  );
  const onPage = (page ? PAGE_ARTICLES[page] : []).flatMap((s) => {
    const a = articleBySlug(s);
    return a ? [a] : [];
  });

  const openArticle = (a: Article) => {
    lastLink.current = a.slug;
    setArticle(a);
    window.setTimeout(() => back.current?.focus(), 0);
  };
  const closeArticle = () => {
    setArticle(null);
    // Focus rendu au lien de l'article
    window.setTimeout(
      () =>
        (
          document.querySelector<HTMLElement>(`#help-drawer [data-slug="${lastLink.current}"]`) ??
          search.current
        )?.focus(),
      0,
    );
  };

  const link = (a: Article, marked = false) => (
    <button
      key={a.slug}
      type="button"
      className="help-link"
      data-slug={a.slug}
      onClick={() => openArticle(a)}
    >
      <BookOpen aria-hidden="true" />
      <span>
        {marked ? <Marked text={a.title} terms={terms} /> : a.title}
        <small>{marked ? `${a.section} · ${a.summary}` : a.summary}</small>
      </span>
    </button>
  );

  return (
    <aside id="help-drawer" className="help-drawer" aria-labelledby="help-title">
      <header className="help-head">
        <CircleHelp aria-hidden="true" />
        <h2 id="help-title">{t('help.title')}</h2>
        <span className="help-grow" />
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
          aria-label={t('help.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="help-search">
        <Search aria-hidden="true" />
        <input
          ref={search}
          type="search"
          className="fd-input"
          aria-label={t('help.search')}
          placeholder={t('help.search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setArticle(null);
          }}
        />
      </div>
      <div className="help-body">
        {article ? (
          <article className="help-article" aria-labelledby="help-art-title">
            <button
              ref={back}
              type="button"
              className="fd-btn fd-btn--ghost fd-btn--sm help-back"
              onClick={closeArticle}
            >
              <ArrowLeft aria-hidden="true" />
              {t('help.back')}
            </button>
            <p className="help-section">{article.section}</p>
            <h2 id="help-art-title">{article.title}</h2>
            <Markdown source={article.body} />
            <Feedback slug={article.slug} page={page ?? ''} wsId={current?.id} />
          </article>
        ) : (
          <>
            <section className="help-results" aria-live="polite" hidden={!results}>
              {results && (
                <>
                  <h3>{t('help.results', { count: results.length, q: q.trim() })}</h3>
                  {results.map((a) => link(a, true))}
                  <p className="help-muted">{results.length ? t('help.notFound') : t('help.noResult')}</p>
                </>
              )}
            </section>
            {!results && (
              <>
                {page && (
                  <section className="help-sec" aria-labelledby="help-page">
                    <h3 id="help-page">{t('help.onPage', { page: t(`help.page.${page}`) })}</h3>
                    {onPage.map((a) => link(a))}
                    {/* Sans visite : l'entrée reste, désactivée, avec « Bientôt » */}
                    <button
                      type="button"
                      className="fd-btn fd-btn--sm help-tour"
                      aria-disabled={tour ? undefined : true}
                      onClick={() => tour && setTouring(true)}
                    >
                      <Play aria-hidden="true" />
                      {t('help.tour')}
                      {!tour && (
                        <Status size="sm" className="help-soon">
                          {t('shell.soon')}
                        </Status>
                      )}
                    </button>
                  </section>
                )}
                <Academy />
                {resume && (
                  <button type="button" className="help-link" onClick={reopenOnboarding}>
                    <Sparkles aria-hidden="true" />
                    <span>
                      {t('onb.resume')}
                      <small>{t('onb.resumeHint')}</small>
                    </span>
                  </button>
                )}
                <section className="help-sec" aria-labelledby="help-keys">
                  <h3 id="help-keys">{t('help.keys')}</h3>
                  <button type="button" className="help-link" onClick={() => setKeys(true)}>
                    <Keyboard aria-hidden="true" />
                    <span>
                      {t('help.keysAll')}
                      <small>{t('help.keysHint')}</small>
                    </span>
                  </button>
                </section>
              </>
            )}
          </>
        )}
      </div>
      {contactHref && (
        <footer className="help-foot">
          <b>{t('help.need')}</b>{' '}
          <a
            href={contactHref}
            target={contactHref.startsWith('https') ? '_blank' : undefined}
            rel="noopener noreferrer"
          >
            {t('help.contact')}
          </a>
          <span className="help-muted help-block">{contact}</span>
        </footer>
      )}
      {touring && tour && (
        <TourDialog tourId={tour.id} title={tour.title} onClose={() => setTouring(false)} />
      )}
      {keys && <ShortcutsDialog onClose={() => setKeys(false)} />}
    </aside>
  );
}

/** Donnée personnelle (L41 §2) : adresse e-mail ou numéro de 9 chiffres ou plus (espaces et points ignorés). */
export const hasPersonalData = (v: string) =>
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(v) || /\d{9,}/.test(v.replace(/[\s.]/g, ''));

type FbState =
  | { k: 'loading' }
  | { k: 'ask' }
  | { k: 'thanks' }
  | { k: 'answered'; helpful: boolean }
  | { k: 'comment'; id: string }
  | { k: 'sent' };

/**
 * « Cet article vous a aidé ? » (L41 §2) : une réponse par article et par personne dans l'espace.
 * Après « Non », un commentaire facultatif (500 caractères, sans donnée personnelle) part à l'équipe
 * TutoClick, sans le nom de la personne.
 */
function Feedback({ slug, page, wsId }: { slug: string; page: string; wsId: string | undefined }) {
  const { t } = useTranslation();
  const [st, setSt] = useState<FbState>({ k: 'loading' });
  const [text, setText] = useState('');
  const [err, setErr] = useState<'pii' | 'send' | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!wsId) return setSt({ k: 'ask' });
    let alive = true;
    void supabase.rpc('my_help_vote', { p_article: slug, p_workspace: wsId }).then(({ data }) => {
      if (!alive) return;
      const r = data as { helpful: boolean } | null;
      setSt(r ? { k: 'answered', helpful: r.helpful } : { k: 'ask' });
    });
    return () => {
      alive = false;
    };
  }, [slug, wsId]);
  useEffect(() => {
    if (st.k === 'comment') field.current?.focus();
  }, [st.k]);

  const answer = async (helpful: boolean) => {
    if (!wsId) return;
    // Le vote est enregistré tout de suite ; le commentaire reste facultatif
    const { data, error } = await supabase.rpc('help_vote', {
      p_article: slug,
      p_helpful: helpful,
      p_page: page,
      p_workspace: wsId,
    });
    setText('');
    setErr(null);
    setSt(!error && !helpful && data ? { k: 'comment', id: data as string } : { k: 'thanks' });
  };
  const send = async (id: string) => {
    if (hasPersonalData(text)) return setErr('pii');
    setBusy(true);
    const { error } = await supabase.rpc('help_comment', { p_entry: id, p_text: text.trim() });
    setBusy(false);
    if (error) return setErr(/PERSONAL_DATA/.test(error.message) ? 'pii' : 'send');
    setErr(null);
    setSt({ k: 'sent' });
  };

  if (st.k === 'loading') return <div className="help-fb" aria-hidden="true" />;
  if (st.k === 'comment')
    return (
      <form
        className="help-fb help-fb--comment fd-stack fd-stack--label"
        onSubmit={(e) => {
          e.preventDefault();
          void send(st.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setSt({ k: 'thanks' });
          }
        }}
      >
        <p role="status">{t('help.fb.thanksShort')}</p>
        <label htmlFor="help-fb-text" className="label">
          {t('help.fb.question')}
        </label>
        <textarea
          ref={field}
          id="help-fb-text"
          className="fd-input input"
          rows={3}
          maxLength={500}
          value={text}
          aria-describedby="help-fb-help help-fb-count"
          aria-invalid={err === 'pii' || undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (err === 'pii') setErr(null);
          }}
        />
        <span className="help help-fb__count" id="help-fb-count">
          {t('help.fb.count', { n: text.length })}
        </span>
        <span className="help" id="help-fb-help">
          {t('help.fb.privacy')}
        </span>
        {err === 'pii' && (
          <p className="help-fb__err" role="alert">
            {t('help.fb.pii')}
          </p>
        )}
        {err === 'send' && (
          <p className="help-fb__err" role="alert">
            {t('help.fb.error')}{' '}
            <button type="submit" className="link-button">
              {t('help.fb.retry')}
            </button>
          </p>
        )}
        <div className="help-fb__acts">
          <button type="submit" className="fd-btn fd-btn--primary" disabled={!text.trim() || busy}>
            {t('help.fb.send')}
          </button>
          <button type="button" className="fd-btn fd-btn--ghost" onClick={() => setSt({ k: 'thanks' })}>
            {t('help.fb.skip')}
          </button>
        </div>
      </form>
    );
  return (
    <div className="help-fb" role="group" aria-labelledby="help-fb-q">
      {st.k === 'thanks' && <p role="status">{t('help.thanks')}</p>}
      {st.k === 'sent' && <p role="status">{t('help.fb.sent')}</p>}
      {st.k === 'answered' && (
        <p>
          {t(st.helpful ? 'help.fb.answeredYes' : 'help.fb.answeredNo')}{' '}
          <button type="button" className="link-button" onClick={() => setSt({ k: 'ask' })}>
            {t('help.fb.change')}
          </button>
        </p>
      )}
      {st.k === 'ask' && (
        <>
          <span id="help-fb-q">{t('help.helpful')}</span>
          <button
            type="button"
            className="fd-btn fd-btn--sm"
            onClick={() => void answer(true)}
            disabled={!wsId}
          >
            {t('common.yes')}
          </button>
          <button
            type="button"
            className="fd-btn fd-btn--sm"
            onClick={() => void answer(false)}
            disabled={!wsId}
          >
            {t('common.no')}
          </button>
        </>
      )}
    </div>
  );
}
