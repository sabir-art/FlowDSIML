import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';

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

/** Exige au moins un workspace ; sinon onboarding. */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { loading, current } = useWorkspace();
  if (loading) return <Loading />;
  if (!current) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
