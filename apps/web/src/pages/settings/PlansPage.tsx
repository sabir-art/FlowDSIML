import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Minus } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Card } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { PlanUsage } from './PlanUsage';

type Limits = {
  published_demos: number | null;
  members: number | null;
  steps_per_demo: number | null;
  remove_branding: boolean;
  lead_forms: boolean;
  analytics_retention_days: number;
};

/** Page Plans (D3) : comparatif lu depuis public.plans ; changement de plan manuel tant que Stripe n'est pas branché. */
export function PlansPage() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const [plans, setPlans] = useState<Tables<'plans'>[] | null>(null);

  useEffect(() => {
    void supabase
      .from('plans')
      .select('*')
      .order('sort')
      .then(({ data }) => setPlans(data ?? []));
  }, []);

  if (!plans) return <Loading />;
  const n = (v: number | null) => (v === null ? t('plans.unlimited') : String(v));
  const yes = (v: boolean) =>
    v ? (
      <Check size={16} className="plan-yes" aria-label={t('common.yes')} />
    ) : (
      <Minus size={16} className="plan-no" aria-label={t('common.no')} />
    );

  return (
    <div className="stack" style={{ maxWidth: 1080 }}>
      <div className="page-head">
        <h1>{t('plans.title')}</h1>
      </div>
      <Alert kind="info">{t('plans.manualNotice')}</Alert>
      <div className="plans-grid">
        {plans.map((p) => {
          const l = p.limits as unknown as Limits;
          const isCurrent = current?.plan_code === p.code;
          return (
            <Card key={p.code} className={`plan-card${isCurrent ? ' is-current fd-card--hero' : ''}`}>
              <div className="plan-head">
                <h2>{t(`plan.names.${p.code}`, { defaultValue: p.name })}</h2>
                {isCurrent && <span className="fd-badge status-published">{t('plans.current')}</span>}
              </div>
              <ul className="plan-features">
                <li>
                  <span>{t('plan.publishedDemos')}</span>
                  <strong>{n(l.published_demos)}</strong>
                </li>
                <li>
                  <span>{t('plan.members')}</span>
                  <strong>{n(l.members)}</strong>
                </li>
                <li>
                  <span>{t('plan.stepsPerDemo')}</span>
                  <strong>{n(l.steps_per_demo)}</strong>
                </li>
                <li>
                  <span>{t('plan.leadForms')}</span>
                  {yes(l.lead_forms)}
                </li>
                <li>
                  <span>{t('plan.removeBranding')}</span>
                  {yes(l.remove_branding)}
                </li>
                <li>
                  <span>{t('plan.retention')}</span>
                  <strong>{t('plan.days', { count: l.analytics_retention_days, formatParams: {} })}</strong>
                </li>
              </ul>
            </Card>
          );
        })}
      </div>
      <PlanUsage />
    </div>
  );
}
