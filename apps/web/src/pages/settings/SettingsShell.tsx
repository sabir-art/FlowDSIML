import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { Action } from '@flowdsiml/core';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import { NotificationBell } from '../../components/notifications/NotificationBell';

/** Une entrée : une route, ou « Bientôt » (jamais masquée, pas de lien). */
interface Entry {
  label: string;
  to?: string;
  /** Droit requis pour voir l'entrée (règles existantes). */
  perm?: Action;
}
/** Titre de groupe → entrées (L48-A §4). */
const GROUPS: Array<{ key: string; entries: Entry[] }> = [
  {
    key: 'space',
    entries: [
      { label: 'settings.general', to: '/settings/workspace' },
      { label: 'settings.members', to: '/settings/members' },
      { label: 'settings.usage', to: '/settings/usage' },
      { label: 'soon.security', to: '/settings/security' },
      { label: 'privacy.title', to: '/settings/privacy' },
    ],
  },
  {
    key: 'brand',
    entries: [
      { label: 'settings.brandTheme', to: '/settings/brand' },
      { label: 'settings.publicPage', to: '/settings/brand/page' },
      { label: 'settings.domain' },
    ],
  },
  {
    key: 'content',
    entries: [
      { label: 'settings.variables', to: '/settings/variables' },
      // L17 : glossaire, propriétaires, admins et éditeurs (les lecteurs ne voient pas l'entrée)
      { label: 'settings.glossary', to: '/settings/glossary', perm: 'demo.edit' },
      { label: 'settings.tags' },
      { label: 'ai.name', to: '/settings/ai' },
    ],
  },
  {
    key: 'connections',
    entries: [
      // L23 : intégrations, propriétaires et admins seulement
      { label: 'settings.integrations', to: '/settings/integrations', perm: 'integrations.manage' },
      { label: 'settings.keys' },
    ],
  },
  {
    key: 'account',
    entries: [{ label: 'settings.profile', to: '/settings/profile' }, { label: 'settings.notifications' }],
  },
];

/** Groupe et entrée de la page courante (les sous-pages, ex. un webhook, gardent leur entrée). */
function currentEntry(path: string) {
  let best: { group: string; entry: Entry } | null = null;
  for (const g of GROUPS)
    for (const e of g.entries)
      if (e.to && (path === e.to || path.startsWith(`${e.to}/`)))
        if (!best || e.to.length > (best.entry.to?.length ?? 0)) best = { group: g.key, entry: e };
  return best;
}

/**
 * L48-A §4 : cadre des Paramètres. Cinq groupes (Espace, Marque, Contenu, Connexions, Mon compte),
 * fil d'Ariane « Paramètres > Groupe > Page » au-dessus du titre de la page (h1, le nom de la section).
 * Chaque section garde sa route (/settings/…) pour les liens directs.
 */
export function SettingsShell({
  children,
  sub,
}: {
  children: ReactNode;
  /** L48-F : sous-page d'une entrée (ex. Webhooks) : l'entrée devient un lien du fil, `title` est le h1. */
  sub?: { title: string; trail?: Array<{ label: string; to: string }> };
}) {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  const { pathname } = useLocation();
  const here = currentEntry(pathname);
  return (
    <div className="mk st">
      <div className="page-head">
        <div>
          <nav className="st-crumb" aria-label={t('settings.breadcrumb')}>
            <ol>
              <li>
                <Link to="/settings/workspace">{t('settings.title')}</Link>
              </li>
              {here && (
                <>
                  <li>
                    <ChevronRight size={14} aria-hidden="true" />
                    {t(`settings.grp.${here.group}`)}
                  </li>
                  {sub ? (
                    <>
                      {[{ label: t(here.entry.label), to: here.entry.to! }, ...(sub.trail ?? [])].map((c) => (
                        <li key={c.to}>
                          <ChevronRight size={14} aria-hidden="true" />
                          <Link to={c.to}>{c.label}</Link>
                        </li>
                      ))}
                      <li aria-current="page">
                        <ChevronRight size={14} aria-hidden="true" />
                        {sub.title}
                      </li>
                    </>
                  ) : (
                    <li aria-current="page">
                      <ChevronRight size={14} aria-hidden="true" />
                      {t(here.entry.label)}
                    </li>
                  )}
                </>
              )}
            </ol>
          </nav>
          <h1 id="st-title">{sub ? sub.title : here ? t(here.entry.label) : t('settings.title')}</h1>
        </div>
        <div className="page-head__actions">
          <NotificationBell />
        </div>
      </div>
      <div className="settings">
        <nav className="snav" aria-label={t('settings.sections')}>
          {GROUPS.map((g) => (
            // Retour client : intitulé de groupe = étiquette non cliquable qui nomme le groupe
            <div key={g.key} className="snav-grp" role="group" aria-labelledby={`snav-g-${g.key}`}>
              <p id={`snav-g-${g.key}`} className="grp">
                {t(`settings.grp.${g.key}`)}
              </p>
              {g.entries
                .filter((e) => !e.perm || can(e.perm))
                .map((e) =>
                  e.to ? (
                    <NavLink
                      key={e.label}
                      to={e.to}
                      end={e.to === '/settings/brand'}
                      className={({ isActive }) => `snav-item${isActive ? ' is-active' : ''}`}
                    >
                      {t(e.label)}
                    </NavLink>
                  ) : (
                    <span key={e.label} className="snav-item snav-item--soon">
                      {t(e.label)}
                      <em>{t('shell.soon')}</em>
                    </span>
                  ),
                )}
            </div>
          ))}
        </nav>
        <div className="st-body">{children}</div>
      </div>
    </div>
  );
}
