/**
 * L48-D §4 : onglet Démos. Une ligne par démo (séries L47 filtrées par la source, le segment et la
 * période de la barre) ; tri par en-tête (Vues décroissant par défaut), ligne entière cliquable vers
 * l'analytics de la démo, 25 lignes puis « Afficher plus ». Sous 768 px : la démo et la colonne triée,
 * tri par un menu « Trier par ».
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { completionRate } from '@flowdsiml/core';
import { formatNumber } from '../../lib/format';
import { Menu } from '../../components/Menu';

type Col = 'views' | 'visitors' | 'completion' | 'leads';
export interface DemoRowData {
  demo_id: string;
  views: number;
  visitors: number;
  completions: number;
  leads: number;
  /** A8 : sessions qui ont vu le guide du Sandbox, l'ont terminé, l'ont quitté sans le terminer. */
  guideStarted?: number;
  guideDone?: number;
  guideSkipped?: number;
}
const PAGE = 25;

export function DemosTab({
  demos,
  rows,
  canLeads,
}: {
  demos: Array<{ id: string; title: string; folder: string | null; sandbox?: boolean }>;
  rows: DemoRowData[];
  canLeads: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ col: Col; desc: boolean }>({ col: 'views', desc: true });
  const [limit, setLimit] = useState(PAGE);
  const cols: Col[] = canLeads
    ? ['views', 'visitors', 'completion', 'leads']
    : ['views', 'visitors', 'completion'];
  const byId = new Map(rows.map((r) => [r.demo_id, r]));
  const value = (id: string, c: Col): number | null => {
    const r = byId.get(id);
    if (!r || r.views === 0) return null;
    return c === 'completion' ? completionRate(r.visitors, r.completions) : r[c];
  };
  const list = [...demos].sort((a, b) => {
    const va = value(a.id, sort.col);
    const vb = value(b.id, sort.col);
    if (va === vb) return a.title.localeCompare(b.title);
    if (va === null) return 1;
    if (vb === null) return -1;
    return sort.desc ? vb - va : va - vb;
  });
  const show = (id: string, c: Col) => {
    const v = value(id, c);
    if (v === null) return <span className="an-dash">–</span>;
    return c === 'completion' ? `${Math.round(v * 100)}\u00a0%` : formatNumber(v);
  };
  const click = (c: Col) => {
    setSort((s) => (s.col === c ? { col: c, desc: !s.desc } : { col: c, desc: true }));
    setLimit(PAGE);
  };
  const label = (c: Col) => t(`kpi.col.${c}`);
  // A8 : ligne du guide d'un Sandbox (pourcentages des sessions qui l'ont vu)
  const pct = (n = 0, of = 0) => (of ? Math.round((n / of) * 100) : 0);
  const guideLine = (r: DemoRowData) =>
    t('analytics.guideLine', {
      done: pct(r.guideDone, r.guideStarted),
      skip: pct(r.guideSkipped, r.guideStarted),
    });
  return (
    <div className="fd-card an-demos">
      <div className="an-demos__sort">
        <Menu
          label={t('analytics.sortBy')}
          align="start"
          trigger={{ text: `${t('analytics.sortBy')} : ${label(sort.col)}`, chevron: true }}
          items={cols.map((c) => ({ label: label(c), current: c === sort.col, onSelect: () => click(c) }))}
        />
      </div>
      <table className="an-demos__t">
        <caption className="sr-only">{t('analytics.tab.demos')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('kpi.demo')}</th>
            {cols.map((c) => (
              <th
                key={c}
                scope="col"
                className={`r${c === sort.col ? ' is-sorted' : ' an-demos__opt'}`}
                aria-sort={c === sort.col ? (sort.desc ? 'descending' : 'ascending') : 'none'}
              >
                <button type="button" className="an-demos__h" onClick={() => click(c)}>
                  {label(c)}
                  {c === sort.col &&
                    (sort.desc ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />)}
                </button>
              </th>
            ))}
            <th scope="col" className="an-demos__go">
              <span className="sr-only">{t('analytics.openDemo')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, limit).map((d) => (
            <tr key={d.id} onClick={() => navigate(`/demos/${d.id}/analytics`)}>
              <td>
                <Link
                  to={`/demos/${d.id}/analytics`}
                  onClick={(e) => e.stopPropagation()}
                  className="an-demos__name"
                >
                  {d.title}
                </Link>
                {d.folder && <span className="an-demos__folder">{d.folder}</span>}
                {d.sandbox && (byId.get(d.id)?.guideStarted ?? 0) > 0 && (
                  <span className="an-demos__guide">{guideLine(byId.get(d.id)!)}</span>
                )}
              </td>
              {cols.map((c) => (
                <td key={c} className={`r num${c === sort.col ? '' : ' an-demos__opt'}`}>
                  {show(d.id, c)}
                </td>
              ))}
              <td className="an-demos__go" aria-hidden="true">
                <ChevronRight />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > limit && (
        <button type="button" className="fd-btn an-demos__more" onClick={() => setLimit(limit + PAGE)}>
          {t('analytics.showMore')}
        </button>
      )}
    </div>
  );
}
