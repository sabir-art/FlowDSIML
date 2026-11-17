import { useTranslation } from 'react-i18next';
import type { Cta } from '@flowdsiml/manifest';
import { Field, Switch } from '@flowdsiml/ui';

export function CtaFields({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: Cta | null;
  onChange: (v: Cta | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="panel-group">
      <Switch
        label={t('editor.cta')}
        checked={!!value}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.checked ? { label: t('editor.ctaDefault'), url: 'https://' } : null)
        }
      />
      {value && (
        <>
          <Field label={t('editor.ctaLabel')} htmlFor={`${idPrefix}-cta-l`}>
            <input
              id={`${idPrefix}-cta-l`}
              className="fd-input"
              maxLength={80}
              disabled={disabled}
              value={value.label}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
            />
          </Field>
          <Field label={t('editor.ctaUrl')} htmlFor={`${idPrefix}-cta-u`}>
            <input
              id={`${idPrefix}-cta-u`}
              className="fd-input"
              type="url"
              disabled={disabled}
              value={value.url}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
            />
          </Field>
        </>
      )}
    </div>
  );
}
