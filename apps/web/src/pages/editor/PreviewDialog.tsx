import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Monitor, Smartphone, X } from 'lucide-react';
import type { Manifest } from '@flowdsiml/manifest';
import { Button } from '@flowdsiml/ui';
import { PLAYER_URL } from '../../lib/env';

/**
 * Aperçu intégré (ED12) : le player réel dans une iframe, alimenté par postMessage avec le
 * manifeste brouillon. Message d'erreur si le player ne répond pas en 8 s.
 */
export function PreviewDialog({
  manifest,
  onClose,
  startQuiz = false,
  startStep,
}: {
  /** P1-1 : « Lire depuis ici » ouvre l'aperçu à cette étape (index à partir de 0). */
  startStep?: number;
  manifest: Manifest | null;
  onClose: () => void;
  /** F2 : « Tester le quiz » ouvre l'aperçu directement sur le quiz (tentatives non comptées). */
  startQuiz?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [status, setStatus] = useState<'loading' | 'ready' | 'timeout'>('loading');
  const origin = new URL(PLAYER_URL).origin;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (manifest && !d.open) d.showModal();
    if (!manifest && d.open) d.close();
  }, [manifest]);

  useEffect(() => {
    if (!manifest) return;
    setStatus('loading');
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string })?.type === 'fd:preview-ready') {
        frame.current?.contentWindow?.postMessage(
          { type: 'fd:preview', manifest, startQuiz, startStep },
          origin,
        );
        setStatus('ready');
      }
    };
    addEventListener('message', onMsg);
    const timer = setTimeout(() => setStatus((s) => (s === 'loading' ? 'timeout' : s)), 8000);
    return () => {
      removeEventListener('message', onMsg);
      clearTimeout(timer);
    };
  }, [manifest, origin, device, startQuiz, startStep]);

  return (
    <dialog ref={ref} className="preview-dialog" onClose={onClose} aria-label={t('editor.preview')}>
      <header className="preview-bar" data-tip-side="bottom">
        <strong>{t('editor.preview')}</strong>
        <div className="segmented" role="group" aria-label={t('editor.previewDevice')}>
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
            <Monitor size={15} aria-hidden="true" />
            {t('editor.desktop')}
          </button>
          <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
            <Smartphone size={15} aria-hidden="true" />
            {t('editor.mobile')}
          </button>
        </div>
        <Button variant="ghost" icon={<X />} aria-label={t('common.close')} onClick={onClose} />
      </header>
      <div className="preview-body">
        {status === 'timeout' && (
          <div className="preview-error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <p>{t('editor.previewTimeout')}</p>
            <a className="fd-btn" href={`${PLAYER_URL}/#/preview`} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              {t('editor.previewOpenTab')}
            </a>
          </div>
        )}
        {manifest && (
          <iframe
            key={device}
            ref={frame}
            title={t('editor.preview')}
            src={`${PLAYER_URL}/#/preview`}
            className={`preview-frame preview-${device}`}
          />
        )}
      </div>
    </dialog>
  );
}
