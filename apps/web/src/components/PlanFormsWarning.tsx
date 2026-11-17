import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@flowdsiml/ui';

/** Formulaire de lead non inclus dans le plan : il ne sera pas publié (spéc. recette « Formulaire en plan Free »). */
export function PlanFormsWarning({ variant = 'editor' }: { variant?: 'editor' | 'share' }) {
  const { t } = useTranslation();
  return (
    <Alert kind="warning">
      {variant === 'editor' ? (
        <p>
          <strong>{t('planForms.notPublishedTitle')}</strong> {t('planForms.notPublishedBody')}{' '}
          <Link to="/settings/plans">{t('planForms.seePlans')}</Link>
        </p>
      ) : (
        <p>
          {t('planForms.sharePublished')} <Link to="/settings/plans">{t('planForms.seePlans')}</Link>
        </p>
      )}
    </Alert>
  );
}
