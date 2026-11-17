import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asSettings, type DemoSettings } from '../types';
import { FormPanel } from './FormPanel';

/** Interrupteur de la maquette (.setting + .switch). */
function SettingSwitch({
  id,
  label,
  checked,
  disabled,
  onChange,
  badge,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  badge?: ReactNode;
}) {
  return (
    <div className="setting">
      <label className="t-label" htmlFor={id}>
        {label} {badge}
      </label>
      <span className="switch">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          readOnly={!onChange}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span />
      </span>
    </div>
  );
}

/** Onglet Réglages de l'éditeur (maquette editeur.html, EDT-11) + formulaire de lead (EDT-08). */
export function SettingsTab({
  editor,
  readOnly,
  leadFormsAllowed,
}: {
  editor: DemoEditor;
  readOnly: boolean;
  leadFormsAllowed: boolean;
}) {
  const { t } = useTranslation();
  const settings = asSettings(editor.demo!.settings);
  const set = (patch: Partial<DemoSettings>) =>
    editor.updateDemo({ settings: { ...settings, ...patch } as DemoSettings as never });
  const autoplay = { enabled: false, delayMs: 4000, ...settings.autoplay };
  const checklist = { enabled: false, title: '', position: 'right' as const, ...settings.checklist };
  const soon = <span className="badge badge-xs">{t('shell.soon')}</span>;
  const [key, setKey] = useState('');
  const valid = /^[a-z][a-z0-9_]{0,39}$/.test(key);

  async function addVariable(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await editor.addVariable(key);
    setKey('');
  }

  return (
    <div className="st-panel">
      <div className="sec">
        <div className="sec-title">{t('editor.settings.reading')}</div>
        <SettingSwitch
          id="ap-on"
          label={t('editor.autoplay')}
          checked={autoplay.enabled}
          disabled={readOnly}
          onChange={(v) => set({ autoplay: { ...autoplay, enabled: v } })}
        />
        {autoplay.enabled && (
          <div className="field">
            <label htmlFor="ap-delay">{t('editor.autoplayDelay')}</label>
            <input
              id="ap-delay"
              className="input input-sm"
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
            <span className="help">{t('editor.autoplayHelp')}</span>
          </div>
        )}
        <SettingSwitch id="pg-on" label={t('editor.settings.progress')} checked disabled badge={soon} />
        <p className="help">{t('editor.settings.progressHelp')}</p>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.settings.language')}</div>
        <select
          id="th-locale"
          className="select input-sm"
          aria-label={t('editor.settings.language')}
          disabled={readOnly}
          value={settings.locale ?? 'fr'}
          onChange={(e) => set({ locale: e.target.value === 'en' ? 'en' : 'fr' })}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.settings.variables')}</div>
        {editor.variables.length === 0 && <p className="help">{t('editor.variablesHint')}</p>}
        {editor.variables.map((v) => (
          <div key={v.id} className="field-row var-row">
            <span className="chip-var">{`{{${v.key}}}`}</span>
            <label className="sr-only" htmlFor={`v-d-${v.id}`}>
              {t('editor.variableDefault')}
            </label>
            <span className="grow muted t-caption var-default">
              {t('editor.settings.defaultIs')}
              <input
                id={`v-d-${v.id}`}
                className="input input-sm"
                maxLength={200}
                disabled={readOnly}
                value={v.default_value}
                onChange={(e) => editor.updateVariable(v.id, { default_value: e.target.value })}
              />
            </span>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                aria-label={t('editor.settings.deleteVariable', { key: v.key })}
                onClick={() => void editor.deleteVariable(v.id)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <form onSubmit={addVariable} className="row-3 var-add">
            <input
              className="input input-sm t-mono grow"
              placeholder="company"
              aria-label={t('editor.variableKey')}
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!valid}>
              <Plus aria-hidden="true" />
              {t('editor.addVariable')}
            </button>
          </form>
        )}
      </div>

      <FormPanel editor={editor} readOnly={readOnly} leadFormsAllowed={leadFormsAllowed} />

      <div className="sec">
        <div className="sec-title">
          {t('editor.chapters')}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void editor.addChapter(t('editor.chapterN', { n: editor.chapters.length + 1 }))}
            >
              <Plus aria-hidden="true" />
              {t('editor.settings.add')}
            </button>
          )}
        </div>
        <p className="help sec-help">{t('editor.chaptersHint')}</p>
        {editor.chapters.map((c) => (
          <div key={c.id} className="field-row">
            <input
              className="input input-sm grow"
              aria-label={t('editor.chapter')}
              maxLength={120}
              disabled={readOnly}
              value={c.title}
              onChange={(e) => editor.updateChapter(c.id, { title: e.target.value })}
            />
            {!readOnly && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                aria-label={t('common.delete')}
                onClick={() => void editor.deleteChapter(c.id)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.advanced.checklist.title')}</div>
        <SettingSwitch
          id="cl-on"
          label={t('editor.advanced.checklist.show')}
          checked={checklist.enabled}
          disabled={readOnly}
          onChange={(v) => set({ checklist: { ...checklist, enabled: v } })}
        />
        {checklist.enabled && (
          <>
            <div className="field">
              <label htmlFor="cl-heading">{t('editor.advanced.checklist.heading')}</label>
              <input
                id="cl-heading"
                className="input input-sm"
                maxLength={80}
                disabled={readOnly}
                value={checklist.title}
                placeholder={t('editor.advanced.checklist.headingPlaceholder')}
                onChange={(e) => set({ checklist: { ...checklist, title: e.target.value } })}
              />
            </div>
            <div className="field">
              <span className="label" id="cl-pos">
                {t('editor.advanced.checklist.position')}
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="cl-pos">
                {(['left', 'right', 'collapsed'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    disabled={readOnly}
                    aria-checked={checklist.position === p}
                    onClick={() => set({ checklist: { ...checklist, position: p } })}
                  >
                    {t(`editor.advanced.checklist.${p}`)}
                  </button>
                ))}
              </div>
            </div>
            <p className="help">
              {t('editor.advanced.checklist.itemsHelp')}
              {editor.chapters.length === 0 && ` ${t('editor.checklistNoChapter')}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
