import { ListChecks, MousePointerClick, PlayCircle, Spotlight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, Switch } from '@flowdsiml/ui';
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
    <section className="stack" aria-labelledby="mode-title">
      <div className="fd-card__head" style={{ margin: 0 }}>
        <span className="fd-icon-chip" aria-hidden="true">
          <MousePointerClick />
        </span>
        <h2 className="fd-card__title" id="mode-title">
          {t('editor.advanced.mode.title')}
        </h2>
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
      <p className="fd-help">{t('editor.advanced.mode.scopeDemo')}</p>
    </section>
  );
}

/** F1 (spec a2 §3) : checklist et lecture automatique. Onglet Réglages. */
export function GuidedTourPanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const [settings, set] = useSettings(editor);
  const checklist = { enabled: false, title: '', position: 'right' as const, ...settings.checklist };
  const autoplay = { enabled: false, delayMs: 4000, ...settings.autoplay };
  const chapters = editor.chapters.length;
  return (
    <div className="stack">
      <section className="stack" aria-labelledby="cl-title">
        <div className="fd-card__head" style={{ margin: 0 }}>
          <span className="fd-icon-chip" aria-hidden="true">
            <ListChecks />
          </span>
          <h2 className="fd-card__title" id="cl-title">
            {t('editor.advanced.checklist.title')}
          </h2>
        </div>
        <Switch
          label={t('editor.advanced.checklist.show')}
          checked={checklist.enabled}
          disabled={readOnly}
          onChange={(e) => set({ checklist: { ...checklist, enabled: e.target.checked } })}
        />
        {checklist.enabled && (
          <>
            <Field label={t('editor.advanced.checklist.heading')} htmlFor="cl-heading">
              <input
                id="cl-heading"
                className="fd-input"
                maxLength={80}
                disabled={readOnly}
                value={checklist.title}
                placeholder={t('editor.advanced.checklist.headingPlaceholder')}
                onChange={(e) => set({ checklist: { ...checklist, title: e.target.value } })}
              />
            </Field>
            <Field label={t('editor.advanced.checklist.position')}>
              <div className="fd-segmented" role="group" aria-label={t('editor.advanced.checklist.position')}>
                {(['left', 'right', 'collapsed'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={checklist.position === p}
                    onClick={() => set({ checklist: { ...checklist, position: p } })}
                  >
                    {t(`editor.advanced.checklist.${p}`)}
                  </button>
                ))}
              </div>
            </Field>
            <p className="fd-help">
              {t('editor.advanced.checklist.itemsHelp')}
              {chapters === 0 && ` ${t('editor.checklistNoChapter')}`}
            </p>
          </>
        )}
      </section>
      <section className="stack" aria-labelledby="ap-title">
        <div className="fd-card__head" style={{ margin: 0 }}>
          <span className="fd-icon-chip" aria-hidden="true">
            <PlayCircle />
          </span>
          <h2 className="fd-card__title" id="ap-title">
            {t('editor.autoplay')}
          </h2>
        </div>
        <Switch
          label={t('editor.autoplay')}
          hint={t('editor.autoplayHelp')}
          checked={autoplay.enabled}
          disabled={readOnly}
          onChange={(e) => set({ autoplay: { ...autoplay, enabled: e.target.checked } })}
        />
        {autoplay.enabled && (
          <Field label={t('editor.autoplayDelay')} htmlFor="ap-delay">
            <input
              id="ap-delay"
              className="fd-input"
              type="number"
              min={1.5}
              max={30}
              step={0.5}
              disabled={readOnly}
              value={autoplay.delayMs / 1000}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v))
                  set({
                    autoplay: { ...autoplay, delayMs: Math.round(Math.min(30, Math.max(1.5, v)) * 1000) },
                  });
              }}
            />
          </Field>
        )}
      </section>
    </div>
  );
}
