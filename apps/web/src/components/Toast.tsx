import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../styles/maquette.css';
import '../styles/maquette-ajouts.css';
import '../styles/maquette-peau.css';

/** L16 : action facultative (ex. « Télécharger ») ; un toast avec action reste jusqu'à sa fermeture. */
export type ToastAction = {
  label: string;
  onClick: () => void;
  /** L18 : action limitée dans le temps (ex. « Annuler » pendant 8 s) : le toast se ferme seul. */
  durationMs?: number;
};
/** REV-07 : variante « avertissement » (icône et couleur d'alerte, affichée plus longtemps). */
export type ToastOptions = { tone?: 'warning' };
type Toast = { id: number; text: string; action?: ToastAction; tone?: 'warning' };
/** Affiche un toast ; renvoie de quoi le fermer avant son délai (consigne devenue inutile, A8). */
const Ctx = createContext<(text: string, action?: ToastAction, opts?: ToastOptions) => () => void>(
  () => () => {},
);

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
    (text: string, action?: ToastAction, opts?: ToastOptions) => {
      const id = ++seq.current;
      setToasts((l) => [...l.slice(-2), { id, text, action, tone: opts?.tone }]);
      if (!action || action.durationMs)
        window.setTimeout(
          () => close(id),
          action?.durationMs ?? (opts?.tone === 'warning' ? 8000 : DURATION),
        );
      return () => close(id);
    },
    [close],
  );
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="mk mk-toasts">
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((x) => (
            <div key={x.id} className={`toast${x.tone === 'warning' ? ' toast--warning' : ''}`}>
              {x.tone === 'warning' ? (
                <TriangleAlert aria-hidden="true" />
              ) : (
                <CircleCheck aria-hidden="true" />
              )}
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
