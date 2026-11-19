/**
 * L26-02 (§3.3) : visite guidée = démo TutoClick dans le lecteur, en modale de 960 px. Ouverte en aperçu
 * (?preview=1) : aucune statistique. La fin de la démo (événement du lecteur) termine le module.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { PLAYER_URL } from '../lib/env';

export function TourDialog({
  demoId,
  title,
  onComplete,
  onClose,
}: {
  demoId: string;
  title: string;
  onComplete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  // Dernière étape vue : événement « demo_complete » relayé par le lecteur (origine du lecteur seulement)
  useEffect(() => {
    if (!onComplete) return;
    const origin = new URL(PLAYER_URL).origin;
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: string; event?: string } | null;
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      if (m?.type === 'flowdsiml:event' && m.event === 'demo_complete') onComplete();
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, [onComplete]);
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
        src={`${PLAYER_URL}/#/d/${demoId}?preview=1`}
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="fullscreen"
      />
    </dialog>
  );
}
