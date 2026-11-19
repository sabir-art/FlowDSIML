import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Plus, Trash2 } from 'lucide-react';
import { CHART_ROWS_MAX, validChart, type ChartType, type HtmlChart } from '@flowdsiml/core';
import type { DetectedChart } from '@flowdsiml/player-core';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';
import { opOn, removeOp, upsertOp } from './htmlModel';

const ICON = { size: 16, 'aria-hidden': true } as const;
const TYPES: ChartType[] = ['bar', 'line', 'donut'];

/** Saisie d'une valeur (« 1 248 », « 12,5 ») ; null si ce n'est pas un nombre. */
export function parseValue(s: string): number | null {
  const t = s.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Lignes valides seulement : une valeur non numérique n'est pas appliquée. */
export function chartValue(
  type: ChartType,
  rows: Array<{ label: string; value: string }>,
  title: string,
): HtmlChart | null {
  const ok = rows.flatMap((r) => {
    const v = parseValue(r.value);
    return v === null ? [] : [{ label: r.label.slice(0, 40), value: v }];
  });
  const c: HtmlChart = {
    type,
    rows: ok.slice(0, CHART_ROWS_MAX),
    ...(title ? { title: title.slice(0, 120) } : {}),
  };
  return validChart(c) ? c : null;
}

/** Événement : ouvrir la modale « Jeu de données » (L25-09) depuis le graphique. */
export const DATASET_OPEN = 'fd:dataset-open';

/**
 * L25-08 : panneau « Graphique · {{titre}} » d'un graphique reconnu dans la page (barres, courbe,
 * anneau en HTML ou SVG simple). Type, tableau des valeurs (12 lignes au plus), « Depuis un jeu de
 * données ». Le graphique est redessiné dans la page, valeurs toujours écrites.
 */
export function ChartFields({
  editor,
  step,
  chart,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  chart: DetectedChart;
  readOnly: boolean;
}) {
  const { t, i18n } = useTranslation();
  const op = opOn(step, chart.sel, 'chart');
  const saved = op && validChart(op.value) ? op.value : null;
  const fmt = (v: number) => v.toLocaleString(i18n.language);
  const initial = saved ?? chart;
  const [type, setType] = useState<ChartType>(initial.type);
  const [rows, setRows] = useState(initial.rows.map((r) => ({ label: r.label, value: fmt(r.value) })));
  const title = saved?.title ?? chart.title;
  useEffect(() => {
    setType(initial.type);
    setRows(initial.rows.map((r) => ({ label: r.label, value: fmt(r.value) })));
  }, [chart.sel, op?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(nextType = type, nextRows = rows) {
    if (readOnly) return;
    const v = chartValue(nextType, nextRows, title);
    if (!v) return;
    upsertOp(editor, step, { sel: chart.sel, op: 'chart', value: v, before: title || chart.sel }, 'step');
  }
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="sec ch-fields">
      <div className="sec-title">
        {t('editor.data.chartTitle', { title: title || t('editor.data.chartUntitled') })}
      </div>
      <div className="field">
        <span className="label" id="ch-type">
          {t('editor.data.chartType')}
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="ch-type">
          {TYPES.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={type === k}
              tabIndex={type === k ? 0 : -1}
              disabled={readOnly}
              onClick={() => {
                setType(k);
                commit(k);
              }}
            >
              {t(`editor.data.chart_${k}`)}
            </button>
          ))}
        </div>
      </div>
      <h3 className="dt-sub">{t('editor.data.values')}</h3>
      <table className="ch-table">
        <caption className="sr-only">{t('editor.data.valuesCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('editor.data.label')}</th>
            <th scope="col">{t('editor.data.value')}</th>
            <th scope="col">
              <span className="sr-only">{t('editor.data.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const bad = r.value.trim() !== '' && parseValue(r.value) === null;
            const errId = `ch-err-${i}`;
            return (
              <tr key={i}>
                <td>
                  <input
                    className="input input-sm"
                    value={r.label}
                    maxLength={40}
                    aria-label={t('editor.data.labelN', { n: i + 1 })}
                    disabled={readOnly}
                    onChange={(e) => setRow(i, { label: e.target.value })}
                    onBlur={() => commit()}
                  />
                </td>
                <td>
                  <input
                    className="input input-sm ch-num"
                    value={r.value}
                    inputMode="decimal"
                    aria-label={t('editor.data.valueN', { n: i + 1 })}
                    aria-invalid={bad}
                    aria-describedby={bad ? errId : undefined}
                    disabled={readOnly}
                    onChange={(e) => setRow(i, { value: e.target.value })}
                    onBlur={() => commit()}
                  />
                  {bad && (
                    <span className="field-error" id={errId}>
                      {t('editor.data.notNumber')}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('editor.data.deleteRow', { n: i + 1 })}
                    disabled={readOnly || rows.length <= 1}
                    onClick={() => {
                      const next = rows.filter((_, j) => j !== i);
                      setRows(next);
                      commit(type, next);
                    }}
                  >
                    <Trash2 {...ICON} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="st-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={readOnly || rows.length >= CHART_ROWS_MAX}
          onClick={() => setRows((rs) => [...rs, { label: '', value: '' }])}
        >
          <Plus {...ICON} />
          {t('editor.data.addRow')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={readOnly}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(DATASET_OPEN, { detail: { stepId: step.id, opId: op?.id ?? null } }),
            )
          }
        >
          <Database {...ICON} />
          {t('editor.data.fromDataset')}
        </button>
      </div>
      {op && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={readOnly}
          onClick={() => removeOp(editor, step, op.id)}
        >
          {t('editor.data.chartReset')}
        </button>
      )}
      <p className="help">{t('editor.data.chartHelp')}</p>
    </div>
  );
}
