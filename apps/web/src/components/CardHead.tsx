import type { ReactNode } from 'react';

/** En-tête de carte (refonte DSI) : puce d'icône + titre h2, action facultative poussée à droite. */
export function CardHead({
  icon,
  title,
  action,
  tone,
}: {
  icon: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  /** « danger » : puce sur fond danger-soft (zone de danger). */
  tone?: 'danger';
}) {
  return (
    <div className="fd-card__head">
      <span className={`fd-icon-chip${tone === 'danger' ? ' icon-chip--danger' : ''}`} aria-hidden="true">
        {icon}
      </span>
      <h2 className="fd-card__title">{title}</h2>
      {action}
    </div>
  );
}
