import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

/** L49 §6 : mention d'autorisation (13 px text-muted, icône info, sans encadré ni case à cocher). */
export function HtmlCaptureNotice({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={`hc-notice ${className}`.trim()}>
      <Info aria-hidden="true" />
      <span>{t('htmlCapture.notice')}</span>
    </p>
  );
}
