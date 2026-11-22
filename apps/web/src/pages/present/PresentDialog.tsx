/**
 * L22-02 : modale « Présenter » (affichage, étape de départ, minuteur, points chauds masqués).
 * L'écran public s'ouvre dans le geste du clic (sinon le navigateur le bloque).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Play, Presentation, RefreshCw, X } from 'lucide-react';
import { DEFAULT_PRESENT, screenUrl, toSearch, type PresentOptions } from './present';
import './present.css';
import { Select } from '@flowdsiml/ui';

export function PresentDialog({
  demoId,
  title,
  steps,
  onClose,
}: {
  demoId: string;
  title: string;
  steps: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const [o, setO] = useState<PresentOptions>(DEFAULT_PRESENT);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const launch = () => {
    if (o.mode === 'two') {
      const w = window.open(screenUrl(demoId), `fd-present-${demoId}`, 'popup,width=1280,height=800');
      if (!w) {
        setBlocked(true);
        return;
      }
    }
    ref.current?.close();
    navigate(`/demos/${demoId}/present${toSearch(o)}`);
  };

  return (
    <dialog ref={ref} className="dialog lx" aria-labelledby={`${id}-t`} onClose={onClose}>
      <header>
        <span className="fd-icon-chip">
          <Presentation aria-hidden="true" />
        </span>
        <h2 id={`${id}-t`}>{t('present.title', { title })}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
          aria-label={t('common.close')}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <fieldset className="lx-fs">
        <legend className="fd-label">{t('present.display')}</legend>
        <div className="lx-modes">
          {(['two', 'one'] as const).map((m) => (
            <label key={m}>
              <input
                type="radio"
                name={`${id}-mode`}
                checked={o.mode === m}
                onChange={() => {
                  setO({ ...o, mode: m });
                  setBlocked(false);
                }}
              />
              <span className="ill" aria-hidden="true">
                <i className="n" />
                {m === 'two' && <i />}
              </span>
              <b>{t(`present.mode_${m}`)}</b>
              <small>{t(`present.mode_${m}_help`)}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="lx-row">
        <div className="fd-field">
          <label className="fd-label" htmlFor={`${id}-s`}>
            {t('present.start')}
          </label>
          <Select
            id={`${id}-s`}
            value={o.start}
            onChange={(e) => setO({ ...o, start: Number(e.target.value) })}
          >
            {steps.map((s, i) => (
              <option key={i} value={i}>
                {t('present.stepOption', { n: i + 1, title: s || t('editor.untitled') })}
              </option>
            ))}
          </Select>
        </div>
        <div className="fd-field">
          <span className="fd-label" id={`${id}-tl`}>
            {t('present.timer')}
          </span>
          <div className="lx-time" role="group" aria-labelledby={`${id}-tl`}>
            <label className="fd-switch">
              <input
                type="checkbox"
                role="switch"
                checked={o.timer}
                aria-label={t('present.target')}
                onChange={(e) => setO({ ...o, timer: e.target.checked })}
              />
              <span className="fd-switch__track" aria-hidden="true" />
            </label>
            <input
              className="fd-input"
              type="number"
              min={1}
              max={180}
              value={o.minutes}
              disabled={!o.timer}
              aria-label={t('present.targetMinutes')}
              onChange={(e) =>
                setO({ ...o, minutes: Math.min(180, Math.max(1, Number(e.target.value) || 1)) })
              }
            />
            <span className="fd-help">{t('present.min')}</span>
          </div>
        </div>
      </div>
      <label className="fd-switch">
        <span>
          {t('present.hide')}
          <span className="fd-help lx-help">{t('present.hideHelp')}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={o.hideHotspots}
          onChange={(e) => setO({ ...o, hideHotspots: e.target.checked })}
        />
        <span className="fd-switch__track" aria-hidden="true" />
      </label>
      {/* L26-10 : télécommande sur téléphone (appairage à l'ouverture de la vue présentateur) */}
      <label className="fd-switch">
        <span>
          {t('present.remoteOption')}
          <span className="fd-help lx-help">{t('present.remoteOptionHelp')}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={o.remote}
          onChange={(e) => setO({ ...o, remote: e.target.checked })}
        />
        <span className="fd-switch__track" aria-hidden="true" />
      </label>
      {blocked ? (
        <div className="fd-alert fd-alert--error" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>{t('present.blocked')}</div>
        </div>
      ) : (
        <div className="fd-alert lx-info">
          <Presentation aria-hidden="true" />
          <div>{t(o.mode === 'two' ? 'present.info_two' : 'present.info_one')}</div>
        </div>
      )}
      <footer>
        <button type="button" className="fd-btn" onClick={() => ref.current?.close()}>
          {t('common.cancel')}
        </button>
        <button type="button" className="fd-btn fd-btn--primary" onClick={launch}>
          {blocked ? <RefreshCw aria-hidden="true" /> : <Play aria-hidden="true" />}
          {t(blocked ? 'present.retry' : 'present.launch')}
        </button>
      </footer>
    </dialog>
  );
}
