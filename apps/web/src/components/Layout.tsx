import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import { AvatarPhoto } from './AvatarPhoto';
import { BrandMark } from './BrandMark';
import symbol from '../assets/symbole-tutoclick.svg';
import { APP_NAME } from '@flowdsiml/core';
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
  PanelLeft,
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
const HOVER_IN = 150;
const HOVER_OUT = 300;

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
  // §6 : rail (≥ 1 024 px, non épinglé), déplié par-dessus le contenu au survol ou au focus
  const [pinned, setPinned] = useState(savedPinned);
  const [expanded, setExpanded] = useState(false);
  const rail = !drawer && !pinned;
  const collapsedRail = rail && !expanded;
  const hoverTimer = useRef(0);
  /** Échap rend le focus à l'élément actif sans redéplier le rail (ce focus-là seulement). */
  const escapedAt = useRef(0);
  const justEscaped = () => performance.now() - escapedAt.current < 100;
  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    setExpanded(false);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'pinned' : 'rail');
    } catch {
      /* stockage indisponible : l'état vaut pour la session */
    }
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  const railEvents = rail
    ? {
        onMouseEnter: () => {
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(() => setExpanded(true), HOVER_IN);
        },
        onMouseLeave: () => {
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(() => {
            // Le focus clavier dans la barre la garde dépliée (pas celui laissé par un clic)
            const el = document.activeElement;
            if (!sidebar.current?.contains(el) || !el?.matches(':focus-visible')) setExpanded(false);
          }, HOVER_OUT);
        },
        onFocus: (e: FocusEvent<HTMLElement>) => {
          // Focus clavier seulement : un clic donne aussi le focus, et déplier à cet instant déplacerait
          // l'élément sous le pointeur avant le relâchement (le clic tomberait à côté, ex. « Mon compte ») ;
          // à la souris, c'est le survol qui déplie
          if (justEscaped() || !(e.target as HTMLElement).matches(':focus-visible')) return;
          window.clearTimeout(hoverTimer.current);
          setExpanded(true);
        },
        onBlur: (e: FocusEvent<HTMLElement>) => {
          const to = e.relatedTarget as Node | null;
          // Un menu ouvert depuis la barre (portail) la garde dépliée
          if (to && (sidebar.current?.contains(to) || document.getElementById('fd-portal')?.contains(to)))
            return;
          if (!sidebar.current?.matches(':hover')) setExpanded(false);
        },
        onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
          if (e.key !== 'Escape' || !expanded || document.querySelector('#fd-portal [role=menu]')) return;
          e.preventDefault();
          escapedAt.current = performance.now();
          setExpanded(false);
          // L'élément actif de la page, sinon le premier
          (
            sidebar.current?.querySelector<HTMLElement>('.fd-nav__item[aria-current="page"]') ??
            sidebar.current?.querySelector<HTMLElement>('.fd-nav__item')
          )?.focus();
        },
      }
    : {};

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
        <span className="brand">
          <img src={symbol} alt={APP_NAME} width={32} height={32} className="brand__symbol" />
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
        data-expanded={rail ? String(expanded) : undefined}
        {...railEvents}
      >
        {!drawer && (
          // §6 : même place épinglée ou en rail ; nom stable, état dans aria-pressed (motif bouton bascule)
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm sidebar__pin"
            aria-label={t('nav.pinSidebar')}
            aria-pressed={pinned}
            data-tip={pinned ? t('nav.collapseSidebar') : t('nav.pinSidebar')}
            onClick={togglePin}
          >
            <PanelLeft {...ICON} />
          </button>
        )}
        <div className="brand">
          {collapsedRail ? (
            <img src={symbol} alt={APP_NAME} width={32} height={32} className="brand__symbol" />
          ) : (
            <BrandMark full width={224} />
          )}
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
          <button
            type="button"
            className="fd-nav__item"
            data-tip={collapsedRail ? t('nav.extension') : undefined}
            onClick={() => setExtension(true)}
          >
            <Puzzle {...ICON} />
            <span className="fd-nav__label">{t('nav.extension')}</span>
          </button>
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
      {extension && <ExtensionDialog onClose={() => setExtension(false)} />}
      <main className="main" id="main" tabIndex={-1}>
        {/* Changement d'espace : la page est remontée, ses données et requêtes de l'ancien espace abandonnées */}
        <Outlet key={current?.id ?? 'none'} />
      </main>
    </div>
  );
}
