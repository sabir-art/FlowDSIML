import { MousePointerClick, Spotlight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asSettings, type DemoSettings } from '../types';

function useSettings(editor: DemoEditor) {
  const settings = asSettings(editor.demo!.settings);
  const set = (patch: Partial<DemoSettings>) =>
    editor.updateDemo({ settings: { ...settings, ...patch } as DemoSettings as never });
  return [settings, set] as const;
}

/** F1 (spec a2 §1) : mode de lecture de toute la démo, en cartes-choix. Onglet Design. */
export function ReadingModePanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const [settings, set] = useSettings(editor);
  const mode = settings.mode ?? 'walkthrough';
  const cards = [
    { key: 'walkthrough', icon: <MousePointerClick />, label: 'walkthrough', desc: 'walkthroughDesc' },
    { key: 'spotlight', icon: <Spotlight />, label: 'spotlight', desc: 'spotlightDesc' },
  ] as const;
  return (
    <section aria-labelledby="mode-title">
      <div className="sec-title" id="mode-title">
        {t('editor.advanced.mode.title')}
      </div>
      <div className="mode-cards" role="group" aria-labelledby="mode-title">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className="mode-card"
            aria-pressed={mode === c.key}
            disabled={readOnly}
            onClick={() => set({ mode: c.key })}
          >
            <span className={`mode-card__art mode-card__art--${c.key}`} aria-hidden="true">
              <span className="mode-card__zone" />
              {c.key === 'walkthrough' && <span className="mode-card__dot" />}
            </span>
            <span className="mode-card__label">
              {c.icon}
              {t(`editor.advanced.mode.${c.label}`)}
            </span>
            <span className="mode-card__desc">{t(`editor.advanced.mode.${c.desc}`)}</span>
          </button>
        ))}
      </div>
      <p className="help">{t('editor.advanced.mode.scopeDemo')}</p>
    </section>
  );
}
