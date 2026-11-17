import { useTranslation } from 'react-i18next';
import { SettingsSoon } from './SettingsShell';

/** Paramètres › Marque : thème par défaut du workspace (aujourd'hui réglé démo par démo dans l'éditeur). */
export function BrandSettings() {
  const { t } = useTranslation();
  return <SettingsSoon title={t('settings.brand')} body={t('settings.brandSoon')} />;
}

/** Paramètres › Variables : variables partagées du workspace (aujourd'hui définies dans chaque démo). */
export function VariablesSettings() {
  const { t } = useTranslation();
  return <SettingsSoon title={t('settings.variables')} body={t('settings.variablesSoon')} />;
}
