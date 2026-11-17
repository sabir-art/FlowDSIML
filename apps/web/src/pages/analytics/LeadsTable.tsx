import { ScrollX } from '../../components/ScrollX';
import { formatDateTime } from '../../lib/format';
import { useConfirm } from '../../components/ConfirmDialog';
import { YesNo } from '../../components/YesNo';
import { Download, Inbox, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toCsv } from '@flowdsiml/core';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { downloadText } from '../../lib/download';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type Lead = Tables<'leads'> & { demos: { title: string } | null };

/** Liste des leads (d'une démo ou de tout le workspace), recherche, export CSV, suppression (RGPD). */
export function LeadsTable({ demoId }: { demoId?: string }) {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const { current, can } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState('');
  const { error, run } = useAction();

  const load = useCallback(async () => {
    let query = supabase
      .from('leads')
      .select('*, demos(title)')
      .eq('workspace_id', current!.id)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (demoId) query = query.eq('demo_id', demoId);
    if (q.trim()) query = query.ilike('email', `%${q.trim()}%`);
    const { data } = await query;
    setLeads((data ?? []) as Lead[]);
  }, [current, demoId, q]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  const known: Record<string, string> = {
    full_name: t('editor.fieldName'),
    company: t('editor.fieldCompany'),
    job_title: t('editor.fieldJob'),
    phone: t('editor.fieldPhone'),
  };
  const fieldLabel = (k: string) => known[k] ?? k;
  const fieldKeys = [
    ...new Set(leads.flatMap((l) => Object.keys((l.fields as Record<string, unknown>) ?? {}))),
  ];

  function exportCsv() {
    const headers = ['email', ...fieldKeys, 'demo', 'consent', 'created_at'];
    const rows = leads.map((l) => [
      l.email,
      ...fieldKeys.map((k) => (l.fields as Record<string, unknown>)?.[k] ?? ''),
      l.demos?.title ?? '',
      l.consent ? 'yes' : 'no',
      l.created_at,
    ]);
    downloadText(`leads-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {dialog}
      {error && <Alert kind="error">{error}</Alert>}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <input
          className="fd-input"
          style={{ maxWidth: 280 }}
          type="search"
          placeholder={t('leads.search')}
          aria-label={t('leads.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {leads.length > 0 && (
          <Button icon={<Download />} onClick={exportCsv}>
            {t('analytics.exportCsv')}
          </Button>
        )}
        <span className="fd-muted">{t('leads.count', { count: leads.length })}</span>
      </div>
      {leads.length === 0 && q.trim() ? (
        <p className="fd-muted">{t('leads.noMatch')}</p>
      ) : leads.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            <Inbox size={24} />
          </span>
          <p className="empty-state__title">{t('leads.empty')}</p>
          <p className="fd-muted">{t('leads.emptyHint')}</p>
          {can('demo.edit') && (
            <Link className="fd-btn fd-btn--sm" to={demoId ? `/demos/${demoId}/edit` : '/'}>
              <span className="fd-btn__icon" aria-hidden="true">
                <Plus />
              </span>
              {t('leads.addForm')}
            </Link>
          )}
        </div>
      ) : (
        <ScrollX label={t('leads.title')}>
          <table className="fd-table">
            <thead>
              <tr>
                <th>Email</th>
                {fieldKeys.map((k) => (
                  <th key={k}>{fieldLabel(k)}</th>
                ))}
                {!demoId && <th>{t('leads.demo')}</th>}
                <th>{t('leads.consent')}</th>
                <th>{t('leads.date')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{l.email}</td>
                  {fieldKeys.map((k) => (
                    <td key={k}>{String((l.fields as Record<string, unknown>)?.[k] ?? '')}</td>
                  ))}
                  {!demoId && <td>{l.demos?.title ?? '—'}</td>}
                  <td>
                    <YesNo value={l.consent} />
                  </td>
                  <td>{formatDateTime(l.created_at)}</td>
                  <td>
                    {can('members.manage') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="btn-danger-ghost"
                        icon={<Trash2 />}
                        aria-label={t('leads.delete', { email: l.email })}
                        onClick={() =>
                          void ask({
                            title: t('leads.confirmDelete', { email: l.email }),
                            confirmLabel: t('common.delete'),
                            danger: true,
                          }).then(
                            (yes) =>
                              yes &&
                              void run(async () => {
                                check(await supabase.from('leads').delete().eq('id', l.id));
                                await load();
                              }),
                          )
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      )}
    </div>
  );
}
