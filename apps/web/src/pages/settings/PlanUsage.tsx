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
        {t('plan.title')} : <span className="fd-badge">{usage.plan}</span>
      </h2>
      <table className="fd-table">
        <tbody>
          <tr>
            <td>{t('plan.publishedDemos')}</td>
            <td>
              {usage.published_demos} / {fmt(usage.limits.published_demos)}
            </td>
          </tr>
          <tr>
            <td>{t('plan.members')}</td>
            <td>
              {usage.members} / {fmt(usage.limits.members)}
            </td>
          </tr>
          <tr>
            <td>{t('plan.stepsPerDemo')}</td>
            <td>{fmt(usage.limits.steps_per_demo)}</td>
          </tr>
          <tr>
            <td>{t('plan.leadForms')}</td>
            <td>{usage.limits.lead_forms ? '✓' : '—'}</td>
          </tr>
          <tr>
            <td>{t('plan.removeBranding')}</td>
            <td>{usage.limits.remove_branding ? '✓' : '—'}</td>
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
