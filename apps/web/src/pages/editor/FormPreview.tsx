import { useTranslation } from 'react-i18next';
import { themeSchema } from '@flowdsiml/manifest';
import { themeVars } from '@flowdsiml/player-core';
import type { DemoEditor } from './useDemoEditor';
import { asFields, asSettings, type FormRow } from './types';

/**
 * EDT-08 : aperçu du formulaire de lead sur le canevas, en carte sur la capture assombrie,
 * comme dans le lecteur (titre, description, champs, consentement, bouton plein, « Passer »).
 */
export function FormPreview({ form, editor }: { form: FormRow; editor: DemoEditor }) {
  const { t } = useTranslation();
  const theme = themeSchema.parse(asSettings(editor.demo?.settings).theme ?? {});
  const fields = asFields(form.fields);
  return (
    <div className="canvas-form-preview fd-player-scope" style={themeVars(theme)} aria-hidden="true">
      <div className="cfp-card">
        <h2>{form.title || t('editor.leadForm')}</h2>
        {form.description && <p className="cfp-sub">{form.description}</p>}
        <label className="cfp-field">
          <span>
            {t('editor.form.emailPro')} <span aria-hidden="true">*</span>
          </span>
          <span className="cfp-input" />
        </label>
        {fields
          .filter((f) => f.type !== 'email')
          .map((f) => (
            <label key={f.key} className="cfp-field">
              <span>
                {f.label}
                {f.required && <span aria-hidden="true"> *</span>}
              </span>
              <span className="cfp-input" />
            </label>
          ))}
        {form.consent_text.trim() && (
          <span className="cfp-consent">
            <span className="cfp-box" />
            {form.consent_text}
          </span>
        )}
        <div className="cfp-acts">
          {form.skippable && <span className="p-btn p-btn-ghost">{t('editor.form.skip')}</span>}
          <span className="p-btn p-btn-primary">{form.submit_label || t('editor.form.continue')}</span>
        </div>
      </div>
    </div>
  );
}
