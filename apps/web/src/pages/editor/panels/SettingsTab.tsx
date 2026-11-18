import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asSettings, type DemoSettings } from '../types';
import { ClipboardList } from 'lucide-react';
import { PlanFormsWarning } from '../../../components/PlanFormsWarning';
import { DEMO_TAG_LIMIT, TAG_COLORS, TAG_LIMIT, useWorkspaceTags } from '../../../components/Tags';

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
  onOpenForm,
  showCursors = true,
  onShowCursors,
}: {
  editor: DemoEditor;
  readOnly: boolean;
  leadFormsAllowed: boolean;
  /** L22-08 : curseurs des autres personnes (préférence de ce navigateur). */
  showCursors?: boolean;
  onShowCursors?: (on: boolean) => void;
  /** EDT-08 : ouvre le formulaire dans le rail (onglet Étape). */
  onOpenForm: (stepIndex: number, formId: string) => void;
}) {
  const { t } = useTranslation();
  const { current: ws } = useWorkspace();
  const settings = asSettings(editor.demo!.settings);
  const set = (patch: Partial<DemoSettings>) =>
    editor.updateDemo({ settings: { ...settings, ...patch } as DemoSettings as never });
  const autoplay = { enabled: false, delayMs: 4000, ...settings.autoplay };
  const checklist = { enabled: false, title: '', position: 'right' as const, ...settings.checklist };
  const soon = <span className="badge badge-xs">{t('shell.soon')}</span>;
  const form = editor.forms[0];
  const gateIndex = form ? editor.steps.findIndex((s) => s.gate_form_id === form.id) : -1;
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
      {/* L12-07 : étiquettes de la démo (organiser et filtrer le tableau de bord) */}
      <TagsField demoId={editor.demo!.id} wsId={editor.demo!.workspace_id} readOnly={readOnly} />
      {onShowCursors && (
        <div className="sec">
          <div className="sec-title">{t('presence.collab')}</div>
          <SettingSwitch
            id="show-cursors"
            label={t('presence.showCursors')}
            checked={showCursors}
            onChange={onShowCursors}
          />
        </div>
      )}
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

      <div className="sec">
        <div className="sec-title">{t('editor.leadForm')}</div>
        {!leadFormsAllowed && <PlanFormsWarning />}
        <p className="help sec-help">
          {form && gateIndex >= 0
            ? t('editor.form.inRail', { n: gateIndex + 1 })
            : form
              ? t('editor.form.notPlaced')
              : t('editor.leadFormHint')}
        </p>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              void (async () => {
                const f = form ?? (await editor.createForm(ws?.name ?? ''));
                if (!f) return;
                // Nouveau formulaire : avant la 2e étape (ou la seule étape)
                let i = editor.steps.findIndex((s) => s.gate_form_id === f.id);
                if (i < 0) {
                  i = Math.min(1, editor.steps.length - 1);
                  const target = editor.steps[i];
                  if (!target) return;
                  editor.updateStep(target.id, { gate_form_id: f.id });
                }
                onOpenForm(i, f.id);
              })()
            }
          >
            <ClipboardList aria-hidden="true" />
            {form ? t('editor.form.open') : t('editor.createForm')}
          </button>
        )}
      </div>

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

/** Champ à pastilles : retrait par pastille, ajout (ou création) par saisie puis Entrée. */
function TagsField({ demoId, wsId, readOnly }: { demoId: string; wsId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const store = useWorkspaceTags(wsId);
  const [q, setQ] = useState('');
  const mine = store.tagsOf(demoId);
  const add = async () => {
    const name = q.trim();
    if (!name) return;
    let tag = store.tags.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
    if (!tag) {
      // Nouvelle étiquette : couleur suivante de la palette
      const color = TAG_COLORS[store.tags.length % TAG_COLORS.length]!;
      tag = (await store.create(name, color)) ?? undefined;
    }
    if (tag && !mine.some((x) => x.id === tag!.id)) await store.toggle(demoId, tag.id, true);
    setQ('');
  };
  return (
    <div className="sec">
      <div className="sec-title">{t('tags.title')}</div>
      <div className="tg-field" role="group" aria-label={t('tags.title')}>
        {mine.map((x) => (
          <span key={x.id} className={`tg tg--${x.color} tg--removable`}>
            {x.name}
            {!readOnly && (
              <button
                type="button"
                aria-label={t('tags.remove', { name: x.name })}
                onClick={() => void store.toggle(demoId, x.id, false)}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {!readOnly && mine.length < DEMO_TAG_LIMIT && (
          <input
            list="tg-suggest"
            value={q}
            maxLength={32}
            aria-label={t('tags.add')}
            placeholder={t('tags.addPlaceholder')}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void add();
              }
            }}
          />
        )}
        <datalist id="tg-suggest">
          {store.tags
            .filter((x) => !mine.some((m) => m.id === x.id))
            .map((x) => (
              <option key={x.id} value={x.name} />
            ))}
        </datalist>
      </div>
      {store.error && (
        <p className="error-msg" role="alert">
          {store.error}
        </p>
      )}
      <p className="help">{t('tags.fieldHelp', { ws: TAG_LIMIT, demo: DEMO_TAG_LIMIT })}</p>
    </div>
  );
}
