/**
 * L41 : Console propriétaire, réservée à l'équipe TutoClick (hors de tout espace client).
 * Pour tout autre compte, #/console se comporte comme une adresse inconnue (retour à l'accueil).
 * Onglets : Vue d'ensemble, Retours, Backlog, Nouveautés, Équipe et journal.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BrandMark } from '../../components/BrandMark';
import { Loading } from '../../components/guards';
import { usePlatformRole } from './platform';
import { RoleCtx, useConsoleRole } from './shared';
import { Overview } from './ConsoleOverview';
import { Feedback } from './ConsoleFeedback';
import { Backlog } from './ConsoleBacklog';
import { NewsTab } from './ConsoleNews';
import { Team } from './ConsoleTeam';
import './console.css';

let opened = false;

export function ConsolePage() {
  const role = usePlatformRole();
  if (role === undefined) return <Loading />;
  if (role === null) return <Navigate to="/" replace />;
  return (
    <RoleCtx.Provider value={role}>
      <ConsoleFrame />
    </RoleCtx.Provider>
  );
}

/** Compteurs des onglets (« Retours · n nouveaux », « Backlog · n à trier »). */
export function useCounts() {
  const [counts, setCounts] = useState<{ newComments: number; triage: number } | null>(null);
  const reload = useCallback(() => {
    void supabase.rpc('console_overview', { p_days: 90 }).then(({ data }) => {
      const d = data as { newComments: number; triage: number } | null;
      if (d) setCounts({ newComments: d.newComments, triage: d.triage });
    });
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener('fd:console-changed', reload);
    return () => window.removeEventListener('fd:console-changed', reload);
  }, [reload]);
  return counts;
}
/** Une écriture a modifié les retours ou le backlog : les compteurs se rechargent. */
export const consoleChanged = () => window.dispatchEvent(new Event('fd:console-changed'));

function ConsoleFrame() {
  const { t } = useTranslation();
  const counts = useCounts();
  const role = useConsoleRole();
  useEffect(() => {
    if (opened) return;
    opened = true;
    void supabase.rpc('console_log_event', { p_action: 'console.open', p_label: '' }).then(() => undefined);
  }, []);
  const tabs = [
    { to: '/console', end: true, label: t('console.tabs.overview') },
    {
      to: '/console/retours',
      label: counts?.newComments
        ? t('console.tabs.feedbackN', { count: counts.newComments })
        : t('console.tabs.feedback'),
    },
    {
      to: '/console/backlog',
      label: counts?.triage
        ? t('console.tabs.backlogN', { count: counts.triage })
        : t('console.tabs.backlog'),
    },
    { to: '/console/nouveautes', label: t('console.tabs.news') },
    { to: '/console/equipe', label: t('console.tabs.team') },
  ];
  return (
    <div className="mk console">
      <header className="console-head">
        <BrandMark />
        <div className="console-head__t">
          <b>{t('console.entry')}</b>
          <span>{t('console.sub')}</span>
        </div>
        <Link className="fd-btn fd-btn--sm" to="/">
          <ArrowLeft aria-hidden="true" />
          {t('console.back')}
        </Link>
      </header>
      <nav className="console-tabs" aria-label={t('console.tabsLabel')}>
        {tabs.map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end} className="console-tab">
            {x.label}
          </NavLink>
        ))}
      </nav>
      <main className="console-main" id="main">
        {role === 'read_only' && (
          <p className="console-ro" role="note">
            {t('console.roBanner')}
          </p>
        )}
        <Routes>
          <Route index element={<Overview />} />
          <Route path="retours" element={<Feedback />} />
          <Route path="backlog" element={<Backlog />} />
          <Route path="backlog/:itemId" element={<Backlog />} />
          <Route path="nouveautes" element={<NewsTab />} />
          <Route path="equipe" element={<Team />} />
          <Route path="*" element={<Navigate to="/console" replace />} />
        </Routes>
      </main>
    </div>
  );
}
