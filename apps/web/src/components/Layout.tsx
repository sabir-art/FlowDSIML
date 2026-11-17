import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { LanguageSwitch } from './LanguageSwitch';

export function Layout() {
  const { t } = useTranslation();
  const { signOut, user } = useAuth();
  const { workspaces, current, select } = useWorkspace();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">{t('app.name')}</div>
        {workspaces.length > 0 && (
          <label className="fd-field">
            <span className="fd-label">{t('nav.workspace')}</span>
            <select className="fd-select" value={current?.id ?? ''} onChange={(e) => select(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label={t('nav.main')}>
          <NavLink to="/" end>
            {t('nav.demos')}
          </NavLink>
          <NavLink to="/analytics">{t('nav.analytics')}</NavLink>
          <NavLink to="/leads">{t('nav.leads')}</NavLink>
          <NavLink to="/settings/workspace">{t('nav.workspaceSettings')}</NavLink>
          <NavLink to="/settings/members">{t('nav.members')}</NavLink>
          <NavLink to="/settings/profile">{t('nav.profile')}</NavLink>
          <NavLink to="/onboarding">{t('nav.newWorkspace')}</NavLink>
        </nav>
        <div className="spacer" />
        <LanguageSwitch />
        <div className="fd-muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
          {user?.email}
        </div>
        <Button onClick={() => void signOut()}>{t('auth.signOut')}</Button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
