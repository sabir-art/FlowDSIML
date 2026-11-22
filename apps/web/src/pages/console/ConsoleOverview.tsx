/** L41 §4 : Vue d'ensemble (90 jours, tous espaces). */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateTime, formatNumber } from '../../lib/format';
import { initials } from '../../lib/initials';
import { actionLabel, articleSection, articleTitle } from './shared';

interface Overview {
  yes: number;
  no: number;
  articles: number;
  newComments: number;
  triage: number;
  activity: Array<{
    at: string;
    action: string;
    objectType: string;
    label: string;
    actor: string;
    actorEmail: string;
  }>;
}
interface ArticleRow {
  article: string;
  yes: number;
  no: number;
  comments: number;
  items: number;
}
/** Seuil de réponses pour classer un article parmi les moins bien notés. */
export const MIN_ANSWERS = 5;
export const satisfaction = (r: { yes: number; no: number }) => (r.yes + r.no ? r.yes / (r.yes + r.no) : 0);

export function Overview() {
  const { t } = useTranslation();
  const [o, setO] = useState<Overview | null>(null);
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [failed, setFailed] = useState(false);
  const load = () => {
    setFailed(false);
    void Promise.all([
      supabase.rpc('console_overview', { p_days: 90 }),
      supabase.rpc('console_articles', { p_days: 90 }),
    ]).then(([a, b]) => {
      if (a.error || b.error) return setFailed(true);
      setO(a.data as unknown as Overview);
      setRows((b.data as unknown as ArticleRow[]) ?? []);
    });
  };
  useEffect(load, []);
  if (failed)
    return (
      <div className="fd-card console-error" role="alert">
        <p>{t('console.loadError')}</p>
        <button type="button" className="fd-btn" onClick={load}>
          {t('console.retry')}
        </button>
      </div>
    );
  if (!o)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  const total = o.yes + o.no;
  const watch = rows
    .filter((r) => r.yes + r.no >= MIN_ANSWERS)
    .sort((a, b) => satisfaction(a) - satisfaction(b))
    .slice(0, 3);
  const stat = (label: string, value: string, sub: string) => (
    <div className="console-stat">
      <span className="console-stat__l">{label}</span>
      <span className="console-stat__v">{value}</span>
      <span className="console-stat__s">{sub}</span>
    </div>
  );
  return (
    <div className="console-stack">
      <h1 className="sr-only">{t('console.tabs.overview')}</h1>
      <section className="fd-card console-stats" aria-label={t('console.ov.stats')}>
        {stat(
          t('console.ov.satisfaction'),
          total ? `${Math.round((o.yes / total) * 100)}\u00a0%` : '—',
          t('console.ov.yesNo', { yes: formatNumber(o.yes), no: formatNumber(o.no) }),
        )}
        {stat(
          t('console.ov.answers'),
          total ? formatNumber(total) : '—',
          t('console.ov.onArticles', { count: o.articles }),
        )}
        {stat(
          t('console.ov.newComments'),
          o.newComments ? formatNumber(o.newComments) : '—',
          t('console.ov.allSpaces'),
        )}
        {stat(t('console.ov.triage'), o.triage ? formatNumber(o.triage) : '—', t('console.ov.inBacklog'))}
      </section>
      <div className="console-two">
        <section className="fd-card" aria-labelledby="ov-watch">
          <h2 id="ov-watch" className="console-h2">
            {t('console.ov.watch', { count: watch.length })}
          </h2>
          {watch.length === 0 ? (
            <p className="fd-muted">{t('console.ov.noWatch')}</p>
          ) : (
            <ul className="console-watch">
              {watch.map((r) => {
                const sat = Math.round(satisfaction(r) * 100);
                return (
                  <li key={r.article}>
                    {/* L41-02 K2 : ligne entière cliquable, chevron à droite */}
                    <Link
                      className="console-watch__row"
                      to={`/console/retours?vue=commentaires&article=${r.article}`}
                    >
                      <span className="console-watch__t">
                        <b>{articleTitle(r.article)}</b>
                        <span className="fd-muted">
                          {articleSection(r.article)} ·{' '}
                          {t('console.ov.noComments', { no: r.no, count: r.comments })}
                        </span>
                      </span>
                      <span className="console-watch__sat">
                        <span className="console-bar" aria-hidden="true">
                          <span style={{ width: `${sat}%` }} />
                        </span>
                        {sat} %
                      </span>
                      <ChevronRight className="console-watch__chev" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="fd-card" aria-labelledby="ov-act">
          <h2 id="ov-act" className="console-h2">
            {t('console.ov.activity')}
          </h2>
          {o.activity.length === 0 ? (
            <p className="fd-muted">{t('console.ov.noActivity')}</p>
          ) : (
            <ul className="console-activity">
              {o.activity.map((a, i) => (
                <li key={i}>
                  <span className="avatar avatar--sm" aria-hidden="true">
                    {initials(a.actor || a.actorEmail)}
                  </span>
                  <span>
                    <b>{actionLabel(t, a.action)}</b>
                    {a.label && ` · ${a.label}`}
                    <span className="fd-muted console-activity__by">
                      {a.actor || a.actorEmail} · {formatDateTime(a.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
