/**
 * L47 : indicateurs en onglets. Les indicateurs forment une liste d'onglets dans la même carte que
 * le graphique ; l'onglet actif est souligné et pilote le graphique et le tri du tableau.
 * Clavier : une seule carte dans l'ordre de tabulation, flèches (activation immédiate), Début, Fin.
 */
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { completionRate, trendDirection, type Trend } from '@flowdsiml/core';
import { formatDate, formatNumber, unit } from '../../lib/format';
import { Sk } from '../Skeleton';
import './kpi.css';
import { Empty } from '@flowdsiml/ui';
import { ChartColumn } from 'lucide-react';

/** L47-01 : 4 indicateurs (les visiteurs récurrents ont leur bloc ; les clics vont sous « Étape par étape »). */
export type KpiKey = 'views' | 'visitors' | 'completion' | 'leads';
export const KPI_KEYS: KpiKey[] = ['views', 'visitors', 'completion', 'leads'];
/** Indicateur lu dans l'adresse (?indicateur=) ; inconnu : Vues. */
export const kpiFromParam = (v: string | null, keys: KpiKey[]): KpiKey =>
  keys.includes(v as KpiKey) ? (v as KpiKey) : 'views';

/** Réponse de analytics_series (agrégats seulement). */
export interface SeriesRow {
  views: number;
  visitors: number;
  completions: number;
  cta: number;
  leads: number;
}
export type SeriesDay = SeriesRow & { day: string };
export interface Series {
  daily: SeriesDay[];
  byDemo: Array<SeriesRow & { demo_id: string }>;
  bySource: Array<SeriesRow & { source: 'direct' | 'embed' | 'link' | 'page' }>;
}
/** Valeur d'un indicateur pour une ligne (jour, démo ou source) ; complétion : 0–1. */
export function dayValue(r: SeriesRow, k: KpiKey): number {
  if (k === 'completion') return completionRate(r.visitors, r.completions);
  return r[k];
}
export const metricValues = (r: SeriesRow): Partial<Record<KpiKey, number>> => ({
  views: r.views,
  visitors: r.visitors,
  completion: r.visitors > 0 ? completionRate(r.visitors, r.completions) : undefined,
  leads: r.leads,
});

/** Évolution : texte visible court, phrase complète pour les lecteurs d'écran. */
export function useTrendText() {
  const { t } = useTranslation();
  return (tr: Trend, days: number) => {
    const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
    const word = (n: number) => (n > 0 ? t('kpi.plus') : n < 0 ? t('kpi.minus') : '');
    const n = (v: number) => formatNumber(Math.abs(v));
    switch (tr.kind) {
      case 'none':
        return { short: '—', suffix: '', sr: t('kpi.srNone') };
      case 'new':
        return { short: t('kpi.new'), suffix: '', sr: t('kpi.srNew') };
      case 'mult':
        return {
          short: `×${formatNumber(tr.value)}`,
          suffix: t('kpi.vs', { count: days }),
          sr: t('kpi.srMult', { value: formatNumber(tr.value) }),
        };
      case 'abs':
        return {
          short: `${sign(tr.value)}${n(tr.value)} ${t('kpi.vsValue', { value: formatNumber(tr.previous) })}`,
          suffix: t('kpi.theDays', { count: days }),
          sr: t('kpi.srAbs', {
            sign: word(tr.value),
            value: n(tr.value),
            previous: formatNumber(tr.previous),
          }),
        };
      case 'pts':
        return {
          short: `${sign(tr.value)}${n(tr.value)} ${t('kpi.pts')}`,
          suffix: t('kpi.vs', { count: days }),
          sr: t('kpi.srPts', { sign: word(tr.value), value: n(tr.value) }),
        };
      default:
        return {
          short: `${sign(tr.value)}${n(tr.value)}\u00a0%`,
          suffix: t('kpi.vs', { count: days }),
          sr: t('kpi.srPct', { sign: word(tr.value), value: n(tr.value) }),
        };
    }
  };
}

/** Évolution visible (signe, puis couleur en complément ; aucune icône sur 0, « Nouveau » ou « — »). */
export function TrendBadge({ trend, days }: { trend: Trend; days: number }) {
  const text = useTrendText()(trend, days);
  const dir = trendDirection(trend);
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : null;
  return (
    <span className="kpi-trend">
      <span
        aria-hidden="true"
        className={`kpi-trend__v${dir ? ` is-${dir}` : ''}${trend.kind === 'new' ? ' is-new' : ''}${trend.kind === 'none' ? ' is-none' : ''}`}
      >
        {Icon && <Icon />}
        {text.short}
      </span>
      {text.suffix && (
        <span className="kpi-trend__s" aria-hidden="true">
          {' '}
          {text.suffix}
        </span>
      )}
      <span className="sr-only">{text.sr}</span>
    </span>
  );
}

export interface KpiItem {
  key: KpiKey;
  label: string;
  value: string;
  trend: Trend;
}

export function KpiTabs({
  items,
  active,
  onSelect,
  days,
  children,
}: {
  items: KpiItem[];
  active: KpiKey;
  onSelect: (k: KpiKey) => void;
  days: number;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  // Mobile : la carte active reste dans la vue (chargement et changement)
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  const move = (i: number) => {
    const k = items[(i + items.length) % items.length]!.key;
    onSelect(k);
    requestAnimationFrame(() =>
      list.current?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${k}`)}`)?.focus(),
    );
  };
  return (
    <section className="kpi-card">
      <div
        ref={list}
        className="kpi-tabs"
        // §18.7 : rangée d'onglets qui défile en largeur sur mobile (voulu)
        data-scroll-x=""
        role="tablist"
        aria-label={t('kpi.tablist')}
        style={{ ['--kpi-n' as string]: items.length }}
      >
        {items.map((it, i) => (
          <button
            key={it.key}
            id={`${id}-${it.key}`}
            type="button"
            role="tab"
            className="kpi-tab"
            aria-selected={it.key === active}
            aria-controls={`${id}-panel`}
            tabIndex={it.key === active ? 0 : -1}
            onClick={() => onSelect(it.key)}
            onKeyDown={(e) => {
              const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 }[e.key];
              if (to === undefined) return;
              e.preventDefault();
              move(to);
            }}
          >
            <span className="kpi-tab__l">{it.label}</span>
            <span className="kpi-tab__v">{it.value}</span>
            <TrendBadge trend={it.trend} days={days} />
          </button>
        ))}
      </div>
      <div className="kpi-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${active}`}>
        {children}
      </div>
    </section>
  );
}

/** Une valeur par jour de la période, du plus ancien au plus récent (jours sans activité à 0). */
export function alignDays<T extends { day: string }>(
  rows: T[],
  days: number,
  end: number,
  pick: (r: T) => number,
) {
  const by = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(end - (days - 1 - i) * 86400_000).toISOString().slice(0, 10);
    const r = by.get(day);
    return { day, v: r ? pick(r) : 0 };
  });
}

/**
 * Courbe de la période (2,5 px, aire légère) et de la période précédente en pointillé gris.
 * Taux : axe de 0 à 100 %. Les valeurs restent lisibles au clavier (tableau masqué).
 */
export function TrendChart({
  title,
  cur,
  prev,
  days,
  rate = false,
  loading = false,
}: {
  title: string;
  cur: Array<{ day: string; v: number }> | null;
  prev: Array<{ day: string; v: number }> | null;
  days: number;
  rate?: boolean;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const H = 240;
  const W = 1000;
  const max = useMemo(() => {
    if (rate) return 1;
    const all = [...(cur ?? []), ...(prev ?? [])].map((d) => d.v);
    return Math.max(1, ...all) * 1.15;
  }, [cur, prev, rate]);
  const pts = (s: Array<{ v: number }>) =>
    s
      .map((d, i) => {
        const x = s.length > 1 ? (i / (s.length - 1)) * W : W / 2;
        const y = 8 + (H - 16) * (1 - Math.min(1, d.v / max));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  const fmt = (v: number) => (rate ? `${Math.round(v * 100)}\u00a0%` : formatNumber(v));
  return (
    <div className="kpi-chart">
      <header className="kpi-chart__head">
        <h2 className="kpi-chart__t">{title}</h2>
        <span className="kpi-chart__leg" aria-hidden="true">
          <span>
            <i />
            {t('kpi.lastDays', { count: days })}
          </span>
          <span>
            <i className="is-prev" />
            {t('kpi.previous')}
          </span>
        </span>
      </header>
      {loading ? (
        <Sk className="kpi-chart__sk" h={H} />
      ) : !cur ? (
        <p className="kpi-chart__none">{t('kpi.noDaily')}</p>
      ) : (
        <figure className="kpi-chart__fig" /* §18.6 : graphique et dates de son axe */ data-gap-exempt="">
          <svg
            className="kpi-chart__svg"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={t('kpi.chartLabel', { metric: title, count: days })}
          >
            {[0, 0.5, 1].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={8 + (H - 16) * (1 - f)}
                y2={8 + (H - 16) * (1 - f)}
                className="kpi-chart__grid"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {prev && (
              <polyline points={pts(prev)} className="kpi-chart__prev" vectorEffect="non-scaling-stroke" />
            )}
            <polyline points={pts(cur)} className="kpi-chart__cur" vectorEffect="non-scaling-stroke" />
          </svg>
          {rate && (
            <span className="kpi-chart__axis" aria-hidden="true">
              <span>{unit(100, '%')}</span>
              <span>{unit(0, '%')}</span>
            </span>
          )}
          <span className="kpi-chart__dates" aria-hidden="true">
            <span>{formatDate(cur[0]!.day, { day: 'numeric', month: 'short' })}</span>
            <span>{formatDate(cur[cur.length - 1]!.day, { day: 'numeric', month: 'short' })}</span>
          </span>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">{t('kpi.day')}</th>
                <th scope="col">{t('kpi.lastDays', { count: days })}</th>
                <th scope="col">{t('kpi.previous')}</th>
              </tr>
            </thead>
            <tbody>
              {cur.map((d, i) => (
                <tr key={d.day}>
                  <th scope="row">{formatDate(d.day)}</th>
                  <td>{fmt(d.v)}</td>
                  <td>{prev?.[i] ? fmt(prev[i]!.v) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </div>
  );
}

export interface MetricRow {
  id: string;
  name: ReactNode;
  values: Partial<Record<KpiKey, number>>;
}

/** Tableau trié par l'indicateur actif (décroissant), colonne active en gras ; 10 lignes. */
export function MetricTable({
  title,
  nameLabel,
  columns,
  rows,
  active,
  more,
}: {
  title: string;
  nameLabel: string;
  columns: Array<{ key: KpiKey; label: string; rate?: boolean }>;
  rows: MetricRow[];
  active: KpiKey;
  more?: { to: string; label: string };
}) {
  const { t } = useTranslation();
  // Indicateur sans colonne (visiteurs récurrents) : tri par vues
  const activeCol = columns.find((c) => c.key === active) ?? columns[0]!;
  const by = activeCol.key;
  const sorted = [...rows].sort((a, b) => (b.values[by] ?? -1) - (a.values[by] ?? -1)).slice(0, 10);
  const cell = (c: { key: KpiKey; rate?: boolean }, v: number | undefined) =>
    v === undefined ? '—' : c.rate ? `${Math.round(v * 100)}\u00a0%` : formatNumber(v);
  return (
    <section className="fd-card kpi-table">
      <h2 className="kpi-table__t">{title}</h2>
      {sorted.length === 0 ? (
        <Empty
          variant="compact"
          level={3}
          icon={<ChartColumn />}
          title={t('empty.analyticsTitle')}
          body={t('empty.analyticsBody')}
        />
      ) : (
        <>
          <table className="kpi-tbl">
            <thead>
              <tr>
                <th scope="col">{nameLabel}</th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={`r${c.key === by ? ' on' : ''}`}
                    aria-sort={c.key === by ? 'descending' : undefined}
                  >
                    {c.key === by && <ArrowDown aria-hidden="true" className="kpi-tbl__arrow" />}
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name}</th>
                  {columns.map((c) => (
                    <td key={c.key} className={`r${c.key === by ? ' on' : ''}`}>
                      {cell(c, r.values[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile : deux colonnes, nom et valeur de l'indicateur actif */}
          <ul className="kpi-list" aria-label={title}>
            {sorted.map((r) => (
              <li key={r.id}>
                <span>{r.name}</span>
                <b>{cell(activeCol, r.values[by])}</b>
              </li>
            ))}
          </ul>
          {more && rows.length > 10 && (
            <Link className="link-button kpi-table__more" to={more.to}>
              {more.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}
