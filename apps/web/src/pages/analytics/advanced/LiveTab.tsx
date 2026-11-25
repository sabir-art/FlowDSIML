import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Flag, Mail, Pause, Play, Radio } from 'lucide-react';
import type { ContentType } from '@flowdsiml/core';
import { Empty } from '@flowdsiml/ui';
import { supabase } from '../../../lib/supabase';
import { formatNumber, formatRelativeShort } from '../../../lib/format';
import { initials } from '../../../lib/initials';
import { Loading } from '../../../components/guards';
import { TypeBadge } from '../../../components/TypeBadge';
import { VisitBadge } from '../returning';
import { LiveDemoFilter } from './LiveDemoFilter';
import { elapsedShort, liveCsv, type LiveSpace } from './live';
import './live.css';

const REFRESH_MS = 10_000;

/**
 * Temps réel de l'espace (retours du 24/11, 2e série §5 ; live_space, interrogée toutes les 10 s).
 * Filtre Démo avec recherche, indicateur « En direct · actualisé il y a n s » et bouton icône de pause,
 * quatre indicateurs, « Sur les démos maintenant » (tableau à colonnes fixes) et fil d'activité.
 * L'identité d'un visiteur (apprenant, e-mail du lead) n'est renvoyée par la base qu'aux éditeurs.
 * Les changements sont annoncés une fois par minute au plus, jamais ligne par ligne.
 */
export function LiveTab({
  wsId,
  demo,
  onDemo,
  demos,
  types,
}: {
  wsId: string;
  demo: string;
  onDemo: (id: string) => void;
  demos: Array<{ id: string; title: string; folder: string | null }>;
  types: Record<string, ContentType>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<LiveSpace | null>(null);
  const [paused, setPaused] = useState(false);
  const [at, setAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [announce, setAnnounce] = useState('');
  const lastAnnounce = useRef({ at: 0, text: '' });
  /** L26-07 : numéro de visite par visiteur (`démo:clé`), vide si la mesure est désactivée. */
  const [visits, setVisits] = useState<Record<string, number>>({});

  useEffect(() => {
    if (paused) return;
    let off = false;
    const load = () =>
      supabase.rpc('live_space', { p_workspace: wsId, p_demo: demo || undefined }).then(({ data: d }) => {
        if (off || !d) return;
        const live = d as unknown as LiveSpace;
        setData(live);
        setAt(Date.now());
        // L26-07 : nouveau ou récurrent, pour les démos où quelqu'un est en direct (six au plus)
        void Promise.all(
          live.demos
            .slice(0, 6)
            .map((x) =>
              supabase
                .rpc('live_visits', { p_demo: x.demoId })
                .then(({ data: lv }) =>
                  Object.entries((lv as Record<string, number> | null) ?? {}).map(
                    ([key, no]) => [`${x.demoId}:${key}`, no] as const,
                  ),
                ),
            ),
        ).then((all) => !off && setVisits(Object.fromEntries(all.flat())));
        setNow(Date.now());
        // Indicateurs annoncés au plus une fois par minute, et seulement s'ils changent
        const text = t('analytics.adv.live.announce', { live: live.kpis.live, views: live.kpis.views30 });
        const stamp = Date.now();
        if (text !== lastAnnounce.current.text && stamp - lastAnnounce.current.at >= 60_000) {
          lastAnnounce.current = { at: stamp, text };
          setAnnounce(text);
        }
      });
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      off = true;
      window.clearInterval(timer);
    };
  }, [wsId, demo, paused, t]);
  // « actualisé il y a n s » : l'horloge de l'écran avance chaque seconde (figée en pause)
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const liveBy = useMemo(() => new Map((data?.demos ?? []).map((d) => [d.demoId, d.live])), [data]);
  const options = useMemo(
    () => demos.map((d) => ({ ...d, type: types[d.id], live: liveBy.get(d.id) ?? 0 })),
    [demos, types, liveBy],
  );
  const titleOf = (id: string) => demos.find((d) => d.id === id)?.title ?? t('demos.untitled');

  if (!data) return <Loading />;
  const k = data.kpis;
  const totalLive = demo ? [...liveBy.values()].reduce((a, b) => a + b, 0) : k.live;
  let anon = 0;

  const exportCsv = () => {
    const csv = liveCsv(
      data,
      titleOf,
      {
        visitor: t('analytics.visitor'),
        demo: t('analytics.demoLabel'),
        step: t('analytics.progress'),
        since: t('analytics.adv.live.since'),
        anon: t('analytics.adv.live.anon'),
        learner: t('analytics.adv.live.learner'),
      },
      now,
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'temps-reel.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="lv">
      <div className="lv-bar">
        <LiveDemoFilter value={demo} options={options} totalLive={totalLive} onChange={onDemo} />
        <span className={`lv-state${paused ? ' is-paused' : ''}`}>
          <i aria-hidden="true" />
          {paused
            ? t('analytics.adv.live.paused')
            : t('analytics.adv.live.liveSince', { n: Math.max(0, Math.round((now - at) / 1000)) })}
        </span>
        <button
          type="button"
          className="fd-btn fd-btn--icon fd-btn--sm lv-pause"
          aria-pressed={paused}
          aria-label={t('analytics.adv.live.pauseLabel')}
          title={paused ? t('analytics.adv.live.resume') : t('analytics.adv.live.pauseLabel')}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
        <span className="lv-bar__grow" />
        <button
          type="button"
          className="fd-btn fd-btn--icon lv-export"
          aria-label={t('analytics.adv.live.export')}
          title={t('analytics.adv.live.export')}
          onClick={exportCsv}
        >
          <Download aria-hidden="true" />
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>

      <dl className="lv-kpis">
        {(
          [
            ['now', k.live],
            ['views30', k.views30],
            ['endsToday', k.endsToday],
            ['leadsToday', k.leadsToday],
          ] as const
        ).map(([key, n]) => (
          <div key={key} className="lv-kpi">
            <dd>{formatNumber(n)}</dd>
            <dt>{t(`analytics.adv.live.${key}`)}</dt>
          </div>
        ))}
      </dl>

      <div className="lv-cols">
        <section className="lv-card" aria-labelledby="lv-now-t">
          <h2 id="lv-now-t">{t('analytics.adv.live.nowTitle')}</h2>
          {data.visitors.length === 0 ? (
            <Empty
              live
              variant="compact"
              icon={<Radio />}
              title={t('analytics.adv.live.emptyTitle')}
              body={t('analytics.adv.live.emptyBody')}
            />
          ) : (
            <>
              <table className="lv-table" aria-live="off">
                <caption className="sr-only">{t('analytics.adv.live.nowTitle')}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="lv-c-av">
                      <span className="sr-only">{t('analytics.adv.live.avatar')}</span>
                    </th>
                    <th scope="col">{t('analytics.visitor')}</th>
                    <th scope="col">{t('analytics.demoLabel')}</th>
                    <th scope="col">{t('analytics.progress')}</th>
                    <th scope="col" className="lv-c-since">
                      {t('analytics.adv.live.since')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.visitors.map((v) => {
                    const seen = v.stepIndex === null ? 0 : v.stepIndex + 1;
                    const total = Math.max(v.stepsTotal, seen);
                    // Lieu approximatif (pays), ou l'adresse si la personne s'est identifiée par un lead
                    const label =
                      v.identity ??
                      (v.learner
                        ? t('analytics.adv.live.learner')
                        : v.country
                          ? t('analytics.adv.live.visitorFrom', { place: regionName(v.country) })
                          : t('analytics.adv.live.anon'));
                    const avatar = v.identity ? initials(v.identity) : v.learner ? 'AI' : `V${++anon}`;
                    const name = titleOf(v.demoId);
                    const type = types[v.demoId];
                    return (
                      <tr key={`${v.demoId}:${v.key}`}>
                        <td className="lv-c-av">
                          <span className={`lv-av lv-av--${(anon + avatar.length) % 3}`} aria-hidden="true">
                            {avatar}
                          </span>
                        </td>
                        <th scope="row" className="lv-who" title={label}>
                          <span className="lv-who__t">{label}</span>
                          <VisitBadge no={visits[`${v.demoId}:${v.key}`]} />
                        </th>
                        <td>
                          <span className="lv-demo">
                            {type && <TypeBadge type={type} tone />}
                            <span className="lv-demo__t" title={name}>
                              {name}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="lv-prog">
                            <span
                              className="lv-prog__bar"
                              role="img"
                              aria-label={t('analytics.adv.live.stepsSeen', { n: seen, total })}
                            >
                              <i style={{ width: `${total ? Math.round((seen / total) * 100) : 0}%` }} />
                            </span>
                            <span className="lv-prog__t" aria-hidden="true">
                              {t('analytics.adv.live.stepOf', { n: seen, total })}
                            </span>
                          </span>
                        </td>
                        <td className="lv-c-since">{elapsedShort(v.since, now)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="lv-foot">
                {data.more > 0 && `${t('analytics.adv.live.more', { count: data.more })} `}
                {t('analytics.adv.live.privacy')}
              </p>
            </>
          )}
        </section>

        <section className="lv-card" aria-labelledby="lv-feed-t">
          <h2 id="lv-feed-t">{t('analytics.adv.live.feedTitle')}</h2>
          {data.feed.length === 0 ? (
            <p className="lv-none">{t('analytics.adv.live.feedNone')}</p>
          ) : (
            <ul className="lv-feed">
              {data.feed.map((f) => (
                <li key={`${f.kind}-${f.demoId}-${f.at}`}>
                  {f.kind === 'lead' ? (
                    <Mail aria-hidden="true" />
                  ) : f.kind === 'end' ? (
                    <Flag aria-hidden="true" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                  <span className="lv-feed__t">
                    {t(`analytics.adv.live.feed_${f.kind}`, { demo: titleOf(f.demoId) })}
                  </span>
                  <span className="lv-feed__at">{formatRelativeShort(f.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Nom du pays dans la langue de l'interface (code à 2 lettres stocké, jamais l'IP). */
export function regionName(code: string): string {
  try {
    return (
      new Intl.DisplayNames([document.documentElement.lang || 'fr'], { type: 'region' }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
