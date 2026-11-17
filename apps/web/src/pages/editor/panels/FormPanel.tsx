import { useConfirm } from '../../../components/ConfirmDialog';
import { ClipboardList, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Field } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asFields, type FormField } from '../types';
import { PlanFormsWarning } from '../../../components/PlanFormsWarning';

const OPTIONAL: Array<Omit<FormField, 'label'> & { labelKey: string }> = [
  { key: 'full_name', type: 'text', required: false, labelKey: 'editor.fieldName' },
  { key: 'company', type: 'text', required: false, labelKey: 'editor.fieldCompany' },
  { key: 'job_title', type: 'text', required: false, labelKey: 'editor.fieldJob' },
  { key: 'phone', type: 'tel', required: false, labelKey: 'editor.fieldPhone' },
];

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
      <div className="stack">
        <h3 className="panel-title">{t('editor.leadForm')}</h3>
        <p className="fd-muted">{t('editor.leadFormHint')}</p>
        {!leadFormsAllowed && <PlanFormsWarning />}
        {!readOnly && (
          <Button icon={<ClipboardList />} onClick={() => void editor.createForm()}>
            {t('editor.createForm')}
          </Button>
        )}
      </div>
    );

  const fields = asFields(form.fields);
  const set = (patch: Parameters<DemoEditor['updateForm']>[1]) => editor.updateForm(form.id, patch);
  const toggle = (opt: (typeof OPTIONAL)[number], on: boolean) => {
    const next = on
      ? [...fields, { key: opt.key, type: opt.type, required: false, label: t(opt.labelKey) }]
      : fields.filter((f) => f.key !== opt.key);
    set({ fields: next });
  };

  return (
    <div className="stack">
      {dialog}
      <div className="panel-title-row">
        <h3 className="panel-title">{t('editor.leadForm')}</h3>
        {!leadFormsAllowed && <span className="fd-badge badge-warning">{t('planForms.badge')}</span>}
      </div>
      {!leadFormsAllowed && <PlanFormsWarning />}
      <p className="fd-muted" style={{ fontSize: 12 }}>
        {t('editor.leadFormGateHint')}
      </p>
      <Field label={t('editor.formTitle')} htmlFor="f-title">
        <input
          id="f-title"
          className="fd-input"
          maxLength={120}
          disabled={readOnly}
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>
      <Field label={t('editor.formDescription')} htmlFor="f-desc">
        <textarea
          id="f-desc"
          className="fd-textarea"
          maxLength={500}
          disabled={readOnly}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      <Field label={t('editor.formSubmit')} htmlFor="f-submit">
        <input
          id="f-submit"
          className="fd-input"
          maxLength={40}
          disabled={readOnly}
          value={form.submit_label}
          onChange={(e) => set({ submit_label: e.target.value })}
        />
      </Field>
      <div>
        <div className="fd-label">{t('editor.formFields')}</div>
        <Checkbox checked disabled label={t('editor.fieldEmail')} />
        {OPTIONAL.map((o) => {
          const f = fields.find((x) => x.key === o.key);
          return (
            <div key={o.key} className="row">
              <Checkbox
                disabled={readOnly}
                checked={!!f}
                onChange={(e) => toggle(o, e.target.checked)}
                label={t(o.labelKey)}
              />
              {f && (
                <Checkbox
                  disabled={readOnly}
                  checked={f.required}
                  onChange={(e) =>
                    set({
                      fields: fields.map((x) => (x.key === o.key ? { ...x, required: e.target.checked } : x)),
                    })
                  }
                  label={t('editor.required')}
                />
              )}
            </div>
          );
        })}
      </div>
      <Field label={t('editor.consent')} htmlFor="f-consent">
        <textarea
          id="f-consent"
          className="fd-textarea"
          maxLength={500}
          disabled={readOnly}
          value={form.consent_text}
          placeholder={t('editor.consentPlaceholder')}
          onChange={(e) => set({ consent_text: e.target.value })}
        />
      </Field>
      <Checkbox
        disabled={readOnly}
        checked={form.skippable}
        onChange={(e) => set({ skippable: e.target.checked })}
        label={t('editor.skippable')}
      />
      {!readOnly && (
        <Button
          variant="ghost"
          className="btn-danger-ghost"
          icon={<Trash2 />}
          onClick={() =>
            void ask({
              title: t('editor.confirmDeleteForm'),
              confirmLabel: t('common.delete'),
              danger: true,
            }).then((yes) => yes && void editor.deleteForm(form.id))
          }
        >
          {t('editor.deleteForm')}
        </Button>
      )}
    </div>
  );
}
