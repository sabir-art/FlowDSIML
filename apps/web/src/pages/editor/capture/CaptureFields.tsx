import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { allTabs, capturedTab, showTabs, stepTab } from './tabs';

/** L25-06 : section « Onglet de la capture » du panneau Étape (étapes capturées avec le suivi). */
export function CaptureTabFields({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const tab = stepTab(step);
  const tabs = allTabs(editor.steps);
  if (!tab || !tabs.length) return null;
  const raw = (step.options ?? {}) as Record<string, unknown>;
  const write = (patch: Record<string, unknown>) =>
    editor.updateStep(step.id, { options: { ...raw, ...patch } as unknown as StepRow['options'] });
  return (
    <div className="sec cap-tab">
      <div className="sec-title">{t('editor.capture.tabSection')}</div>
      <div className="field">
        <label className="t-label" htmlFor="cap-tab">
          {t('editor.capture.tab')}
        </label>
        <select
          id="cap-tab"
          className="select input-sm"
          value={tab.n}
          disabled={readOnly}
          aria-describedby={tab.n > 1 ? 'cap-tab-h' : undefined}
          onChange={(e) => {
            const next = tabs.find((x) => x.n === Number(e.target.value));
            // L'onglet d'origine est gardé : on peut toujours y revenir
            if (next) write({ tab: next, tabCaptured: capturedTab(step) ?? tab });
          }}
        >
          {/* L'onglet de l'étape en premier, puis les autres (maquette) */}
          {[...tabs]
            .sort((a, b) => (a.n === tab.n ? -1 : b.n === tab.n ? 1 : a.n - b.n))
            .map((x) => (
              <option key={x.n} value={x.n}>
                {t('editor.capture.tabOption', { n: x.n, title: x.n === tab.n ? tab.title : x.title })}
              </option>
            ))}
        </select>
        {tab.n > 1 && (
          <span className="help" id="cap-tab-h">
            {tab.n === 2 ? t('editor.capture.tabHelp2') : t('editor.capture.tabHelpN', { n: tab.n })}
          </span>
        )}
      </div>
      <div className="setting">
        <span className="t-label" id="cap-showtabs-l">
          {t('editor.capture.showTabs')}
        </span>
        <span className="switch">
          <input
            type="checkbox"
            aria-labelledby="cap-showtabs-l"
            checked={showTabs(step)}
            disabled={readOnly}
            onChange={(e) => write({ showTabs: e.target.checked })}
          />
          <span />
        </span>
      </div>
    </div>
  );
}
