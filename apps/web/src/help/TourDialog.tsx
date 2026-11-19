/**
 * L26 §3.3 : visite guidée = démo statique embarquée, jouée par le lecteur en aperçu (#/preview : le
 * manifeste est envoyé par l'app, aucune statistique). Modale de 960 px. La fin de la démo (événement
 * « demo_complete » relayé par le lecteur) termine le module.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { PLAYER_URL } from '../lib/env';
import { loadTourManifest } from './tours';

export function TourDialog({
  tourId,
  title,
  onComplete,
  onClose,
}: {
  tourId: string;
  title: string;
  onComplete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const done = useRef(onComplete);
  done.current = onComplete;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  // Le lecteur annonce qu'il est prêt : on lui envoie le manifeste. Messages du lecteur seulement.
  // Écoute posée dès le montage (useLayoutEffect) : l'annonce peut arriver avant un useEffect.
  useLayoutEffect(() => {
    const origin = new URL(PLAYER_URL).origin;
    const manifest = loadTourManifest(tourId);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { type?: string; event?: string } | null;
      if (m?.type === 'fd:preview-ready')
        void manifest.then((mf) =>
          frame.current?.contentWindow?.postMessage({ type: 'fd:preview', manifest: mf }, origin),
        );
      else if (m?.type === 'flowdsiml:event' && m.event === 'demo_complete') done.current?.();
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, [tourId]);
  const name = title || t('help.tour');
  return (
    <dialog ref={ref} className="dialog help-tour-dialog" aria-labelledby="help-tour-t" onClose={onClose}>
      <div className="nd-head">
        <h2 id="help-tour-t">{name}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
          aria-label={t('common.close')}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <iframe
        ref={frame}
        title={name}
        src={`${PLAYER_URL}/#/preview`}
        sandbox="allow-scripts allow-same-origin"
        allow="fullscreen"
      />
    </dialog>
  );
}
