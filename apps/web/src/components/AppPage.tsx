import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader, type Crumb } from '@flowdsiml/ui';
import { LazyNotificationBell } from './notifications/LazyNotificationBell';

const CrumbLink = (p: { to: string; className?: string; title?: string; children?: ReactNode }) => (
  <Link {...p} />
);

/**
 * PAGE-01 (COMP-01 §16.1) : cadre d'une page de la coque. Une seule barre `.fd-page-header` en haut
 * (56 px, collante, filet dessous) avec le titre ou le fil d'Ariane, le statut ou le compte à côté, les
 * actions de la page, puis Aide et Notifications. Le contenu ne répète pas le titre : aucun h1 hors de
 * la barre.
 */
interface HeaderProps {
  title: string;
  crumbs?: Crumb[];
  after?: ReactNode;
  actions?: ReactNode;
  mobileBack?: { to: string; ariaLabel: string };
}

/** La barre seule, pour une page qui compose son cadre (`.pg` puis `.pg-body`) elle-même. */
export function AppPageHeader({ title, crumbs, after, actions, mobileBack }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <PageHeader
      title={title}
      crumbs={crumbs}
      after={after}
      actions={actions}
      mobileBack={mobileBack}
      tools={<LazyNotificationBell />}
      labels={{ breadcrumb: t('folders.breadcrumb') }}
      as={CrumbLink}
    />
  );
}

export function AppPage({
  className,
  children,
  ...header
}: HeaderProps & {
  /** Classes du conteneur du contenu (styles propres à la page). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="pg">
      <AppPageHeader {...header} />
      <div className={`pg-body${className ? ` ${className}` : ''}`}>{children}</div>
    </div>
  );
}
