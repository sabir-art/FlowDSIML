import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDate, formatNumber, formatPercent } from '../lib/format';
import { useState } from 'react';

/** Tuile KPI : valeur héros + libellé (pas de graphique). */
export function StatTile({
  label,
  value,
  hint,
  delta,
  deltaLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Variation relative vs période précédente (0.12 = +12 %) ; null = pas de comparaison possible. */
  delta?: number | null;
  deltaLabel?: string;
}) {
  const dir =
    delta === undefined || delta === null ? null : delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : 'flat';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  return (
    <div className="fd-card stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {dir && (
        <div className={`stat-delta stat-delta--${dir}`}>
          <Icon size={14} aria-hidden="true" />
          <span>
            {delta! > 0 ? '+' : ''}
            {formatPercent(delta!)}
          </span>
          {deltaLabel && <span className="stat-delta-label">{deltaLabel}</span>}
        </div>
      )}
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/** Variation relative entre deux valeurs (null si la période précédente est vide). */
export function variation(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

/**
 * Histogramme mono-série (vues par jour). Couleur unique = primaire (aucune légende nécessaire,
 * le titre nomme la série). Barres fines à extrémité arrondie, écart de 2px, tooltip au survol.
 */
export function DailyBars({
  data,
  label,
  emptyText,
}: {
  data: Array<{ day: string; views: number }>;
  label: string;
  emptyText: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="fd-muted">{emptyText}</p>;
  const W = 640;
  const H = 160;
  const pad = { l: 32, b: 22, t: 8 };
  const max = Math.max(1, ...data.map((d) => d.views));
  const bw = (W - pad.l) / data.length;
  const barW = Math.max(2, Math.min(28, bw - 2));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const h = hover !== null ? data[hover] : null;
  return (
    <figure className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W} y1={y(max * f)} y2={y(max * f)} className="chart-grid" />
            <text x={pad.l - 6} y={y(max * f) + 4} textAnchor="end" className="chart-axis">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + (bw - barW) / 2;
          const top = y(d.views);
          const hh = Math.max(0, H - pad.b - top);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <path
                d={
                  hh > 4
                    ? `M${x},${H - pad.b} V${top + 4} q0,-4 4,-4 h${barW - 8} q4,0 4,4 V${H - pad.b} Z`
                    : `M${x},${H - pad.b} h${barW} v${-hh} h${-barW} Z`
                }
                className={`chart-bar ${hover === i ? 'is-hover' : ''}`}
              />
            </g>
          );
        })}
        <text x={pad.l} y={H - 6} className="chart-axis">
          {formatDate(data[0]!.day, { day: 'numeric', month: 'short' })}
        </text>
        <text x={W} y={H - 6} textAnchor="end" className="chart-axis">
          {formatDate(data[data.length - 1]!.day, { day: 'numeric', month: 'short' })}
        </text>
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{formatDate(d.day)}</th>
              <td>{d.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {h && (
        <div className="chart-tip" role="status">
          <strong>{formatNumber(h.views)}</strong> · {formatDate(h.day)}
        </div>
      )}
    </figure>
  );
}

/** Entonnoir par étape : barre horizontale = part des visiteurs ayant atteint l'étape. */
export function Funnel({
  rows,
  labels,
  stepLabel,
  reachLabel,
  dropLabel,
}: {
  rows: Array<{ stepIndex: number; visitors: number; reach: number; dropOff: number }>;
  labels: string[];
  stepLabel: string;
  reachLabel: string;
  dropLabel: string;
}) {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  return (
    <table className="fd-table funnel">
      <thead>
        <tr>
          <th>{stepLabel}</th>
          <th style={{ width: '45%' }}>{reachLabel}</th>
          <th>{dropLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.stepIndex} title={`${r.visitors} · ${pct(r.reach)}`}>
            <td>
              {r.stepIndex + 1}. {labels[r.stepIndex] ?? ''}
            </td>
            <td>
              <div className="funnel-cell">
                <div className="funnel-track" aria-hidden="true">
                  <div
                    className="funnel-bar"
                    style={{ width: `${Math.max(r.reach * 100, r.visitors ? 1 : 0)}%` }}
                  />
                </div>
                <span className="funnel-value">
                  {formatNumber(r.visitors)} · {pct(r.reach)}
                </span>
              </div>
            </td>
            <td className={r.dropOff >= 0.3 ? 'funnel-drop-high' : 'fd-muted'}>
              {r.stepIndex === 0 ? '—' : `−${pct(r.dropOff)}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
