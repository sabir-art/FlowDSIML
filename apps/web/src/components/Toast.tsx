import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motionMs, useFlip } from '../lib/flip';
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
type Toast = {
  id: number;
  text: string;
  detail?: string;
  action?: ToastAction;
  tone?: 'warning';
  /** Délai avant fermeture ; absent : le toast reste jusqu'à sa fermeture (action sans durée). */
  ms?: number;
  /** En train de sortir (fondu de 160 ms), avant d'être retiré. */
  leaving?: boolean;
};
/** Affiche un toast ; renvoie de quoi le fermer avant son délai (consigne devenue inutile, A8). */
const Ctx = createContext<(text: string, action?: ToastAction, opts?: ToastOptions) => () => void>(
  () => () => {},
);

/** Durée d'affichage d'un toast (CAD-08 : 4 s ; avertissement : 6 s). */
const DURATION = 4000;
const DURATION_WARNING = 6000;

/**
 * CAD-08 (révisé le 25/11, décision du client) : toasts en bas au milieu, à 24 px du bas (16 px sous
 * 600 px, et 16 px au-dessus de la barre « Modifications non enregistrées » quand elle est là), 420 px
 * au plus. Icône, texte, « Fermer ». Trois au plus, le plus récent en bas. Fermeture après 4 s,
 * suspendue tant que la souris ou le focus est sur la pile. Annoncés aux lecteurs d'écran (role=status).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  // MOTION-01 : quand un toast entre ou sort, les autres rejoignent leur place en glissant (FLIP)
  const stack = useRef<HTMLDivElement>(null);
  useFlip(stack, toasts.map((x) => x.id).join(), 'viewport');
  // Sortie : fondu de 160 ms (120 ms en mouvement réduit), puis le toast est retiré
  const close = useCallback((id: number) => {
    setToasts((l) => l.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(
      () => setToasts((l) => l.filter((x) => x.id !== id)),
      motionMs('--fd-motion-duration-exit'),
    );
  }, []);
  // Délais de fermeture : suspendus (et repris en entier) tant que la souris ou le focus est sur la pile
  const timers = useRef(new Map<number, number>());
  const held = useRef(false);
  const arm = useCallback(
    (x: Pick<Toast, 'id' | 'ms'>) => {
      if (!x.ms || held.current) return;
      window.clearTimeout(timers.current.get(x.id));
      timers.current.set(
        x.id,
        window.setTimeout(() => {
          timers.current.delete(x.id);
          close(x.id);
        }, x.ms),
      );
    },
    [close],
  );
  const latest = useRef<Toast[]>([]);
  latest.current = toasts;
  const hold = (on: boolean) => {
    if (held.current === on) return;
    held.current = on;
    if (on) {
      for (const id of timers.current.values()) window.clearTimeout(id);
      timers.current.clear();
    } else for (const x of latest.current) if (!x.leaving) arm(x);
  };
  const show = useCallback(
    (text: string, action?: ToastAction, opts?: ToastOptions) => {
      const id = ++seq.current;
      const ms =
        !action || action.durationMs
          ? (action?.durationMs ?? (opts?.tone === 'warning' ? DURATION_WARNING : DURATION))
          : undefined;
      // Le plus récent en bas ; trois au plus
      setToasts((l) => [...l.slice(-2), { id, text, detail: opts?.detail, action, tone: opts?.tone, ms }]);
      arm({ id, ms });
      return () => close(id);
    },
    [close, arm],
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
        <div
          className="toasts"
          role="status"
          aria-live="polite"
          ref={stack}
          onMouseEnter={() => hold(true)}
          onMouseLeave={() => hold(false)}
          onFocus={() => hold(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) hold(false);
          }}
        >
          {toasts.map((x) => (
            <div
              key={x.id}
              data-flip={x.id}
              className={`toast${x.tone === 'warning' ? ' toast--warning' : ''}${x.detail ? ' toast--rich' : ''}${x.leaving ? ' toast--leaving' : ''}`}
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
