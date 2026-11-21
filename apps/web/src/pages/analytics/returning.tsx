import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, ShieldCheck, X } from 'lucide-react';
import { Status } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';

/** L26-06 : agrégats « visiteurs récurrents » (workspace_returning). */
export type Returning =
  | { enabled: false; gapMinutes: number }
  | {
      enabled: true;
      gapMinutes: number;
      total: number;
      visitors: number;
      avgVisits: number | null;
      topDemos: Array<{ demoId: string; title: string; visitors: number; returning: number }>;
    };

/** « Nouveau » ou « Récurrent · visite n° n » : état en texte avec un point (audit L50 X4). */
export function VisitBadge({ no }: { no: number | null | undefined }) {
  const { t } = useTranslation();
  if (!no) return null;
  return no >= 2 ? (
    <Status size="sm" tone="brand" className="an-visit an-visit-ret">
      {t('analytics.ret.badgeRet', { n: no })}
    </Status>
  ) : (
    <Status size="sm" className="an-visit">
      {t('analytics.ret.badgeNew')}
    </Status>
  );
}

/**
 * L26-08 : modale « Mesure des visites ». Réglage réservé aux propriétaires et administrateurs ;
 * les autres rôles lisent l'explication sans pouvoir modifier.
 */
export function MeasureDialog({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { t } = useTranslation();
  const { current, can, reload } = useWorkspace();
  const toast = useToast();
  const editable = can('workspace.settings');
  const ws = current!;
  const [on, setOn] = useState(ws.visit_measure !== false);
  const [gap, setGap] = useState<30 | 1440>(ws.visit_gap_minutes === 1440 ? 1440 : 30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('workspaces')
      .update({ visit_measure: on, visit_gap_minutes: gap })
      .eq('id', ws.id);
    setBusy(false);
    if (error) return setErr(true);
    await reload();
    toast(t('analytics.ret.saved'));
    onSaved?.();
    onClose();
  };
  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal an-measure" role="dialog" aria-modal="true" aria-labelledby="an-measure-t">
          <div className="modal-head">
            <h2 id="an-measure-t">{t('analytics.ret.measureTitle')}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">
            <div className="setting">
              <div>
                <b id="an-measure-sw">{t('analytics.ret.switch')}</b>
                <p className="t-caption muted" id="an-measure-help">
                  {t('analytics.ret.switchHelp')}
                </p>
              </div>
              <span className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-labelledby="an-measure-sw"
                  aria-describedby="an-measure-help"
                  checked={on}
                  disabled={!editable}
                  onChange={(e) => setOn(e.target.checked)}
                />
                <span />
              </span>
            </div>
            <fieldset className="an-measure-gap" disabled={!editable || !on}>
              <legend className="t-label">{t('analytics.ret.gapLabel')}</legend>
              <label className="radio">
                <input type="radio" name="an-gap" checked={gap === 30} onChange={() => setGap(30)} />
                {t('analytics.ret.gap30Default')}
              </label>
              <label className="radio">
                <input type="radio" name="an-gap" checked={gap === 1440} onChange={() => setGap(1440)} />
                {t('analytics.ret.gap24h')}
              </label>
              <p className="help">{t('analytics.ret.gapHelp')}</p>
            </fieldset>
            <div className="alert">
              <ShieldCheck aria-hidden="true" />
              <span className="t-caption">{t('analytics.ret.cnil')}</span>
            </div>
            <p className="t-caption muted">{t('analytics.ret.playerNote')}</p>
            <p className="t-caption muted">{t('analytics.ret.offNote')}</p>
            {!editable && <p className="help">{t('analytics.ret.adminOnly')}</p>}
            {err && (
              <p className="error-msg" role="alert">
                <CircleAlert aria-hidden="true" />
                {t('analytics.ret.saveError')}
              </p>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {editable ? t('common.cancel') : t('common.close')}
            </button>
            {editable && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
                {t('common.save')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
