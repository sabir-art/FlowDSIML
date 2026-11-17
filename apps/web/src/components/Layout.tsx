import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Folder,
  Layers,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  SquarePlay,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { supabase } from '../lib/supabase';
import { usePlan } from '../lib/plan';
import { initials } from '../lib/initials';
import { SUPPORT_EMAIL } from '../lib/env';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useCrumbs } from './crumbs';
import '../styles/maquette.css';
import '../styles/maquette-ajouts.css';

/** Icônes de la maquette : 20 px dans la navigation, trait 1,75. */
const NAV_ICON = { size: 20, strokeWidth: 1.75, 'aria-hidden': true } as const;
const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;

interface Counts {
  demos: number;
  published: number;
  leads: number;
  members: number;
  folders: Array<{ id: string; name: string }>;
}

/**
 * Cadre commun de l'app (règle D13) : reproduction de la barre latérale et de la barre du haut de
 * la maquette d'origine (docs/ux/maquettes/assets/mockup.js, shell « app »), avec le CSS de la
 * maquette (styles/maquette.css). Données réelles : workspace, plan, membres, compteurs, dossiers,
 * usage, utilisateur. Éléments sans fonction réelle (Démo centers, crédits IA, notifications) :
 * visibles avec un badge, comme dans la maquette.
 */
export function Layout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, profile } = useAuth();
  const { workspaces, current, select } = useWorkspace();
  const plan = usePlan();
  const crumbs = useCrumbs();
  const [open, setOpen] = useState(false);
  const [wsMenu, setWsMenu] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [query, setQuery] = useState('');
  const drawer = useMediaQuery('(max-width: 1023px)');
  const sidebar = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpen(false);
    setWsMenu(false);
  }, [location.pathname]);

  // Compteurs de la navigation et de la carte d'usage
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    const ws = current.id;
    void Promise.all([
      supabase
        .from('demos')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws)
        .is('deleted_at', null),
      supabase
        .from('demos')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws)
        .eq('status', 'published')
        .is('deleted_at', null),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', ws),
      supabase.from('members').select('user_id', { count: 'exact', head: true }).eq('workspace_id', ws),
      supabase.from('folders').select('id, name').eq('workspace_id', ws).order('created_at'),
    ]).then(([d, p, l, m, f]) => {
      if (cancelled) return;
      setCounts({
        demos: d.count ?? 0,
        published: p.count ?? 0,
        leads: l.count ?? 0,
        members: m.count ?? 0,
        folders: (f.data ?? []) as Counts['folders'],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [current, location.pathname]);

  // Tiroir de navigation (< 1 024 px) : focus placé dans le tiroir et piégé tant qu'il est ouvert
  useEffect(() => {
    if (!drawer || !open) return;
    const panel = sidebar.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, [tabindex="0"]') ?? [],
      ).filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
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
    };
    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, [drawer, open]);

  // Raccourci « / » : focus sur la recherche (comme la maquette)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? '';
      if (
        e.key === '/' &&
        !/input|textarea|select/i.test(tag) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setWsMenu(false);
        if (drawer && open) {
          setOpen(false);
          menuBtn.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer, open]);

  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  const folder = params.get('folder');
  const cur = (active: boolean) => (active ? ({ 'aria-current': 'page' } as const) : {});
  const isDemos = (path === '/' || path.startsWith('/demos/')) && !folder;
  const limit = plan.publishedDemos;
  const name = profile?.full_name || user?.email || '';

  function onSearch(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') navigate(`/?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="mk">
      <a
        className="skip"
        href="#contenu"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('contenu')?.focus();
        }}
      >
        {t('shell.skip')}
      </a>
      <div className="app">
        <aside
          className={`sidebar${open ? ' open' : ''}`}
          id="sidebar"
          ref={sidebar}
          aria-label={t('shell.main')}
          inert={drawer && !open}
        >
          <button
            className="ws-switch"
            type="button"
            aria-haspopup="menu"
            aria-expanded={wsMenu}
            aria-controls="ws-menu"
            onClick={() => setWsMenu(!wsMenu)}
          >
            <span className="ws-logo" aria-hidden="true">
              {(current?.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="grow">
              <span className="t-label" style={{ display: 'block', fontWeight: 600 }}>
                {current?.name}
              </span>
              <span className="t-caption subtle">
                {t('shell.wsPlan', {
                  plan: t(`plan.names.${current?.plan_code ?? 'free'}`),
                  count: counts?.members ?? 1,
                })}
              </span>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {wsMenu && (
            <div className="menu" id="ws-menu" role="menu" style={{ top: 60, left: 12, width: 216 }}>
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    select(w.id);
                    setWsMenu(false);
                  }}
                >
                  <span
                    className="ws-logo"
                    style={{ width: 20, height: 20, fontSize: 10 }}
                    aria-hidden="true"
                  >
                    {w.name.slice(0, 1).toUpperCase()}
                  </span>
                  {w.name}
                  {w.id === current?.id && (
                    <Check {...ICON} style={{ marginLeft: 'auto', color: 'var(--fd-color-primary)' }} />
                  )}
                </button>
              ))}
              <hr />
              <button type="button" role="menuitem" onClick={() => navigate('/onboarding')}>
                <Plus {...ICON} />
                {t('shell.newWorkspace')}
              </button>
            </div>
          )}

          <nav className="nav" aria-label={t('shell.sections')}>
            <Link to="/" {...cur(isDemos)}>
              <SquarePlay {...NAV_ICON} />
              {t('shell.demos')}
              {counts && <span className="count">{counts.demos}</span>}
            </Link>
            <a aria-disabled="true" title={t('shell.soon')} onClick={(e) => e.preventDefault()} href="#">
              <Layers {...NAV_ICON} />
              {t('shell.centers')}
              <span className="badge" style={{ marginLeft: 'auto' }}>
                V2
              </span>
            </a>
            <Link to="/analytics" {...cur(path.startsWith('/analytics'))}>
              <BarChart3 {...NAV_ICON} />
              {t('shell.analytics')}
            </Link>
            <Link to="/leads" {...cur(path.startsWith('/leads'))}>
              <Users {...NAV_ICON} />
              {t('shell.leads')}
              {counts && <span className="count">{counts.leads}</span>}
            </Link>
            <div className="nav-title">{t('shell.folders')}</div>
            {counts?.folders.map((f) => (
              <Link key={f.id} to={`/?folder=${f.id}`} {...cur(folder === f.id)}>
                <Folder {...NAV_ICON} />
                {f.name}
              </Link>
            ))}
            <Link to="/?folder=archived" {...cur(folder === 'archived')}>
              <Archive {...NAV_ICON} />
              {t('shell.archived')}
            </Link>
            <div className="nav-title">{t('shell.workspace')}</div>
            <Link
              to="/settings/workspace"
              {...cur(path.startsWith('/settings') && !path.startsWith('/settings/plans'))}
            >
              <Settings {...NAV_ICON} />
              {t('shell.settings')}
            </Link>
            <Link to="/settings/plans" {...cur(path.startsWith('/settings/plans'))}>
              <CreditCard {...NAV_ICON} />
              {t('shell.plans')}
            </Link>
          </nav>

          <div className="sidebar-foot">
            <div className="usage">
              <div className="row between t-caption">
                <span>{t('shell.publishedDemos')}</span>
                <span className="num">
                  {counts?.published ?? 0} / {limit === null ? t('shell.unlimited') : limit}
                </span>
              </div>
              <div className="row between t-caption" style={{ marginTop: 8 }}>
                <span>{t('shell.aiCredits')}</span>
                <span className="badge" title={t('shell.soon')}>
                  {t('shell.soon')}
                </span>
              </div>
              <div className="progress" style={{ marginTop: 6 }}>
                <span
                  style={{
                    width: `${limit ? Math.min(100, ((counts?.published ?? 0) / limit) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="row">
              <span className="avatar" aria-hidden="true">
                {initials(name || '?')}
              </span>
              <span className="grow">
                <span className="t-label" style={{ display: 'block' }}>
                  {profile?.full_name || user?.email}
                </span>
                <span className="t-caption subtle">{user?.email}</span>
              </span>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                type="button"
                aria-label={t('shell.logout')}
                title={t('shell.logout')}
                onClick={() => void signOut().then(() => navigate('/login'))}
              >
                <LogOut {...ICON} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <button
              ref={menuBtn}
              type="button"
              className="btn btn-ghost btn-icon mobile-bar"
              aria-label={t('shell.openNav')}
              aria-expanded={open}
              aria-controls="sidebar"
              onClick={() => setOpen(!open)}
            >
              <MenuIcon {...ICON} />
            </button>
            <nav className="crumbs" aria-label={t('shell.crumbs')}>
              {crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} style={{ display: 'contents' }}>
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {i === crumbs.length - 1 ? (
                    <span aria-current="page">{c.label}</span>
                  ) : c.to ? (
                    <Link to={c.to}>{c.label}</Link>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <span className="grow" />
            <div className="input-affix hide-sm" style={{ width: 260 }}>
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                className="input input-sm"
                type="search"
                placeholder={t('shell.search')}
                aria-label={t('shell.searchLabel')}
                aria-keyshortcuts="/"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearch}
              />
            </div>
            <a
              className="btn btn-ghost btn-icon"
              aria-label={t('shell.help')}
              title={t('shell.help')}
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              <CircleHelp {...ICON} />
            </a>
            <button
              className="btn btn-ghost btn-icon"
              type="button"
              aria-label={`${t('shell.notifications')} (${t('shell.soon')})`}
              title={t('shell.soon')}
              aria-disabled="true"
            >
              <Bell {...ICON} />
            </button>
          </header>
          <main id="contenu" tabIndex={-1}>
            <div className="content">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      {drawer && open && <div className="mk-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
    </div>
  );
}
