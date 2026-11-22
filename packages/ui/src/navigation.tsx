import type { ComponentType, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Lien fourni par l'app (ex. `Link` de react-router) : le paquet ui ne dépend d'aucun routeur. */
export type NavLinkComponent = ComponentType<{
  to: string;
  className?: string;
  title?: string;
  'aria-label'?: string;
  children?: ReactNode;
}>;

export interface Crumb {
  label: string;
  to: string;
}

/**
 * NAV-03 §12.3 : bouton retour ghost de 32 px, chevron puis la destination (« Démos », « Paramètres »).
 * Nom accessible « Retour à {destination} ». `iconOnly` : le libellé n'est plus visible (barre mobile).
 */
export function BackButton({
  to,
  label,
  ariaLabel,
  iconOnly,
  className = '',
  as: L,
}: {
  to: string;
  label: string;
  /** Nom accessible complet, ex. « Retour à Paramètres ». */
  ariaLabel: string;
  iconOnly?: boolean;
  className?: string;
  as: NavLinkComponent;
}) {
  return (
    <L
      to={to}
      className={`fd-back${iconOnly ? ' fd-back--icon' : ''} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <ChevronLeft size={16} aria-hidden="true" />
      {!iconOnly && <span>{label}</span>}
    </L>
  );
}

/**
 * NAV-03 §12.2 : fil d'Ariane. Parents en liens gris sans soulignement, chevrons de 14 px,
 * page courante en `<h1 aria-current="page">` (le seul titre de la page).
 */
export function Breadcrumb({
  label,
  crumbs,
  current,
  as: L,
}: {
  /** Nom du repère, « Fil d'Ariane ». */
  label: string;
  crumbs: Crumb[];
  current: string;
  as: NavLinkComponent;
}) {
  return (
    <nav className="fd-crumb" aria-label={label}>
      <ol>
        {crumbs.map((c) => (
          <li key={c.to}>
            <L to={c.to} className="fd-crumb__link" title={c.label}>
              {c.label}
            </L>
            <ChevronRight size={14} aria-hidden="true" className="fd-crumb__sep" />
          </li>
        ))}
        <li>
          <h1 aria-current="page" title={current}>
            {current}
          </h1>
        </li>
      </ol>
    </nav>
  );
}

/**
 * NAV-03 §12.1 : barre fixe de 56 px en haut du contenu. À gauche, le BackButton éventuel puis le fil
 * d'Ariane (ou le titre seul) ; à droite, les actions de la page, puis les outils (Aide, Notifications).
 * Sous 768 px, `mobileBack` (bouton icône) remplace les parents du fil, et la page courante reste le titre.
 */
export function PageHeader({
  title,
  crumbs = [],
  back,
  mobileBack,
  actions,
  tools,
  labels,
  as,
}: {
  title: string;
  crumbs?: Crumb[];
  back?: { to: string; label: string; ariaLabel: string };
  mobileBack?: { to: string; ariaLabel: string };
  actions?: ReactNode;
  /** Outils communs (Aide, Notifications), après un filet ; masqués sous 1 024 px (barre mobile). */
  tools?: ReactNode;
  labels: { breadcrumb: string };
  as: NavLinkComponent;
}) {
  return (
    <header className={`fd-page-header${mobileBack ? ' fd-page-header--mback' : ''}`}>
      {back && <BackButton {...back} as={as} />}
      {mobileBack && (
        <BackButton {...mobileBack} label="" iconOnly className="fd-page-header__mback" as={as} />
      )}
      {crumbs.length ? (
        <Breadcrumb label={labels.breadcrumb} crumbs={crumbs} current={title} as={as} />
      ) : (
        <h1 className="fd-page-header__title">{title}</h1>
      )}
      <div className="fd-page-header__actions">
        {actions}
        {tools && (
          <>
            <span className="fd-page-header__sep" aria-hidden="true" />
            <div className="fd-page-header__tools">{tools}</div>
          </>
        )}
      </div>
    </header>
  );
}
