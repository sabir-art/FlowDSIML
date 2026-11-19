import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Repeat, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatNumber } from '../../lib/format';
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

/** Sous ce nombre de récurrents, la phrase d'analyse est omise (spec L26 §5). */
export const RETURNING_SENTENCE_MIN = 20;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** KPI « Visiteurs récurrents » (après « Visiteurs uniques »). */
export function ReturningKpi({ ret }: { ret: Returning | null }) {
  const { t } = useTranslation();
  const off = ret && !ret.enabled;
  return (
    <div className="card kpi">
      <span className="t-caption muted">{t('analytics.ret.kpi')}</span>
      <div className="value">{!ret || off ? '—' : `${pct(ret.visitors, ret.total)}\u00a0%`}</div>
      <span className="t-caption muted">
        {!ret
          ? '\u00a0'
          : !ret.enabled
            ? t('analytics.ret.off')
            : t('analytics.ret.kpiSub', { n: formatNumber(ret.visitors), total: formatNumber(ret.total) })}
      </span>
    </div>
  );
}

/** Carte « Nouveaux et récurrents » (deux barres, définition, « Comment c'est mesuré »). */
export function ReturningCard({ ret, onHow }: { ret: Returning | null; onHow: () => void }) {
  const { t, i18n } = useTranslation();
  if (!ret) return null;
  const gap = ret.gapMinutes === 1440 ? t('analytics.ret.gap24h') : t('analytics.ret.gap30');
  const head = (
    <div className="row between">
      <h2 className="t-h3">{t('analytics.ret.title')}</h2>
      <button type="button" className="link-btn" onClick={onHow}>
        {t('analytics.ret.how')}
      </button>
    </div>
  );
  if (!ret.enabled)
    return (
      <div className="card chart-card an-ret">
        {head}
        <p className="muted">{t('analytics.ret.offBody')}</p>
      </div>
    );
  const fresh = ret.total - ret.visitors;
  const pNew = pct(fresh, ret.total);
  const pRet = ret.total ? 100 - pNew : 0;
  const num = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 }).format(n);
  const top = ret.topDemos
    .map((d) => t('analytics.ret.topItem', { title: d.title, pct: pct(d.returning, d.visitors) }))
    .join(', ');
  return (
    <div className="card chart-card an-ret">
      {head}
      <p className="t-caption muted an-ret-def">{t('analytics.ret.definition', { gap })}</p>
      <div
        className="col an-sources"
        role="img"
        aria-label={t('analytics.ret.summary', {
          fresh: formatNumber(fresh),
          pNew,
          ret: formatNumber(ret.visitors),
          pRet,
        })}
      >
        {(
          [
            ['new', fresh, pNew],
            ['ret', ret.visitors, pRet],
          ] as const
        ).map(([k, n, p]) => (
          <div key={k}>
            <div className="row between t-label">
              <span>{t(`analytics.ret.${k}`)}</span>
              <span className="num">
                {formatNumber(n)} · {p}&nbsp;%
              </span>
            </div>
            <div className={`progress an-progress${k === 'ret' ? ' an-progress-ret' : ''}`}>
              <span style={{ width: `${p}%` }} />
            </div>
          </div>
        ))}
      </div>
      {ret.visitors >= RETURNING_SENTENCE_MIN && ret.avgVisits != null && (
        <p className="t-caption an-ret-sentence">
          {t('analytics.ret.sentence', { avg: num(ret.avgVisits) })}
          {top && ` ${t('analytics.ret.sentenceTop', { list: top })}`}
        </p>
      )}
    </div>
  );
}

/** Badge « Nouveau » ou « Récurrent · visite n° n » (texte, jamais la couleur seule). */
export function VisitBadge({ no }: { no: number | null | undefined }) {
  const { t } = useTranslation();
  if (!no) return null;
  return no >= 2 ? (
    <span className="badge an-visit an-visit-ret">
      <Repeat aria-hidden="true" />
      {t('analytics.ret.badgeRet', { n: no })}
    </span>
  ) : (
    <span className="badge an-visit">{t('analytics.ret.badgeNew')}</span>
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
