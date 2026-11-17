import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { completionRate, toCsv } from '@flowdsiml/core';
import { Button, Card } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { downloadText } from '../../lib/download';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { StatTile } from '../../components/charts';
import { Loading } from '../../components/guards';
import { PeriodPicker } from './DemoAnalyticsPage';

interface Row {
  demo_id: string;
  views: number;
  visitors: number;
  completions: number;
  leads: number;
}

export function AnalyticsPage() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    setRows(null);
    void Promise.all([
      supabase.rpc('workspace_overview', { p_workspace: current!.id, p_days: days }),
      supabase.from('demos').select('id, title').eq('workspace_id', current!.id).is('deleted_at', null),
    ]).then(([o, d]) => {
      setRows(((o.data ?? []) as Row[]).sort((a, b) => b.views - a.views));
      setTitles(Object.fromEntries((d.data ?? []).map((x) => [x.id, x.title])));
    });
  }, [current, days]);

  if (!rows) return <Loading />;
  const sum = (k: keyof Omit<Row, 'demo_id'>) => rows.reduce((s, r) => s + Number(r[k]), 0);
  const pct = (v: number) => `${Math.round(v * 100)} %`;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t('analytics.workspaceTitle')}</h1>
      </div>
      <PeriodPicker days={days} setDays={setDays} />
      <div className="stat-row">
        <StatTile label={t('analytics.views')} value={String(sum('views'))} />
        <StatTile label={t('analytics.visitors')} value={String(sum('visitors'))} />
        <StatTile
          label={t('analytics.completion')}
          value={pct(completionRate(sum('visitors'), sum('completions')))}
        />
        <StatTile label={t('analytics.leads')} value={String(sum('leads'))} />
      </div>
      <Card>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ marginTop: 0 }}>{t('analytics.byDemo')}</h2>
          <Button
            icon={<Download />}
            onClick={() =>
              downloadText(
                `analytics-${days}j.csv`,
                toCsv(
                  ['demo', 'views', 'visitors', 'completions', 'completion_rate', 'leads'],
                  rows.map((r) => [
                    titles[r.demo_id] ?? r.demo_id,
                    r.views,
                    r.visitors,
                    r.completions,
                    completionRate(r.visitors, r.completions).toFixed(3),
                    r.leads,
                  ]),
                ),
              )
            }
          >
            {t('analytics.exportCsv')}
          </Button>
        </div>
        <table className="fd-table">
          <thead>
            <tr>
              <th>{t('leads.demo')}</th>
              <th>{t('analytics.views')}</th>
              <th>{t('analytics.visitors')}</th>
              <th>{t('analytics.completion')}</th>
              <th>{t('analytics.leads')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.demo_id}>
                <td>
                  <Link to={`/demos/${r.demo_id}/analytics`}>{titles[r.demo_id] ?? '—'}</Link>
                </td>
                <td>{r.views}</td>
                <td>{r.visitors}</td>
                <td>{pct(completionRate(r.visitors, r.completions))}</td>
                <td>{r.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
