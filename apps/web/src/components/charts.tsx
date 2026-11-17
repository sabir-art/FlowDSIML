import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate, formatNumber, formatPercent } from '../lib/format';

/**
 * Carte KPI (refonte DSI §2) : puce d'icône + libellé, gros chiffre, badge de tendance.
 * `hero` : carte verte DSI (une seule par rangée, la première), texte noir.
 */
export function StatTile({
  label,
  value,
  icon,
  hero = false,
  hint,
  delta,
  deltaLabel,
  noDeltaLabel,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  hero?: boolean;
  hint?: string;
  /** Variation relative vs période précédente (0.12 = +12 %) ; null = pas de comparaison possible. */
  delta?: number | null;
  deltaLabel?: string;
  /** Texte pour lecteur d'écran quand la comparaison est impossible (delta === null). */
  noDeltaLabel?: string;
}) {
  const dir =
    delta === undefined || delta === null ? null : delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : 'flat';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  return (
    <article className={`fd-card fd-kpi stat-tile${hero ? ' fd-card--hero' : ''}`}>
      <div className="fd-card__head" style={{ margin: 0 }}>
        {icon && (
          <span className="fd-icon-chip" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="fd-kpi__label stat-label" title={label}>
          {label}
        </span>
      </div>
      <span className="fd-kpi__value stat-value">{value}</span>
      {(delta !== undefined || hint) && (
        <span className="fd-kpi__foot">
          {delta === null && (
            <span className="fd-trend stat-delta stat-delta--none" title={noDeltaLabel}>
              <span aria-hidden="true">—</span>
              {noDeltaLabel && <span className="sr-only">{noDeltaLabel}</span>}
            </span>
          )}
          {dir && (
            <span
              className={`fd-trend stat-delta stat-delta--${dir}${dir === 'up' ? ' fd-trend--up' : dir === 'down' ? ' fd-trend--down' : ''}`}
            >
              <Icon aria-hidden="true" />
              {delta! > 0 ? '+' : delta! < 0 ? '−' : ''}
              {formatPercent(Math.abs(delta!))}
            </span>
          )}
          {delta !== undefined && deltaLabel && <span className="stat-delta-label">{deltaLabel}</span>}
          {(delta === undefined || !deltaLabel) && hint && <span className="stat-hint">{hint}</span>}
        </span>
      )}
    </article>
  );
}

/** Variation relative entre deux valeurs (null si la période précédente est vide). */
export function variation(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

/** Au-delà de ce nombre de barres, les valeurs ne s'affichent qu'au survol (§3). */
const MAX_LABELLED_BARS = 31;

/**
 * Histogramme mono-série (refonte DSI §3) : barres arrondies orange sur piste pâle, valeur écrite
 * au-dessus de chaque barre (l'orange seul ne fait que 2,35:1), pic et barre survolée en noir.
 * Une table sr-only donne les mêmes données aux lecteurs d'écran.
 */
export function DailyBars({
  data,
  label,
  emptyText,
  metric = 'views',
}: {
  data: Array<{ day: string; views: number; visitors?: number }>;
  label: string;
  emptyText: string;
  metric?: 'views' | 'visitors';
}) {
  if (!data.length) return <p className="fd-muted">{emptyText}</p>;
  const value = (d: (typeof data)[number]) => (metric === 'visitors' ? (d.visitors ?? 0) : d.views);
  const max = Math.max(1, ...data.map(value));
  const peak = data.reduce((best, d, i) => (value(d) > value(data[best]!) ? i : best), 0);
  const dense = data.length > MAX_LABELLED_BARS;
  // Dates sous les barres : toutes jusqu'à 14 barres, sinon une sur n
  const every = Math.ceil(data.length / 14);
  return (
    <figure className="chart-bars-wrap" aria-label={label}>
      <div
        className={`chart-bars${dense ? ' chart-bars--dense' : ''}`}
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {data.map((d, i) => (
          <div
            key={d.day}
            className={`chart-col${i === peak && value(d) > 0 ? ' is-peak' : ''}`}
            title={`${formatNumber(value(d))} · ${formatDate(d.day)}`}
          >
            <span className="chart-col__v">{formatNumber(value(d))}</span>
            <span className="fd-bar chart-col__bar">
              <span className="fd-bar__fill" style={{ height: `${(value(d) / max) * 100}%` }} />
            </span>
            <span className="chart-col__d">
              {i % every === 0 || i === data.length - 1
                ? formatDate(d.day, { day: 'numeric', ...(data.length > 14 ? { month: 'short' } : {}) })
                : ''}
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{formatDate(d.day)}</th>
              <td>{value(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Entonnoir par étape (refonte DSI §3) : barres horizontales .fd-bar--h, nombre et perte. */
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
    <table className="funnel">
      <thead className="sr-only">
        <tr>
          <th scope="col">{stepLabel}</th>
          <th scope="col">{reachLabel}</th>
          <th scope="col">{reachLabel}</th>
          <th scope="col">{dropLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.stepIndex} className="funnel__row" title={`${r.visitors} · ${pct(r.reach)}`}>
            <th scope="row" className="funnel__label">
              <span className="funnel-step-num">{r.stepIndex + 1}</span>
              <span aria-hidden="true"> · </span>
              {labels[r.stepIndex] ?? ''}
            </th>
            <td className="funnel__barcell">
              <span className="fd-bar fd-bar--h funnel__bar" aria-hidden="true">
                <span
                  className="fd-bar__fill"
                  style={{ width: `${Math.max(r.reach * 100, r.visitors ? 1 : 0)}%` }}
                />
              </span>
              <span className="sr-only">{pct(r.reach)}</span>
            </td>
            <td className="funnel__n">{formatNumber(r.visitors)}</td>
            <td className={`funnel__loss${r.stepIndex === 0 || r.dropOff === 0 ? ' is-none' : ''}`}>
              {r.stepIndex === 0 ? '—' : `−${pct(r.dropOff)}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DONUT_R = 70;
const DONUT_C = 2 * Math.PI * DONUT_R;
/** Espace entre segments en longueur d'arc : 4 px visibles + l'arrondi du trait (22 px). */
const DONUT_GAP = 4 + 22;

/**
 * Donut SVG (refonte DSI §3) : un cercle par segment (stroke-dasharray), trait de 22 px arrondi,
 * total au centre, légende avec pastille, libellé et pourcentage aligné à droite.
 */
export function Donut({
  segments,
  totalLabel,
  label,
  valueLabel,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  totalLabel: string;
  label: string;
  /** Libellé de la valeur (« 42 vues ») dans la légende et la table sr-only. */
  valueLabel: (n: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? DONUT_GAP : 0;
  let offset = 0;
  const arcs = visible.map((s) => {
    const len = (s.value / total) * DONUT_C;
    const arc = { ...s, dash: Math.max(len - gap, 0.01), offset };
    offset += len;
    return arc;
  });
  const pct = (v: number) => formatPercent(total ? v / total : 0);
  return (
    <div className="donut-wrap">
      <div
        className="donut"
        role="img"
        aria-label={`${label} : ${segments.map((s) => `${s.label} ${pct(s.value)}`).join(', ')}`}
        data-total={total}
      >
        <svg className="donut__svg" viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
          <circle r={DONUT_R} cx="90" cy="90" fill="none" className="donut__track" strokeWidth="22" />
          {arcs.map((a) => (
            <circle
              key={a.label}
              r={DONUT_R}
              cx="90"
              cy="90"
              fill="none"
              stroke={a.color}
              strokeWidth="22"
              strokeLinecap={visible.length > 1 ? 'round' : 'butt'}
              strokeDasharray={`${a.dash} ${DONUT_C}`}
              strokeDashoffset={-(a.offset + gap / 2)}
              transform="rotate(-90 90 90)"
            />
          ))}
        </svg>
        <div className="donut__center">
          <b>{formatNumber(total)}</b>
          <small>{totalLabel}</small>
        </div>
      </div>
      <ul className="legend" aria-hidden="true">
        {segments.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
            <span className="legend__n">{valueLabel(s.value)}</span>
            <b>{pct(s.value)}</b>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.label}>
              <th scope="row">{s.label}</th>
              <td>{valueLabel(s.value)}</td>
              <td>{pct(s.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
