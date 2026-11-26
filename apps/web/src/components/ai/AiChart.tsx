import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { CHART_ROWS_MAX, type ChartType, type HtmlChart } from '@flowdsiml/core';
import { AiRequestError, aiBlock, callAi, useAiStatus } from '../../lib/ai';
import { parseValue } from '../../pages/editor/html/ChartFields';
import { useBlockText } from './AiWrite';
import './ai.css';

export interface ChartPlan {
  type: ChartType;
  title: string;
  labelColumn: string;
  valueColumn: string;
  aggregate: 'none' | 'sum' | 'avg' | 'count';
}

/** Valeurs du graphique calculées localement depuis le jeu de données (12 libellés au plus). */
export function chartFromDataset(plan: ChartPlan, columns: string[], rows: string[][]): HtmlChart | null {
  const li = columns.indexOf(plan.labelColumn);
  const vi = columns.indexOf(plan.valueColumn);
  if (li < 0 || (plan.aggregate !== 'count' && vi < 0)) return null;
  const out: Array<{ label: string; value: number }> = [];
  if (plan.aggregate === 'none') {
    for (const r of rows) {
      const v = parseValue(r[vi] ?? '');
      if (v !== null) out.push({ label: (r[li] ?? '').slice(0, 40), value: v });
    }
  } else {
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      const k = (r[li] ?? '').slice(0, 40);
      const v = plan.aggregate === 'count' ? 1 : parseValue(r[vi] ?? '');
      if (v === null) continue;
      groups.set(k, [...(groups.get(k) ?? []), v]);
    }
    for (const [label, vs] of groups) {
      const sum = vs.reduce((a, b) => a + b, 0);
      out.push({ label, value: plan.aggregate === 'avg' ? Math.round((sum / vs.length) * 100) / 100 : sum });
    }
  }
  if (out.length < 1) return null;
  return {
    type: plan.type,
    rows: out.slice(0, CHART_ROWS_MAX),
    ...(plan.title ? { title: plan.title.slice(0, 120) } : {}),
  };
}

/**
 * L30-07 : « Décrire le graphique » (graphique d'une capture HTML, L25). Le graphique utilise le jeu
 * de données relié à la démo : seuls les noms de colonnes et 5 lignes d'exemple sont envoyés ; les
 * valeurs sont calculées ici. Aperçu (graphique, type, colonnes, titre), Appliquer ou Ignorer.
 */
export function AiChart({
  ws,
  lang,
  dataset,
  onApply,
  onOpenDataset,
  onCancel,
}: {
  ws: string;
  lang: string;
  dataset: { columns: string[]; rows: string[][] } | null;
  onApply: (chart: HtmlChart) => void;
  onOpenDataset: () => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const [desc, setDesc] = useState('');
  const [phase, setPhase] = useState<'input' | 'busy' | 'ready' | 'error' | 'blocked'>('input');
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<ChartPlan | null>(null);
  const [chart, setChart] = useState<HtmlChart | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  if (!dataset)
    return (
      <div className="ai-preview" role="note">
        <p className="ai-after">{t('ai.chart.noDataset')}</p>
        <div className="ai-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenDataset}>
            {t('ai.chart.openDataset')}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {t('common.close')}
          </button>
        </div>
      </div>
    );

  const run = async () => {
    const b = aiBlock(status, 'chart');
    if (b) {
      setMessage(blockText(b, status));
      return setPhase('blocked');
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const p = await callAi<ChartPlan>(
        ws,
        'chart',
        lang,
        { description: desc, columns: dataset.columns.slice(0, 30), sample: dataset.rows.slice(0, 5) },
        c.signal,
      );
      const ch = chartFromDataset(p, dataset.columns, dataset.rows);
      if (!ch) return setPhase('error');
      setPlan(p);
      setChart(ch);
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('input');
      if (e instanceof AiRequestError && (e.code === 'AI_QUOTA_WORKSPACE' || e.code === 'AI_QUOTA_USER')) {
        setMessage(blockText(e.code === 'AI_QUOTA_USER' ? 'userQuota' : 'quota', status));
        return setPhase('blocked');
      }
      setPhase('error');
    }
  };

  const max = chart ? Math.max(...chart.rows.map((r) => Math.abs(r.value)), 1) : 1;
  return (
    <div className="ai-preview ai-chart" aria-busy={phase === 'busy'}>
      <span className="sr-only" role="status">
        {phase === 'ready' ? t('ai.ready') : ''}
      </span>
      {phase !== 'ready' && (
        <div className="field">
          <label htmlFor="ai-ch-desc">{t('ai.chart.label')}</label>
          <textarea
            id="ai-ch-desc"
            className="textarea input-sm"
            rows={2}
            maxLength={1000}
            placeholder={t('ai.chart.placeholder')}
            value={desc}
            disabled={phase === 'busy'}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
      )}
      {phase === 'busy' && (
        <>
          <p className="ai-after">{t('ai.chart.busy')}</p>
          <div className="ai-progress" aria-hidden="true" />
        </>
      )}
      {phase === 'blocked' && (
        <p className="ai-after" role="alert">
          {message}
        </p>
      )}
      {phase === 'error' && (
        <p className="ai-after" role="alert">
          {aiBlock(status, 'chart') === 'unavailable' ? t('ai.unavailable') : t('ai.error')}
        </p>
      )}
      {phase === 'ready' && plan && chart && (
        <>
          <p className="ai-after">
            <b>{chart.title || t('editor.data.chartUntitled')}</b>
          </p>
          <p className="t-caption muted">
            {t('ai.chart.summary', {
              type: t(`editor.data.chart_${chart.type}`),
              label: plan.labelColumn,
              value: plan.aggregate === 'count' ? t('ai.chart.count') : plan.valueColumn,
            })}
          </p>
          {/* Aperçu dessiné en barres, avec le tableau de valeurs (description accessible) */}
          <div className="ai-chart-bars" aria-hidden="true">
            {chart.rows.map((r, i) => (
              <div key={i} className="ai-chart-row">
                <span className="ai-chart-label">{r.label}</span>
                <span className="ai-chart-bar" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
                <span className="ai-chart-val">{r.value.toLocaleString(i18n.language)}</span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>{chart.title || t('editor.data.chartUntitled')}</caption>
            <tbody>
              {chart.rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{r.label}</th>
                  <td>{r.value.toLocaleString(i18n.language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ai-mention">
            <Sparkles aria-hidden="true" />
            {t('ai.mention')}
          </p>
        </>
      )}
      <div className="ai-actions">
        {phase === 'ready' && chart ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onApply(chart)}>
            {t('ai.apply')}
          </button>
        ) : phase === 'busy' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ctrl.current?.abort()}>
            {t('ai.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!desc.trim()}
            onClick={() => void run()}
          >
            {phase === 'error' ? t('ai.retry') : t('ai.chart.go')}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          {t('ai.ignore')}
        </button>
      </div>
    </div>
  );
}
