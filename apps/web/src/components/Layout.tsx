import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import { BrandMark } from './BrandMark';
import { initials } from '../lib/initials';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  CreditCard,
  Contact,
  GraduationCap,
  LayoutTemplate,
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
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { setLocale } from '../i18n';
import { supabase } from '../lib/supabase';
import { Menu } from './Menu';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { THEME_OPTIONS, chooseTheme } from './ThemeSwitcher';
import { useTheme, type ThemePref } from '../lib/theme';

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, profile } = useAuth();
  const { current, can } = useWorkspace();
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
    void setLocale(lng);
    // Requête paresseuse : .then() la déclenche (sans lui, la langue n'était jamais enregistrée)
    if (user)
      void supabase
        .from('profiles')
        .update({ locale: lng })
        .eq('id', user.id)
        .then(() => undefined);
  };

  const nav = [
    { to: '/', end: true, icon: <LayoutGrid {...ICON} />, label: t('nav.demos') },
    { to: '/analytics', icon: <BarChart3 {...ICON} />, label: t('nav.analytics') },
    { to: '/analytics?tab=leads', icon: <Contact {...ICON} />, label: t('nav.leads') },
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
      <header className="topbar" data-tip-side="bottom">
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
        <span className="brand">
          <BrandMark size={32} />
        </span>
      </header>
      <aside
        data-tip-side="right"
        className="sidebar"
        id="sidebar"
        ref={sidebar}
        inert={drawer && !open}
        role={drawer ? 'dialog' : undefined}
        aria-modal={drawer && open ? true : undefined}
        aria-label={drawer ? t('nav.main') : undefined}
      >
        <div className="brand">
          <BrandMark size={44} subtitle={t('app.org')} />
        </div>
        {/* CAD-02 : sélecteur de workspace toujours visible (maquette) */}
        <WorkspaceSwitcher />
        <nav aria-label={t('nav.main')} className="fd-nav">
          {nav.map((n) => {
            // RF6 : « Démos » reste actif dans les sous-pages d'une démo (analytics, partage…)
            if (n.to === '/') {
              const active = location.pathname === '/' || location.pathname.startsWith('/demos/');
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`fd-nav__item${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {n.icon}
                  {n.label}
                </Link>
              );
            }
            // ANA-10 : « Leads » ouvre Analytics sur l'onglet Leads ; une seule des deux entrées est active
            const onLeads =
              location.pathname === '/analytics' &&
              new URLSearchParams(location.search).get('tab') === 'leads';
            const active = location.pathname === '/analytics' && (n.to === '/analytics' ? !onLeads : onLeads);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`fd-nav__item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {n.icon}
                {n.label}
              </Link>
            );
          })}
          {/* L13 : section Formation › Apprenants */}
          <div className="fd-nav__section">{t('nav.training')}</div>
          <NavLink to="/learners" className="fd-nav__item">
            <GraduationCap {...ICON} />
            {t('nav.learners')}
          </NavLink>
          {/* L14 : réglages du centre de formation (propriétaires et admins) */}
          {can('members.manage') && (
            <NavLink to="/center" className="fd-nav__item">
              <LayoutTemplate {...ICON} />
              {t('nav.center')}
            </NavLink>
          )}
          <div className="fd-nav__section">{t('nav.workspace')}</div>
          {admin.map((n) => (
            <NavLink key={n.to} to={n.to} className="fd-nav__item">
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user-block">
          <span className="avatar avatar--brand" aria-hidden="true">
            {initials(profile?.full_name || user?.email || '?')}
          </span>
          <span className="user-text">
            <strong>{profile?.full_name || user?.email}</strong>
            <span>{current ? t(`roles.${current.role}`) : user?.email}</span>
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
        {/* Changement d'espace : la page est remontée, ses données et requêtes de l'ancien espace abandonnées */}
        <Outlet key={current?.id ?? 'none'} />
      </main>
    </div>
  );
}
