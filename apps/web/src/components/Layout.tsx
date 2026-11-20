import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import { BrandMark } from './BrandMark';
import { initials } from '../lib/initials';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChartColumn,
  CircleHelp,
  GraduationCap,
  Languages,
  LayoutGrid,
  Map as MapIcon,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  Plus,
  Puzzle,
  Route,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useHelp } from '../help/HelpProvider';
import { ExtensionDialog } from './ExtensionDialog';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { setLocale } from '../i18n';
import { supabase } from '../lib/supabase';
import { Menu } from './Menu';
import { useNewsUnseen, usePlatformRole } from '../pages/console/platform';
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
  // L41 : point de nouveauté et entrée « Console propriétaire » (équipe TutoClick seulement)
  const unseen = useNewsUnseen();
  const platformRole = usePlatformRole();
  const { current, can } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [extension, setExtension] = useState(false);
  const help = useHelp();

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

  // L48-A §1 : Contenus (Démos, Parcours de formation, Analytics), puis Formation › Apprenants
  const path = location.pathname;
  const item = (to: string, active: boolean, icon: ReactNode, label: string) => (
    <Link
      to={to}
      className={`fd-nav__item${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      {label}
    </Link>
  );

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
          {/* RF6 : « Démos » reste actif dans les sous-pages d'une démo (analytics, partage…) */}
          {item('/', path === '/' || path.startsWith('/demos/'), <LayoutGrid {...ICON} />, t('nav.demos'))}
          {/* L48-G §4 : le Sandbox a sa propre entrée (pages reliées, exploration libre) */}
          {item('/sandbox', path === '/sandbox', <MapIcon {...ICON} />, t('nav.sandbox'))}
          {/* L14 : parcours (centre de formation), propriétaires et admins (droits inchangés) */}
          {can('members.manage') && item('/center', path === '/center', <Route {...ICON} />, t('nav.paths'))}
          {/* Leads reste un onglet d'Analytics (?tab=leads) */}
          {item('/analytics', path === '/analytics', <ChartColumn {...ICON} />, t('nav.analytics'))}
          <div className="fd-nav__section">{t('nav.training')}</div>
          {item('/learners', path === '/learners', <GraduationCap {...ICON} />, t('nav.learners'))}
        </nav>
        <div className="spacer" />
        <nav aria-label={t('nav.utilities')} className="fd-nav fd-nav--utils">
          <button type="button" className="fd-nav__item" onClick={() => setExtension(true)}>
            <Puzzle {...ICON} />
            {t('nav.extension')}
          </button>
          {help && (
            <button
              type="button"
              className="fd-nav__item"
              aria-expanded={help.open}
              onClick={(e) => help.toggle(e.currentTarget)}
            >
              <CircleHelp {...ICON} />
              {t('nav.helpCenter')}
            </button>
          )}
          {item(
            '/settings/workspace',
            path.startsWith('/settings/'),
            <Settings {...ICON} />,
            t('nav.workspaceSettings'),
          )}
        </nav>
        <div className="user-block">
          <span className="avatar avatar--brand" aria-hidden="true">
            {initials(profile?.full_name || user?.email || '?')}
            {unseen > 0 && <span className="news-dot" />}
          </span>
          <span className="user-text">
            <strong>{profile?.full_name || user?.email}</strong>
            <span>{current ? t(`roles.${current.role}`) : user?.email}</span>
          </span>
          <Menu
            label={unseen ? t('nav.accountNews', { count: unseen }) : t('nav.account')}
            placement="top-start"
            items={[
              { label: t('nav.profile'), icon: <UserRound />, onSelect: () => navigate('/settings/profile') },
              {
                label: t('news.title'),
                icon: <Megaphone />,
                onSelect: () => navigate('/nouveautes'),
                end:
                  unseen > 0 ? (
                    <>
                      <span className="news-dot news-dot--inline" aria-hidden="true" />
                      <span className="sr-only">{t('news.unseen', { count: unseen })}</span>
                    </>
                  ) : undefined,
              },
              ...(platformRole
                ? [
                    {
                      label: t('console.entry'),
                      icon: <ShieldCheck />,
                      group: t('console.team'),
                      onSelect: () => navigate('/console'),
                    },
                  ]
                : []),
              {
                label: t('nav.newWorkspace'),
                icon: <Plus />,
                onSelect: () => navigate('/onboarding?nouvel=1'),
              },
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
      {extension && <ExtensionDialog onClose={() => setExtension(false)} />}
      <main className="main" id="main" tabIndex={-1}>
        {/* Changement d'espace : la page est remontée, ses données et requêtes de l'ancien espace abandonnées */}
        <Outlet key={current?.id ?? 'none'} />
      </main>
    </div>
  );
}
