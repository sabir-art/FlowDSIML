import { useTranslation } from 'react-i18next';
import type { Cta } from '@flowdsiml/manifest';
import { VarTextField } from '../vars/VarTextField';
import type { CatalogItem } from '../../../lib/varCatalog';

/** Bouton d'appel à l'action (libellé + URL), habillage maquette (.setting / .switch / .field). */
export function CtaFields({
  idPrefix,
  value,
  onChange,
  disabled,
  label,
  catalog,
}: {
  idPrefix: string;
  value: Cta | null;
  onChange: (v: Cta | null) => void;
  disabled?: boolean;
  /** L46-bis : variables du libellé et de l'adresse (encodée dans le lien). */
  catalog: CatalogItem[];
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
          <VarTextField
            singleLine
            id={`${idPrefix}-cta-l`}
            label={t('editor.ctaLabel')}
            maxLength={80}
            catalog={catalog}
            canManage={!disabled}
            disabled={disabled}
            value={value.label}
            onChange={(v) => onChange({ ...value, label: v })}
          />
          <VarTextField
            singleLine
            id={`${idPrefix}-cta-u`}
            label={t('editor.ctaUrl')}
            maxLength={2000}
            catalog={catalog}
            groups={['visitor', 'company']}
            chipHint={t('variables.urlHint')}
            canManage={!disabled}
            disabled={disabled}
            value={value.url}
            onChange={(v) => onChange({ ...value, url: v })}
            extra={<span className="help">{t('editor.ctaNewTabHelp')}</span>}
          />
        </>
      )}
    </div>
  );
}
