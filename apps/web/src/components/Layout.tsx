import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  CreditCard,
  Building2,
  Contact,
  Languages,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Settings,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Select } from '@flowdsiml/ui';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { setLocale } from '../i18n';
import { supabase } from '../lib/supabase';
import { Menu } from './Menu';
import { THEME_OPTIONS, chooseTheme } from './ThemeSwitcher';
import { useTheme, type ThemePref } from '../lib/theme';

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, profile } = useAuth();
  const { workspaces, current, select } = useWorkspace();
  const [open, setOpen] = useState(false);

  const menuBtn = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const drawer = useMediaQuery('(max-width: 1023px)');

  // Ferme le menu mobile à chaque navigation.
  useEffect(() => setOpen(false), [location.pathname]);

  // DB1 : tiroir de navigation modal (< 1024 px) — focus piégé, Échap ferme et rend le focus au bouton.
  useEffect(() => {
    if (!drawer || !open) return;
    const panel = sidebar.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), select, input, [tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('#fd-portal [role=menu]')) return; // un menu ouvert gère sa propre touche Échap
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        menuBtn.current?.focus();
      } else if (e.key === 'Tab') {
        const els = focusables();
        const first = els[0];
        const last = els[els.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer, open]);

  const switchLang = () => {
    const lng = i18n.language === 'en' ? 'fr' : 'en';
    setLocale(lng);
    if (user) void supabase.from('profiles').update({ locale: lng }).eq('id', user.id);
  };

  const nav = [
    { to: '/', end: true, icon: <LayoutGrid {...ICON} />, label: t('nav.demos') },
    { to: '/analytics', icon: <BarChart3 {...ICON} />, label: t('nav.analytics') },
    { to: '/leads', icon: <Contact {...ICON} />, label: t('nav.leads') },
  ];
  const admin = [
    { to: '/settings/members', icon: <Users {...ICON} />, label: t('nav.members') },
    { to: '/settings/workspace', icon: <Settings {...ICON} />, label: t('nav.workspaceSettings') },
    { to: '/settings/plans', icon: <CreditCard {...ICON} />, label: t('nav.plans') },
  ];

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('a11y.skip')}
      </a>
      <header className="topbar">
        <button
          ref={menuBtn}
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--icon"
          aria-label={open ? t('common.close') : t('nav.openMenu')}
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen(!open)}
        >
          {open ? <X {...ICON} /> : <MenuIcon {...ICON} />}
        </button>
        <span className="brand">{t('app.name')}</span>
      </header>
      <aside
        className="sidebar"
        id="sidebar"
        ref={sidebar}
        inert={drawer && !open}
        role={drawer ? 'dialog' : undefined}
        aria-modal={drawer && open ? true : undefined}
        aria-label={drawer ? t('nav.main') : undefined}
      >
        <div className="brand">{t('app.name')}</div>
        {workspaces.length > 0 && (
          <div className="ws-switch">
            <Building2 {...ICON} />
            <Select
              aria-label={t('nav.workspace')}
              value={current?.id ?? ''}
              onChange={(e) => select(e.target.value)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <nav aria-label={t('nav.main')} className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}
          <div className="nav-section">{t('nav.workspace')}</div>
          {admin.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user-block">
          <span className="avatar" aria-hidden="true">
            {(profile?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="user-text">
            <strong>{profile?.full_name || t('nav.profile')}</strong>
            <span>{user?.email}</span>
          </span>
          <Menu
            label={t('nav.account')}
            placement="top-start"
            items={[
              { label: t('nav.profile'), icon: <UserRound />, onSelect: () => navigate('/settings/profile') },
              { label: t('nav.newWorkspace'), icon: <Plus />, onSelect: () => navigate('/onboarding') },
              {
                label: i18n.language === 'en' ? 'Français' : 'English',
                icon: <Languages />,
                onSelect: switchLang,
              },
              {
                radios: {
                  label: t('theme.label'),
                  value: theme,
                  options: THEME_OPTIONS.map(({ value, icon: Icon }) => ({
                    value,
                    label: t(`theme.${value}`),
                    icon: <Icon size={16} aria-hidden="true" />,
                  })),
                  onChange: (v) => void chooseTheme(v as ThemePref),
                },
              },
              'separator',
              { label: t('auth.signOut'), icon: <LogOut />, onSelect: () => void signOut() },
            ]}
          />
        </div>
      </aside>
      <div
        className="scrim"
        aria-hidden="true"
        onClick={() => {
          setOpen(false);
          menuBtn.current?.focus();
        }}
      />
      <main className="main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
