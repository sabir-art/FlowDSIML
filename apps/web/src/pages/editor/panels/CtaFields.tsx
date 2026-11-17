import { useTranslation } from 'react-i18next';
import type { Cta } from '@flowdsiml/manifest';

/** Bouton d'appel à l'action (libellé + URL), habillage maquette (.setting / .switch / .field). */
export function CtaFields({
  idPrefix,
  value,
  onChange,
  disabled,
  label,
}: {
  idPrefix: string;
  value: Cta | null;
  onChange: (v: Cta | null) => void;
  disabled?: boolean;
  /** Libellé de l'interrupteur (par défaut « Bouton d'action (CTA) »). */
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="cta-fields">
      <div className="setting">
        <label className="t-label" htmlFor={`${idPrefix}-cta-on`}>
          {label ?? t('editor.cta')}
        </label>
        <span className="switch">
          <input
            id={`${idPrefix}-cta-on`}
            type="checkbox"
            checked={!!value}
            disabled={disabled}
            onChange={(e) =>
              onChange(e.target.checked ? { label: t('editor.ctaDefault'), url: 'https://' } : null)
            }
          />
          <span />
        </span>
      </div>
      {value && (
        <>
          <div className="field">
            <label htmlFor={`${idPrefix}-cta-l`}>{t('editor.ctaLabel')}</label>
            <input
              id={`${idPrefix}-cta-l`}
              className="input input-sm"
              maxLength={80}
              disabled={disabled}
              value={value.label}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-cta-u`}>{t('editor.ctaUrl')}</label>
            <input
              id={`${idPrefix}-cta-u`}
              className="input input-sm t-mono"
              type="url"
              disabled={disabled}
              value={value.url}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
            />
            <span className="help">{t('editor.ctaNewTabHelp')}</span>
          </div>
        </>
      )}
    </div>
  );
}
