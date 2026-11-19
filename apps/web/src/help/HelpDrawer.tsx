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
import {
  PAGE_ARTICLES,
  articleBySlug,
  highlight,
  pageFor,
  searchArticles,
  termsOf,
  type Article,
} from './articles';
import './help.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTPS = /^https:\/\/[^\s]+$/;

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
  const [article, setArticle] = useState<Article | null>(() =>
    initialArticle ? articleBySlug(initialArticle) : null,
  );
  const [tour, setTour] = useState<{ id: string; title: string } | null>(null);
  const [touring, setTouring] = useState(false);
  const [keys, setKeys] = useState(false);
  const [admins, setAdmins] = useState<string[] | null>(null);
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

  // Contact d'aide de l'espace, sinon les administrateurs
  const settings = (ws.settings ?? {}) as Record<string, unknown>;
  const contact = typeof settings.helpContact === 'string' ? settings.helpContact.trim() : '';
  const contactHref = EMAIL.test(contact) ? `mailto:${contact}` : HTTPS.test(contact) ? contact : null;
  useEffect(() => {
    if (contactHref) return;
    void supabase.rpc('list_members', { p_workspace: ws.id }).then(({ data }) => {
      const rows = (data ?? []) as Array<{ full_name: string; email: string; role: string }>;
      setAdmins(
        rows.filter((r) => r.role === 'admin' || r.role === 'owner').map((r) => r.full_name || r.email),
      );
    });
  }, [contactHref, ws.id]);

  const terms = useMemo(() => termsOf(q), [q]);
  const results = useMemo(() => (terms.length ? searchArticles(q) : null), [q, terms.length]);
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
            <Feedback slug={article.slug} />
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
                      {!tour && <span className="fd-badge help-soon">{t('shell.soon')}</span>}
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
      <footer className="help-foot">
        <b>{t('help.need')}</b>{' '}
        {contactHref ? (
          <>
            <a
              href={contactHref}
              target={contactHref.startsWith('https') ? '_blank' : undefined}
              rel="noopener noreferrer"
            >
              {t('help.contact')}
            </a>
            <span className="help-muted help-block">{contact}</span>
          </>
        ) : (
          <>
            <span>{t('help.askAdmin')}</span>
            {admins && admins.length > 0 && (
              <span className="help-muted help-block">{admins.join(', ')}</span>
            )}
          </>
        )}
      </footer>
      {touring && tour && (
        <TourDialog tourId={tour.id} title={tour.title} onClose={() => setTouring(false)} />
      )}
      {keys && <ShortcutsDialog onClose={() => setKeys(false)} />}
    </aside>
  );
}

/** « Cet article vous a aidé ? » : compteur anonyme, une réponse par article et par navigateur. */
function Feedback({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const key = `fd.help.fb.${slug}`;
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  });
  const answer = (helpful: boolean) => {
    setDone(true);
    try {
      localStorage.setItem(key, helpful ? '1' : '0');
    } catch {
      /* stockage indisponible : la réponse est tout de même comptée */
    }
    void supabase.rpc('help_feedback', { p_article: slug, p_helpful: helpful }).then(() => undefined);
  };
  return (
    <div className="help-fb" role="group" aria-labelledby="help-fb-q">
      {done ? (
        <p role="status">{t('help.thanks')}</p>
      ) : (
        <>
          <span id="help-fb-q">{t('help.helpful')}</span>
          <button type="button" className="fd-btn fd-btn--sm" onClick={() => answer(true)}>
            {t('common.yes')}
          </button>
          <button type="button" className="fd-btn fd-btn--sm" onClick={() => answer(false)}>
            {t('common.no')}
          </button>
        </>
      )}
    </div>
  );
}
