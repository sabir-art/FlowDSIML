import type { ReactNode } from 'react';

/** En-tête de section du panneau (refonte DSI §6) : puce d'icône + titre h2. */
export function PanelTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="panel-head">
      <span className="fd-icon-chip" aria-hidden="true">
        {icon}
      </span>
      <h2 className="panel-title">{children}</h2>
    </div>
  );
}
