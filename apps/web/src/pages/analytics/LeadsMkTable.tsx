import { Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { formatDateTime, formatNumber, formatRelativeShort } from '../../lib/format';
import { useConfirm } from '../../components/ConfirmDialog';
import { YesNo } from '../../components/YesNo';

interface LeadRow {
  id: string;
  email: string;
  fields: Record<string, unknown> | null;
  consent: boolean;
  created_at: string;
  demo_id: string | null;
  max_step: number | null;
  completed: boolean;
  steps_total: number;
}
const PAGE = 50;

/**
 * Leads au format de la maquette analytics.html (onglet Leads, ANA-08) : case à cocher, Email,
 * Entreprise, Démo, Progression, Collecté ; Consentement et suppression (RGPD) en fin de ligne.
 * Lecture via workspace_leads (rôle editor et plus). L'export se fait par le bouton de l'en-tête.
 */
export function LeadsMkTable({
  wsId,
  days,
  demo,
  title,
  onChange,
}: {
  wsId: string;
  days: number;
  demo: string;
  title: (id: string) => string;
  /** Prévient la page quand le nombre total de leads change (suppression). */
  onChange?: (total: number) => void;
}) {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<{ total: number; rows: LeadRow[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { error, run } = useAction();

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('workspace_leads', {
      p_workspace: wsId,
      p_from: new Date(Date.now() - days * 86400_000).toISOString(),
      p_to: new Date().toISOString(),
      p_demo: demo || null,
      p_limit: PAGE,
      p_offset: page * PAGE,
    });
    setRes((data as unknown as { total: number; rows: LeadRow[] }) ?? { total: 0, rows: [] });
    setSelected(new Set());
  }, [wsId, days, demo, page]);

  useEffect(() => setPage(0), [days, demo]);
  useEffect(() => {
    void load();
  }, [load]);

  async function remove(ids: string[], label: string) {
    if (
      !(await ask({
        title: t('leads.deleteTitle', { count: ids.length, email: label }),
        body: t('leads.deleteBody'),
        confirmLabel: t('common.delete'),
        danger: true,
      }))
    )
      return;
    await run(async () => {
      check(await supabase.from('leads').delete().in('id', ids));
      await load();
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId);
      onChange?.(count ?? 0);
    });
  }

  if (!res) return null;
  if (res.total === 0)
    return (
      <div className="card">
        <div className="empty">
          <Users aria-hidden="true" className="an-empty-ic" />
          <h3>{t('leads.emptyTitle')}</h3>
          <p className="muted">{t('leads.emptyBody')}</p>
        </div>
      </div>
    );

  const all = res.rows.length > 0 && res.rows.every((r) => selected.has(r.id));
  const from = page * PAGE + 1;
  const to = Math.min(res.total, (page + 1) * PAGE);
  return (
    <div className="card">
      {dialog}
      {error && (
        <div className="alert alert-danger an-leads-alert" role="alert">
          {error}
        </div>
      )}
      {selected.size > 0 && (
        <div className="row between an-bulk">
          <span className="t-label">{t('leads.selected', { count: selected.size })}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm an-danger"
            onClick={() => void remove([...selected], '')}
          >
            <Trash2 aria-hidden="true" />
            {t('leads.deleteSelected')}
          </button>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">{t('analytics.tab.leads')}</caption>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label={t('leads.selectAll')}
                  checked={all}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(res.rows.map((r) => r.id)) : new Set())
                  }
                />
              </th>
              <th>{t('leads.email')}</th>
              <th>{t('leads.company')}</th>
              <th>{t('leads.demo')}</th>
              <th className="r">{t('analytics.progress')}</th>
              <th>{t('leads.collected')}</th>
              <th>{t('leads.consent')}</th>
              <th>
                <span className="sr-only">{t('members.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {res.rows.map((l) => {
              const company = typeof l.fields?.company === 'string' ? l.fields.company : '—';
              return (
                <tr key={l.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={t('leads.select', { email: l.email })}
                      checked={selected.has(l.id)}
                      onChange={(e) => {
                        const n = new Set(selected);
                        if (e.target.checked) n.add(l.id);
                        else n.delete(l.id);
                        setSelected(n);
                      }}
                    />
                  </td>
                  <td>
                    <b>{l.email}</b>
                  </td>
                  <td>{company}</td>
                  <td>{l.demo_id ? title(l.demo_id) : '—'}</td>
                  <td className="r">
                    {l.completed ? (
                      <span className="badge badge-success">{t('analytics.completed')}</span>
                    ) : (
                      <span className="num">
                        {(l.max_step ?? -1) + 1} / {l.steps_total}
                      </span>
                    )}
                  </td>
                  <td className="muted">
                    <time dateTime={l.created_at} title={formatDateTime(l.created_at)}>
                      {formatRelativeShort(l.created_at)}
                    </time>
                  </td>
                  <td>
                    <YesNo value={l.consent} />
                  </td>
                  <td className="r">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label={t('leads.deleteOne', { email: l.email })}
                      onClick={() => void remove([l.id], l.email)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {res.total > PAGE && (
        <div className="row between an-pager">
          <span className="t-caption muted">
            {t('analytics.range', {
              from: formatNumber(from),
              to: formatNumber(to),
              total: formatNumber(res.total),
            })}
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-disabled={page === 0 ? 'true' : undefined}
              onClick={() => page > 0 && setPage(page - 1)}
            >
              {t('analytics.prev')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-disabled={to >= res.total ? 'true' : undefined}
              onClick={() => to < res.total && setPage(page + 1)}
            >
              {t('analytics.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
