import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

type Variant = 'default' | 'primary' | 'accent' | 'danger' | 'ghost';

/**
 * Bouton du design system. `icon` : icône Lucide placée avant le libellé.
 * Sans enfant, le bouton devient un bouton-icône carré : fournir alors `aria-label`.
 */
export function Button({
  variant = 'default',
  size,
  icon,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'lg'; icon?: ReactNode }) {
  const iconOnly = icon && (children === undefined || children === null || children === false);
  const cls = [
    'fd-btn',
    variant !== 'default' && `fd-btn--${variant}`,
    size && `fd-btn--${size}`,
    iconOnly && 'fd-btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...props}>
      {icon && (
        <span className="fd-btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

/** Liste déroulante avec chevron dessiné (pas celui du navigateur), espacé de la bordure. */
export function Select({
  inline,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { inline?: boolean }) {
  return (
    <span className={`fd-select-wrap${inline ? ' fd-select-wrap--inline' : ''}`}>
      <select className={`fd-select ${className}`.trim()} {...props}>
        {children}
      </select>
      <ChevronDown className="fd-select-wrap__chevron" size={16} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="fd-field">
      <label className="fd-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`fd-card ${className}`}>{children}</div>;
}

const ALERT_ICONS = { info: Info, error: CircleAlert, success: CircleCheck, warning: TriangleAlert };

/** Message d'état : l'état est porté par une icône Lucide (composants.md), jamais par une barre latérale. */
export function Alert({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'error' | 'success' | 'warning';
  children: ReactNode;
}) {
  const Icon = ALERT_ICONS[kind];
  return (
    <div className={`fd-alert fd-alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div className="fd-alert__body">{children}</div>
    </div>
  );
}

/** Audit L50 X4 : un état dit en texte, avec un point de 8 px (jamais une pastille ni un fond coloré).
 *  Les pastilles restent pour les étiquettes choisies par l'utilisateur. */
export function Status({
  tone = 'neutral',
  size = 'md',
  className = '',
  children,
  ...rest
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
  /** md : 14 px ; sm : 13 px (dans une ligne de texte, un menu ou un libellé). */
  size?: 'md' | 'sm';
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'>) {
  return (
    <span
      className={`fd-status fd-status--${tone}${size === 'sm' ? ' fd-status--sm' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </span>
  );
}

/** Case à cocher alignée sur son libellé (.fd-check). */
export function Checkbox({
  label,
  hint,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`fd-check ${className}`.trim()}>
      <input type="checkbox" {...props} />
      <span>
        {label}
        {hint && <span className="fd-check__hint">{hint}</span>}
      </span>
    </label>
  );
}

/** Interrupteur (réglage appliqué immédiatement) : libellé à gauche, piste 36 × 20 px à droite. */
export function Switch({
  label,
  hint,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`fd-switch ${className}`.trim()}>
      <span className="fd-switch__text">
        {label}
        {hint && <span className="fd-check__hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" {...props} />
      <span className="fd-switch__track" aria-hidden="true" />
    </label>
  );
}

/**
 * L48-B : état vide commun. `page` : liste ou page sans contenu (carte, pastille de 64 px) ;
 * `compact` : widget, panneau, colonne (ligne en pointillés) ; `search` : recherche ou filtres sans
 * résultat (pastille neutre). `live` : role=status, pour un état qui apparaît après un filtre.
 */
export function Empty({
  icon,
  title,
  body,
  action,
  secondary,
  children,
  variant = 'page',
  level = 2,
  live = false,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  /** Contenu supplémentaire sous les actions (ex. tuiles de départ). */
  children?: ReactNode;
  variant?: 'page' | 'compact' | 'search';
  level?: 2 | 3;
  live?: boolean;
  className?: string;
}) {
  const H = level === 3 ? 'h3' : 'h2';
  return (
    <div className={`fd-empty fd-empty--${variant} ${className}`.trim()} role={live ? 'status' : undefined}>
      <span className="fd-empty__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="fd-empty__text">
        <H className="fd-empty__title">{title}</H>
        {body && <p className="fd-empty__body">{body}</p>}
      </div>
      {(action || secondary) && (
        <div className="fd-empty__actions">
          {action}
          {secondary}
        </div>
      )}
      {children}
    </div>
  );
}
