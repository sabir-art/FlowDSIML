import type { ReactNode } from 'react';
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
      { label: 'settings.publicPage', icon: Globe, to: '/settings/brand/page', soon: true },
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
      { label: 'settings.keys', icon: KeyRound },
    ],
  },
  {
    key: 'account',
    entries: [
      { label: 'settings.profile', icon: CircleUser, to: '/settings/profile' },
      { label: 'settings.notifications', icon: Bell },
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
        <div key={g.key} className="st-nav__grp" role="group" aria-labelledby={`st-g-${g.key}`}>
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
}: {
  children: ReactNode;
  /** L48-F : sous-page d'une entrée (ex. Webhooks) : l'entrée devient un élément du fil, `title` est le h1. */
  sub?: { title: string; trail?: Crumb[] };
  /** Actions de la page (Annuler, Enregistrer, Inviter…), à droite du PageHeader. */
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const here = currentEntry(pathname);
  // Le groupe mène à sa première page (NAV-03 §12.6)
  const first = here && GROUPS.find((g) => g.key === here.group)?.entries.find((e) => e.to)?.to;
  const crumbs: Crumb[] = here && first ? [{ label: t(`settings.grp.${here.group}`), to: first }] : [];
  if (here && sub) crumbs.push({ label: t(here.entry.label), to: here.entry.to! }, ...(sub.trail ?? []));
  const title = sub ? sub.title : here ? t(here.entry.label) : t('settings.title');
  return (
    <div className="st">
      <SettingsNav />
      <div className="st-main">
        <PageHeader
          title={title}
          crumbs={crumbs}
          mobileBack={{ to: '/settings', ariaLabel: t('settings.backTo') }}
          actions={actions}
          tools={<NotificationBell />}
          labels={{ breadcrumb: t('settings.breadcrumb') }}
          as={CrumbLink}
        />
        <div className="mk st-wrap">{children}</div>
      </div>
    </div>
  );
}

/** /settings : la navigation sert de page d'accueil sous 768 px ; au-delà, on ouvre Général. */
export function SettingsHome() {
  const { t } = useTranslation();
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
        <SettingsNav />
      </div>
    </div>
  );
}
