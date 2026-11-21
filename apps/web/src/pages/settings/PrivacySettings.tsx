import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsShell } from './SettingsShell';
import { MeasureDialog } from '../analytics/returning';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { usePlan } from '../../lib/plan';

/** L26-08 : Paramètres › Confidentialité (mesure des visites) ; 171 : durée de conservation des leads. */
export function PrivacySettings() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const { analyticsRetentionDays } = usePlan();
  const [open, setOpen] = useState(false);
  const on = current?.visit_measure !== false;
  const gap = current?.visit_gap_minutes === 1440 ? t('analytics.ret.gap24h') : t('analytics.ret.gap30');
  return (
    <SettingsShell>
      <section className="soon-page" aria-labelledby="st-title">
        <p className="muted">{t('privacy.sub')}</p>
        <div className="card card-pad">
          <div className="setting">
            <div>
              <b>{t('analytics.ret.measureTitle')}</b>
              <p className="t-caption muted">
                {on ? t('privacy.measureOn', { gap }) : t('analytics.ret.off')}
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
              {t('privacy.edit')}
            </button>
          </div>
          <div className="setting">
            <div>
              <b>{t('privacy.leadsTitle')}</b>
              <p className="t-caption muted">
                {t('privacy.leadsRetention', { count: analyticsRetentionDays })}
              </p>
            </div>
          </div>
        </div>
      </section>
      {open && <MeasureDialog onClose={() => setOpen(false)} />}
    </SettingsShell>
  );
}
