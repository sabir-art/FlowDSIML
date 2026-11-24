import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
export type ToastOptions = {
  tone?: 'warning';
  /** Deuxième ligne, en texte atténué, sous le message en gras (ex. la raison d'un classement). */
  detail?: string;
};
type Toast = { id: number; text: string; detail?: string; action?: ToastAction; tone?: 'warning' };
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
      setToasts((l) => [...l.slice(-2), { id, text, detail: opts?.detail, action, tone: opts?.tone }]);
      if (!action || action.durationMs)
        window.setTimeout(
          () => close(id),
          action?.durationMs ?? (opts?.tone === 'warning' ? 8000 : DURATION),
        );
      return () => close(id);
    },
    [close],
  );
  // Une navigation décidée par la personne (lien de l'application, Précédent ou Suivant du navigateur)
  // ferme les toasts affichés : ils parlent de la page qu'elle quitte. Une redirection qui suit une
  // action (navigate() après une création, un import…) garde son toast : rien n'est fermé ici.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (leavesPage(e, window.location.hash)) setToasts([]);
    };
    const onPop = () => setToasts([]);
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
    };
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="mk mk-toasts">
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((x) => (
            <div
              key={x.id}
              className={`toast${x.tone === 'warning' ? ' toast--warning' : ''}${x.detail ? ' toast--rich' : ''}`}
            >
              {x.tone === 'warning' ? (
                <TriangleAlert aria-hidden="true" />
              ) : (
                <CircleCheck aria-hidden="true" />
              )}
              <div className="grow">
                <div className="t-label toast-text">{x.text}</div>
                {x.detail && <div className="toast-detail">{x.detail}</div>}
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

/**
 * Clic qui mène à une autre page de l'application : lien interne (`#/…`) vers une autre adresse,
 * ouvert dans la même fenêtre, hors de la pile de toasts.
 */
export function leavesPage(
  e: Pick<
    MouseEvent,
    'target' | 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'
  >,
  currentHash: string,
): boolean {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return false;
  const el = e.target instanceof Element ? e.target : null;
  const link = el?.closest('a[href]');
  if (!link || el?.closest('.toasts')) return false;
  const href = link.getAttribute('href') ?? '';
  if (!href.startsWith('#/') || link.getAttribute('target') === '_blank' || link.hasAttribute('download'))
    return false;
  return href !== (currentHash || '#/');
}
