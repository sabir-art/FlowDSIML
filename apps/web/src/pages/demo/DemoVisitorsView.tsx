import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PeriodPicker } from '../analytics/DemoAnalyticsPage';
import { Sessions } from '../analytics/AnalyticsPage';
import { useDemoView } from './DemoViewShell';

const SOURCES = ['', 'link', 'embed', 'page', 'direct'] as const;
type Source = (typeof SOURCES)[number];

/**
 * §9 : visiteurs de la démo, une ligne par session (visiteur anonyme ou identifié, date, source,
 * progression, durée), filtrée par période et par moyen de partage.
 */
export function DemoVisitorsView() {
  const { t } = useTranslation();
  const { demo } = useDemoView();
  const [days, setDays] = useState<number>(30);
  const [source, setSource] = useState<Source>('');
  return (
    <>
      <div className="dv-tools">
        <PeriodPicker days={days} setDays={setDays} />
        <div className="fd-segmented" role="group" aria-label={t('demoViews.sourceFilter')}>
          {SOURCES.map((s) => (
            <button key={s || 'all'} type="button" aria-pressed={source === s} onClick={() => setSource(s)}>
              {s ? t(`kpi.sourceName.${s}`) : t('demoViews.allSources')}
            </button>
          ))}
        </div>
      </div>
      <Sessions
        wsId={demo.workspace_id}
        days={days}
        demo={demo.id}
        source={source}
        title={() => demo.title}
        segment={null}
      />
    </>
  );
}
