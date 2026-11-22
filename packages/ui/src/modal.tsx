import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * MODAL-01 (composants.md §19) : la seule forme de modale de l'app. En-tête séparé (tuile d'icône de
 * 40 px, titre de 18 px, bouton Fermer), corps (padding et gap de 24 px), pied teinté (nav-bg) avec les
 * boutons à droite. `<dialog>` natif ouvert par showModal() : focus piégé, Échap ferme, le focus revient
 * au déclencheur. À l'ouverture, le focus va au premier champ du corps, sinon au premier bouton du pied
 * (Annuler pour une confirmation).
 */
export function Modal({
  open,
  onClose,
  icon,
  title,
  size = 'sm',
  tone = 'default',
  footer,
  closeLabel,
  className = '',
  dismissible = true,
  role,
  describedBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Icône Lucide de 18 px, dans la tuile de l'en-tête. */
  icon: ReactNode;
  title: string;
  /** sm = 400 px, md = 560 px, lg = 720 px, xl = 960 px ; plein écran sous 480 px. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `danger` : tuile en rouge (suppression). */
  tone?: 'default' | 'danger';
  /** Boutons du pied, alignés à droite : Annuler, puis l'action principale. */
  footer?: ReactNode;
  /** Nom accessible du bouton Fermer (« Fermer »). */
  closeLabel: string;
  className?: string;
  /**
   * `false` : ni bouton Fermer, ni Échap, ni clic sur le voile (ex. secret affiché une seule fois) ;
   * seule une action du pied ferme la modale.
   */
  dismissible?: boolean;
  /** `alertdialog` pour un message qui exige une réponse. */
  role?: 'alertdialog';
  /** Id du texte qui décrit la modale (aria-describedby). */
  describedBy?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      const first =
        d.querySelector<HTMLElement>(
          '.fd-modal__body :is(input, textarea, select, [role="combobox"], [contenteditable="true"]):not(:disabled, [type="hidden"])',
        ) ?? d.querySelector<HTMLElement>('.fd-modal__foot button:not(:disabled)');
      first?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`fd-modal fd-modal--${size}${tone === 'danger' ? ' fd-modal--danger' : ''} ${className}`.trim()}
      role={role}
      aria-labelledby={`${id}-t`}
      aria-describedby={describedBy}
      onClose={onClose}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClick={(e) => {
        // Clic sur le voile (la cible est le dialog lui-même) : ferme
        if (dismissible && e.target === ref.current) ref.current?.close();
      }}
    >
      {open && (
        <div className="fd-modal__box">
          <div className="fd-modal__head">
            <span className="fd-modal__tile" aria-hidden="true">
              {icon}
            </span>
            <h2 id={`${id}-t`}>{title}</h2>
            {dismissible && (
              <button
                type="button"
                className="fd-modal__close"
                aria-label={closeLabel}
                onClick={() => ref.current?.close()}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="fd-modal__body">{children}</div>
          {footer ? <div className="fd-modal__foot">{footer}</div> : null}
        </div>
      )}
    </dialog>
  );
}
