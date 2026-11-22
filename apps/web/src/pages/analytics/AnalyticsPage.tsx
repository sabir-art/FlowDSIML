import { Calendar, Check, ChevronDown, Download, Info, Link2, Monitor, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { completionRate, countTrend, rateTrend, toCsv, type ContentType } from '@flowdsiml/core';
import { MeasureDialog, VisitBadge, type Returning } from './returning';
import {
  KPI_KEYS,
  KpiTabs,
  TrendChart,
  alignDays,
  dayValue,
  kpiFromParam,
  type KpiItem,
  type KpiKey,
  type Series,
  type SeriesDay,
} from '../../components/kpi/KpiTabs';
import { supabase } from '../../lib/supabase';
import { loadDemoTypes } from '../../lib/demoTypes';
import { TypeBadge } from '../../components/TypeBadge';
import { downloadText } from '../../lib/download';
import { formatNumber, formatRelativeShort } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { Menu } from '../../components/Menu';
import { LeadsMkTable } from './LeadsMkTable';
import { initials } from '../../lib/initials';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import { FilterMenu, ListToolbar } from '../../components/toolbar/ListToolbar';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { LiveTab } from './advanced/LiveTab';
import { SurveysTab } from './advanced/SurveysTab';
import { SegmentsTab, type Segment } from './advanced/SegmentsTab';
import { AlertsTab } from './advanced/AlertsTab';
import { FilterBar } from './advanced/FilterBar';
import { decodeDef, encodeDef, type SegmentDef } from './advanced/segmentModel';
import { DemosTab } from './DemosTab';
import { DevicesWidget, ReturningWidget, SourcesWidget, StepsWidget } from './widgets';
import './advanced/advanced.css';
import './analytics.css';
import { Status } from '@flowdsiml/ui';

/** L19b : « page » = lecteur affiché dans la page publique. */
type Source = 'direct' | 'embed' | 'link' | 'page';
interface WsAnalytics {
  views: number;
  visitors: number;
  completions: number;
  ctaClicks: number;
  leads: number;
  daily: Array<{ day: string; views: number; completions: number }>;
  sources: Record<Exclude<Source, 'page'>, number> & { page?: number };
  /** L48-D : vues par type d'appareil et par navigateur (migration 150000). */
  devices?: Record<string, number>;
  browsers?: Record<string, number>;
  /** L19 : visiteurs du segment appliqué (null sans segment). */
  segmentVisitors?: number | null;
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
type Tab = 'overview' | 'demos' | 'sessions' | 'leads' | 'live' | 'tests' | 'segments' | 'alerts';
/** L48-D §1 : onglets rangés dans le menu « Plus » (routes inchangées). */
const MORE: Tab[] = ['live', 'tests', 'segments', 'alerts'];
/** Onglets où la barre de filtres (segment) s'applique. */
const FILTERED: Tab[] = ['overview', 'demos', 'sessions', 'leads', 'segments'];
const PERIODS = [7, 30, 90] as const;
const PAGE = 25;
/** L48-D §2 : au-delà, le menu Démo a un champ de recherche. */
const SEARCH_MIN = 10;

/** Analytics de l'espace (ANA-01, L48-D) : 4 onglets et « Plus », 4 indicateurs, grille de widgets. */
export function AnalyticsPage() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const ws = current!;
  // Données personnelles des leads : rôles editor et plus (comme la RLS leads_select)
  const canLeads = can('leads.view');
  const canEdit = can('demo.edit');
  const primary: Tab[] = canLeads
    ? ['overview', 'demos', 'sessions', 'leads']
    : ['overview', 'demos', 'sessions'];
  const tabs: Tab[] = [...primary, ...MORE];
  const [days, setDays] = useState<number>(30);
  const [demo, setDemo] = useState<string>('');
  const [source, setSource] = useState<Source | ''>('');
  const [params, setParams] = useSearchParams();
  // ANA-10 : l'entrée « Leads » de la navigation ouvre cet écran sur l'onglet Leads
  const parseTab = (p: string | null): Tab => (p && tabs.includes(p as Tab) ? (p as Tab) : 'overview');
  const [tab, setTab] = useState<Tab>(parseTab(params.get('tab')));
  useEffect(() => {
    setTab(parseTab(params.get('tab')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, canLeads]);
  /** Met à jour l'URL (onglet, filtres ?f=, segment ?seg=) en gardant le reste. */
  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || (k === 'tab' && v === 'overview')) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const selectTab = (k: Tab) => {
    setTab(k);
    patchParams({ tab: k });
  };
  // L19-04 : filtres de la barre (définition dans ?f=) ou segment enregistré (?seg=)
  const filters = useMemo(() => decodeDef(params.get('f')), [params]);
  const segId = params.get('seg');
  const [segments, setSegments] = useState<Segment[]>([]);
  const reloadSegments = useCallback(async () => {
    const { data: s } = await supabase.from('segments').select('*').eq('workspace_id', ws.id).order('name');
    setSegments((s ?? []) as Segment[]);
  }, [ws.id]);
  useEffect(() => {
    void reloadSegments();
  }, [reloadSegments]);
  const segment = segments.find((x) => x.id === segId) ?? null;
  const pSegment = useMemo(
    () => (segId ? { id: segId } : filters ? { match: filters.match, conditions: filters.conditions } : null),
    [segId, filters],
  );
  const segKey = JSON.stringify(pSegment);
  const [segInitial, setSegInitial] = useState<SegmentDef | null>(null);
  const [demos, setDemos] = useState<
    Array<{ id: string; title: string; folder: string | null; sandbox: boolean }>
  >([]);
  /** L48-G : type de contenu de chaque démo, en badge dans le filtre Démo. */
  const [types, setTypes] = useState<Record<string, ContentType>>({});
  const [data, setData] = useState<WsAnalytics | null>(null);
  const [prev, setPrev] = useState<WsAnalytics | null>(null);
  // L47 : séries quotidiennes et détail par démo de chaque indicateur (période et précédente)
  const [series, setSeries] = useState<{ cur: Series | null; prev: Series | null; end: number } | null>(null);
  const [loadedAt, setLoadedAt] = useState<string>('');
  // L26-06 : visiteurs récurrents ; L26-08 : modale « Mesure des visites »
  const [ret, setRet] = useState<Returning | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureTick, setMeasureTick] = useState(0);

  useEffect(() => {
    void Promise.all([
      supabase
        .from('demos')
        .select('id, title, folder_id, kind')
        .eq('workspace_id', ws.id)
        .is('deleted_at', null)
        .order('title'),
      supabase.from('folders').select('id, name').eq('workspace_id', ws.id),
    ]).then(([d, f]) => {
      const names = new Map((f.data ?? []).map((x) => [x.id, x.name]));
      void loadDemoTypes(ws.id, d.data ?? []).then(setTypes);
      setDemos(
        (d.data ?? []).map((x) => ({
          id: x.id,
          title: x.title,
          folder: x.folder_id ? (names.get(x.folder_id) ?? null) : null,
          sandbox: x.kind === 'sandbox',
        })),
      );
    });
  }, [ws.id]);

  useEffect(() => {
    setData(null);
    const now = Date.now();
    const iso = (d: number) => new Date(now - d * 86400_000).toISOString();
    const args = {
      p_workspace: ws.id,
      p_demo: demo || null,
      p_source: source || null,
      p_segment: pSegment as never,
    };
    setRet(null);
    setSeries(null);
    void supabase
      .rpc('workspace_returning', { ...args, p_from: iso(days), p_to: new Date(now).toISOString() })
      .then(({ data: r }) => setRet((r as unknown as Returning) ?? null));
    void Promise.all([
      supabase.rpc('workspace_analytics', { ...args, p_from: iso(days), p_to: new Date(now).toISOString() }),
      supabase.rpc('workspace_analytics', { ...args, p_from: iso(2 * days), p_to: iso(days) }),
      supabase.rpc('analytics_series', { ...args, p_from: iso(days), p_to: new Date(now).toISOString() }),
      supabase.rpc('analytics_series', { ...args, p_from: iso(2 * days), p_to: iso(days) }),
    ]).then(([c, p, sc, sp]) => {
      setSeries({
        cur: sc.error ? null : ((sc.data as unknown as Series) ?? null),
        prev: sp.error ? null : ((sp.data as unknown as Series) ?? null),
        end: now,
      });
      setData((c.data as unknown as WsAnalytics) ?? emptyAnalytics());
      setPrev((p.data as unknown as WsAnalytics) ?? null);
      setLoadedAt(new Date().toISOString());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.id, days, demo, source, segKey, measureTick]);

  if (!data) return <Loading />;
  const title = (id: string) => demos.find((d) => d.id === id)?.title ?? '—';
  const byDemo = series?.cur?.byDemo ?? [];

  const exportCsv = async () => {
    // Onglet Leads : export des leads de la période (rôle editor et plus)
    if (tab === 'leads' && canLeads) {
      const { data: r } = await supabase.rpc('workspace_leads', {
        p_workspace: ws.id,
        p_from: new Date(Date.now() - days * 86400_000).toISOString(),
        p_to: new Date().toISOString(),
        p_demo: demo || null,
        p_limit: 200,
        p_segment: pSegment as never,
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
    // Onglet Démos : une ligne par démo de la période
    if (tab === 'demos') {
      return downloadText(
        `demos-${days}j.csv`,
        toCsv(
          ['demo', 'views', 'visitors', 'completions', ...(canLeads ? ['leads'] : [])],
          byDemo.map((r) => [
            title(r.demo_id),
            r.views,
            r.visitors,
            r.completions,
            ...(canLeads ? [r.leads] : []),
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

  const inMore = MORE.includes(tab);
  return (
    <div className="mk an">
      <div className="page-head">
        <div>
          <h1>{t('analytics.title')}</h1>
          <p className="muted an-sub">{t('analytics.updated', { when: formatRelativeShort(loadedAt) })}</p>
        </div>
        <div className="row wrap an-head-actions">
          <NotificationBell />
        </div>
      </div>

      {/* L48-D §1 : 4 onglets au premier niveau, puis « Plus » (menu), qui prend le nom de l'onglet ouvert */}
      {/* §18.7 : rangée d'onglets, défilement horizontal voulu sur mobile */}
      <div className="an-tabrow" data-scroll-x="">
        <div className="an-tabs2" role="tablist" aria-label={t('analytics.views_label')}>
          {primary.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`an-tab-${k}`}
              aria-selected={tab === k}
              aria-controls={tab === k ? `an-panel-${k}` : undefined}
              tabIndex={tab === k || (inMore && k === 'overview') ? 0 : -1}
              onClick={() => selectTab(k)}
              onKeyDown={(e) => {
                const i = primary.indexOf(k);
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  const n =
                    primary[(i + (e.key === 'ArrowRight' ? 1 : primary.length - 1)) % primary.length]!;
                  selectTab(n);
                  document.getElementById(`an-tab-${n}`)?.focus();
                }
              }}
            >
              {t(`analytics.tab.${k}`)}
            </button>
          ))}
        </div>
        <Menu
          label={t('analytics.more')}
          align="end"
          custom={{
            className: `an-more${inMore ? ' is-active' : ''}`,
            content: (
              <>
                {inMore ? t(`analytics.tab.${tab}`) : t('analytics.more')}
                <ChevronDown aria-hidden="true" />
              </>
            ),
          }}
          items={[
            ...MORE.map((k) => ({
              label: t(`analytics.tab.${k}`),
              current: tab === k,
              end: tab === k ? <Check aria-hidden="true" /> : undefined,
              onSelect: () => selectTab(k),
            })),
            'separator' as const,
            {
              label: t('analytics.ret.measure'),
              icon: <ShieldCheck />,
              onSelect: () => setMeasureOpen(true),
            },
            {
              label: t('analytics.dates'),
              icon: <Calendar />,
              disabled: true,
              hint: t('shell.soon'),
              end: <span className="soon-text">{t('shell.soon')}</span>,
              onSelect: () => undefined,
            },
          ]}
        />
      </div>

      {/* L48-D §2 : Démo, Source | période, Exporter */}
      <ListToolbar
        className="an-toolbar"
        activeCount={(demo ? 1 : 0) + (source ? 1 : 0)}
        onReset={() => {
          setDemo('');
          setSource('');
        }}
        status={t('analytics.filteredOn', {
          demo: demo ? title(demo) : t('analytics.allDemos'),
          source: source ? t(`analytics.src.${source}`) : t('analytics.allSources'),
        })}
        filters={
          <>
            <FilterMenu
              icon={<Monitor />}
              label={t('analytics.demoLabel')}
              value={demo ? title(demo) : t('analytics.allDemos')}
              active={!!demo}
              search={
                demos.length > SEARCH_MIN
                  ? { label: t('analytics.searchDemo'), empty: t('analytics.noDemoMatch'), keep: 1 }
                  : undefined
              }
              items={[
                {
                  label: t('analytics.allDemos'),
                  icon: demo ? <span /> : <Check />,
                  onSelect: () => setDemo(''),
                },
                ...demos.map((d) => ({
                  label: d.title,
                  icon: demo === d.id ? <Check /> : <span />,
                  end: types[d.id] ? <TypeBadge type={types[d.id]!} /> : undefined,
                  onSelect: () => setDemo(d.id),
                })),
              ]}
            />
            <FilterMenu
              icon={<Link2 />}
              label={t('analytics.sourceLabel')}
              value={source ? t(`analytics.src.${source}`) : t('analytics.allSources')}
              active={!!source}
              items={[
                {
                  label: t('analytics.allSources'),
                  icon: source ? <span /> : <Check />,
                  onSelect: () => setSource(''),
                },
                ...(['direct', 'embed', 'link', 'page'] as Source[]).map((k) => ({
                  label: t(`analytics.src.${k}`),
                  icon: source === k ? <Check /> : <span />,
                  onSelect: () => setSource(k),
                })),
              ]}
            />
            {FILTERED.includes(tab) && (
              <FilterBar
                def={segId ? null : filters}
                segment={segment}
                segments={segments}
                demos={demos}
                canEdit={canEdit}
                onChange={(d) => patchParams({ f: d ? encodeDef(d) : null, seg: null })}
                onSegment={(x) => patchParams({ seg: x?.id ?? null, f: null })}
                onSave={() => {
                  setSegInitial(filters);
                  selectTab('segments');
                }}
              />
            )}
          </>
        }
        end={
          <div className="an-toolbar__end">
            <div className="fd-segmented" role="radiogroup" aria-label={t('analytics.period')}>
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={days === p}
                  onClick={() => setDays(p)}
                >
                  {t('analytics.daysShort', { count: p })}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>
              <Download aria-hidden="true" />
              {t('analytics.export')}
            </button>
          </div>
        }
      />

      {FILTERED.includes(tab) && data.segmentVisitors != null && data.segmentVisitors < 5 && (
        <p className="help l19-small" role="status">
          {t('analytics.adv.seg.tooSmall')}
        </p>
      )}
      {/* L19-03 / L19-04 : ces onglets n'appliquent pas encore les filtres du haut : on le dit */}
      {(tab === 'tests' || tab === 'segments') && (
        <p className="help an-filter-note" role="note">
          <Info size={14} aria-hidden="true" />
          {t('analytics.adv.filtersNotApplied')}
        </p>
      )}
      {tab === 'overview' && (
        <section role="tabpanel" id="an-panel-overview" aria-labelledby="an-tab-overview">
          <Overview
            data={data}
            prev={prev}
            series={series}
            keys={canLeads ? KPI_KEYS : KPI_KEYS.filter((k) => k !== 'leads')}
            metric={kpiFromParam(
              params.get('indicateur'),
              canLeads ? KPI_KEYS : KPI_KEYS.filter((k) => k !== 'leads'),
            )}
            onMetric={(k) => patchParams({ indicateur: k === 'views' ? null : k })}
            days={days}
            onWiden={() => setDays(90)}
            demo={demo}
            demos={demos}
            ret={ret}
            onHow={() => setMeasureOpen(true)}
          />
        </section>
      )}
      {tab === 'demos' && (
        <section role="tabpanel" id="an-panel-demos" aria-labelledby="an-tab-demos">
          {series ? (
            <DemosTab
              demos={demo ? demos.filter((d) => d.id === demo) : demos}
              rows={byDemo}
              canLeads={canLeads}
            />
          ) : (
            <Loading />
          )}
        </section>
      )}
      {measureOpen && (
        <MeasureDialog onClose={() => setMeasureOpen(false)} onSaved={() => setMeasureTick((n) => n + 1)} />
      )}
      {tab === 'sessions' && (
        <section role="tabpanel" id="an-panel-sessions" aria-labelledby="an-tab-sessions">
          <Sessions wsId={ws.id} days={days} demo={demo} source={source} title={title} segment={pSegment} />
        </section>
      )}
      {tab === 'leads' && canLeads && (
        <section role="tabpanel" id="an-panel-leads" aria-labelledby="an-tab-leads">
          <LeadsMkTable
            wsId={ws.id}
            days={days}
            demo={demo}
            title={title}
            formDemo={demo || demos[0]?.id}
            segment={pSegment}
          />
        </section>
      )}
      {tab === 'live' && (
        <section role="tabpanel" id="an-panel-live" aria-label={t('analytics.tab.live')}>
          <LiveTab wsId={ws.id} demo={demo} demos={demos} />
        </section>
      )}
      {tab === 'tests' && (
        <section role="tabpanel" id="an-panel-tests" aria-label={t('analytics.tab.tests')}>
          <SurveysTab demo={demo} demos={demos} days={days} canEdit={canEdit} />
        </section>
      )}
      {tab === 'segments' && (
        <section role="tabpanel" id="an-panel-segments" aria-label={t('analytics.tab.segments')}>
          <SegmentsTab
            wsId={ws.id}
            days={days}
            demos={demos}
            canEdit={canEdit}
            initial={segInitial}
            segments={segments}
            reload={reloadSegments}
            onApply={(x) => {
              setTab('overview');
              patchParams({ tab: 'overview', seg: x.id, f: null });
            }}
          />
        </section>
      )}
      {tab === 'alerts' && (
        <section role="tabpanel" id="an-panel-alerts" aria-label={t('analytics.tab.alerts')}>
          <AlertsTab
            wsId={ws.id}
            demos={demos}
            segments={segments}
            canEdit={canEdit}
            isAdmin={can('integrations.manage')}
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

function Overview({
  data,
  prev,
  series,
  keys,
  metric,
  onMetric,
  days,
  onWiden,
  demo,
  demos,
  ret,
  onHow,
}: {
  data: WsAnalytics;
  prev: WsAnalytics | null;
  series: { cur: Series | null; prev: Series | null; end: number } | null;
  keys: KpiKey[];
  metric: KpiKey;
  onMetric: (k: KpiKey) => void;
  days: number;
  onWiden: () => void;
  demo: string;
  demos: Array<{ id: string; title: string }>;
  ret: Returning | null;
  onHow: () => void;
}) {
  const { t } = useTranslation();
  const rate = completionRate(data.visitors, data.completions);
  const none = { kind: 'none' } as const;
  const all: KpiItem[] = [
    {
      key: 'views',
      label: t('kpi.views'),
      value: formatNumber(data.views),
      trend: prev ? countTrend(data.views, prev.views) : none,
    },
    {
      key: 'visitors',
      label: t('kpi.visitors'),
      value: formatNumber(data.visitors),
      trend: prev ? countTrend(data.visitors, prev.visitors) : none,
    },
    {
      key: 'completion',
      label: t('kpi.completion'),
      value: `${Math.round(rate * 100)}\u00a0%`,
      trend: prev ? rateTrend(rate, completionRate(prev.visitors, prev.completions), prev.visitors) : none,
    },
    {
      key: 'leads',
      label: t('kpi.leads'),
      value: formatNumber(data.leads),
      trend: prev ? countTrend(data.leads, prev.leads) : none,
    },
  ];
  const items = all.filter((i) => keys.includes(i.key as KpiKey));
  const pick = (d: SeriesDay) => dayValue(d, metric);
  // Étape par étape : démo filtrée, sinon la plus vue de la période, sinon la première
  const top = [...(series?.cur?.byDemo ?? [])].sort((a, b) => b.views - a.views)[0]?.demo_id;
  const initial = demo || top || demos[0]?.id || '';
  const common = { days, onWiden };

  return (
    <>
      <KpiTabs items={items} active={metric} onSelect={onMetric} days={days}>
        <TrendChart
          title={t(`kpi.perDay.${metric}`)}
          days={days}
          rate={metric === 'completion'}
          loading={!series}
          cur={series?.cur ? alignDays(series.cur.daily, days, series.end, pick) : null}
          prev={series?.prev ? alignDays(series.prev.daily, days, series.end - days * 86400_000, pick) : null}
        />
      </KpiTabs>
      <div className="an-grid">
        <SourcesWidget {...common} sources={data.sources} />
        <StepsWidget {...common} demos={demos} initial={initial} />
        <ReturningWidget {...common} ret={ret} onHow={onHow} />
        <DevicesWidget {...common} devices={data.devices ?? {}} browsers={data.browsers ?? {}} />
      </div>
    </>
  );
}

function Sessions({
  wsId,
  days,
  demo,
  source,
  title,
  segment,
}: {
  wsId: string;
  days: number;
  demo: string;
  source: Source | '';
  title: (id: string) => string;
  segment: unknown;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<{ total: number; rows: Session[]; tooSmall?: boolean } | null>(null);
  const [visits, setVisits] = useState<Record<string, number>>({});
  const segKey = JSON.stringify(segment);
  useEffect(() => setPage(0), [days, demo, source, segKey]);
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
        p_segment: segment as never,
      })
      .then(async ({ data }) => {
        const r = (data as unknown as { total: number; rows: Session[] }) ?? { total: 0, rows: [] };
        // L26-07 : numéro de visite des sessions affichées (vide si la mesure est désactivée)
        const ids = r.rows.map((x) => x.session_id);
        const v = ids.length
          ? await supabase.rpc('session_visits', { p_workspace: wsId, p_sessions: ids })
          : { data: {} };
        setVisits((v.data as Record<string, number> | null) ?? {});
        setRes(r);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, days, demo, source, page, segKey]);
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
                  {res.tooSmall ? t('analytics.adv.seg.tooSmall') : t('analytics.noSessions')}
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
                        <VisitBadge no={visits[s.session_id]} />
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
                      <Status size="sm" tone="success">
                        {t('analytics.completed')}
                      </Status>
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
