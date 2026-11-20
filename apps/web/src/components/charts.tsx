/** Graphiques partagés des pages Analytics (entonnoir). */
import { formatNumber } from '../lib/format';

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
