/** L26-02 : bouton « Aide » des barres du haut (ouvre ou ferme le tiroir d'aide). */
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { useHelp } from './HelpProvider';

export function HelpButton({ className = 'fd-btn fd-btn--ghost fd-btn--icon' }: { className?: string }) {
  const { t } = useTranslation();
  const help = useHelp();
  if (!help) return null;
  return (
    <button
      type="button"
      className={`${className} help-btn`}
      aria-label={t('help.open')}
      aria-expanded={help.open}
      aria-controls={help.open ? 'help-drawer' : undefined}
      aria-keyshortcuts="F1"
      onClick={(e) => help.toggle(e.currentTarget)}
    >
      <CircleHelp aria-hidden="true" size={20} />
    </button>
  );
}
