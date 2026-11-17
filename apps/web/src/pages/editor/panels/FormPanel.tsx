import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu } from '../../../components/Menu';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from '../useDemoEditor';
import { asFields, type FormField } from '../types';
import { PlanFormsWarning } from '../../../components/PlanFormsWarning';

const OPTIONAL: Array<Omit<FormField, 'label'> & { labelKey: string }> = [
  { key: 'full_name', type: 'text', required: false, labelKey: 'editor.fieldName' },
  { key: 'company', type: 'text', required: false, labelKey: 'editor.fieldCompany' },
  { key: 'job_title', type: 'text', required: false, labelKey: 'editor.fieldJob' },
  { key: 'phone', type: 'tel', required: false, labelKey: 'editor.fieldPhone' },
];

/** Formulaire de lead (maquette editeur.html, contexte « form », EDT-08), dans l'onglet Réglages. */
export function FormPanel({
  editor,
  readOnly,
  leadFormsAllowed,
}: {
  editor: DemoEditor;
  readOnly: boolean;
  leadFormsAllowed: boolean;
}) {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const form = editor.forms[0];

  if (!form)
    return (
      <div className="sec">
        <div className="sec-title">{t('editor.leadForm')}</div>
        <p className="help sec-help">{t('editor.leadFormHint')}</p>
        {!leadFormsAllowed && <PlanFormsWarning />}
        {!readOnly && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void editor.createForm()}>
            <ClipboardList aria-hidden="true" />
            {t('editor.createForm')}
          </button>
        )}
      </div>
    );

  const fields = asFields(form.fields);
  const set = (patch: Parameters<DemoEditor['updateForm']>[1]) => editor.updateForm(form.id, patch);
  const add = (opt: (typeof OPTIONAL)[number]) =>
    set({ fields: [...fields, { key: opt.key, type: opt.type, required: false, label: t(opt.labelKey) }] });
  const remove = (key: string) => set({ fields: fields.filter((f) => f.key !== key) });
  const setRequired = (key: string, required: boolean) =>
    set({ fields: fields.map((x) => (x.key === key ? { ...x, required } : x)) });
  const missing = OPTIONAL.filter((o) => !fields.some((f) => f.key === o.key));
  const consent = form.consent_text.trim().length > 0;

  return (
    <>
      {dialog}
      <div className="sec">
        <div className="sec-title">
          {t('editor.leadForm')}
          {!leadFormsAllowed && <span className="badge badge-warning">{t('planForms.badge')}</span>}
        </div>
        {!leadFormsAllowed && <PlanFormsWarning />}
        <p className="help sec-help">{t('editor.leadFormGateHint')}</p>
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
          <span className="grow">{t('editor.form.email')}</span>
          <span className="badge">{t('editor.form.required')}</span>
          <span className="fr-spacer" aria-hidden="true" />
        </div>
        {OPTIONAL.filter((o) => fields.some((f) => f.key === o.key)).map((o) => {
          const f = fields.find((x) => x.key === o.key)!;
          const label = t(o.labelKey);
          return (
            <div key={o.key} className="field-row">
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
                      onSelect: () => setRequired(o.key, !f.required),
                    },
                    {
                      label: t('editor.form.removeField'),
                      icon: <Trash2 />,
                      danger: true,
                      onSelect: () => remove(o.key),
                    },
                  ]}
                />
              ) : (
                <span className="fr-spacer" aria-hidden="true" />
              )}
            </div>
          );
        })}
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
        {!readOnly && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-danger-ghost f-delete"
            onClick={() =>
              void ask({
                title: t('editor.confirmDeleteForm'),
                confirmLabel: t('common.delete'),
                danger: true,
              }).then((yes) => yes && void editor.deleteForm(form.id))
            }
          >
            <Trash2 aria-hidden="true" />
            {t('editor.deleteForm')}
          </button>
        )}
      </div>
    </>
  );
}
