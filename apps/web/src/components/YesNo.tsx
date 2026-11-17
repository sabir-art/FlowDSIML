import { Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Oui / non lisible (icône + texte masqué pour les lecteurs d'écran). */
export function YesNo({ value }: { value: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`yesno ${value ? 'yes' : 'no'}`}>
      {value ? <Check size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
      <span className="sr-only">{value ? t('common.yes') : t('common.no')}</span>
    </span>
  );
}
