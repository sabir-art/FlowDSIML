/**
 * L66 §3 : bilan « Présentation terminée » et historique des présentations. Un bilan par présentation
 * (present_reports), gardé 90 jours, visible par la seule personne qui a présenté ; aucune donnée du
 * public.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, History } from 'lucide-react';
import { Button, Modal } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { clock, spoken, verdictOf } from './present';

export interface PresentReportRow {
  id: string;
  started_at: string;
  duration_s: number;
  target_min: number | null;
  mode: string | null;
  notes_changed: number;
  steps: Array<{ index: number; title?: string; seconds: number; noted?: boolean }>;
}

/** Bilans de cette démo par la personne connectée, du plus récent au plus ancien (90 jours). */
export function usePresentHistory(demoId: string) {
  const [reports, setReports] = useState<PresentReportRow[]>([]);
  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('present_reports')
      .select('id, started_at, duration_s, target_min, mode, notes_changed, steps')
      .eq('demo_id', demoId)
      .order('started_at', { ascending: false })
      .limit(20);
    setReports((data ?? []) as unknown as PresentReportRow[]);
  }, [demoId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { reports, reload };
}

/** « 12 min 40 » ; « 45 s » sous la minute. */
const minSec = (s: number) => (s < 60 ? `${Math.max(0, Math.round(s))} s` : spoken(s));
/** « 6:10 » (sans zéro de tête). */
const mss = (s: number) => clock(s).replace(/^0(\d):/, '$1:');

function useWhen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  return (iso: string) => {
    const d = new Date(iso);
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
    if (diff === 0) return t('present.today', { time });
    if (diff === 1) return t('present.yesterday', { time });
    return `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d)}, ${time}`;
  };
}

/** Tableau des présentations : date, durée, étapes, « Voir ». La présentation en cours est marquée. */
function HistoryTable({
  reports,
  current,
  onView,
}: {
  reports: PresentReportRow[];
  current?: string;
  onView: (r: PresentReportRow) => void;
}) {
  const { t } = useTranslation();
  const when = useWhen();
  if (!reports.length) return <p className="fd-help">{t('present.historyNone')}</p>;
  return (
    <table className="rp-hist">
      <thead>
        <tr>
          <th scope="col">{t('present.historyDate')}</th>
          <th scope="col">{t('present.duration')}</th>
          <th scope="col">{t('present.historySteps')}</th>
          <th scope="col">
            <span className="sr-only">{t('present.historyView')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {reports.map((r) => {
          const shown = r.steps.filter((s) => s.seconds > 0).length;
          const mine = r.id === current;
          return (
            <tr
              key={r.id}
              className={mine ? 'is-current' : undefined}
              aria-current={mine ? 'true' : undefined}
            >
              <td>
                {when(r.started_at)}
                {mine && <> · {t('present.thisOne')}</>}
              </td>
              <td>{minSec(r.duration_s)}</td>
              <td>
                {shown} / {r.steps.length}
              </td>
              <td>
                <button
                  type="button"
                  className="link-button"
                  aria-label={t('present.historyViewOf', { when: when(r.started_at) })}
                  onClick={() => onView(r)}
                >
                  {t('present.historyView')}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Bilan d'une présentation (fin de présentation, ou rouvert depuis l'historique). */
export function ReportDialog({
  report,
  history,
  onView,
  onClose,
  onEditor,
}: {
  report: PresentReportRow;
  history: PresentReportRow[];
  onView: (r: PresentReportRow) => void;
  onClose: () => void;
  onEditor?: () => void;
}) {
  const { t } = useTranslation();
  const when = useWhen();
  const steps = report.steps;
  const max = Math.max(1, ...steps.map((s) => s.seconds));
  const longest = steps.findIndex((s) => s.seconds === max && s.seconds > 0);
  const skipped = steps.filter((s) => s.seconds <= 0).length;
  const noted = steps.filter((s) => s.noted).map((s) => s.index + 1);
  const target = report.target_min != null ? report.target_min * 60 : null;
  const v = verdictOf(report.duration_s, report.target_min);
  const verdict =
    v === 'over' && target != null
      ? { cls: 'is-over', text: t('present.overBy', { time: minSec(report.duration_s - target) }) }
      : v === 'short'
        ? { cls: 'is-short', text: t('present.shorter') }
        : v === 'ok'
          ? { cls: 'is-ok', text: t('present.onTime') }
          : null;
  const mode =
    report.mode === 'one' ? t('present.mode_one') : report.mode === 'two' ? t('present.mode_two') : '';
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Flag />}
      title={t('present.reportDone')}
      subtitle={[when(report.started_at), mode].filter(Boolean).join(' · ')}
      closeLabel={t('common.close')}
      className="rp"
      footer={
        <>
          <Button onClick={onClose}>{t('present.reportClose')}</Button>
          {onEditor && (
            <Button variant="primary" onClick={onEditor} autoFocus>
              {t('present.reportEditor')}
            </Button>
          )}
        </>
      }
    >
      <div className="rp-body">
        <div className="rp-cards">
          <div className="rp-card">
            <span className="rp-k">{t('present.duration')}</span>
            <b className="rp-v">{minSec(report.duration_s)}</b>
            {target != null && (
              <span className="rp-sub">
                {t('present.planned', { min: report.target_min })}
                {verdict && <span className={`fd-badge rp-verdict ${verdict.cls}`}>{verdict.text}</span>}
              </span>
            )}
          </div>
          <div className="rp-card">
            <span className="rp-k">{t('present.stepsShown')}</span>
            <b className="rp-v">
              {steps.length - skipped} / {steps.length}
            </b>
            <span className="rp-sub">
              {skipped ? t('present.skipped', { count: skipped }) : t('present.noneSkipped')}
            </span>
          </div>
          <div className="rp-card">
            <span className="rp-k">{t('present.notesChanged')}</span>
            <b className="rp-v">{report.notes_changed}</b>
            <span className="rp-sub">
              {noted.length
                ? t('present.notesWhere', { count: noted.length, list: noted.join(', ') })
                : t('present.notesNone')}
            </span>
          </div>
        </div>
        <section className="rp-sec" aria-labelledby="rp-steps-t">
          <h3 id="rp-steps-t">{t('present.reportTable')}</h3>
          <table className="rp-steps">
            <thead className="sr-only">
              <tr>
                <th scope="col">{t('present.step')}</th>
                <th scope="col">{t('present.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={s.index} className={i === longest ? 'is-long' : undefined}>
                  <th scope="row">
                    <span className="rp-n">{s.index + 1}</span>
                    <span className="rp-name">
                      {s.title || t('editor.untitled')}
                      {i === longest && <span className="sr-only"> · {t('present.reportLongest')}</span>}
                    </span>
                  </th>
                  <td>
                    <span className="rp-bar" aria-hidden="true">
                      <i style={{ width: `${Math.round((s.seconds / max) * 100)}%` }} />
                    </span>
                    <span className="rp-time">{mss(s.seconds)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rp-legend">
            <span className="rp-dot is-long" aria-hidden="true" />
            {t('present.legendLongest')}
            <span className="rp-dot" aria-hidden="true" />
            {t('present.legendOthers')}
          </p>
          <p className="fd-help">{t('present.measured')}</p>
        </section>
        <section className="rp-sec" aria-labelledby="rp-hist-t">
          <h3 id="rp-hist-t">{t('present.historyTitle')}</h3>
          <HistoryTable reports={history} current={report.id} onView={onView} />
          <p className="fd-help">{t('present.kept')}</p>
        </section>
      </div>
    </Modal>
  );
}

/** Historique ouvert depuis la fenêtre « Présenter » : « Voir » rouvre un bilan. */
export function HistoryDialog({
  demoTitle,
  reports,
  onClose,
}: {
  demoTitle: string;
  reports: PresentReportRow[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<PresentReportRow | null>(null);
  if (view)
    return <ReportDialog report={view} history={reports} onView={setView} onClose={() => setView(null)} />;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<History />}
      title={t('present.historyTitle')}
      subtitle={demoTitle}
      closeLabel={t('common.close')}
      className="rp"
      footer={<Button onClick={onClose}>{t('present.reportClose')}</Button>}
    >
      <div className="rp-body">
        <HistoryTable reports={reports} onView={setView} />
        <p className="fd-help">{t('present.kept')}</p>
      </div>
    </Modal>
  );
}
