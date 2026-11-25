import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * ACTION-01 : réglage rare ou avancé en ligne repliable. Un bouton (`aria-expanded`) sur toute la ligne,
 * icône et intitulé à gauche, chevron à droite ; le contenu s'ouvre dessous.
 */
export function Fold({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`shd-fold${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="shd-fold__head"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span>{title}</span>
        <ChevronDown className="shd-fold__chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="shd-fold__body" id={`${id}-body`}>
          {children}
        </div>
      )}
    </div>
  );
}
