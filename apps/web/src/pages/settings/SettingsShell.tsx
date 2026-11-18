import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Code, CreditCard, Palette, Plug, Settings, UserRound, Users } from 'lucide-react';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import { NotificationBell } from '../../components/notifications/NotificationBell';

/**
 * Cadre des paramètres (maquette parametres.html) : titre « Paramètres » et navigation interne
 * WORKSPACE (Général, Membres, Marque, Variables) / COMPTE (Mon profil, Plans et facturation).
 * Chaque section garde sa route (/settings/…) pour les liens directs.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  const item = (to: string, icon: ReactNode, label: string) => (
    <NavLink to={to} className={({ isActive }) => `snav-item${isActive ? ' is-active' : ''}`}>
      {icon}
      {label}
    </NavLink>
  );
  return (
    <div className="mk st">
      <div className="page-head">
        <h1>{t('settings.title')}</h1>
        <div className="page-head__actions">
          <NotificationBell />
        </div>
      </div>
      <div className="settings">
        <nav className="snav" aria-label={t('settings.sections')}>
          <span className="grp">{t('settings.workspace')}</span>
          {item('/settings/workspace', <Settings aria-hidden="true" />, t('settings.general'))}
          {item('/settings/members', <Users aria-hidden="true" />, t('settings.members'))}
          {item('/settings/brand', <Palette aria-hidden="true" />, t('settings.brand'))}
          {item('/settings/variables', <Code aria-hidden="true" />, t('settings.variables'))}
          {/* L23 : intégrations, propriétaires et admins seulement */}
          {can('integrations.manage') &&
            item('/settings/integrations', <Plug aria-hidden="true" />, t('settings.integrations'))}
          <span className="grp">{t('settings.account')}</span>
          {item('/settings/profile', <UserRound aria-hidden="true" />, t('settings.profile'))}
          {item('/settings/plans', <CreditCard aria-hidden="true" />, t('settings.plans'))}
        </nav>
        <div className="st-body">{children}</div>
      </div>
    </div>
  );
}
