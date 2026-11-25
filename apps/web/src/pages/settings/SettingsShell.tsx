import { useLayoutEffect, useRef, useState, type ReactNode, useEffect } from 'react';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BookA,
  Braces,
  Building2,
  CircleUser,
  FileLock2,
  Gauge,
  Globe,
  KeyRound,
  Palette,
  Plug,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import type { Action } from '@flowdsiml/core';
import { PageHeader, type Crumb } from '@flowdsiml/ui';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import '../../styles/parametres.css';
import './settings.css';

/** Une entrée : une route, ou « Bientôt » (jamais masquée, désactivée). */
interface Entry {
  label: string;
  icon: LucideIcon;
  to?: string;
  /** Droit requis pour voir l'entrée (règles existantes). */
  perm?: Action;
  /** Page ouverte mais réglages encore inactifs : libellé « Bientôt », lien gardé. */
  soon?: boolean;
}
/** NAV-02 §11.7.2 : groupes, entrées et icônes de 16 px. « Domaine » est retiré (décision du chef). */
const GROUPS: Array<{ key: string; entries: Entry[] }> = [
  {
    key: 'space',
    entries: [
      { label: 'settings.general', icon: Building2, to: '/settings/workspace' },
      { label: 'settings.members', icon: Users, to: '/settings/members' },
      { label: 'settings.usage', icon: Gauge, to: '/settings/usage' },
      { label: 'soon.security', icon: ShieldCheck, to: '/settings/security' },
      { label: 'privacy.title', icon: FileLock2, to: '/settings/privacy' },
    ],
  },
  {
    key: 'brand',
    entries: [
      { label: 'settings.brandTheme', icon: Palette, to: '/settings/brand' },
      // §6.1 : réglage du catalogue public, propriétaires et admins seulement
      { label: 'settings.publicPage', icon: Globe, to: '/settings/brand/page', perm: 'workspace.settings' },
    ],
  },
  {
    key: 'content',
    entries: [
      { label: 'settings.variables', icon: Braces, to: '/settings/variables' },
      // L17 : glossaire, propriétaires, admins et éditeurs (les lecteurs ne voient pas l'entrée)
      { label: 'settings.glossary', icon: BookA, to: '/settings/glossary', perm: 'demo.edit' },
      // L52 : étiquettes, lisibles par tous les rôles (lecture seule sans le droit d'édition)
      { label: 'settings.tags', icon: Tag, to: '/settings/tags' },
      { label: 'ai.name', icon: Sparkles, to: '/settings/ai' },
    ],
  },
  {
    key: 'connections',
    entries: [
      // L23 : intégrations, propriétaires et admins seulement
      {
        label: 'settings.integrations',
        icon: Plug,
        to: '/settings/integrations',
        perm: 'integrations.manage',
      },
      // §6.2 : clés d'accès de l'API, propriétaires et admins seulement
      { label: 'settings.keys', icon: KeyRound, to: '/settings/keys', perm: 'integrations.manage' },
    ],
  },
  {
    key: 'account',
    entries: [
      { label: 'settings.profile', icon: CircleUser, to: '/settings/profile' },
      { label: 'settings.notifications', icon: Bell, to: '/settings/notifications' },
    ],
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

const CrumbLink = (p: { to: string; className?: string; title?: string; children?: ReactNode }) => (
  <Link {...p} />
);

/** Colonne de navigation des Paramètres (NAV-02), aussi page d'accueil des Paramètres sous 768 px. */
function SettingsNav() {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  return (
    <nav className="st-nav" aria-label={t('settings.sections')}>
      {GROUPS.map((g) => (
        <div
          key={g.key}
          className="st-nav__grp"
          role="group"
          aria-labelledby={`st-g-${g.key}`}
          /* §18.6 : titre de groupe à 6 px de sa première entrée (NAV-02 §11.7.2, mesure de la spec) */
          data-gap-exempt=""
        >
          <p id={`st-g-${g.key}`} className="st-nav__title">
            {t(`settings.grp.${g.key}`)}
          </p>
          {g.entries
            .filter((e) => !e.perm || can(e.perm))
            .map(({ label, icon: Icon, to, soon }) =>
              to ? (
                <NavLink key={label} to={to} end={to === '/settings/brand'} className="st-nav__item">
                  <Icon size={16} aria-hidden="true" />
                  <span>{t(label)}</span>
                  {soon && <span className="st-nav__soon">{t('shell.soon')}</span>}
                </NavLink>
              ) : (
                <span key={label} className="st-nav__item" aria-disabled="true">
                  <Icon size={16} aria-hidden="true" />
                  <span>{t(label)}</span>
                  <span className="st-nav__soon">{t('shell.soon')}</span>
                </span>
              ),
            )}
        </div>
      ))}
    </nav>
  );
}

/**
 * NAV-02 et NAV-03 : cadre des Paramètres. Colonne de navigation pleine hauteur, puis le contenu :
 * PageHeader fixe « {Groupe} › {Page} » (le groupe mène à sa première page) avec les actions de la page,
 * et les sections centrées sur 880 px. Sous 768 px, bouton retour en icône vers /settings.
 */
export function SettingsShell({
  children,
  sub,
  actions,
  actionsNarrow,
  pending,
  pendingActions,
  search,
  legacy = true,
}: {
  children: ReactNode;
  /** L48-F : sous-page d'une entrée (ex. Webhooks) : l'entrée devient un élément du fil, `title` est le h1. */
  sub?: { title: string; trail?: Crumb[] };
  /**
   * SETTINGS-HDR-01 : actions de la page, dans l'en-tête du contenu (plus dans la barre du haut).
   * Ordre de gauche à droite : secondaires, « Annuler », puis l'action principale (une au plus).
   */
  actions?: ReactNode;
  /** Sous 600 px, à la place de `actions` : avec trois boutons ou plus, les secondaires dans un menu ⋯. */
  actionsNarrow?: ReactNode;
  /**
   * Formulaire avec des modifications en attente. Sous 600 px, quand l'en-tête est sorti de l'écran, une
   * barre collée en bas reprend « Annuler » et « Enregistrer » (`pendingActions`, sinon `actions`).
   */
  pending?: boolean;
  pendingActions?: ReactNode;
  /** SETTINGS-HDR-01 : recherche de la page (260 px), à gauche des actions. */
  search?: ReactNode;
  /**
   * Page pas encore passée au gabarit du §11 : son contenu garde les styles hérités (« .mk »).
   * Les pages refaites passent `legacy={false}` (classes « stg- » de settings.css).
   */
  legacy?: boolean;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const here = currentEntry(pathname);
  // Le groupe mène à sa première page (NAV-03 §12.6)
  const first = here && GROUPS.find((g) => g.key === here.group)?.entries.find((e) => e.to)?.to;
  const crumbs: Crumb[] = here && first ? [{ label: t(`settings.grp.${here.group}`), to: first }] : [];
  if (here && sub) crumbs.push({ label: t(here.entry.label), to: here.entry.to! }, ...(sub.trail ?? []));
  const title = sub ? sub.title : here ? t(here.entry.label) : t('settings.title');
  // §6 (retours du 24/11, 2e série) : en-tête de page dans le contenu, h1 de 24 px et description. Quand
  // la première section porte le même titre que la page, son intitulé est celui de la page : il n'est
  // pas répété, et son texte devient la description.
  const wrap = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const sync = () => {
      const head = el.querySelector<HTMLElement>('.stg-sec__head');
      const h2 = head?.querySelector('h2');
      const dup = !!head && !!h2 && h2.textContent?.trim() === title;
      for (const x of el.querySelectorAll('.stg-sec__head[data-page-title]'))
        if (x !== head || !dup) x.removeAttribute('data-page-title');
      if (dup && !head.hasAttribute('data-page-title')) head.setAttribute('data-page-title', '');
      setOwn(dup ? h2.parentElement?.querySelector('p')?.textContent?.trim() || null : null);
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [title]);
  // SETTINGS-HDR-01 §3 : sous 600 px, la barre collée en bas n'existe que si des modifications sont en
  // attente et que les actions de l'en-tête ne sont plus à l'écran
  const narrow = useMediaQuery('(max-width: 599px)');
  const acts = useRef<HTMLDivElement>(null);
  const [actsSeen, setActsSeen] = useState(true);
  const watch = narrow && !!pending;
  useEffect(() => {
    const el = acts.current;
    if (!watch || !el) return setActsSeen(true);
    // Plusieurs relevés peuvent arriver ensemble : seul le dernier dit l'état courant
    const io = new IntersectionObserver((es) => setActsSeen(!!es.at(-1)?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);
  const bar = watch && !actsSeen;
  const key = sub ? null : (here?.entry.to?.replace('/settings/', '').replace('/', '-') ?? null);
  const desc = own ?? (key ? t(`settings.desc.${key}`, { defaultValue: '' }) : '');
  return (
    <div className="st">
      <SettingsNav />
      <div className="st-main">
        <PageHeader
          title={title}
          crumbs={crumbs}
          mobileBack={{ to: '/settings', ariaLabel: t('settings.backTo') }}
          tools={<NotificationBell />}
          labels={{ breadcrumb: t('settings.breadcrumb') }}
          as={CrumbLink}
          headingInPage
        />
        <div
          ref={wrap}
          className={`${legacy ? 'mk st-wrap' : 'st-wrap st-wrap--plain'}${bar ? ' st-wrap--bar' : ''}`}
        >
          {/* SETTINGS-HDR-01 : en-tête compact (titre, sous-titre, recherche et actions à droite) dans
              une bande dont le filet va d'un bord à l'autre de la colonne de contenu */}
          <header className="stg-page">
            <div className="stg-page__txt">
              <h1>{title}</h1>
              {desc && <p>{desc}</p>}
            </div>
            {(search || actions) && (
              <div className="stg-page__acts" ref={acts}>
                {search}
                {(narrow && actionsNarrow) || actions}
              </div>
            )}
          </header>
          {children}
        </div>
        {/* Annoncée une fois, à son apparition : la région de texte existe avant la barre */}
        <p className="sr-only" aria-live="polite">
          {bar ? t('settings.unsaved') : ''}
        </p>
        {bar && (
          <div className="stg-savebar" role="region" aria-label={t('settings.unsaved')}>
            {/* L'annonce est faite par la région de texte ci-dessus : celui-ci n'est pas relu */}
            <p className="stg-savebar__txt" aria-hidden="true">
              {t('settings.unsaved')}
            </p>
            {pendingActions ?? actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * /settings : accueil des Paramètres sous 768 px (maquette lot1-parametres/accueil) ; au-delà, on ouvre
 * Général. PageHeader « Paramètres » sans retour, puis un groupe par liste : lignes de 52 px (icône de
 * 20 px, libellé en 15 px, « Bientôt », chevron) sur la surface, filet entre les lignes, rayon de 12 px.
 */
export function SettingsHome() {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  if (window.matchMedia('(min-width: 768px)').matches) return <Navigate to="/settings/workspace" replace />;
  return (
    <div className="st st--home">
      <div className="st-main">
        <PageHeader
          title={t('settings.title')}
          tools={<NotificationBell />}
          labels={{ breadcrumb: t('settings.breadcrumb') }}
          as={CrumbLink}
        />
        <nav className="st-home" aria-label={t('settings.title')}>
          {GROUPS.map((g) => (
            <section key={g.key} aria-labelledby={`st-h-${g.key}`}>
              <h2 id={`st-h-${g.key}`}>{t(`settings.grp.${g.key}`)}</h2>
              {/* §18.6 : lignes à filets, l'écart est porté par leur hauteur de 52 px */}
              <ul data-gap-exempt="">
                {g.entries
                  .filter((e) => !e.perm || can(e.perm))
                  .map(({ label, icon: Icon, to, soon }) => {
                    const inner = (
                      <>
                        <Icon size={20} aria-hidden="true" />
                        <span className="st-home__label">{t(label)}</span>
                        {(soon || !to) && <span className="stg-soon">{t('shell.soon')}</span>}
                        {/* Entrée sans page : ni chevron ni survol (décision UX du 22/11) */}
                        {to && <ChevronRight size={16} aria-hidden="true" />}
                      </>
                    );
                    return (
                      <li key={label}>
                        {to ? (
                          <Link to={to} className="st-home__row">
                            {inner}
                          </Link>
                        ) : (
                          <span className="st-home__row" aria-disabled="true">
                            {inner}
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </div>
  );
}
