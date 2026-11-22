import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
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
    <SettingsShell legacy={false}>
      <section className="stg-sec" aria-labelledby="pv-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="pv-title">{t('analytics.ret.measureTitle')}</h2>
            <p>{t('privacy.sub')}</p>
          </div>
        </div>
        {/* §18.6 : rangées à filets, l'écart est porté par leur padding de 20 px */}
        <div data-gap-exempt="">
          <div className="stg-row stg-row--inline">
            <div className="stg-text" data-gap-exempt="">
              <div className="stg-lab">{t('privacy.returningTitle')}</div>
              <div className="stg-help">{on ? t('privacy.measureOn', { gap }) : t('analytics.ret.off')}</div>
            </div>
            <div className="stg-ctl">
              <Button onClick={() => setOpen(true)}>{t('privacy.edit')}</Button>
            </div>
          </div>
          <div className="stg-row stg-row--inline">
            <div className="stg-text" data-gap-exempt="">
              <div className="stg-lab">{t('privacy.leadsTitle')}</div>
              <div className="stg-help">{t('privacy.leadsRetention', { count: analyticsRetentionDays })}</div>
            </div>
            <div className="stg-ctl">
              {/* La durée suit les limites de l'espace : valeur en texte, non modifiable (décision UX du 22/11) */}
              <b className="pv-value">{t('privacy.days', { count: analyticsRetentionDays })}</b>
            </div>
          </div>
        </div>
      </section>
      {open && <MeasureDialog onClose={() => setOpen(false)} />}
    </SettingsShell>
  );
}
