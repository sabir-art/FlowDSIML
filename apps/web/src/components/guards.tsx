import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { LoadError } from './Skeleton';

export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="center fd-muted" role="status">
      {t('common.loading')}
    </div>
  );
}

/** Exige une session ; sinon renvoie vers la connexion en mémorisant la destination. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

/**
 * Exige au moins un workspace ; sinon onboarding. Si la lecture des espaces a échoué, carte d'erreur avec
 * « Réessayer » : une panne n'est jamais prise pour « aucun espace » (création d'un second espace évitée).
 */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, current, error, retry } = useWorkspace();
  if (loading) return <Loading />;
  if (!current && error)
    return (
      <main id="main" className="center on-content">
        <LoadError title={t('loading.workspaceError')} body={t('loading.errorBody')} onRetry={retry} />
      </main>
    );
  if (!current) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
