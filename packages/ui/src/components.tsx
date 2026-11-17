import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

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

export function Alert({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'error' | 'success';
  children: ReactNode;
}) {
  return (
    <div className={`fd-alert fd-alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
