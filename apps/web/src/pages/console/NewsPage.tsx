/**
 * L41 §7.2 : page « Nouveautés » côté client. Annonces publiées par l'équipe TutoClick, de la plus
 * récente à la plus ancienne ; l'ouverture de la page efface le point de nouveauté pour cette personne.
 * Aucun lien vers la console, aucun nom de client.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { useHelp } from '../../help/HelpProvider';
import { articleBySlug } from '../../help/articles';
import { notifyNewsSeen } from './platform';
import './console.css';
import { Status } from '@flowdsiml/ui';
import { AppPage } from '../../components/AppPage';

interface News {
  id: string;
  title: string;
  body: string;
  article: string | null;
  publishedAt: string;
  unread: boolean;
}

export function NewsPage() {
  const { t } = useTranslation();
  const help = useHelp();
  const [list, setList] = useState<News[] | null>(null);
  useEffect(() => {
    void supabase.rpc('list_product_news').then(({ data }) => {
      setList((data as unknown as News[]) ?? []);
      void supabase.rpc('news_mark_seen').then(() => notifyNewsSeen());
    });
  }, []);
  return (
    // PAGE-01 : barre « Nouveautés » ; la phrase d'explication ouvre le contenu
    <AppPage title={t('news.title')} className="stack news-page">
      <p className="news-intro">{t('news.sub')}</p>
      {list && list.length === 0 && (
        <div className="fd-card news-empty">
          <Megaphone aria-hidden="true" />
          <p>{t('news.empty')}</p>
        </div>
      )}
      {list?.map((n) => (
        <article key={n.id} className="fd-card news-card">
          <p className="news-card__meta">
            <time dateTime={n.publishedAt}>{formatDate(n.publishedAt)}</time>
            {n.unread && (
              <Status size="sm" tone="brand">
                {t('news.new')}
              </Status>
            )}
          </p>
          <h2 className="news-card__t">{n.title}</h2>
          <p className="news-card__b">{n.body}</p>
          {n.article && (
            <button type="button" className="link-button" onClick={() => help?.openArticle(n.article!)}>
              {t('news.readArticle', { title: articleBySlug(n.article)?.title ?? n.article })}
            </button>
          )}
        </article>
      ))}
    </AppPage>
  );
}
