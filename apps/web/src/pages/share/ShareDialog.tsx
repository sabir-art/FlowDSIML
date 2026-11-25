import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SHARE_MODES, SharePanel, type ShareMode, type ShareView } from './SharePage';
import './share-dialog.css';

const isView = (v: string | null): v is ShareView =>
  v === 'menu' || (SHARE_MODES as readonly string[]).includes(v ?? '');
/** Sous 640 px, la fenêtre est une feuille plein écran : la liste des modes d'abord. */
const narrow = () => window.matchMedia('(max-width: 639px)').matches;

/** Adresse qui ouvre la fenêtre Partager au-dessus de l'éditeur d'une démo. */
export const shareUrl = (demoId: string, mode: ShareMode = 'lien', extra = '') =>
  `/demos/${demoId}/edit?share=${mode}${extra}`;

/**
 * Ouverture de la fenêtre Partager sur la vue courante d'une démo (éditeur, Analytics, Leads,
 * Visiteurs) : l'état est dans l'adresse (`?share=lien`, `integrer`, `perso`, `acces`, `exporter`), pour
 * un lien direct. `open()` est à brancher sur le bouton « Partager ».
 */
export function useShareWindow() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('share');
  const view: ShareView | null = isView(raw) ? raw : raw !== null ? 'lien' : null;
  const set = (v: ShareView | null, replace = true) => {
    const next = new URLSearchParams(params);
    if (v) next.set('share', v);
    else {
      next.delete('share');
      next.delete('published');
    }
    setParams(next, { replace });
  };
  return {
    view,
    justPublished: params.get('published') === '1',
    open: () => set(narrow() ? 'menu' : 'lien', false),
    setView: (v: ShareView) => set(v),
    close: () => set(null),
  };
}

/**
 * Retours du 24/11 (2e série) §1 : Partager en fenêtre, au-dessus de la démo. `<dialog>` modal (focus
 * piégé, Échap, clic sur le voile) de 960 × 640 px ; feuille plein écran sous 640 px. À la fermeture, le
 * focus revient au bouton « Partager ».
 */
export function ShareDialog({
  demoId,
  view,
  onView,
  onClose,
  onPublish,
  justPublished,
}: {
  demoId: string;
  view: ShareView;
  onView: (v: ShareView) => void;
  onClose: () => void;
  onPublish?: () => void;
  justPublished?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    return () => {
      if (d.open) d.close();
      // Le focus revient au bouton « Partager » (ou à l'élément qui a ouvert la fenêtre)
      const back = opener?.isConnected ? opener : document.querySelector<HTMLElement>('[data-share-open]');
      back?.focus();
    };
  }, []);
  // Le titre du mode prend le focus quand on change de mode (lecteurs d'écran, feuille mobile)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.querySelector<HTMLElement>(view === 'menu' ? '.shd-nav__item' : '#shd-mode')?.focus();
  }, [view]);
  return (
    <dialog
      ref={ref}
      className="fd-modal shd-dialog"
      aria-labelledby="shd-title"
      onCancel={(e) => {
        // Échap dans une fenêtre ouverte par-dessus (confirmation, export) la ferme, elle seule
        if (e.target !== ref.current) return;
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <SharePanel
        demoId={demoId}
        view={view}
        onView={onView}
        onClose={onClose}
        onPublish={
          onPublish ??
          (() => {
            navigate(`/demos/${demoId}/edit`, { state: { publish: true } });
          })
        }
        justPublished={justPublished}
      />
    </dialog>
  );
}
