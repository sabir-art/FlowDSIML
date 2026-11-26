/**
 * L22-02 et L66 §1 : fenêtre « Présenter » (gabarit MODAL-01, taille md). Affichage en 2 cartes radio
 * avec un schéma et une phrase ; Commencer à et Minuteur sur une ligne ; options en lignes ; historique
 * des présentations en lien du pied. L'écran public s'ouvre dans le geste du clic (sinon le navigateur le
 * bloque).
 */
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, History, Play, Presentation, RefreshCw } from 'lucide-react';
import { Button, Modal, Select } from '@flowdsiml/ui';
import { DEFAULT_PRESENT, screenUrl, toSearch, type PresentOptions } from './present';
import { HistoryDialog, usePresentHistory } from './PresentReport';
import './present.css';

/** Choix du minuteur (minutes) ; « Autre… » permet une saisie libre. */
export const TIMER_CHOICES = [5, 10, 15, 20, 30, 45, 60];

/** Schéma d'un affichage (SVG aux couleurs des jetons, décoratif : la phrase porte le sens). */
function Schema({ mode }: { mode: 'two' | 'one' }) {
  const { t } = useTranslation();
  const screen = (x: number, w: number, notes: boolean, dashed = false) => (
    <g>
      <rect x={x} y={14} width={w} height={62} rx={4} className="lx-sc" />
      <rect x={x + 6} y={22} width={notes ? w * 0.55 : w - 12} height={40} rx={2} className="lx-demo" />
      <rect x={x + 10} y={28} width={(notes ? w * 0.55 : w - 12) - 8} height={4} rx={1} className="lx-bar" />
      <circle cx={x + (notes ? w * 0.4 : w * 0.7)} cy={50} r={3} className="lx-hot" />
      {notes && (
        <g className={dashed ? 'lx-notes is-dashed' : 'lx-notes'}>
          <rect x={x + w * 0.55 + 10} y={22} width={w * 0.45 - 16} height={40} rx={2} />
          <line x1={x + w * 0.55 + 14} y1={30} x2={x + w - 10} y2={30} />
          <line x1={x + w * 0.55 + 14} y1={37} x2={x + w - 14} y2={37} />
        </g>
      )}
    </g>
  );
  return (
    <svg className="lx-schema" viewBox="0 0 240 96" aria-hidden="true">
      {mode === 'two' ? (
        <>
          {screen(10, 96, true)}
          <path d="M112 45h14m-4-4 4 4-4 4" className="lx-arrow" />
          {screen(132, 98, false)}
          <text x={58} y={90} className="lx-cap">
            {t('present.schemaYou')}
          </text>
          <text x={181} y={90} className="lx-cap">
            {t('present.schemaPublic')}
          </text>
        </>
      ) : (
        <>
          {screen(50, 140, true, true)}
          <text x={202} y={30} className="lx-key">
            N
          </text>
          <text x={120} y={90} className="lx-cap">
            {t('present.schemaOne')}
          </text>
        </>
      )}
    </svg>
  );
}

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
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [o, setO] = useState<PresentOptions>(DEFAULT_PRESENT);
  const [blocked, setBlocked] = useState(false);
  // Minuteur : un choix de la liste, sinon « Autre… » et une durée saisie
  const [other, setOther] = useState(false);
  const history = usePresentHistory(demoId);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (!open) onClose();
  }, [open, onClose]);

  const launch = () => {
    if (o.mode === 'two') {
      const w = window.open(screenUrl(demoId), `fd-present-${demoId}`, 'popup,width=1280,height=800');
      if (!w) {
        setBlocked(true);
        return;
      }
    }
    setOpen(false);
    navigate(`/demos/${demoId}/present${toSearch(o)}`);
  };
  const timerValue = !o.timer
    ? 'off'
    : other || !TIMER_CHOICES.includes(o.minutes)
      ? 'other'
      : String(o.minutes);

  if (showHistory)
    return (
      <HistoryDialog demoTitle={title} reports={history.reports} onClose={() => setShowHistory(false)} />
    );

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      size="md"
      icon={<Presentation />}
      title={t('present.title', { title })}
      closeLabel={t('common.close')}
      className="lxm"
      footerLead={
        <button type="button" className="link-button lx-history" onClick={() => setShowHistory(true)}>
          <History aria-hidden="true" />
          {t('present.history', { count: history.reports.length })}
        </button>
      }
      footer={
        <>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            icon={blocked ? <RefreshCw size={16} /> : <Play size={16} />}
            onClick={launch}
          >
            {t(blocked ? 'present.retry' : 'present.launch')}
          </Button>
        </>
      }
    >
      <div className="lx-body">
        <div className="lx-sec">
          <span className="fd-label" id={`${id}-d`}>
            {t('present.display')}
          </span>
          <div className="lx-cards" role="radiogroup" aria-labelledby={`${id}-d`}>
            {(['two', 'one'] as const).map((m) => (
              <label key={m} className={`lx-card${o.mode === m ? ' is-on' : ''}`}>
                <span className="lx-art">
                  <Schema mode={m} />
                </span>
                <span className="lx-choice">
                  <input
                    type="radio"
                    name={`${id}-mode`}
                    checked={o.mode === m}
                    aria-describedby={`${id}-${m}`}
                    onChange={() => {
                      setO({ ...o, mode: m });
                      setBlocked(false);
                    }}
                  />
                  <b>{t(`present.mode_${m}`)}</b>
                </span>
                <small id={`${id}-${m}`}>{t(`present.mode_${m}_help`)}</small>
              </label>
            ))}
          </div>
          {o.mode === 'two' && !blocked && <p className="fd-help lx-proj">{t('present.projectorHelp')}</p>}
          {blocked && (
            <p className="fd-error lx-blocked" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              {t('present.blocked')}
            </p>
          )}
        </div>
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
            <label className="fd-label" htmlFor={`${id}-tm`}>
              {t('present.timer')}
            </label>
            <Select
              id={`${id}-tm`}
              value={timerValue}
              onChange={(e) => {
                const v = e.target.value;
                setOther(v === 'other');
                if (v === 'off') setO({ ...o, timer: false });
                else if (v === 'other') setO({ ...o, timer: true });
                else setO({ ...o, timer: true, minutes: Number(v) });
              }}
            >
              <option value="off">{t('present.timerOff')}</option>
              {TIMER_CHOICES.map((m) => (
                <option key={m} value={String(m)}>
                  {t('present.timerMin', { n: m })}
                </option>
              ))}
              <option value="other">{t('present.timerOther')}</option>
            </Select>
            {timerValue === 'other' && (
              <input
                className="fd-input lx-custom"
                type="number"
                min={1}
                max={180}
                value={o.minutes}
                aria-label={t('present.targetMinutes')}
                onChange={(e) =>
                  setO({ ...o, minutes: Math.min(180, Math.max(1, Number(e.target.value) || 1)) })
                }
              />
            )}
          </div>
        </div>
        <ul className="lx-opts">
          {(
            [
              ['hideHotspots', 'present.hide', 'present.hideHelp'],
              ['remote', 'present.remoteOption', 'present.remoteOptionHelp'],
            ] as const
          ).map(([k, label, help]) => (
            <li key={k}>
              <span className="lx-opt-tx">
                <span id={`${id}-${k}`}>{t(label)}</span>
                <small id={`${id}-${k}-h`}>{t(help)}</small>
              </span>
              <label className="fd-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={o[k]}
                  aria-labelledby={`${id}-${k}`}
                  aria-describedby={`${id}-${k}-h`}
                  onChange={(e) => setO({ ...o, [k]: e.target.checked })}
                />
                <span className="fd-switch__track" aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
