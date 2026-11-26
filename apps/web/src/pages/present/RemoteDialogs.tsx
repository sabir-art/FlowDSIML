/**
 * L26-10 : appairage du téléphone (QR code, adresse courte, code à 8 chiffres). Le bilan de fin est dans PresentReport (L66).
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, RefreshCw, Smartphone, X } from 'lucide-react';
import { encode } from 'uqr';
import { codeDisplay, codeSpoken, remoteShortUrl } from './remote';

/** QR code en SVG (modules noirs sur fond blanc, marge de 2 modules), nommé pour les lecteurs d'écran. */
export function Qr({ text, label, size = 168 }: { text: string; label: string; size?: number }) {
  const { data, size: n } = useMemo(() => encode(text, { border: 2 }), [text]);
  const path = useMemo(() => {
    let d = '';
    data.forEach((row, y) => row.forEach((on, x) => (on ? (d += `M${x} ${y}h1v1h-1z`) : null)));
    return d;
  }, [data]);
  return (
    <svg className="rm-qr" role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} width={size} height={size}>
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" shapeRendering="crispEdges" />
    </svg>
  );
}

export function RemoteDialog({
  url,
  code,
  paired,
  expired,
  error,
  onNewCode,
  onClose,
}: {
  url: string | null;
  code: string | null;
  paired: boolean;
  expired: boolean;
  error: boolean;
  onNewCode: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="dialog lx rm" aria-labelledby={`${id}-t`} onClose={onClose}>
      <header>
        <span className="fd-icon-chip">
          <Smartphone aria-hidden="true" />
        </span>
        <h2 id={`${id}-t`}>{t('present.remoteTitle')}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
          aria-label={t('common.close')}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      {error ? (
        <div className="fd-alert fd-alert--error" role="alert">
          {t('present.remoteError')}
        </div>
      ) : (
        <div className="rm-body">
          {url && !paired && <Qr text={url} label={t('present.remoteQr')} />}
          <div className="rm-text">
            <p>{t('present.remoteScan', { url: remoteShortUrl() })}</p>
            {code && !paired && !expired && (
              <p className="rm-code" aria-label={t('present.remoteCodeLabel', { spoken: codeSpoken(code) })}>
                {codeDisplay(code)}
              </p>
            )}
            {expired && !paired && (
              <p className="rm-expired">
                {t('present.remoteExpired')}{' '}
                <button type="button" className="fd-btn fd-btn--sm" onClick={onNewCode}>
                  <RefreshCw aria-hidden="true" />
                  {t('present.remoteNewCode')}
                </button>
              </p>
            )}
            <p className="fd-help">{t('present.remoteRules')}</p>
            <p className="fd-help">{t('present.remoteScope')}</p>
          </div>
        </div>
      )}
      <p className={`rm-status${paired ? ' is-on' : ''}`} role="status" aria-live="polite">
        {paired ? <CircleCheck aria-hidden="true" /> : <span className="rm-dot" aria-hidden="true" />}
        {paired ? t('present.remotePaired') : t('present.remoteWaiting')}
      </p>
      <footer>
        <button type="button" className="fd-btn" onClick={() => ref.current?.close()}>
          {t('present.close')}
        </button>
      </footer>
    </dialog>
  );
}
