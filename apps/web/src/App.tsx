import { RouteFocus } from './lib/routeFocus';
import { CenterSettings } from './pages/center/CenterSettings';
import { LearnersPage } from './pages/learners/LearnersPage';
import { lazy, Suspense, useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@flowdsiml/ui';
import './app.css';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';
import { isConfigured } from './lib/supabase';
import { Loading, RequireAuth, RequireWorkspace } from './components/guards';
import { Layout } from './components/Layout';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { LegalSoon } from './pages/auth/LegalSoon';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { Onboarding } from './pages/Onboarding';
import { AcceptInvite } from './pages/AcceptInvite';
import { Profile } from './pages/settings/Profile';
import { Members } from './pages/settings/Members';
import { WorkspaceSettings } from './pages/settings/WorkspaceSettings';
import { PlansPage } from './pages/settings/PlansPage';
import { BrandSettings, VariablesSettings } from './pages/settings/SoonSections';
import { DemosPage } from './pages/demos/DemosPage';
import { IntegrationsPage } from './pages/settings/integrations/IntegrationsPage';
import { WebhookDetail } from './pages/settings/integrations/WebhookDetail';

// Pages lourdes chargées à la demande (éditeur, analytics, partage).
const PresenterPage = lazy(() =>
  import('./pages/present/PresenterPage').then((m) => ({ default: m.PresenterPage })),
);
const PublicScreen = lazy(() =>
  import('./pages/present/PublicScreen').then((m) => ({ default: m.PublicScreen })),
);
const EditorPage = lazy(() => import('./pages/editor/EditorPage').then((m) => ({ default: m.EditorPage })));
const QuizEditorPage = lazy(() =>
  import('./pages/editor/quiz/QuizEditorPage').then((m) => ({ default: m.QuizEditorPage })),
);
const DemoAnalyticsPage = lazy(() =>
  import('./pages/analytics/DemoAnalyticsPage').then((m) => ({ default: m.DemoAnalyticsPage })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const SharePage = lazy(() => import('./pages/share/SharePage').then((m) => ({ default: m.SharePage })));
/** L16 : #/demos/:id/distribute ouvre la modale « Diffuser » au-dessus de l'éditeur. */
function DistributeRoute() {
  const { demoId = '' } = useParams();
  return <Navigate replace to={`/demos/${demoId}/edit?distribute=1`} />;
}

/**
 * Après un lien email (PKCE), Supabase renvoie vers /?code=…&next=/route.
 * supabase-js échange le code ; on nettoie l'URL et on navigue vers `next`.
 */
function EmailRedirectHandler() {
  const navigate = useNavigate();
  const { loading, recovery } = useAuth();
  useEffect(() => {
    if (loading) return;
    const url = new URL(window.location.href);
    const next = url.searchParams.get('next');
    if (url.searchParams.has('code') || next) {
      url.searchParams.delete('code');
      url.searchParams.delete('next');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      navigate(recovery ? '/reset-password' : next && next.startsWith('/') ? next : '/', { replace: true });
    } else if (recovery) {
      navigate('/reset-password', { replace: true });
    }
  }, [loading, recovery, navigate]);
  return null;
}

function ConfigWarning() {
  const { t } = useTranslation();
  if (isConfigured) return null;
  return (
    <div style={{ position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 50 }}>
      <Alert kind="error">{t('errors.notConfigured')}</Alert>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <ToastProvider>
            <EmailRedirectHandler />
            <RouteFocus />
            <ConfigWarning />
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/legal/:doc" element={<LegalSoon />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/invite/:token" element={<AcceptInvite />} />
                <Route
                  path="/onboarding"
                  element={
                    <RequireAuth>
                      <Onboarding />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/demos/:demoId/quiz"
                  element={
                    <RequireAuth>
                      <RequireWorkspace>
                        <QuizEditorPage />
                      </RequireWorkspace>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/demos/:demoId/present"
                  element={
                    <RequireAuth>
                      <RequireWorkspace>
                        <PresenterPage />
                      </RequireWorkspace>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/present/:demoId/screen"
                  element={
                    <RequireAuth>
                      <PublicScreen />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/demos/:demoId/edit"
                  element={
                    <RequireAuth>
                      <RequireWorkspace>
                        <EditorPage />
                      </RequireWorkspace>
                    </RequireAuth>
                  }
                />
                <Route
                  element={
                    <RequireAuth>
                      <RequireWorkspace>
                        <Layout />
                      </RequireWorkspace>
                    </RequireAuth>
                  }
                >
                  <Route index element={<DemosPage />} />
                  <Route path="/demos/:demoId/share" element={<SharePage />} />
                  <Route path="/demos/:demoId/distribute" element={<DistributeRoute />} />
                  <Route path="/demos/:demoId/analytics" element={<DemoAnalyticsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/learners" element={<LearnersPage />} />
                  <Route path="/center" element={<CenterSettings />} />
                  <Route path="/leads" element={<Navigate to="/analytics?tab=leads" replace />} />
                  <Route path="/settings/profile" element={<Profile />} />
                  <Route path="/settings/members" element={<Members />} />
                  <Route path="/settings/workspace" element={<WorkspaceSettings />} />
                  <Route path="/settings/plans" element={<PlansPage />} />
                  <Route path="/settings/brand" element={<BrandSettings />} />
                  <Route path="/settings/variables" element={<VariablesSettings />} />
                  <Route path="/settings/integrations" element={<IntegrationsPage />} />
                  <Route path="/settings/integrations/:id" element={<WebhookDetail />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </HashRouter>
  );
}
