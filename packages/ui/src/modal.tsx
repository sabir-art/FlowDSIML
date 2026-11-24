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
  subtitle,
  footerLead,
  size = 'sm',
  tone = 'default',
  footer,
  closeLabel,
  className = '',
  dismissible = true,
  onDismiss,
  role,
  describedBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Icône Lucide de 18 px, dans la tuile de l'en-tête. */
  icon: ReactNode;
  title: string;
  /** Ligne de 13 px sous le titre (ex. « Étape 1 sur 2 · Type de contenu ») ; elle complète le nom de la modale. */
  subtitle?: ReactNode;
  /** Texte d'aide à gauche du pied (12 px), masqué sous 480 px. */
  footerLead?: ReactNode;
  /** sm = 400 px, md = 560 px, lg = 720 px, xl = 960 px ; plein écran sous 480 px. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `danger` : tuile en rouge (suppression). `success` : tuile en vert, réservée aux fenêtres qui
   * confirment une création réussie (MODAL-01). */
  tone?: 'default' | 'danger' | 'success';
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
  /**
   * Fermeture à confirmer (ex. envoi en cours) : Échap, le voile et le bouton Fermer appellent cette
   * fonction au lieu de fermer ; l'appelant ferme lui-même en passant `open` à `false`.
   */
  onDismiss?: () => void;
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
      className={`fd-modal fd-modal--${size}${tone === 'default' ? '' : ` fd-modal--${tone}`} ${className}`.trim()}
      role={role}
      // Fermée, la modale n'a pas de contenu : ses références ARIA ne sont posées qu'à l'ouverture
      aria-labelledby={open ? (subtitle ? `${id}-t ${id}-s` : `${id}-t`) : undefined}
      aria-describedby={open ? describedBy : undefined}
      onClose={() => {
        // Fermeture à confirmer : si le navigateur ferme quand même (deuxième Échap sans autre geste),
        // la modale se rouvre aussitôt et la confirmation est demandée
        if (onDismiss && open) {
          ref.current?.showModal();
          onDismiss();
        } else onClose();
      }}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
        else if (onDismiss && e.target === ref.current) {
          e.preventDefault();
          onDismiss();
        }
      }}
      onClick={(e) => {
        // Clic sur le voile (la cible est le dialog lui-même) : ferme
        if (dismissible && e.target === ref.current) (onDismiss ?? (() => ref.current?.close()))();
      }}
    >
      {open && (
        <div className="fd-modal__box">
          <div className="fd-modal__head">
            <span className="fd-modal__tile" aria-hidden="true">
              {icon}
            </span>
            {subtitle ? (
              <div className="fd-modal__titles">
                <h2 id={`${id}-t`}>{title}</h2>
                <p className="fd-modal__sub" id={`${id}-s`}>
                  {subtitle}
                </p>
              </div>
            ) : (
              <h2 id={`${id}-t`}>{title}</h2>
            )}
            {dismissible && (
              <button
                type="button"
                className="fd-modal__close"
                aria-label={closeLabel}
                onClick={() => (onDismiss ? onDismiss() : ref.current?.close())}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="fd-modal__body">{children}</div>
          {footer ? (
            <div className="fd-modal__foot">
              {footerLead ? <span className="fd-modal__lead">{footerLead}</span> : null}
              {footer}
            </div>
          ) : null}
        </div>
      )}
    </dialog>
  );
}
