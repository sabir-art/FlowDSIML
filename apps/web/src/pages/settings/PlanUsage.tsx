import { YesNo } from '../../components/YesNo';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

interface Usage {
  plan: string;
  limits: Record<string, number | boolean | null>;
  published_demos: number;
  demos: number;
  members: number;
}

export function PlanUsage() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    if (!current) return;
    void supabase
      .rpc('workspace_usage', { p_workspace: current.id })
      .then(({ data }) => setUsage(data as unknown as Usage));
  }, [current]);

  if (!usage) return null;
  const fmt = (v: unknown) => (v === null || v === undefined ? '∞' : String(v));
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>
        {t('plan.title')} :{' '}
        <span className="fd-badge">{t(`plan.names.${usage.plan}`, { defaultValue: usage.plan })}</span>
      </h2>
      <table className="fd-table">
        <tbody>
          <tr>
            <td>{t('plan.publishedDemos')}</td>
            <td>
              <Gauge used={usage.published_demos} limit={usage.limits.published_demos as number | null} />
            </td>
          </tr>
          <tr>
            <td>{t('plan.members')}</td>
            <td>
              <Gauge used={usage.members} limit={usage.limits.members as number | null} />
            </td>
          </tr>
          <tr>
            <td>{t('plan.stepsPerDemo')}</td>
            <td>{fmt(usage.limits.steps_per_demo)}</td>
          </tr>
          <tr>
            <td>{t('plan.leadForms')}</td>
            <td>
              <YesNo value={!!usage.limits.lead_forms} />
            </td>
          </tr>
          <tr>
            <td>{t('plan.removeBranding')}</td>
            <td>
              <YesNo value={!!usage.limits.remove_branding} />
            </td>
          </tr>
          <tr>
            <td>{t('plan.retention')}</td>
            <td>{t('plan.days', { count: Number(usage.limits.analytics_retention_days ?? 30) })}</td>
          </tr>
        </tbody>
      </table>
      <p className="fd-muted">{t('plan.upgradeHint')}</p>
    </Card>
  );
}

/** Jauge d'usage (W10) : avertissement à 80 %, danger à 100 % et au-delà. */
function Gauge({ used, limit }: { used: number; limit: number | null }) {
  const { t } = useTranslation();
  if (limit === null || limit === undefined) return <span>{used} / ∞</span>;
  const ratio = used / Math.max(1, limit);
  const level = ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'ok';
  return (
    <div className={`gauge gauge-${level}`}>
      <span>
        {used} / {limit}
      </span>
      <div className="gauge-track" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      {level !== 'ok' && <small>{t(level === 'danger' ? 'plan.overLimit' : 'plan.nearLimit')}</small>}
    </div>
  );
}
