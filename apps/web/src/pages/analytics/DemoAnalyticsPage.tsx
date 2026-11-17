import { Download, Pencil, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { completionRate, computeFunnel, toCsv } from '@flowdsiml/core';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { downloadText } from '../../lib/download';
import { DailyBars, Funnel, StatTile } from '../../components/charts';
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
  daily: Array<{ day: string; views: number }>;
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
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    setData(null);
    const from = new Date(Date.now() - days * 86400_000).toISOString();
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
  const labels = steps.map((s) => s.title || t('editor.untitled'));
  const pct = (v: number) => `${Math.round(v * 100)} %`;

  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <div className="page-head">
        <h1>
          {t('analytics.title')} — {demo.title}
        </h1>
        <div className="row">
          <Link className="fd-btn" to={`/demos/${demoId}/edit`}>
            <Pencil size={16} aria-hidden="true" />
            {t('share.backToEditor')}
          </Link>
          <Link className="fd-btn" to={`/demos/${demoId}/share`}>
            <Share2 size={16} aria-hidden="true" />
            {t('editor.share')}
          </Link>
        </div>
      </div>
      <PeriodPicker days={days} setDays={setDays} />
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="stat-row">
            <StatTile label={t('analytics.views')} value={String(data.views)} />
            <StatTile label={t('analytics.visitors')} value={String(data.visitors)} />
            <StatTile
              label={t('analytics.completion')}
              value={pct(completionRate(data.visitors, data.completions))}
              hint={t('analytics.completionHint', { n: data.completions })}
            />
            <StatTile label={t('analytics.ctaClicks')} value={String(data.ctaClicks)} />
            <StatTile label={t('analytics.leads')} value={String(data.leads)} />
          </div>
          <Card>
            <h2 style={{ marginTop: 0 }}>{t('analytics.viewsPerDay')}</h2>
            <DailyBars
              data={data.daily}
              label={t('analytics.viewsPerDay')}
              emptyText={t('analytics.noData')}
            />
          </Card>
          <Card>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ marginTop: 0 }}>{t('analytics.funnel')}</h2>
              <Button
                icon={<Download />}
                size="sm"
                onClick={() =>
                  downloadText(
                    `funnel-${demo.title}.csv`,
                    toCsv(
                      [
                        t('analytics.step'),
                        t('analytics.visitors'),
                        t('analytics.reach'),
                        t('analytics.dropOff'),
                      ],
                      funnel.map((r) => [
                        r.stepIndex + 1 + '. ' + (labels[r.stepIndex] ?? ''),
                        r.visitors,
                        r.reach.toFixed(3),
                        r.dropOff.toFixed(3),
                      ]),
                    ),
                  )
                }
              >
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
              <h2 style={{ marginTop: 0 }}>{t('analytics.leads')}</h2>
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
    <div className="toolbar" role="group" aria-label={t('analytics.period')}>
      {PERIODS.map((p) => (
        <Button
          key={p}
          size="sm"
          variant={days === p ? 'primary' : 'default'}
          aria-pressed={days === p}
          onClick={() => setDays(p)}
        >
          {t('analytics.lastDays', { count: p })}
        </Button>
      ))}
    </div>
  );
}
