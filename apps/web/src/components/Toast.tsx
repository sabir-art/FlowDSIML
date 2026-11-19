import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../styles/maquette.css';
import '../styles/maquette-ajouts.css';
import '../styles/maquette-peau.css';

/** L16 : action facultative (ex. « Télécharger ») ; un toast avec action reste jusqu'à sa fermeture. */
export type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; text: string; action?: ToastAction };
const Ctx = createContext<(text: string, action?: ToastAction) => void>(() => {});

/** Durée d'affichage d'un toast (maquette : 5 s). */
const DURATION = 5000;

/**
 * CAD-08 : toasts de confirmation de la maquette (carte en bas à droite, icône de succès, Fermer,
 * disparition après 5 s, pleine largeur sous 640 px), annoncés aux lecteurs d'écran (role=status).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const close = useCallback((id: number) => setToasts((l) => l.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (text: string, action?: ToastAction) => {
      const id = ++seq.current;
      setToasts((l) => [...l.slice(-2), { id, text, action }]);
      if (!action) window.setTimeout(() => close(id), DURATION);
    },
    [close],
  );
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="mk mk-toasts">
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((x) => (
            <div key={x.id} className="toast">
              <CircleCheck aria-hidden="true" />
              <div className="grow">
                <div className="t-label toast-text">{x.text}</div>
              </div>
              {x.action && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    x.action!.onClick();
                    close(x.id);
                  }}
                >
                  {x.action.label}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon toast-close"
                aria-label={t('common.close')}
                onClick={() => close(x.id)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
