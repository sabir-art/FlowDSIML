import { useTranslation } from 'react-i18next';
import { applyVariables, extractVariableKeys } from '@flowdsiml/core';

/** PL3 : aperçu de la phrase telle que la verra un visiteur sans valeur personnalisée (valeurs par défaut). */
export function VariablePreview({
  text,
  variables,
}: {
  text: string;
  variables: Array<{ key: string; default_value: string }>;
}) {
  const { t } = useTranslation();
  if (!extractVariableKeys(text).length) return null;
  const defaults = Object.fromEntries(variables.map((v) => [v.key, v.default_value]));
  const plain = text.replace(/\*\*|__|\[([^\]]*)\]\([^)]*\)/g, (_m, link?: string) => link ?? '');
  return (
    <p className="fd-help var-preview">
      <span className="var-preview__label">{t('editor.variablePreview')}</span>{' '}
      {applyVariables(plain, {}, defaults)}
    </p>
  );
}
