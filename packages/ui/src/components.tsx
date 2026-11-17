import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'danger' | 'ghost';

export function Button({
  variant = 'default',
  size,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' }) {
  const cls = ['fd-btn', variant !== 'default' && `fd-btn--${variant}`, size && `fd-btn--${size}`, className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} {...props} />;
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
