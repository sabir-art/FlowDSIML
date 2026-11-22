/**
 * L41 : Console propriétaire, réservée à l'équipe TutoClick (hors de tout espace client).
 * Pour tout autre compte, #/console se comporte comme une adresse inconnue (retour à l'accueil).
 * Onglets : Vue d'ensemble, Retours, Backlog, Nouveautés, Équipe et journal.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { BackButton } from '@flowdsiml/ui';
import { HelpButton } from '../../help/HelpButton';
import { supabase } from '../../lib/supabase';
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

const CrumbLink = (p: { to: string; className?: string; title?: string; children?: ReactNode }) => (
  <Link {...p} />
);

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
    // Compteur des retours nouveaux en pastille ; le libellé complet reste le nom accessible
    { to: '/console/retours', label: t('console.tabs.feedback'), count: counts?.newComments || 0 },
    {
      to: '/console/backlog',
      label: counts?.triage
        ? t('console.tabs.backlogN', { count: counts.triage })
        : t('console.tabs.backlog'),
    },
    { to: '/console/nouveautes', label: t('console.tabs.news') },
    { to: '/console/equipe', label: t('console.tabs.team') },
  ];
  const nav = (
    <nav className="console-tabs" aria-label={t('console.tabsLabel')}>
      {tabs.map((x) => (
        <NavLink key={x.to} to={x.to} end={x.end} className="console-tab">
          {x.label}
          {x.count ? (
            <>
              <span className="console-tab__n" aria-hidden="true">
                {x.count}
              </span>
              <span className="sr-only">{t('console.tabs.newCount', { count: x.count })}</span>
            </>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="mk console">
      {/* PAGE-01 §16.2 : variante éditeur de la barre commune (56 px, collante, filet), grille 1fr auto 1fr.
          Elle remplace l'ancien en-tête et la rangée d'onglets ; le h1 de la Console est dans la barre. */}
      <header className="fd-page-header fd-page-header--editor console-top" data-tip-side="bottom">
        <div className="console-top__l">
          <BackButton
            to="/"
            label={t('console.backApp')}
            ariaLabel={t('console.backLabel')}
            className="console-top__back"
            as={CrumbLink}
          />
          {/* Sous 1 024 px : le retour en icône seule */}
          <BackButton
            to="/"
            label=""
            iconOnly
            ariaLabel={t('console.backLabel')}
            className="console-top__back-m"
            as={CrumbLink}
          />
          <span className="console-top__sep" aria-hidden="true" />
          <h1 className="console-top__t" data-tip={t('console.sub')} tabIndex={0}>
            {t('console.entry')}
          </h1>
        </div>
        <div className="console-top__c">{nav}</div>
        <div className="console-top__r">
          <HelpButton className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm" />
        </div>
      </header>
      {/* Sous 1 024 px : les onglets passent sous la barre, sur une ligne qui défile */}
      {/* §18.7 : rangée d'onglets, défilement horizontal voulu sur mobile */}
      <div className="console-tabrow" data-scroll-x="">
        {nav}
      </div>
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
