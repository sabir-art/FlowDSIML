import { RouteFocus } from './lib/routeFocus';
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { useNarrow } from './lib/useNarrow';
import { loadRestLocale, withRestLocale } from './i18n';
import { ToastProvider } from './components/Toast';
import { HelpProvider } from './help/HelpProvider';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
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
import { LegalPage } from './pages/auth/LegalPage';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';

// L33 : une page chargée à la demande attend aussi la suite des textes (src/i18n.ts, vite.locales.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- même signature que React.lazy
function lazyRest<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => withRestLocale(load));
}

// Pages lourdes chargées à la demande (éditeur, analytics, partage).
// L27 : chaque page est un morceau chargé à la demande (bundle initial réduit)
const MediaPage = lazyRest(() => import('./pages/media/MediaPage').then((m) => ({ default: m.MediaPage })));
const ExtensionPage = lazyRest(() =>
  import('./pages/extension/ExtensionPage').then((m) => ({ default: m.ExtensionPage })),
);
const CenterSettings = lazyRest(() =>
  import('./pages/center/CenterSettings').then((m) => ({ default: m.CenterSettings })),
);
const LearnersPage = lazyRest(() =>
  import('./pages/learners/LearnersPage').then((m) => ({ default: m.LearnersPage })),
);
const ConsolePage = lazyRest(() =>
  import('./pages/console/ConsolePage').then((m) => ({ default: m.ConsolePage })),
);
const NewsPage = lazyRest(() => import('./pages/console/NewsPage').then((m) => ({ default: m.NewsPage })));
const Onboarding = lazyRest(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const AcceptInvite = lazyRest(() =>
  import('./pages/AcceptInvite').then((m) => ({ default: m.AcceptInvite })),
);
const Unsubscribe = lazyRest(() => import('./pages/Unsubscribe').then((m) => ({ default: m.Unsubscribe })));
const Profile = lazyRest(() => import('./pages/settings/Profile').then((m) => ({ default: m.Profile })));
const AccessKeys = lazyRest(() =>
  import('./pages/settings/keys/AccessKeys').then((m) => ({ default: m.AccessKeys })),
);
const NotificationSettings = lazyRest(() =>
  import('./pages/settings/NotificationSettings').then((m) => ({ default: m.NotificationSettings })),
);
const SettingsHome = lazyRest(() =>
  import('./pages/settings/SettingsShell').then((m) => ({ default: m.SettingsHome })),
);
const Members = lazyRest(() => import('./pages/settings/Members').then((m) => ({ default: m.Members })));
const WorkspaceSettings = lazyRest(() =>
  import('./pages/settings/WorkspaceSettings').then((m) => ({ default: m.WorkspaceSettings })),
);
const UsagePage = lazyRest(() =>
  import('./pages/settings/UsagePage').then((m) => ({ default: m.UsagePage })),
);
const TagsSettings = lazyRest(() =>
  import('./pages/settings/tags/TagsSettings').then((m) => ({ default: m.TagsSettings })),
);
const GlossarySettings = lazyRest(() =>
  import('./pages/settings/GlossarySettings').then((m) => ({ default: m.GlossarySettings })),
);
const AiSettings = lazyRest(() =>
  import('./pages/settings/AiSettings').then((m) => ({ default: m.AiSettings })),
);
const PrivacySettings = lazyRest(() =>
  import('./pages/settings/PrivacySettings').then((m) => ({ default: m.PrivacySettings })),
);
// L32 : la page d'arrivée est demandée dès le démarrage, en parallèle de la session et de l'espace
// (sinon son code n'est chargé qu'une fois l'espace connu, un aller-retour de plus)
const routeHash = typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '';
const demosChunk = () => import('./pages/demos/DemosPage');
const editorChunk = () => withRestLocale(() => import('./pages/editor/EditorPage'));
// L33 : sur écran étroit, une page légère (avis + commentaires) remplace l'éditeur complet
const narrowChunk = () => import('./pages/editor/EditorNarrow');
const startsNarrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
if (routeHash === '' || routeHash === '/') void demosChunk();
else if (/^\/demos\/[^/]+\/edit$/.test(routeHash)) void (startsNarrow ? narrowChunk() : editorChunk());
// Suite des textes demandée une fois la page affichée (boîtes de dialogue et pages suivantes sans attente) ;
// l'éditeur et les autres pages l'attendent de toute façon (lazyRest)
if (typeof window !== 'undefined')
  window.addEventListener('load', () => setTimeout(() => void loadRestLocale(), 1500), { once: true });
const DemosPage = lazy(() => demosChunk().then((m) => ({ default: m.DemosPage })));
const IntegrationsPage = lazyRest(() =>
  import('./pages/settings/integrations/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })),
);
const WebhooksPage = lazyRest(() =>
  import('./pages/settings/integrations/WebhooksPage').then((m) => ({ default: m.WebhooksPage })),
);
const WebhookDetail = lazyRest(() =>
  import('./pages/settings/integrations/WebhookDetail').then((m) => ({ default: m.WebhookDetail })),
);
const BrandSettings = lazyRest(() =>
  import('./pages/settings/brand/BrandSettings').then((m) => ({ default: m.BrandSettings })),
);
const VariablesSettings = lazyRest(() =>
  import('./pages/settings/SoonSections').then((m) => ({ default: m.VariablesSettings })),
);
const PublicPage = lazyRest(() =>
  import('./pages/settings/brand/PublicPage').then((m) => ({ default: m.PublicPage })),
);
const SecuritySettings = lazyRest(() =>
  import('./pages/settings/SecuritySettings').then((m) => ({ default: m.SecuritySettings })),
);
const PresenterPage = lazyRest(() =>
  import('./pages/present/PresenterPage').then((m) => ({ default: m.PresenterPage })),
);
const RemotePhone = lazyRest(() =>
  import('./pages/present/RemotePhone').then((m) => ({ default: m.RemotePhone })),
);
const PublicScreen = lazyRest(() =>
  import('./pages/present/PublicScreen').then((m) => ({ default: m.PublicScreen })),
);
const EditorPage = lazyRest(() => editorChunk().then((m) => ({ default: m.EditorPage })));
const EditorNarrowPage = lazy(() => narrowChunk().then((m) => ({ default: m.EditorNarrowPage })));

/** Écran étroit à l'ouverture : page légère ; dès qu'il a été large, l'éditeur complet (qui gère l'étroit). */
function EditorRoute() {
  const narrow = useNarrow(1024);
  const [everWide, setEverWide] = useState(!narrow);
  useEffect(() => {
    if (!narrow) setEverWide(true);
  }, [narrow]);
  return everWide ? <EditorPage /> : <EditorNarrowPage />;
}
const QuizEditorPage = lazyRest(() =>
  import('./pages/editor/quiz/QuizEditorPage').then((m) => ({ default: m.QuizEditorPage })),
);
const DemoAnalyticsPage = lazyRest(() =>
  import('./pages/analytics/DemoAnalyticsPage').then((m) => ({ default: m.DemoAnalyticsPage })),
);
const DemoViewShell = lazyRest(() =>
  import('./pages/demo/DemoViewShell').then((m) => ({ default: m.DemoViewShell })),
);
const DemoLeadsView = lazyRest(() =>
  import('./pages/demo/DemoLeadsView').then((m) => ({ default: m.DemoLeadsView })),
);
const DemoVisitorsView = lazyRest(() =>
  import('./pages/demo/DemoVisitorsView').then((m) => ({ default: m.DemoVisitorsView })),
);
const AnalyticsPage = lazyRest(() =>
  import('./pages/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
/** §9 : #/demos/:id/preview ouvre l'éditeur sur l'aperçu. */
function PreviewRedirect() {
  const { demoId } = useParams();
  return <Navigate to={`/demos/${demoId}/edit`} state={{ preview: true }} replace />;
}

/** L16 : #/demos/:id/distribute ouvre la modale « Diffuser » au-dessus de l'éditeur. */
/**
 * §1 : l'ancienne page Partager est une fenêtre au-dessus de la démo. #/demos/:id/share redirige vers
 * l'éditeur avec ?share=… (l'ancien ?tab= et ?published=1 sont repris).
 */
function ShareRedirect() {
  const { demoId = '' } = useParams();
  const [params] = useSearchParams();
  const mode =
    { embed: 'integrer', perso: 'perso', access: 'acces', page: 'page' }[params.get('tab') ?? ''] ?? 'lien';
  const published = params.get('published') ? '&published=1' : '';
  return <Navigate replace to={`/demos/${demoId}/edit?share=${mode}${published}`} />;
}

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
            <HelpProvider>
              <EmailRedirectHandler />
              <RouteFocus />
              <ConfigWarning />
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/legal/:doc" element={<LegalPage />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/invite/:token" element={<AcceptInvite />} />
                  {/* E-mails P2 : désinscription du résumé, sans connexion */}
                  <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
                  {/* L26-11 : télécommande du mode présentateur, sans compte */}
                  <Route path="/t" element={<RemotePhone />} />
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
                    path="/console/*"
                    element={
                      <RequireAuth>
                        <ConsolePage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/demos/:demoId/edit"
                    element={
                      <RequireAuth>
                        <RequireWorkspace>
                          <EditorRoute />
                        </RequireWorkspace>
                      </RequireAuth>
                    }
                  />
                  {/* §9 : Aperçu d'une démo, ouvert depuis ses autres vues */}
                  <Route path="/demos/:demoId/preview" element={<PreviewRedirect />} />
                  {/* §9 : vues d'une démo hors de l'éditeur, sans la barre latérale de l'application */}
                  <Route
                    element={
                      <RequireAuth>
                        <RequireWorkspace>
                          <DemoViewShell />
                        </RequireWorkspace>
                      </RequireAuth>
                    }
                  >
                    <Route path="/demos/:demoId/analytics" element={<DemoAnalyticsPage />} />
                    <Route path="/demos/:demoId/leads" element={<DemoLeadsView />} />
                    <Route path="/demos/:demoId/visitors" element={<DemoVisitorsView />} />
                  </Route>
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
                    <Route path="/sandbox" element={<DemosPage key="sandbox" sandbox />} />
                    <Route path="/demos/:demoId/share" element={<ShareRedirect />} />
                    <Route path="/demos/:demoId/distribute" element={<DistributeRoute />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/nouveautes" element={<NewsPage />} />
                    <Route path="/learners" element={<LearnersPage />} />
                    <Route path="/center" element={<CenterSettings />} />
                    <Route path="/media" element={<MediaPage />} />
                    <Route path="/extension" element={<ExtensionPage />} />
                    <Route path="/leads" element={<Navigate to="/analytics?tab=leads" replace />} />
                    <Route path="/settings" element={<SettingsHome />} />
                    <Route path="/settings/profile" element={<Profile />} />
                    <Route path="/settings/notifications" element={<NotificationSettings />} />
                    <Route path="/settings/keys" element={<AccessKeys />} />
                    <Route path="/settings/members" element={<Members />} />
                    <Route path="/settings/workspace" element={<WorkspaceSettings />} />
                    <Route path="/settings/usage" element={<UsagePage />} />
                    {/* L48-A : « Plans et facturation » devient « Utilisation » ; « Fonctions à venir » supprimée */}
                    <Route path="/settings/plans" element={<Navigate to="/settings/usage" replace />} />
                    <Route path="/settings/tags" element={<TagsSettings />} />
                    <Route path="/settings/soon" element={<Navigate to="/settings/workspace" replace />} />
                    <Route path="/settings/brand" element={<BrandSettings />} />
                    <Route path="/settings/brand/page" element={<PublicPage />} />
                    <Route path="/settings/variables" element={<VariablesSettings />} />
                    <Route path="/settings/glossary" element={<GlossarySettings />} />
                    <Route path="/settings/security" element={<SecuritySettings />} />
                    <Route path="/settings/privacy" element={<PrivacySettings />} />
                    <Route path="/settings/ai" element={<AiSettings />} />
                    <Route path="/settings/integrations" element={<IntegrationsPage />} />
                    <Route path="/settings/integrations/webhooks" element={<WebhooksPage />} />
                    <Route path="/settings/integrations/:id" element={<WebhookDetail />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </HelpProvider>
          </ToastProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </HashRouter>
  );
}
