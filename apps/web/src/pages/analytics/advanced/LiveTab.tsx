import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from 'lucide-react';
import { VisitBadge } from '../returning';
import { supabase } from '../../../lib/supabase';
import { formatNumber, formatRelativeShort } from '../../../lib/format';
import { initials } from '../../../lib/initials';
import { Loading } from '../../../components/guards';
import { Empty } from '@flowdsiml/ui';
import { Radio } from 'lucide-react';

interface LiveVisitor {
  key: string;
  lastAt: string;
  since: string;
  stepIndex: number | null;
  stepTitle: string | null;
  device: string | null;
  country: string | null;
  lastType: string;
  identity: string | null;
  /** L19-01 : visiteur rattaché à un apprenant (même sans droit au suivi nominatif). */
  learner?: boolean;
  /** L19-01 : structure de l'apprenant (rôles avec suivi nominatif). */
  structure?: string | null;
}
interface Live {
  kpis: { live: number; views30: number; ctaToday: number; leadsToday: number };
  stepsTotal: number;
  more: number;
  visitors: LiveVisitor[];
}

const REFRESH_MS = 10_000;

/** Démo la plus vue aujourd'hui (temps réel avec « Toutes les démos »). */
async function topDemoToday(wsId: string): Promise<string | null> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('events')
    .select('demo_id')
    .eq('workspace_id', wsId)
    .eq('type', 'demo_view')
    .gte('occurred_at', start.toISOString())
    .limit(2000);
  const n = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ demo_id: string }>) n.set(r.demo_id, (n.get(r.demo_id) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * L19-01 / 02 : temps réel d'une démo (live_demo, interrogée toutes les 10 s ; « Mettre en pause » fige
 * la liste). Identité (e-mail de l'apprenant ou du lead) renvoyée par la base aux éditeurs seulement.
 */
export function LiveTab({
  wsId,
  demo,
  demos,
}: {
  wsId: string;
  demo: string;
  demos: Array<{ id: string; title: string }>;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null>(demo || null);
  const [visits, setVisits] = useState<Record<string, number>>({});
  const [data, setData] = useState<Live | null>(null);
  const [paused, setPaused] = useState(false);
  const [announce, setAnnounce] = useState('');
  const lastAnnounce = useRef({ at: 0, text: '' });

  useEffect(() => {
    if (demo) return setTarget(demo);
    let off = false;
    void topDemoToday(wsId).then((id) => !off && setTarget(id ?? demos[0]?.id ?? null));
    return () => {
      off = true;
    };
  }, [wsId, demo, demos]);

  useEffect(() => {
    if (!target || paused) return;
    let off = false;
    const load = () =>
      Promise.all([
        supabase.rpc('live_demo', { p_demo: target }),
        // L26-07 : nouveau ou récurrent (vide si la mesure est désactivée)
        supabase.rpc('live_visits', { p_demo: target }),
      ]).then(([{ data: d }, { data: lv }]) => {
        if (off || !d) return;
        const live = d as unknown as Live;
        setVisits((lv as Record<string, number> | null) ?? {});
        setData(live);
        // KPI annoncés au plus une fois par minute, et seulement s'ils changent
        const text = t('analytics.adv.live.announce', {
          live: live.kpis.live,
          views: live.kpis.views30,
        });
        const now = Date.now();
        if (text !== lastAnnounce.current.text && now - lastAnnounce.current.at >= 60_000) {
          lastAnnounce.current = { at: now, text };
          setAnnounce(text);
        }
      });
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      off = true;
      window.clearInterval(timer);
    };
  }, [target, paused, t]);

  if (!target) return <div className="card empty">{t('analytics.adv.live.noDemo')}</div>;
  if (!data) return <Loading />;
  const title = demos.find((d) => d.id === target)?.title ?? '—';
  const k = data.kpis;
  const total = data.stepsTotal;
  let anon = 0;

  return (
    <div className="l19">
      <div className="row between wrap l19-livehead">
        {/* L19-01 / 02 : la démo est toujours nommée en tête de ligne (« Démo CRM · actualisé… ») */}
        <div className="l19-livehead-l">
          {!demo && (
            <select
              className="select input-sm"
              aria-label={t('analytics.adv.live.demo')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {demos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          )}
          <p className="muted">
            <b>{title}</b> · {t('analytics.adv.live.refresh')}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {paused ? t('analytics.adv.live.resume') : t('analytics.adv.live.pause')}
        </button>
      </div>
      <span className="sr-only" role="status">
        {announce}
      </span>
      <div className="kpis">
        <div className="card kpi l19-hero">
          <span className="t-caption">
            <span className="live-dot" aria-hidden="true" /> {t('analytics.adv.live.now')}
          </span>
          <div className="value">{formatNumber(k.live)}</div>
        </div>
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.adv.live.views30')}</span>
          <div className="value">{formatNumber(k.views30)}</div>
        </div>
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.adv.live.ctaToday')}</span>
          <div className="value">{formatNumber(k.ctaToday)}</div>
        </div>
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.adv.live.leadsToday')}</span>
          <div className="value">{formatNumber(k.leadsToday)}</div>
        </div>
      </div>
      {data.visitors.length === 0 ? (
        <Empty
          live
          className="l19-gap"
          icon={<Radio />}
          title={t('analytics.adv.live.emptyTitle')}
          body={t('analytics.adv.live.emptyBody')}
        />
      ) : (
        <div className="card l19-gap">
          <div className="card-head">
            <h2 className="t-h3">{t('analytics.adv.live.active')}</h2>
            <span className="t-caption muted">{t('analytics.adv.live.count', { count: k.live })}</span>
          </div>
          <div className="table-wrap">
            <table className="table" aria-live="off">
              <caption className="sr-only">{t('analytics.adv.live.active')}</caption>
              <thead>
                <tr>
                  <th>{t('analytics.visitor')}</th>
                  <th>{t('analytics.adv.live.place')}</th>
                  <th>{t('analytics.progress')}</th>
                  <th>{t('analytics.adv.live.since')}</th>
                </tr>
              </thead>
              <tbody>
                {data.visitors.map((v) => {
                  const seen = v.stepIndex === null ? 0 : v.stepIndex + 1;
                  // L19-01 : apprenant identifié (nom si droit au suivi nominatif), sinon visiteur anonyme
                  const label =
                    v.identity ??
                    (v.learner ? t('analytics.adv.live.learner') : t('analytics.adv.live.anon'));
                  const avatar = v.identity ? initials(v.identity) : v.learner ? 'AI' : `V${++anon}`;
                  const sub = v.learner
                    ? [t('analytics.adv.live.learnerSub'), v.structure].filter(Boolean).join(' · ')
                    : null;
                  return (
                    <tr key={v.key}>
                      <td>
                        <div className="row">
                          <span
                            className={`avatar avatar-sm${v.identity || v.learner ? '' : ' an-anon'}`}
                            aria-hidden="true"
                          >
                            {avatar}
                          </span>
                          <span className="l19-who">
                            <b>{label}</b>
                            {sub && <span className="t-caption muted">{sub}</span>}
                            <VisitBadge no={visits[v.key]} />
                          </span>
                        </div>
                      </td>
                      <td>
                        {[
                          v.country ? regionName(v.country) : t('analytics.adv.live.unknownPlace'),
                          v.device ? t(`analytics.adv.dev.${v.device}`) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                      <td>
                        <span
                          className="steps-mini"
                          role="img"
                          aria-label={t('analytics.adv.live.stepsSeen', { n: seen, total })}
                        >
                          {Array.from({ length: Math.min(total, 20) }, (_, i) => (
                            <i key={i} className={i < seen - 1 ? 'on' : i === seen - 1 ? 'cur' : undefined} />
                          ))}
                        </span>{' '}
                        {seen > 0 && (
                          <span className="t-caption">
                            {t('analytics.adv.live.stepN', { n: seen })}
                            {v.stepTitle ? ` · ${v.stepTitle}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="muted">{formatRelativeShort(v.since)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="t-caption muted l19-foot">
            {data.more > 0 && `${t('analytics.adv.live.more', { count: data.more })} `}
            {t('analytics.adv.live.privacy')}
          </p>
        </div>
      )}
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
