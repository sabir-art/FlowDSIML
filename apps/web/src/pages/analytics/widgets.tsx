/**
 * L48-D §3.2 : widgets de la Vue d'ensemble (grille de 2 par ligne au-dessus de 1 100 px). Chaque widget
 * a un titre, un menu « Exporter en CSV » (sauf Appareils et navigateurs) et un état vide de même hauteur.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Footprints, MonitorSmartphone, Share2, UsersRound } from 'lucide-react';
import { computeFunnel, toCsv } from '@flowdsiml/core';
import { supabase } from '../../lib/supabase';
import { downloadText } from '../../lib/download';
import { formatNumber } from '../../lib/format';
import { Menu } from '../../components/Menu';
import type { Returning } from './returning';

export interface Row {
  key: string;
  label: string;
  value: number;
  /** Texte de droite (par défaut : nombre et part). */
  right?: string;
  /** Plus forte perte (étape par étape). */
  danger?: boolean;
}

function Widget({
  title,
  head,
  csv,
  empty,
  days,
  onWiden,
  icon,
  foot,
  children,
}: {
  title: string;
  /** Contenu de titre (ex. menu de démo) ; à défaut, le titre seul. */
  head?: ReactNode;
  csv?: { name: string; header: string[]; rows: Array<Array<string | number>> };
  empty: boolean;
  days: number;
  onWiden: () => void;
  icon: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section className="fd-card an-w" aria-labelledby={id}>
      <div className="an-w__head">
        <h2 className="an-w__t" id={id}>
          {head ?? title}
        </h2>
        {csv && !empty && (
          <Menu
            label={t('analytics.widgetMenu', { name: title })}
            items={[
              {
                label: t('analytics.exportCsv'),
                onSelect: () => downloadText(csv.name, toCsv(csv.header, csv.rows)),
              },
            ]}
          />
        )}
      </div>
      {empty ? (
        <div className="an-w__empty">
          <span aria-hidden="true">{icon}</span>
          <p>{t('analytics.emptyPeriod')}</p>
          {days < 90 && (
            <button type="button" className="link-button" onClick={onWiden}>
              {t('analytics.widen')}
            </button>
          )}
        </div>
      ) : (
        <>
          {children}
          {foot && <p className="an-w__foot">{foot}</p>}
        </>
      )}
    </section>
  );
}

/** Lignes : nom et chiffre sur une ligne, barre de 6 px dessous. */
export function Rows({ rows, label }: { rows: Row[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <ul className="an-rows" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className={r.danger ? 'is-danger' : undefined}>
          <span className="an-rows__l">{r.label}</span>
          <span className="an-rows__v">
            {r.right ?? `${formatNumber(r.value)} · ${total ? Math.round((r.value / total) * 100) : 0} %`}
          </span>
          <span className="an-rows__bar" aria-hidden="true">
            <i style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

type Common = { days: number; onWiden: () => void };

export function SourcesWidget({ sources, ...c }: Common & { sources: Record<string, number | undefined> }) {
  const { t } = useTranslation();
  const rows: Row[] = (['direct', 'link', 'embed', 'page'] as const)
    .map((k) => ({ key: k, label: t(`analytics.srcLong.${k}`), value: sources[k] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <Widget
      {...c}
      title={t('analytics.sources')}
      icon={<Share2 />}
      empty={total === 0}
      csv={{
        name: `sources-${c.days}j.csv`,
        header: ['source', 'views', 'share'],
        rows: rows.map((r) => [r.label, r.value, total ? Math.round((r.value / total) * 100) : 0]),
      }}
    >
      <Rows rows={rows} label={t('analytics.sources')} />
    </Widget>
  );
}

export function StepsWidget({
  demos,
  initial,
  ...c
}: Common & { demos: Array<{ id: string; title: string }>; initial: string }) {
  const { t } = useTranslation();
  const [demo, setDemo] = useState(initial);
  useEffect(() => setDemo(initial), [initial]);
  const [data, setData] = useState<{
    rows: ReturnType<typeof computeFunnel>;
    labels: string[];
    cta: number;
  } | null>(null);
  useEffect(() => {
    if (!demo) return setData(null);
    let alive = true;
    const from = new Date(Date.now() - c.days * 86400_000).toISOString();
    void Promise.all([
      supabase.rpc('demo_analytics', { p_demo: demo, p_from: from, p_to: new Date().toISOString() }),
      supabase.from('steps').select('title, position').eq('demo_id', demo).order('position'),
    ]).then(([a, s]) => {
      if (!alive) return;
      const r = a.data as unknown as {
        steps: Array<{ stepIndex: number; visitors: number }>;
        visitors: number;
        ctaClicks?: number;
      } | null;
      const labels = (s.data ?? []).map((x) => x.title ?? '');
      setData(
        r
          ? {
              rows: computeFunnel(
                r.steps,
                Math.max(labels.length, ...r.steps.map((x) => x.stepIndex + 1)),
                r.visitors,
              ),
              labels,
              cta: r.ctaClicks ?? 0,
            }
          : null,
      );
    });
    return () => {
      alive = false;
    };
  }, [demo, c.days]);
  const name = demos.find((d) => d.id === demo)?.title ?? '';
  const rows = data?.rows ?? [];
  const worst = rows
    .slice(1)
    .reduce<(typeof rows)[number] | null>((w, r) => (!w || r.dropOff > w.dropOff ? r : w), null);
  const empty = !data || rows.every((r) => r.reach === 0);
  const label = (i: number) => data?.labels[i] || t('editor.stepN', { n: i + 1 });
  return (
    <Widget
      {...c}
      title={t('analytics.stepByStep')}
      icon={<Footprints />}
      empty={empty}
      head={
        <span className="an-w__pick">
          {t('analytics.stepByStep')}
          {demos.length > 0 && (
            <Menu
              label={t('analytics.demoLabel')}
              align="start"
              trigger={{ text: name || t('analytics.demoLabel'), chevron: true }}
              items={demos.map((d) => ({
                label: d.title,
                current: d.id === demo,
                onSelect: () => setDemo(d.id),
              }))}
            />
          )}
        </span>
      }
      csv={{
        name: `etapes-${c.days}j.csv`,
        header: ['step', 'reach', 'drop_off'],
        rows: rows.map((r) => [label(r.stepIndex), Math.round(r.reach * 100), Math.round(r.dropOff * 100)]),
      }}
      foot={t('analytics.ctaFooter', { n: formatNumber(data?.cta ?? 0) })}
    >
      <Rows
        label={t('analytics.stepByStep')}
        rows={rows.map((r) => ({
          key: String(r.stepIndex),
          label: `${r.stepIndex + 1}. ${label(r.stepIndex)}`,
          value: Math.round(r.reach * 100),
          right: `${Math.round(r.reach * 100)} %${r.stepIndex > 0 ? ` · −${Math.round(r.dropOff * 100)} %` : ''}`,
          danger: !!worst && r.stepIndex === worst.stepIndex && worst.dropOff >= 0.1,
        }))}
      />
    </Widget>
  );
}

export function ReturningWidget({ ret, onHow, ...c }: Common & { ret: Returning | null; onHow: () => void }) {
  const { t } = useTranslation();
  const on = ret?.enabled === true;
  const total = on ? ret.total : 0;
  const back = on ? ret.visitors : 0;
  const fresh = total - back;
  return (
    <Widget
      {...c}
      title={t('analytics.newReturning')}
      icon={<UsersRound />}
      empty={on && total === 0}
      csv={{
        name: `nouveaux-recurrents-${c.days}j.csv`,
        header: ['kind', 'visitors'],
        rows: [
          [t('analytics.ret.new'), fresh],
          [t('analytics.ret.ret'), back],
        ],
      }}
    >
      {!ret ? (
        <div className="an-w__wait" aria-busy="true" />
      ) : !on ? (
        <p className="an-w__off">
          {t('analytics.ret.offBody')}{' '}
          <button type="button" className="link-button" onClick={onHow}>
            {t('analytics.ret.how')}
          </button>
        </p>
      ) : (
        <div className="an-nr">
          <div className="an-nr__nums">
            <span>
              <b>{formatNumber(fresh)}</b>
              {t('analytics.ret.new')}
            </span>
            <span>
              <b>{formatNumber(back)}</b>
              {t('analytics.ret.ret')}
            </span>
          </div>
          <span className="an-nr__bar" aria-hidden="true">
            <i style={{ width: `${total ? (fresh / total) * 100 : 0}%` }} />
          </span>
          <p className="an-w__foot">
            {t('analytics.ret.definition', {
              gap: ret.gapMinutes === 1440 ? t('analytics.ret.gap24h') : t('analytics.ret.gap30'),
            })}{' '}
            <button type="button" className="link-button" onClick={onHow}>
              {t('analytics.ret.how')}
            </button>
          </p>
        </div>
      )}
    </Widget>
  );
}

export function DevicesWidget({
  devices,
  browsers,
  ...c
}: Common & { devices: Record<string, number>; browsers: Record<string, number> }) {
  const { t } = useTranslation();
  const kinds = ['desktop', 'mobile', 'tablet'] as const;
  const dRows: Row[] = kinds.map((k) => ({
    key: k,
    label: t(`analytics.deviceKinds.${k}`),
    value: devices[k] ?? 0,
  }));
  const sorted = Object.entries(browsers)
    .filter(([k]) => k !== 'unknown')
    .sort((a, b) => b[1] - a[1]);
  const others = sorted.slice(3).reduce((n, [, v]) => n + v, 0) + (browsers.unknown ?? 0);
  const bRows: Row[] = [
    ...sorted
      .slice(0, 3)
      .map(([k, v]) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), value: v })),
    ...(others ? [{ key: 'others', label: t('analytics.others'), value: others }] : []),
  ];
  const empty = dRows.every((r) => r.value === 0) && bRows.length === 0;
  return (
    <Widget {...c} title={t('analytics.devicesBrowsers')} icon={<MonitorSmartphone />} empty={empty}>
      <h3 className="an-w__sub">{t('analytics.device')}</h3>
      <Rows rows={dRows} label={t('analytics.device')} />
      <h3 className="an-w__sub">{t('analytics.browser')}</h3>
      <Rows rows={bRows} label={t('analytics.browser')} />
    </Widget>
  );
}
