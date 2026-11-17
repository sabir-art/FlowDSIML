import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';

/** Pages légales (conditions d'utilisation, confidentialité) : pas encore rédigées, annoncées « Bientôt ». */
export function LegalSoon() {
  const { t } = useTranslation();
  const { doc } = useParams();
  if (doc !== 'terms' && doc !== 'privacy') return <Navigate to="/login" replace />;
  return (
    <AuthLayout title={t(`legal.${doc}`)} footer={false}>
      <p className="muted t-lg legal-soon">
        <span className="badge">{t('shell.soon')}</span> {t('legal.soon')}
      </p>
      <p className="auth-switch">
        <Link to="/">{t('legal.back')}</Link>
      </p>
    </AuthLayout>
  );
}
