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
        <Button size="sm" onClick={exportCsv} disabled={!leads.length}>
          {t('analytics.exportCsv')}
        </Button>
        <span className="fd-muted">{t('leads.count', { count: leads.length })}</span>
      </div>
      {leads.length === 0 ? (
        <p className="fd-muted">{t('leads.empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="fd-table">
            <thead>
              <tr>
                <th>Email</th>
                {fieldKeys.map((k) => (
                  <th key={k}>{k}</th>
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
                  <td>{l.consent ? '✓' : '—'}</td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>
                    {can('members.manage') && (
                      <Button
                        size="sm"
                        variant="danger"
                        aria-label={t('leads.delete', { email: l.email })}
                        onClick={() =>
                          confirm(t('leads.confirmDelete', { email: l.email })) &&
                          void run(async () => {
                            check(await supabase.from('leads').delete().eq('id', l.id));
                            await load();
                          })
                        }
                      >
                        ✕
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
