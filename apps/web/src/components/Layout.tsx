import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import { AvatarPhoto } from './AvatarPhoto';
import { BrandMark } from './BrandMark';
import symbol from '../assets/symbole-tutoclick.svg';
import { initials } from '../lib/initials';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  ChartColumn,
  CircleHelp,
  GraduationCap,
  Languages,
  LayoutGrid,
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
  Images,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useHelp } from '../help/HelpProvider';
import { PanneauIcon } from './PanneauIcon';
import { LazyNotificationBell } from './notifications/LazyNotificationBell';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { setLocale } from '../i18n';
import { supabase } from '../lib/supabase';
import { Menu } from './Menu';
import { useNewsUnseen, usePlatformRole } from '../pages/console/platform';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { THEME_OPTIONS, chooseTheme } from './ThemeSwitcher';
import { useTheme, type ThemePref } from '../lib/theme';
import { modalOnTop } from '../lib/modalOnTop';

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;

/** Retours client 21/11 §6 : barre épinglée ou rail de 64 px, retenu par personne. */
const SIDEBAR_KEY = 'fd.sidebar';
function savedPinned(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    if (v === 'pinned' || v === 'rail') return v === 'pinned';
  } catch {
    /* stockage indisponible : valeur par défaut */
  }
  return window.matchMedia('(min-width: 1440px)').matches;
}
/** Délais du rail : dépli au survol, repli après la sortie du pointeur. */

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
  const help = useHelp();

  const menuBtn = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const drawer = useMediaQuery('(max-width: 1023px)');
  // §6 et NAV-04 : rail de 64 px (≥ 1 024 px, non épinglé). Il ne se déplie plus au survol ni au focus
  // (retour client du 22/11) : seul le bouton « Déplier » ouvre la barre, qui reste alors ouverte.
  const [pinned, setPinned] = useState(savedPinned);
  const rail = !drawer && !pinned;
  const collapsedRail = rail;
  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'pinned' : 'rail');
    } catch {
      /* stockage indisponible : l'état vaut pour la session */
    }
  };

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
      if (modalOnTop()) return; // une fenêtre modale ouverte par-dessus garde Échap et Tab
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
      // Rail replié : libellé masqué visuellement, montré en infobulle à droite
      data-tip={collapsedRail ? label : undefined}
    >
      {icon}
      <span className="fd-nav__label">{label}</span>
    </Link>
  );

  return (
    <div
      className={`shell${open ? ' nav-open' : ''}${rail ? ' shell--rail' : ''}`}
      /* §18.6 : colonnes de la mise en page (barre latérale, contenu) */ data-gap-exempt=""
    >
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
        {/* LOGO-01 : barre mobile, icône seule de 32 px */}
        {/* NAV-04 §14 ter : le symbole de la barre mobile ramène à l'accueil */}
        <Link className="brand" to="/" aria-label={t('nav.homeLogo')}>
          <img src={symbol} alt="" width={32} height={32} className="brand__symbol" />
        </Link>
        {/* Lot 1 (UX, 21/11) : sous 1 024 px, Aide et Notifications à droite de la barre mobile */}
        <div className="topbar__tools">
          <LazyNotificationBell topbar />
        </div>
        {/* Lot 2 : emplacement d'une action de page dans la barre mobile (bascule « Dossiers » de Démos) */}
        <div className="topbar__slot" id="topbar-slot" />
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
        data-expanded={rail ? 'false' : undefined}
      >
        {/* NAV-04 (COMP-01 §14) : logo à gauche et bouton de repli à droite sur une ligne, filet dessous.
            Rail replié : le bouton seul ; déplié au survol, il garde sa place et le logo vient à sa droite. */}
        <div className="sidebar__head">
          {!collapsedRail && (
            // Le logo complet mène à Démos ; on ne le voit jamais en même temps que « Déplier »
            <Link className="brand" to="/" aria-label={t('nav.homeLogo')}>
              <BrandMark full width={drawer ? 224 : 184} />
            </Link>
          )}
          {!drawer && (
            <button
              type="button"
              className={`fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm sidebar__pin${rail ? ' sidebar__pin--rail' : ''}`}
              aria-label={pinned ? t('nav.collapseSidebar') : t('nav.expandSidebar')}
              aria-expanded={pinned}
              data-tip={pinned ? t('nav.collapseSidebar') : t('nav.expandSidebar')}
              onClick={togglePin}
            >
              {/* NAV-04 §14 bis : dans le rail, le symbole TutoClick au repos ; l'icône « Déplier » au survol
                  et au focus du bouton, au même endroit (fondu croisé en CSS) */}
              {rail && <img src={symbol} alt="" aria-hidden="true" className="sidebar__pin-symbol" />}
              <PanneauIcon />
            </button>
          )}
        </div>
        {/* CAD-02 : sélecteur de workspace toujours visible (maquette) */}
        <WorkspaceSwitcher />
        <nav
          aria-label={t('nav.main')}
          className="fd-nav"
          /* §18.6 : éléments à 2 px, titre de groupe à 6 px de sa première entrée (NAV-02 §11.7.2) */
          data-gap-exempt=""
        >
          {/* RF6 : « Démos » reste actif dans les sous-pages d'une démo (analytics, partage…) */}
          {item('/', path === '/' || path.startsWith('/demos/'), <LayoutGrid {...ICON} />, t('nav.demos'))}
          {/* L48-G §4 : le Sandbox a sa propre entrée (pages reliées, exploration libre) */}
          {item('/sandbox', path === '/sandbox', <Box {...ICON} />, t('nav.sandbox'))}
          {/* L14 : parcours (centre de formation), propriétaires et admins (droits inchangés) */}
          {can('members.manage') && item('/center', path === '/center', <Route {...ICON} />, t('nav.paths'))}
          {/* §3.1 : la Médiathèque de l'espace, entre Parcours de formation et Analytics */}
          {item('/media', path === '/media', <Images {...ICON} />, t('nav.media'))}
          {/* Leads reste un onglet d'Analytics (?tab=leads) */}
          {item('/analytics', path === '/analytics', <ChartColumn {...ICON} />, t('nav.analytics'))}
          <div className="fd-nav__section">{t('nav.training')}</div>
          {item('/learners', path === '/learners', <GraduationCap {...ICON} />, t('nav.learners'))}
        </nav>
        <div className="spacer" />
        <nav aria-label={t('nav.utilities')} className="fd-nav fd-nav--utils">
          {item('/extension', path === '/extension', <Puzzle {...ICON} />, t('nav.extension'))}
          {help && (
            <button
              type="button"
              className="fd-nav__item"
              aria-expanded={help.open}
              data-tip={collapsedRail ? t('nav.helpCenter') : undefined}
              onClick={(e) => help.toggle(e.currentTarget)}
            >
              <CircleHelp {...ICON} />
              <span className="fd-nav__label">{t('nav.helpCenter')}</span>
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
            <AvatarPhoto userId={user?.id} />
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
              // Groupes séparés par un filet (COMP-01, menus) : compte | équipe TutoClick | espace et
              // préférences | déconnexion
              'separator',
              ...(platformRole
                ? [
                    {
                      label: t('console.entry'),
                      icon: <ShieldCheck />,
                      group: t('console.team'),
                      onSelect: () => navigate('/console'),
                    },
                    'separator' as const,
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
      <main className="main" id="main" tabIndex={-1}>
        {/* Changement d'espace : la page est remontée, ses données et requêtes de l'ancien espace abandonnées */}
        <Outlet key={current?.id ?? 'none'} />
      </main>
    </div>
  );
}
