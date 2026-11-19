/**
 * L26-10 : appairage du téléphone (QR code, adresse courte, code à 8 chiffres) ; L26-12 : bilan de fin.
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Flag, RefreshCw, Smartphone, X } from 'lucide-react';
import { encode } from 'uqr';
import { clock, spoken, type ReportRow } from './present';
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

export function ReportDialog({
  seconds,
  targetMin,
  rows,
  notesChanged,
  onClose,
  onEditor,
}: {
  seconds: number;
  targetMin: number | null;
  rows: ReportRow[];
  notesChanged: number;
  onClose: () => void;
  onEditor: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const max = Math.max(1, ...rows.map((r) => r.seconds));
  return (
    <dialog ref={ref} className="dialog lx rp" aria-labelledby={`${id}-t`} onClose={onClose}>
      <header>
        <span className="fd-icon-chip">
          <Flag aria-hidden="true" />
        </span>
        <h2 id={`${id}-t`}>{t('present.reportTitle', { time: spoken(seconds) })}</h2>
      </header>
      <p className="rp-intro">
        {targetMin != null && <>{t('present.reportTarget', { min: targetMin })} </>}
        {t('present.reportIntro')}
      </p>
      <div className="rp-table" role="table" aria-label={t('present.reportTable')}>
        <div role="rowgroup" className="sr-only">
          <div role="row">
            <span role="columnheader">{t('present.step')}</span>
            <span role="columnheader">{t('present.duration')}</span>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((r) => (
            <div role="row" key={`${r.first}-${r.last}`} className={`rp-row${r.longest ? ' is-long' : ''}`}>
              <span role="cell" className="rp-name">
                <span className="rp-n">{r.count > 1 ? `${r.first + 1}–${r.last + 1}` : r.first + 1}</span>
                <span>
                  {r.count > 1
                    ? t('present.reportGroup', { count: r.count })
                    : r.label || t('editor.untitled')}
                  {r.longest && <> · {t('present.reportLongest')}</>}
                </span>
              </span>
              <span role="cell" className="rp-dur">
                <span className="rp-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((r.seconds / max) * 100)}%` }} />
                </span>
                <span className="rp-time">{clock(r.seconds).replace(/^0(\d):/, '$1:')}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="fd-help">{t('present.reportPrivacy')}</p>
      <p className="fd-help">{t('present.reportNotes', { count: notesChanged })}</p>
      <footer>
        <button type="button" className="fd-btn" onClick={onClose}>
          {t('present.reportClose')}
        </button>
        <button type="button" className="fd-btn fd-btn--primary" onClick={onEditor} autoFocus>
          {t('present.reportEditor')}
        </button>
      </footer>
    </dialog>
  );
}
