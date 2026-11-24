import { Download, Route } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { completionRate, computeFunnel, countTrend, rateTrend, toCsv } from '@flowdsiml/core';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card, Empty } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { downloadText } from '../../lib/download';
import { Funnel } from '../../components/charts';
import {
  KPI_KEYS,
  KpiTabs,
  MetricTable,
  TrendChart,
  alignDays,
  dayValue,
  kpiFromParam,
  metricValues,
  type KpiItem,
  type Series,
} from '../../components/kpi/KpiTabs';
import { formatNumber } from '../../lib/format';
import { Loading } from '../../components/guards';
import { ChartColumn } from 'lucide-react';

interface Analytics {
  views: number;
  visitors: number;
  completions: number;
  ctaClicks: number;
  leads: number;
  steps: Array<{ stepIndex: number; visitors: number }>;
  daily: Array<{ day: string; views: number; visitors?: number }>;
  /** Origine des vues (migration 130800) ; absent avant son application. */
  sources?: { direct: number; embed: number; link: number };
}

export const PERIODS = [7, 30, 90] as const;

export function DemoAnalyticsPage() {
  const { t } = useTranslation();
  const { demoId = '' } = useParams();
  const [days, setDays] = useState<number>(30);
  const [demo, setDemo] = useState<Tables<'demos'> | null>(null);
  const [steps, setSteps] = useState<Pick<Tables<'steps'>, 'id' | 'title'>[]>([]);
  const [data, setData] = useState<Analytics | null>(null);
  const [prev, setPrev] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  // L47 : l'indicateur actif est gardé dans l'adresse (?indicateur=)
  const [params, setParams] = useSearchParams();
  const metric = kpiFromParam(params.get('indicateur'), KPI_KEYS);
  const setMetric = (k: string) => {
    const next = new URLSearchParams(params);
    if (k === 'views') next.delete('indicateur');
    else next.set('indicateur', k);
    setParams(next, { replace: true });
  };
  const [series, setSeries] = useState<{ cur: Series | null; prev: Series | null; end: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
      setDemo(d.data);
      // Les libellés de l'entonnoir suivent la version en ligne (ordre publié), sinon le brouillon.
      if (d.data?.current_version_id) {
        const v = await supabase
          .from('demo_versions')
          .select('manifest')
          .eq('id', d.data.current_version_id)
          .maybeSingle();
        const m = v.data?.manifest as { steps?: Array<{ id: string; title: string }> } | undefined;
        if (m?.steps) return setSteps(m.steps.map((s) => ({ id: s.id, title: s.title })));
      }
      const s = await supabase.from('steps').select('id, title').eq('demo_id', demoId).order('position');
      setSteps(s.data ?? []);
    })();
  }, [demoId]);

  // Séries quotidiennes et détail par source (espace de la démo, filtre démo)
  useEffect(() => {
    if (!demo) return;
    setSeries(null);
    const now = Date.now();
    const iso = (d: number) => new Date(now - d * 86400_000).toISOString();
    const args = { p_workspace: demo.workspace_id, p_demo: demoId };
    void Promise.all([
      supabase.rpc('analytics_series', { ...args, p_from: iso(days), p_to: new Date(now).toISOString() }),
      supabase.rpc('analytics_series', { ...args, p_from: iso(2 * days), p_to: iso(days) }),
    ]).then(([c, p]) =>
      setSeries({
        cur: c.error ? null : ((c.data as unknown as Series) ?? null),
        prev: p.error ? null : ((p.data as unknown as Series) ?? null),
        end: now,
      }),
    );
  }, [demo, demoId, days]);

  useEffect(() => {
    setData(null);
    setPrev(null);
    const from = new Date(Date.now() - days * 86400_000).toISOString();
    // A1 : même durée, période précédente, pour les variations
    const prevFrom = new Date(Date.now() - 2 * days * 86400_000).toISOString();
    void supabase
      .rpc('demo_analytics', { p_demo: demoId, p_from: prevFrom, p_to: from })
      .then(({ data: r }) => setPrev((r as unknown as Analytics) ?? null));
    void supabase
      .rpc('demo_analytics', { p_demo: demoId, p_from: from, p_to: new Date().toISOString() })
      .then(({ data: r, error: e }) => {
        if (e) setError(errorMessage(t, e));
        else setData(r as unknown as Analytics);
      });
  }, [demoId, days, t]);

  if (!demo) return <Loading />;
  // Nombre d'étapes : version publiée, ou au minimum la plus haute étape vue (versions antérieures).
  const totalSteps = data ? Math.max(steps.length, ...data.steps.map((x) => x.stepIndex + 1)) : 0;
  const funnel = data ? computeFunnel(data.steps, totalSteps, data.visitors) : [];
  const labels = Array.from(
    { length: Math.max(totalSteps, steps.length) },
    (_, i) => steps[i]?.title || t('editor.stepN', { n: i + 1 }),
  );
  const none = { kind: 'none' } as const;
  const rate = data ? completionRate(data.visitors, data.completions) : 0;
  const items: KpiItem[] = data
    ? [
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
          trend: prev
            ? rateTrend(rate, completionRate(prev.visitors, prev.completions), prev.visitors)
            : none,
        },
        {
          key: 'leads',
          label: t('kpi.leads'),
          value: formatNumber(data.leads),
          trend: prev ? countTrend(data.leads, prev.leads) : none,
        },
      ]
    : [];
  const pick = (d: Parameters<typeof dayValue>[0]) => dayValue(d, metric);
  const SOURCES = ['embed', 'link', 'page', 'direct'] as const;

  function exportFunnel() {
    downloadText(
      `funnel-${demo!.title}.csv`,
      toCsv(
        [t('analytics.step'), t('analytics.visitors'), t('analytics.reach'), t('analytics.dropOff')],
        funnel.map((r) => [
          `${r.stepIndex + 1} · ${labels[r.stepIndex] ?? ''}`,
          r.visitors,
          r.reach.toFixed(3),
          r.dropOff.toFixed(3),
        ]),
      ),
    );
  }

  function exportDaily() {
    if (!data) return;
    downloadText(
      `analytics-${demo!.title}-${days}j.csv`,
      toCsv(
        ['day', 'views', 'visitors'],
        data.daily.map((d) => [d.day, d.views, d.visitors ?? '']),
      ),
    );
  }

  return (
    // §9 : vue « Analytics » de la démo, sous la barre commune (période, export en bouton icône)
    <>
      <div className="dv-tools">
        <PeriodPicker days={days} setDays={setDays} />
        <button
          type="button"
          className="fd-btn fd-btn--icon"
          aria-label={t('analytics.export')}
          title={t('analytics.export')}
          onClick={exportDaily}
          disabled={!data?.daily.length}
        >
          <Download size={16} aria-hidden="true" />
        </button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <KpiTabs items={items} active={metric} onSelect={setMetric} days={days}>
            <TrendChart
              title={t(`kpi.perDay.${metric}`)}
              days={days}
              rate={metric === 'completion'}
              loading={!series}
              cur={series?.cur ? alignDays(series.cur.daily, days, series.end, pick) : null}
              prev={
                series?.prev ? alignDays(series.prev.daily, days, series.end - days * 86400_000, pick) : null
              }
            />
          </KpiTabs>
          <MetricTable
            title={t('demoViews.byChannel')}
            nameLabel={t('demoViews.channel')}
            active={metric}
            columns={KPI_KEYS.map((k) => ({ key: k, label: t(`kpi.col.${k}`), rate: k === 'completion' }))}
            rows={SOURCES.map((src) => {
              const r = series?.cur?.bySource.find((x) => x.source === src);
              return {
                id: src,
                name: t(`kpi.sourceName.${src}`),
                values: metricValues(r ?? { views: 0, visitors: 0, completions: 0, cta: 0, leads: 0 }),
              };
            })}
          />
          <Card>
            <div className="fd-card__head">
              <span className="fd-icon-chip" aria-hidden="true">
                <Route />
              </span>
              <h2 className="fd-card__title">{t('analytics.funnel')}</h2>
              <Button icon={<Download />} size="sm" onClick={exportFunnel}>
                {t('analytics.exportCsv')}
              </Button>
            </div>
            {data.visitors === 0 ? (
              <Empty
                variant="compact"
                level={3}
                icon={<ChartColumn />}
                title={t('empty.analyticsTitle')}
                body={t('empty.analyticsBody')}
              />
            ) : (
              <Funnel
                rows={funnel}
                labels={labels}
                stepLabel={t('analytics.step')}
                reachLabel={t('analytics.reach')}
                dropLabel={t('analytics.dropOff')}
              />
            )}
          </Card>
        </>
      )}
    </>
  );
}

export function PeriodPicker({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="fd-segmented" role="group" aria-label={t('analytics.period')}>
      {PERIODS.map((p) => (
        <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>
          {/* Texte court affiché, libellé complet pour les lecteurs d'écran (RGAA 11.2) */}
          <span aria-hidden="true">{t('analytics.daysShort', { count: p })}</span>
          <span className="sr-only">{t('analytics.lastDays', { count: p })}</span>
        </button>
      ))}
    </div>
  );
}
