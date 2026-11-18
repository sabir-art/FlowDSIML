import { ArrowDown, ArrowUp, Calendar, Download, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { completionRate, computeFunnel, toCsv } from '@flowdsiml/core';
import { supabase } from '../../lib/supabase';
import { downloadText } from '../../lib/download';
import { formatDate, formatNumber, formatRelativeShort } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { LeadsMkTable } from './LeadsMkTable';
import { initials } from '../../lib/initials';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';

type Source = 'direct' | 'embed' | 'link';
interface WsAnalytics {
  views: number;
  visitors: number;
  completions: number;
  ctaClicks: number;
  leads: number;
  daily: Array<{ day: string; views: number; completions: number }>;
  sources: Record<Source, number>;
}
interface Session {
  session_id: string;
  demo_id: string;
  source: Source;
  started_at: string;
  duration_s: number;
  max_step: number | null;
  completed: boolean;
  steps_total: number;
  has_lead?: boolean;
  lead_email: string | null;
  lead_fields: Record<string, unknown> | null;
}
type Tab = 'overview' | 'sessions' | 'leads';
const PERIODS = [7, 30, 90] as const;
const PAGE = 25;

/** Analytics du workspace (ANA-01), à l'identique de la maquette analytics.html, sur les données réelles. */
export function AnalyticsPage() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const ws = current!;
  // Données personnelles des leads : rôles editor et plus (comme la RLS leads_select)
  const canLeads = can('leads.view');
  const tabs: Tab[] = canLeads ? ['overview', 'sessions', 'leads'] : ['overview', 'sessions'];
  const [days, setDays] = useState<number>(30);
  const [demo, setDemo] = useState<string>('');
  const [source, setSource] = useState<Source | ''>('');
  const [params, setParams] = useSearchParams();
  // ANA-10 : l'entrée « Leads » de la navigation ouvre cet écran sur l'onglet Leads
  const [tab, setTab] = useState<Tab>(
    params.get('tab') === 'leads' && canLeads
      ? 'leads'
      : params.get('tab') === 'sessions'
        ? 'sessions'
        : 'overview',
  );
  useEffect(() => {
    const p = params.get('tab');
    if (p === 'leads' && canLeads) setTab('leads');
    else if (p === null) setTab('overview');
  }, [params, canLeads]);
  const selectTab = (k: Tab) => {
    setTab(k);
    setParams(k === 'overview' ? {} : { tab: k }, { replace: true });
  };
  const [demos, setDemos] = useState<Array<{ id: string; title: string }>>([]);
  const [data, setData] = useState<WsAnalytics | null>(null);
  const [prev, setPrev] = useState<WsAnalytics | null>(null);
  const [loadedAt, setLoadedAt] = useState<string>('');
  const [leadCount, setLeadCount] = useState<number | null>(null);

  useEffect(() => {
    void supabase
      .from('demos')
      .select('id, title')
      .eq('workspace_id', ws.id)
      .is('deleted_at', null)
      .order('title')
      .then(({ data: d }) => setDemos(d ?? []));
    void supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws.id)
      .then(({ count }) => setLeadCount(count ?? 0));
  }, [ws.id]);

  useEffect(() => {
    setData(null);
    const now = Date.now();
    const iso = (d: number) => new Date(now - d * 86400_000).toISOString();
    const args = { p_workspace: ws.id, p_demo: demo || null, p_source: source || null };
    void Promise.all([
      supabase.rpc('workspace_analytics', { ...args, p_from: iso(days), p_to: new Date(now).toISOString() }),
      supabase.rpc('workspace_analytics', { ...args, p_from: iso(2 * days), p_to: iso(days) }),
    ]).then(([c, p]) => {
      setData((c.data as unknown as WsAnalytics) ?? emptyAnalytics());
      setPrev((p.data as unknown as WsAnalytics) ?? null);
      setLoadedAt(new Date().toISOString());
    });
  }, [ws.id, days, demo, source]);

  if (!data) return <Loading />;
  const title = (id: string) => demos.find((d) => d.id === id)?.title ?? '—';

  const exportCsv = async () => {
    // Onglet Leads : export des leads de la période (rôle editor et plus) ; sinon la série quotidienne
    if (tab === 'leads' && canLeads) {
      const { data: r } = await supabase.rpc('workspace_leads', {
        p_workspace: ws.id,
        p_from: new Date(Date.now() - days * 86400_000).toISOString(),
        p_to: new Date().toISOString(),
        p_demo: demo || null,
        p_limit: 200,
      });
      const rows = ((r as unknown as { rows?: Array<Record<string, unknown>> })?.rows ?? []) as Array<{
        email: string;
        fields: Record<string, unknown> | null;
        demo_id: string | null;
        completed: boolean;
        consent: boolean;
        created_at: string;
      }>;
      return downloadText(
        `leads-${days}j.csv`,
        toCsv(
          ['email', 'company', 'demo', 'completed', 'consent', 'created_at'],
          rows.map((x) => [
            x.email,
            typeof x.fields?.company === 'string' ? x.fields.company : '',
            x.demo_id ? title(x.demo_id) : '',
            x.completed ? 'oui' : 'non',
            x.consent ? 'oui' : 'non',
            x.created_at,
          ]),
        ),
      );
    }
    downloadText(
      `analytics-${days}j.csv`,
      toCsv(
        ['day', 'views', 'completions'],
        data.daily.map((d) => [d.day, d.views, d.completions]),
      ),
    );
  };

  return (
    <div className="mk an">
      <div className="page-head">
        <div>
          <h1>{t('analytics.title')}</h1>
          <p className="muted an-sub">{t('analytics.updated', { when: formatRelativeShort(loadedAt) })}</p>
        </div>
        <div className="row wrap">
          <select
            className="select input-sm an-select"
            aria-label={t('analytics.demoFilter')}
            value={demo}
            onChange={(e) => setDemo(e.target.value)}
          >
            <option value="">{t('analytics.allDemos')}</option>
            {demos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <select
            className="select input-sm an-select"
            aria-label={t('analytics.sourceFilter')}
            value={source}
            onChange={(e) => setSource(e.target.value as Source | '')}
          >
            <option value="">{t('analytics.allSources')}</option>
            <option value="direct">{t('analytics.src.direct')}</option>
            <option value="embed">{t('analytics.src.embed')}</option>
            <option value="link">{t('analytics.src.link')}</option>
          </select>
          <div className="segmented" role="radiogroup" aria-label={t('analytics.period')}>
            {PERIODS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={days === p} onClick={() => setDays(p)}>
                {t('analytics.daysShort', { count: p })}
              </button>
            ))}
            {/* Plage de dates libre : pas encore disponible */}
            <button
              type="button"
              role="radio"
              aria-checked="false"
              aria-disabled="true"
              title={t('shell.soon')}
            >
              <Calendar aria-hidden="true" />
              {t('analytics.dates')}
              <span className="badge an-soon">{t('shell.soon')}</span>
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void exportCsv()}>
            <Download aria-hidden="true" />
            {t('analytics.export')}
          </button>
        </div>
      </div>

      <div className="tabs an-tabs" role="tablist" aria-label={t('analytics.views_label')}>
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`an-tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`an-panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => selectTab(k)}
            onKeyDown={(e) => {
              const i = tabs.indexOf(k);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
                selectTab(n);
                document.getElementById(`an-tab-${n}`)?.focus();
              }
            }}
          >
            {t(`analytics.tab.${k}`)}
            {k === 'leads' && leadCount !== null && (
              <span className="badge badge-primary">{formatNumber(leadCount)}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section role="tabpanel" id="an-panel-overview" aria-labelledby="an-tab-overview">
          <Overview
            wsId={ws.id}
            data={data}
            prev={prev}
            days={days}
            demo={demo}
            demos={demos}
            title={title}
          />
        </section>
      )}
      {tab === 'sessions' && (
        <section role="tabpanel" id="an-panel-sessions" aria-labelledby="an-tab-sessions">
          <Sessions wsId={ws.id} days={days} demo={demo} source={source} title={title} />
        </section>
      )}
      {tab === 'leads' && canLeads && (
        <section role="tabpanel" id="an-panel-leads" aria-labelledby="an-tab-leads">
          <LeadsMkTable
            wsId={ws.id}
            days={days}
            demo={demo}
            title={title}
            onChange={setLeadCount}
            formDemo={demo || demos[0]?.id}
          />
        </section>
      )}
    </div>
  );
}

function emptyAnalytics(): WsAnalytics {
  return {
    views: 0,
    visitors: 0,
    completions: 0,
    ctaClicks: 0,
    leads: 0,
    daily: [],
    sources: { direct: 0, embed: 0, link: 0 },
  };
}

function Delta({ value, unit, label }: { value: number | null; unit: string; label: string }) {
  if (value === null) return <span className="subtle">{label}</span>;
  const up = value >= 0;
  return (
    <>
      <span className={up ? 'delta-up' : 'delta-down'}>
        {up ? (
          <ArrowUp aria-hidden="true" className="an-arrow" />
        ) : (
          <ArrowDown aria-hidden="true" className="an-arrow" />
        )}
        {formatNumber(Math.abs(value))}
        {unit}
      </span>{' '}
      <span className="subtle">{label}</span>
    </>
  );
}

function Overview({
  wsId,
  data,
  prev,
  days,
  demo,
  demos,
  title,
}: {
  wsId: string;
  data: WsAnalytics;
  prev: WsAnalytics | null;
  days: number;
  demo: string;
  demos: Array<{ id: string; title: string }>;
  title: (id: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const vs = t('analytics.vsPrev', { count: days });
  const pctChange = (c: number, p: number | undefined) =>
    p && p > 0 ? Math.round(((c - p) / p) * 100) : null;
  const rate = completionRate(data.visitors, data.completions);
  const prevRate = prev && prev.visitors > 0 ? completionRate(prev.visitors, prev.completions) : null;
  const share = (n: number) =>
    data.visitors > 0
      ? new Intl.NumberFormat(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(n / data.visitors)
      : '—';
  const pctUnit = ' %';

  // Entonnoir : démo filtrée, sinon la démo la plus vue sur la période
  const [funnelDemo, setFunnelDemo] = useState<string>('');
  const [funnel, setFunnel] = useState<{
    steps: Array<{ stepIndex: number; visitors: number }>;
    visitors: number;
    labels: string[];
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const from = new Date(Date.now() - days * 86400_000).toISOString();
      let id = demo;
      if (!id && demos.length) {
        const o = await supabase.rpc('workspace_overview', { p_workspace: wsId, p_days: days });
        const rows = ((o.data ?? []) as Array<{ demo_id: string; views: number }>).sort(
          (a, b) => b.views - a.views,
        );
        id = rows[0]?.demo_id ?? demos[0]!.id;
      }
      if (!id) return alive && setFunnel(null);
      const [a, s] = await Promise.all([
        supabase.rpc('demo_analytics', { p_demo: id, p_from: from, p_to: new Date().toISOString() }),
        supabase.from('steps').select('title, position').eq('demo_id', id).order('position'),
      ]);
      if (!alive) return;
      const r = a.data as unknown as {
        steps: Array<{ stepIndex: number; visitors: number }>;
        visitors: number;
      } | null;
      setFunnelDemo(id);
      setFunnel(
        r ? { steps: r.steps, visitors: r.visitors, labels: (s.data ?? []).map((x) => x.title ?? '') } : null,
      );
    })();
    return () => {
      alive = false;
    };
  }, [wsId, demo, demos, days]);

  const rows = funnel
    ? computeFunnel(
        funnel.steps,
        Math.max(funnel.labels.length, ...funnel.steps.map((x) => x.stepIndex + 1)),
        funnel.visitors,
      )
    : [];
  const worst = rows
    .slice(1)
    .reduce<(typeof rows)[number] | null>((w, r) => (!w || r.dropOff > w.dropOff ? r : w), null);
  const totalSources = data.sources.direct + data.sources.embed + data.sources.link;

  return (
    <>
      <div className="kpis">
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.views')}</span>
          <div className="value">{formatNumber(data.views)}</div>
          <span className="t-caption">
            <Delta value={pctChange(data.views, prev?.views)} unit={pctUnit} label={vs} />
          </span>
        </div>
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.visitors')}</span>
          <div className="value">{formatNumber(data.visitors)}</div>
          <span className="t-caption">
            <Delta value={pctChange(data.visitors, prev?.visitors)} unit={pctUnit} label={vs} />
          </span>
        </div>
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.completion')}</span>
          <div className="value">{Math.round(rate * 100)}&nbsp;%</div>
          <span className="t-caption">
            <Delta
              value={prevRate === null ? null : Math.round((rate - prevRate) * 100)}
              unit={t('demos.pts')}
              label={vs}
            />
          </span>
        </div>
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.leadsCollected')}</span>
          <div className="value">{formatNumber(data.leads)}</div>
          <span className="t-caption">
            <Delta
              value={pctChange(data.leads, prev?.leads)}
              unit={pctUnit}
              label={t('analytics.ofVisitors', { pct: share(data.leads) })}
            />
          </span>
        </div>
        <div className="card kpi">
          <span className="t-caption muted">{t('analytics.ctaClicks')}</span>
          <div className="value">{formatNumber(data.ctaClicks)}</div>
          <span className="t-caption">
            <Delta
              value={pctChange(data.ctaClicks, prev?.ctaClicks)}
              unit={pctUnit}
              label={t('analytics.ofVisitors', { pct: share(data.ctaClicks) })}
            />
          </span>
        </div>
      </div>

      <div className="two an-two">
        <div className="card chart-card">
          <div className="row between">
            <h2 className="t-h3">{t('analytics.viewsAndCompletions')}</h2>
            <div className="legend">
              <span>
                <i className="an-l1" />
                {t('analytics.views')}
              </span>
              <span>
                <i className="an-l2" />
                {t('analytics.completedDemos')}
              </span>
            </div>
          </div>
          <LineChart daily={data.daily} days={days} />
        </div>
        <div className="card chart-card">
          <h2 className="t-h3">{t('analytics.sources')}</h2>
          <div className="col an-sources">
            {(['embed', 'link', 'direct'] as Source[]).map((k) => {
              const n = data.sources[k];
              const p = totalSources ? Math.round((n / totalSources) * 100) : 0;
              return (
                <div key={k}>
                  <div className="row between t-label">
                    <span>{t(`analytics.srcLong.${k}`)}</span>
                    <span className="num">
                      {formatNumber(n)} · {p}&nbsp;%
                    </span>
                  </div>
                  <div className="progress an-progress">
                    <span style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <hr className="divider" />
          <div className="row between t-caption muted">
            <span>{t('analytics.devices')}</span>
            {/* Le type d'appareil n'est pas encore enregistré avec les événements */}
            <span className="badge">{t('shell.soon')}</span>
          </div>
        </div>
      </div>

      <div className="card chart-card an-funnel-card">
        <div className="row between">
          <div>
            <h2 className="t-h3">{t('analytics.stepByStep')}</h2>
            <p className="t-caption muted an-funnel-sub">
              {funnelDemo ? `${title(funnelDemo)} · ` : ''}
              {t('analytics.stepShare')}
            </p>
          </div>
          {funnelDemo && (
            <Link className="btn btn-secondary btn-sm" to={`/demos/${funnelDemo}/edit`}>
              {t('analytics.openInEditor')}
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="muted an-empty">{t('analytics.noStepData')}</p>
        ) : (
          <div className="funnel an-funnel" role="table" aria-label={t('analytics.funnelLabel')}>
            <div className="funnel-row t-caption muted" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">{t('analytics.step')}</span>
              <span role="columnheader" className="an-r">
                {t('analytics.visitors_short')}
              </span>
              <span role="columnheader" className="an-r">
                {t('analytics.dropOffShort')}
              </span>
            </div>
            {rows.map((r) => {
              const isWorst = worst && r.stepIndex === worst.stepIndex && worst.dropOff >= 0.1;
              return (
                <div key={r.stepIndex} className="funnel-row" role="row">
                  <span className="subtle" role="cell">
                    {r.stepIndex + 1}
                  </span>
                  <div className="funnel-bar" role="cell">
                    <span style={{ width: `${Math.round(r.reach * 100)}%` }} />
                    <b>{funnel!.labels[r.stepIndex] || t('editor.stepN', { n: r.stepIndex + 1 })}</b>
                  </div>
                  <span className="num an-r" role="cell">
                    {Math.round(r.reach * 100)}&nbsp;%
                  </span>
                  <span
                    className={`num an-r${isWorst ? ' drop' : r.stepIndex === 0 ? ' subtle' : ''}`}
                    role="cell"
                  >
                    {r.stepIndex === 0 ? (
                      '—'
                    ) : (
                      <>
                        {isWorst && <TriangleAlert aria-hidden="true" className="an-warn" />}−
                        {Math.round(r.dropOff * 100)}&nbsp;%
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {worst && worst.dropOff >= 0.1 && (
          <div className="alert alert-warning an-alert">
            <TriangleAlert aria-hidden="true" />
            <span>
              <b>
                {t('analytics.dropAlert', {
                  step: funnel!.labels[worst.stepIndex] || t('editor.stepN', { n: worst.stepIndex + 1 }),
                  pct: Math.round(worst.dropOff * 100),
                })}
              </b>{' '}
              {t('analytics.dropAdvice')}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

/** Courbes « Vues » (pleine) et « Démos terminées » (pointillés), comme la maquette. */
function LineChart({ daily, days }: { daily: WsAnalytics['daily']; days: number }) {
  const { t } = useTranslation();
  const series = useMemo(() => {
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const out: Array<{ day: string; views: number; completions: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      const d = byDay.get(day);
      out.push({ day, views: Number(d?.views ?? 0), completions: Number(d?.completions ?? 0) });
    }
    return out;
  }, [daily, days]);
  const max = Math.max(1, ...series.map((d) => d.views));
  const W = 600;
  const H = 220;
  const top = 20;
  const bottom = 30;
  const x = (i: number) => (series.length > 1 ? (i / (series.length - 1)) * W : 0);
  const y = (v: number) => H - bottom - (v / max) * (H - top - bottom);
  const path = (k: 'views' | 'completions') =>
    series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(' ');
  const mid = Math.floor(series.length / 2);
  const fmt = (d: string) => formatDate(d, { day: 'numeric', month: 'short' });
  const total = series.reduce((s, d) => s + d.views, 0);
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t('analytics.chartLabel', { count: days, total: formatNumber(total) })}
    >
      <g className="grid">
        <line x1="0" x2={W} y1="40" y2="40" />
        <line x1="0" x2={W} y1="100" y2="100" />
        <line x1="0" x2={W} y1="160" y2="160" />
      </g>
      <path d={path('views')} fill="none" stroke="var(--fd-color-chart-1)" strokeWidth="2.5" />
      <path d={`${path('views')} L${W} ${H} L0 ${H}Z`} fill="var(--fd-color-chart-1)" opacity=".08" />
      <path
        d={path('completions')}
        fill="none"
        stroke="var(--fd-color-chart-2)"
        strokeWidth="2.5"
        strokeDasharray="6 4"
      />
      <text x="2" y="214">
        {fmt(series[0]!.day)}
      </text>
      <text x={W / 2 - 30} y="214">
        {fmt(series[mid]!.day)}
      </text>
      <text x={W - 52} y="214">
        {fmt(series[series.length - 1]!.day)}
      </text>
    </svg>
  );
}

function Sessions({
  wsId,
  days,
  demo,
  source,
  title,
}: {
  wsId: string;
  days: number;
  demo: string;
  source: Source | '';
  title: (id: string) => string;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<{ total: number; rows: Session[] } | null>(null);
  useEffect(() => setPage(0), [days, demo, source]);
  useEffect(() => {
    setRes(null);
    void supabase
      .rpc('workspace_sessions', {
        p_workspace: wsId,
        p_from: new Date(Date.now() - days * 86400_000).toISOString(),
        p_to: new Date().toISOString(),
        p_demo: demo || null,
        p_source: source || null,
        p_limit: PAGE,
        p_offset: page * PAGE,
      })
      .then(({ data }) =>
        setRes((data as unknown as { total: number; rows: Session[] }) ?? { total: 0, rows: [] }),
      );
  }, [wsId, days, demo, source, page]);
  if (!res) return <Loading />;
  const dur = (s: number) =>
    s >= 60
      ? t('analytics.durMin', { m: Math.floor(s / 60), s: String(s % 60).padStart(2, '0') })
      : t('analytics.durSec', { s });
  const from = res.total ? page * PAGE + 1 : 0;
  const to = Math.min(res.total, (page + 1) * PAGE);
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">{t('analytics.tab.sessions')}</caption>
          <thead>
            <tr>
              <th>{t('analytics.visitor')}</th>
              <th>{t('leads.demo')}</th>
              <th>{t('analytics.source')}</th>
              <th className="r">{t('analytics.duration')}</th>
              <th className="r">{t('analytics.progress')}</th>
              <th>{t('analytics.date')}</th>
            </tr>
          </thead>
          <tbody>
            {res.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t('analytics.noSessions')}
                </td>
              </tr>
            )}
            {res.rows.map((s) => {
              const f = s.lead_fields ?? {};
              const str = (k: string) => (typeof f[k] === 'string' ? (f[k] as string).trim() : '');
              const company = str('company');
              const name =
                str('name') ||
                str('full_name') ||
                [str('first_name'), str('last_name')].filter(Boolean).join(' ');
              // Ligne 1 : nom (ou email) ; ligne 2 : « email · entreprise ». Lieu et navigateur des anonymes
              // ne sont pas enregistrés. Un viewer ne voit pas le lead (has_lead seulement).
              const main =
                name || s.lead_email || (s.has_lead ? t('analytics.identified') : t('analytics.anonymous'));
              const sub = [name ? s.lead_email : null, company || null].filter(Boolean).join(' · ');
              return (
                <tr key={s.session_id}>
                  <td>
                    <div className="row">
                      <span
                        className={`avatar avatar-sm${s.lead_email ? '' : ' an-anon'}`}
                        aria-hidden="true"
                      >
                        {s.lead_email ? initials(name || s.lead_email) : '?'}
                      </span>
                      <div>
                        <b>{main}</b>
                        {sub && <div className="t-caption subtle">{sub}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{title(s.demo_id)}</td>
                  <td>
                    <span className="badge">{t(`analytics.src.${s.source}`)}</span>
                  </td>
                  <td className="r">{dur(s.duration_s)}</td>
                  <td className="r">
                    {s.completed ? (
                      <span className="badge badge-success">{t('analytics.completed')}</span>
                    ) : (
                      <span className="num">
                        {(s.max_step ?? -1) + 1} / {s.steps_total}
                      </span>
                    )}
                  </td>
                  <td className="muted">{formatRelativeShort(s.started_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row between an-pager">
        <span className="t-caption muted">
          {t('analytics.range', {
            from: formatNumber(from),
            to: formatNumber(to),
            total: formatNumber(res.total),
          })}
        </span>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-disabled={page === 0 ? 'true' : undefined}
            onClick={() => page > 0 && setPage(page - 1)}
          >
            {t('analytics.prev')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-disabled={to >= res.total ? 'true' : undefined}
            onClick={() => to < res.total && setPage(page + 1)}
          >
            {t('analytics.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
