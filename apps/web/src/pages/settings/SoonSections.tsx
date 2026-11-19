import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { extractVariableKeys } from '@flowdsiml/core';
import { SettingsShell } from './SettingsShell';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { formatNumber } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';

/**
 * Paramètres › Variables (PRM-08) : variables du workspace (table variables, partagées par toutes les
 * démos), avec le nombre de démos qui les utilisent dans leurs textes, et création d'une variable.
 */
export function VariablesSettings() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const ws = current!;
  const [vars, setVars] = useState<Tables<'variables'>[] | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const editable = can('demo.edit');

  const load = useCallback(async () => {
    const [v, d, s, h] = await Promise.all([
      supabase.from('variables').select('*').eq('workspace_id', ws.id).order('key'),
      supabase.from('demos').select('id').eq('workspace_id', ws.id).is('deleted_at', null),
      supabase.from('steps').select('demo_id, title, body').eq('workspace_id', ws.id),
      supabase.from('hotspots').select('demo_id, title, body').eq('workspace_id', ws.id),
    ]);
    setVars(v.data ?? []);
    const alive = new Set((d.data ?? []).map((x) => x.id));
    const used = new Map<string, Set<string>>();
    for (const r of [...(s.data ?? []), ...(h.data ?? [])]) {
      if (!alive.has(r.demo_id)) continue;
      for (const k of extractVariableKeys(`${r.title} ${r.body}`)) {
        if (!used.has(k)) used.set(k, new Set());
        used.get(k)!.add(r.demo_id);
      }
    }
    setUsage(Object.fromEntries([...used].map(([k, set]) => [k, set.size])));
  }, [ws.id]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SettingsShell>
      <section className="card st-vars" aria-labelledby="var-title">
        <div className="card-head">
          <div>
            <h2 className="t-h3" id="var-title">
              {t('settings.variables')}
            </h2>
            <p className="t-caption muted">
              {t('vars.help1')} <span className="t-mono">{'{{nom}}'}</span>
              {t('vars.help2')}
            </p>
          </div>
          {editable && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              {t('vars.new')}
            </button>
          )}
        </div>
        {vars && vars.length === 0 ? (
          <p className="muted st-vars-empty">{t('vars.empty')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t('settings.variables')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('vars.variable')}</th>
                  <th scope="col">{t('vars.type')}</th>
                  <th scope="col">{t('vars.default')}</th>
                  <th scope="col" className="r">
                    {t('vars.usedIn')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(vars ?? []).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <span className="t-mono badge badge-primary">{`{{${v.key}}}`}</span>
                    </td>
                    <td>{t('vars.text')}</td>
                    <td className="muted">{v.default_value || '—'}</td>
                    <td className="r">
                      {usage[v.key]
                        ? t('vars.demos', { count: usage[v.key], n: formatNumber(usage[v.key]!) })
                        : t('vars.unused')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {creating && (
        <NewVariableDialog
          wsId={ws.id}
          taken={(vars ?? []).map((v) => v.key)}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </SettingsShell>
  );
}

function NewVariableDialog({
  wsId,
  taken,
  onClose,
  onCreated,
}: {
  wsId: string;
  taken: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [key, setKey] = useState('');
  const [def, setDef] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) return setErr(t('vars.keyInvalid'));
    if (taken.includes(k)) return setErr(t('vars.keyTaken'));
    setErr(null);
    await run(async () => {
      check(
        await supabase
          .from('variables')
          .insert({ workspace_id: wsId, key: k, label: k, default_value: def.trim() }),
      );
      toast(t('vars.created', { key: k }));
      onCreated();
    });
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="var-new-t" onSubmit={submit}>
        <div className="modal-head">
          <h2 id="var-new-t">{t('vars.new')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="var-key">{t('vars.key')}</label>
            <input
              id="var-key"
              className="input t-mono"
              autoFocus
              maxLength={40}
              value={key}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? 'var-key-err var-key-help' : 'var-key-help'}
              onChange={(e) => {
                setKey(e.target.value.toLowerCase());
                setErr(null);
              }}
            />
            {err && (
              <p id="var-key-err" className="field-error">
                {err}
              </p>
            )}
            <span id="var-key-help" className="help">
              {t('vars.keyHelp')}
            </span>
          </div>
          <div className="field st-gen-first">
            <label htmlFor="var-def">
              {t('vars.default')} <span className="opt">{t('plans.optional')}</span>
            </label>
            <input
              id="var-def"
              className="input"
              maxLength={200}
              value={def}
              onChange={(e) => setDef(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('vars.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
