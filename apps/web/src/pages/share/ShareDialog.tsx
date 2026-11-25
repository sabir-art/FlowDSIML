import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SHARE_MODES, SharePanel, type ShareMode, type ShareView } from './SharePage';
import { ExportDialog } from '../export/ExportDialog';
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
export function ShareDialog(props: {
  demoId: string;
  view: ShareView;
  onView: (v: ShareView) => void;
  onClose: () => void;
  onPublish?: () => void;
  justPublished?: boolean;
}) {
  // Exporter : la fenêtre d'export REMPLACE la fenêtre Partager (jamais deux fenêtres modales l'une sur
  // l'autre). « ← Partager » y revient, sur le mode Exporter ; Échap ou « Fermer » rend la main à la démo.
  const [exporting, setExporting] = useState<null | 'pdf' | 'gif' | 'mp4'>(null);
  if (exporting)
    return (
      <ExportDialog
        demoId={props.demoId}
        initialFormat={exporting}
        onBack={() => setExporting(null)}
        // Fermeture : on rend la main à la démo. L'état « export » est gardé jusqu'au démontage, sinon la
        // fenêtre Partager réapparaîtrait un instant, le temps que l'adresse perde ?share
        onClose={props.onClose}
      />
    );
  return <ShareWindow {...props} onExport={setExporting} />;
}

function ShareWindow({
  demoId,
  view,
  onView,
  onClose,
  onPublish,
  onExport,
  justPublished,
}: {
  demoId: string;
  view: ShareView;
  onView: (v: ShareView) => void;
  onClose: () => void;
  onPublish?: () => void;
  onExport: (fmt: 'pdf' | 'gif' | 'mp4') => void;
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
      // Le focus revient au bouton « Partager » (ou à l'élément qui a ouvert la fenêtre), une fois la
      // fenêtre retirée de la page : pendant le démontage, le navigateur peut encore le reprendre. Le
      // bouton visé est celui qui est à l'écran à cette largeur (la barre en a un par disposition).
      const shown = (el: HTMLElement | null) => !!el?.isConnected && el.getClientRects().length > 0;
      requestAnimationFrame(() => {
        const back = shown(opener)
          ? opener
          : ([...document.querySelectorAll<HTMLElement>('[data-share-open]')].find(shown) ?? null);
        // Une autre fenêtre a pu s'ouvrir entre-temps (l'export remplace Partager) : on lui laisse le focus
        if (!document.querySelector('dialog[open]')) back?.focus();
      });
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
        onExport={onExport}
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
