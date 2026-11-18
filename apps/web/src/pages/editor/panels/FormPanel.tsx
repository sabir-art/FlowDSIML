import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu } from '../../../components/Menu';
import { ArrowDown, ArrowUp, ChevronLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asFields, type FormField, type FormRow } from '../types';
import { PlanFormsWarning } from '../../../components/PlanFormsWarning';

const OPTIONAL: Array<Omit<FormField, 'label'> & { labelKey: string }> = [
  { key: 'full_name', type: 'text', required: false, labelKey: 'editor.fieldName' },
  { key: 'company', type: 'text', required: false, labelKey: 'editor.fieldCompany' },
  { key: 'job_title', type: 'text', required: false, labelKey: 'editor.fieldJob' },
  { key: 'phone', type: 'tel', required: false, labelKey: 'editor.fieldPhone' },
];

/**
 * Formulaire de lead (maquette editeur.html, contexte « form », EDT-08) : sélectionné dans le rail,
 * avant l'étape qu'il précède, et édité dans l'onglet Étape.
 */
export function FormPanel({
  editor,
  readOnly,
  leadFormsAllowed,
  form,
  onBack,
  onMove,
}: {
  editor: DemoEditor;
  readOnly: boolean;
  leadFormsAllowed: boolean;
  form: FormRow;
  onBack: () => void;
  /** Après un changement d'étape déclencheuse : nouvel index de cette étape. */
  onMove: (stepIndex: number) => void;
}) {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const [dragKey, setDragKey] = useState<string | null>(null);
  const gateIndex = editor.steps.findIndex((s) => s.gate_form_id === form.id);

  function moveTo(i: number) {
    const target = editor.steps[i];
    if (!target) return;
    for (const s of editor.steps)
      if (s.gate_form_id === form.id && s.id !== target.id) editor.updateStep(s.id, { gate_form_id: null });
    editor.updateStep(target.id, { gate_form_id: form.id });
    onMove(i);
  }

  const fields = asFields(form.fields);
  const set = (patch: Parameters<DemoEditor['updateForm']>[1]) => editor.updateForm(form.id, patch);
  const add = (opt: (typeof OPTIONAL)[number]) =>
    set({ fields: [...fields, { key: opt.key, type: opt.type, required: false, label: t(opt.labelKey) }] });
  const remove = (key: string) => set({ fields: fields.filter((f) => f.key !== key) });
  const setRequired = (key: string, required: boolean) =>
    set({ fields: fields.map((x) => (x.key === key ? { ...x, required } : x)) });
  const missing = OPTIONAL.filter((o) => !fields.some((f) => f.key === o.key));
  const optional = fields.filter((f) => OPTIONAL.some((o) => o.key === f.key));
  const reorder = (key: string, to: number) => {
    const from = optional.findIndex((f) => f.key === key);
    if (from < 0 || to < 0 || to >= optional.length || from === to) return;
    const next = [...optional];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    set({ fields: [...fields.filter((f) => !OPTIONAL.some((o) => o.key === f.key)), ...next] });
  };
  const labelOf = (key: string) => t(OPTIONAL.find((o) => o.key === key)!.labelKey);
  const consent = form.consent_text.trim().length > 0;

  return (
    <>
      {dialog}
      <div className="hs-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ChevronLeft aria-hidden="true" />
          {t('editor.backToStep')}
        </button>
        <span className="t-label">{t('editor.leadForm')}</span>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={t('editor.deleteForm')}
            title={t('editor.deleteForm')}
            onClick={() =>
              void ask({
                title: t('editor.confirmDeleteForm'),
                confirmLabel: t('common.delete'),
                danger: true,
              }).then((yes) => {
                if (yes) {
                  void editor.deleteForm(form.id);
                  onBack();
                }
              })
            }
          >
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="sec">
        <div className="sec-title">
          {t('editor.leadForm')}
          {!leadFormsAllowed && <span className="badge badge-warning">{t('planForms.badge')}</span>}
        </div>
        {!leadFormsAllowed && <PlanFormsWarning />}
        <div className="field">
          <label htmlFor="f-title">{t('editor.formTitle')}</label>
          <input
            id="f-title"
            className="input input-sm"
            maxLength={120}
            disabled={readOnly}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-desc">{t('editor.formDescription')}</label>
          <textarea
            id="f-desc"
            className="textarea"
            maxLength={500}
            disabled={readOnly}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
      </div>

      <div className="sec">
        <div className="sec-title">
          {t('editor.formFields')}
          {!readOnly && missing.length > 0 && (
            <Menu
              label={t('editor.form.addField')}
              trigger={{ icon: <Plus />, text: t('editor.settings.add') }}
              items={missing.map((o) => ({ label: t(o.labelKey), onSelect: () => add(o) }))}
            />
          )}
        </div>
        <div className="field-row">
          <span className="fr-grip is-fixed" aria-hidden="true">
            <GripVertical />
          </span>
          <span className="grow">{t('editor.form.email')}</span>
          <span className="badge">{t('editor.form.required')}</span>
          <span className="fr-spacer" aria-hidden="true" />
        </div>
        {optional.map((f, i) => {
          const label = labelOf(f.key);
          return (
            <div
              key={f.key}
              className={`field-row${dragKey === f.key ? ' is-dragging' : ''}`}
              draggable={!readOnly}
              onDragStart={() => setDragKey(f.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragKey) reorder(dragKey, i);
                setDragKey(null);
              }}
              onDragEnd={() => setDragKey(null)}
            >
              <span className="fr-grip" aria-hidden="true">
                <GripVertical />
              </span>
              <span className="grow">{label}</span>
              <span className="badge">
                {f.required ? t('editor.form.required') : t('editor.form.optional')}
              </span>
              {!readOnly ? (
                <Menu
                  label={t('editor.form.fieldOptions', { field: label })}
                  items={[
                    {
                      label: f.required ? t('editor.form.makeOptional') : t('editor.form.makeRequired'),
                      onSelect: () => setRequired(f.key, !f.required),
                    },
                    {
                      label: t('editor.moveUp'),
                      icon: <ArrowUp />,
                      disabled: i === 0,
                      onSelect: () => reorder(f.key, i - 1),
                    },
                    {
                      label: t('editor.moveDown'),
                      icon: <ArrowDown />,
                      disabled: i === optional.length - 1,
                      onSelect: () => reorder(f.key, i + 1),
                    },
                    'separator',
                    {
                      label: t('editor.form.removeField'),
                      icon: <Trash2 />,
                      danger: true,
                      onSelect: () => remove(f.key),
                    },
                  ]}
                />
              ) : (
                <span className="fr-spacer" aria-hidden="true" />
              )}
            </div>
          );
        })}
        <p className="help">
          {t('editor.form.feedsVars')}{' '}
          {['email', ...optional.map((f) => f.key)].map((k) => (
            <span key={k} className="chip-var">{`{{${k}}}`}</span>
          ))}{' '}
          <span className="badge badge-xs">{t('shell.soon')}</span>
        </p>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.form.position')}</div>
        <div className="field">
          <label htmlFor="f-gate">{t('editor.form.beforeStepLabel')}</label>
          <select
            id="f-gate"
            className="select input-sm"
            disabled={readOnly}
            value={gateIndex}
            onChange={(e) => moveTo(Number(e.target.value))}
          >
            {editor.steps.map((s, i) => (
              <option key={s.id} value={i}>
                {i + 1}. {s.title || t('editor.untitled')}
              </option>
            ))}
          </select>
          <span className="help">{t('editor.form.positionHelp')}</span>
        </div>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.form.behavior')}</div>
        <div className="setting">
          <label className="t-label" htmlFor="f-required">
            {t('editor.form.mandatory')}
          </label>
          <span className="switch">
            <input
              id="f-required"
              type="checkbox"
              checked={!form.skippable}
              disabled={readOnly}
              onChange={(e) => set({ skippable: !e.target.checked })}
            />
            <span />
          </span>
        </div>
        <div className="setting">
          <label className="t-label" htmlFor="f-consent-on">
            {t('editor.form.consentBox')}
          </label>
          <span className="switch">
            <input
              id="f-consent-on"
              type="checkbox"
              checked={consent}
              disabled={readOnly}
              onChange={(e) => set({ consent_text: e.target.checked ? t('editor.consentPlaceholder') : '' })}
            />
            <span />
          </span>
        </div>
        {consent && (
          <div className="field">
            <label htmlFor="f-consent">{t('editor.consent')}</label>
            <textarea
              id="f-consent"
              className="textarea"
              maxLength={500}
              disabled={readOnly}
              value={form.consent_text}
              onChange={(e) => set({ consent_text: e.target.value })}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="f-submit">{t('editor.formSubmit')}</label>
          <input
            id="f-submit"
            className="input input-sm"
            maxLength={40}
            disabled={readOnly}
            value={form.submit_label}
            onChange={(e) => set({ submit_label: e.target.value })}
          />
        </div>
      </div>

      <div className="sec">
        <div className="sec-title">{t('editor.form.sendTo')}</div>
        <div className="field">
          <label htmlFor="f-webhook">
            {t('editor.form.webhook')} <span className="badge badge-xs">{t('shell.soon')}</span>
          </label>
          <input
            id="f-webhook"
            className="input input-sm t-mono"
            placeholder="https://hooks.example.com/…"
            disabled
          />
        </div>
        <p className="help">{t('editor.form.leadsTab')}</p>
      </div>
    </>
  );
}
