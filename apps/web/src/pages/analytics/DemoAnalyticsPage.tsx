import {
  ArrowLeft,
  BarChart3,
  Download,
  Eye,
  Mail,
  MousePointerClick,
  Pencil,
  PieChart,
  Route,
  Share2,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { completionRate, computeFunnel, toCsv } from '@flowdsiml/core';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { downloadText } from '../../lib/download';
import { DailyBars, Donut, Funnel, StatTile, variation } from '../../components/charts';
import { formatNumber } from '../../lib/format';
import { Loading } from '../../components/guards';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { LeadsTable } from './LeadsTable';

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
  const { can } = useWorkspace();
  const [days, setDays] = useState<number>(30);
  const [demo, setDemo] = useState<Tables<'demos'> | null>(null);
  const [steps, setSteps] = useState<Pick<Tables<'steps'>, 'id' | 'title'>[]>([]);
  const [data, setData] = useState<Analytics | null>(null);
  const [prev, setPrev] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'views' | 'visitors'>('views');
  const [versionNumber, setVersionNumber] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
      setDemo(d.data);
      // Les libellés de l'entonnoir suivent la version en ligne (ordre publié), sinon le brouillon.
      if (d.data?.current_version_id) {
        const v = await supabase
          .from('demo_versions')
          .select('manifest, number')
          .eq('id', d.data.current_version_id)
          .maybeSingle();
        setVersionNumber(v.data?.number ?? null);
        const m = v.data?.manifest as { steps?: Array<{ id: string; title: string }> } | undefined;
        if (m?.steps) return setSteps(m.steps.map((s) => ({ id: s.id, title: s.title })));
      }
      const s = await supabase.from('steps').select('id, title').eq('demo_id', demoId).order('position');
      setSteps(s.data ?? []);
    })();
  }, [demoId]);

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
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const vs = t('analytics.vsPreviousDays', { count: days });
  const kpi = { deltaLabel: vs, noDeltaLabel: t('analytics.noComparison') };

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

  const sources = data?.sources;
  return (
    <div className="stack page-wide">
      <header className="page-head page-head--refonte">
        <Link className="fd-btn fd-btn--round btn-surface" to="/analytics" aria-label={t('common.back')}>
          <ArrowLeft aria-hidden="true" />
        </Link>
        <div className="page-head__titles">
          <h1>{demo.title}</h1>
          <p className="page-head__sub">
            {[
              t(`status.${demo.status}`),
              versionNumber ? t('analytics.versionN', { n: versionNumber }) : null,
              t('share.stepCount', { count: totalSteps || steps.length }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="page-head__actions">
          <PeriodPicker days={days} setDays={setDays} />
          <Link className="fd-btn" to={`/demos/${demoId}/edit`}>
            <Pencil size={16} aria-hidden="true" />
            {t('share.backToEditor')}
          </Link>
          <Link className="fd-btn" to={`/demos/${demoId}/share`}>
            <Share2 size={16} aria-hidden="true" />
            {t('editor.share')}
          </Link>
          <Button icon={<Download />} onClick={exportDaily} disabled={!data?.daily.length}>
            {t('analytics.export')}
          </Button>
        </div>
      </header>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <section className="stat-row stat-row--5" aria-label={t('analytics.kpis', { count: days })}>
            <StatTile
              hero
              icon={<Eye />}
              label={t('analytics.views')}
              value={formatNumber(data.views)}
              delta={prev && variation(data.views, prev.views)}
              {...kpi}
            />
            <StatTile
              icon={<Users />}
              label={t('analytics.visitors')}
              value={formatNumber(data.visitors)}
              delta={prev && variation(data.visitors, prev.visitors)}
              {...kpi}
            />
            <StatTile
              icon={<Route />}
              label={t('analytics.completion')}
              value={pct(completionRate(data.visitors, data.completions))}
              delta={
                prev && prev.visitors > 0
                  ? variation(
                      completionRate(data.visitors, data.completions),
                      completionRate(prev.visitors, prev.completions),
                    )
                  : null
              }
              {...kpi}
            />
            <StatTile
              icon={<MousePointerClick />}
              label={t('analytics.ctaClicks')}
              value={formatNumber(data.ctaClicks)}
              delta={prev && variation(data.ctaClicks, prev.ctaClicks)}
              {...kpi}
            />
            <StatTile
              icon={<Mail />}
              label={t('analytics.leads')}
              value={formatNumber(data.leads)}
              delta={prev && variation(data.leads, prev.leads)}
              {...kpi}
            />
          </section>
          <div className="grid-2-1">
            <Card>
              <div className="fd-card__head">
                <span className="fd-icon-chip" aria-hidden="true">
                  <BarChart3 />
                </span>
                <h2 className="fd-card__title">
                  {metric === 'views' ? t('analytics.viewsPerDay') : t('analytics.visitorsPerDay')}
                </h2>
                <div className="fd-segmented" role="group" aria-label={t('analytics.metric')}>
                  {(['views', 'visitors'] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}>
                      {t(`analytics.${m}Short`)}
                    </button>
                  ))}
                </div>
              </div>
              <DailyBars
                data={data.daily}
                metric={metric}
                label={metric === 'views' ? t('analytics.viewsPerDay') : t('analytics.visitorsPerDay')}
                emptyText={t('analytics.noData')}
              />
            </Card>
            <Card>
              <div className="fd-card__head">
                <span className="fd-icon-chip" aria-hidden="true">
                  <PieChart />
                </span>
                <h2 className="fd-card__title">{t('analytics.sources')}</h2>
              </div>
              {sources ? (
                <Donut
                  label={t('analytics.sources')}
                  totalLabel={t('analytics.viewsUnit', { count: data.views })}
                  valueLabel={(n) => t('demos.views', { count: n, n: formatNumber(n) })}
                  segments={[
                    {
                      label: t('analytics.source_direct'),
                      value: sources.direct,
                      color: 'var(--fd-color-chart-2)',
                    },
                    {
                      label: t('analytics.source_embed'),
                      value: sources.embed,
                      color: 'var(--fd-color-chart-3)',
                    },
                    {
                      label: t('analytics.source_link'),
                      value: sources.link,
                      color: 'var(--fd-color-chart-4)',
                    },
                  ]}
                />
              ) : (
                <p className="fd-muted">{t('analytics.noData')}</p>
              )}
            </Card>
          </div>
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
              <p className="fd-muted">{t('analytics.noData')}</p>
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
          {can('leads.view') && (
            <Card>
              <div className="fd-card__head">
                <span className="fd-icon-chip" aria-hidden="true">
                  <Mail />
                </span>
                <h2 className="fd-card__title">{t('analytics.leads')}</h2>
              </div>
              <LeadsTable demoId={demoId} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export function PeriodPicker({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="fd-segmented" role="group" aria-label={t('analytics.period')}>
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={days === p}
          aria-label={t('analytics.lastDays', { count: p })}
          onClick={() => setDays(p)}
        >
          {t('analytics.daysShort', { count: p })}
        </button>
      ))}
    </div>
  );
}
