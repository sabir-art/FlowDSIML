import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { extractVariableKeys } from '@flowdsiml/core';
import { SettingsShell } from './SettingsShell';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { formatNumber } from '../../lib/format';
import { keyFromLabel, labelFromKey } from '../../lib/varCatalog';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { Menu } from '../../components/Menu';
import '../editor/vars/vars.css';
import { Empty } from '@flowdsiml/ui';
import { Braces } from 'lucide-react';

type Row = Tables<'variables'>;

/**
 * Paramètres › Variables (PRM-08, L46) : mots définis une fois pour l'espace, puis insérés dans toutes
 * les démos. Tableau sans clé technique (libellé, description, exemple, repli, démos qui l'utilisent),
 * création et modification dans un tiroir, suppression confirmée avec le nombre de démos concernées.
 */
export function VariablesSettings() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const ws = current!;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [vars, setVars] = useState<Row[] | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Row | 'new' | null>(params.get('nouveau') ? 'new' : null);
  const [dialog, ask] = useConfirm();
  const editable = can('demo.edit');

  const load = useCallback(async () => {
    const [v, d, s, h] = await Promise.all([
      supabase.from('variables').select('*').eq('workspace_id', ws.id).order('label'),
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

  async function remove(v: Row) {
    const n = usage[v.key] ?? 0;
    const ok = await ask({
      title: t('vars.deleteTitle', { name: v.label || labelFromKey(v.key) }),
      body: n ? t('vars.deleteBody', { count: n }) : t('vars.deleteUnused'),
      confirmLabel: t('vars.delete'),
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('variables').delete().eq('id', v.id);
    if (error) return toast(error.message);
    toast(t('vars.deleted', { name: v.label || labelFromKey(v.key) }));
    void load();
  }

  return (
    <SettingsShell>
      {dialog}
      <section className="card st-vars" aria-labelledby="var-title">
        <div className="card-head">
          <div>
            <h2 className="t-h3" id="var-title">
              {t('settings.variables')}
            </h2>
            <p className="t-caption muted">{t('vars.intro')}</p>
          </div>
          {editable && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              {t('vars.new')}
            </button>
          )}
        </div>
        {vars && vars.length === 0 ? (
          <Empty
            level={3}
            icon={<Braces />}
            title={t('vars.emptyTitle')}
            body={t('vars.emptyBody')}
            action={
              editable ? (
                <button type="button" className="fd-btn fd-btn--primary" onClick={() => setEditing('new')}>
                  <Plus aria-hidden="true" />
                  {t('vars.new')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table st-vars-table">
              <caption className="sr-only">{t('settings.variables')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('vars.name')}</th>
                  <th scope="col">{t('vars.example')}</th>
                  <th scope="col">{t('vars.ifUnknown')}</th>
                  <th scope="col" className="r">
                    {t('vars.usedIn')}
                  </th>
                  {editable && (
                    <th scope="col">
                      <span className="sr-only">{t('vars.actions')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(vars ?? []).map((v) => {
                  const name = v.label || labelFromKey(v.key);
                  return (
                    <tr key={v.id}>
                      <td>
                        <b>{name}</b>
                        {v.description && <small className="st-vars-desc">{v.description}</small>}
                      </td>
                      <td>{v.example || '—'}</td>
                      <td className="muted">{v.default_value || '—'}</td>
                      <td className="r t-num">
                        {usage[v.key]
                          ? t('vars.demos', { count: usage[v.key], n: formatNumber(usage[v.key]!) })
                          : t('vars.unused')}
                      </td>
                      {editable && (
                        <td className="r">
                          <Menu
                            label={t('vars.actionsFor', { name })}
                            items={[
                              { label: t('vars.edit'), icon: <Pencil />, onSelect: () => setEditing(v) },
                              {
                                label: t('vars.delete'),
                                icon: <Trash2 />,
                                danger: true,
                                onSelect: () => void remove(v),
                              },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <VariableDrawer
          wsId={ws.id}
          row={editing === 'new' ? null : editing}
          initialLabel={editing === 'new' ? (params.get('nouveau') ?? '') : ''}
          taken={(vars ?? []).map((v) => v.key)}
          onClose={() => {
            setEditing(null);
            if (params.get('nouveau')) setParams({}, { replace: true });
          }}
          onSaved={() => {
            setEditing(null);
            if (params.get('nouveau')) setParams({}, { replace: true });
            void load();
          }}
        />
      )}
    </SettingsShell>
  );
}

function VariableDrawer({
  wsId,
  row,
  initialLabel,
  taken,
  onClose,
  onSaved,
}: {
  wsId: string;
  row: Row | null;
  initialLabel: string;
  taken: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [label, setLabel] = useState(row ? row.label || labelFromKey(row.key) : initialLabel);
  const [description, setDescription] = useState(row?.description ?? '');
  const [example, setExample] = useState(row?.example ?? '');
  const [value, setValue] = useState(row?.value ?? '');
  const [fallback, setFallback] = useState(row?.default_value ?? '');
  const [err, setErr] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !example.trim()) return setErr(t('vars.required'));
    setErr(null);
    await run(async () => {
      const fields = {
        label: label.trim(),
        description: description.trim(),
        example: example.trim(),
        value: value.trim() || null,
        default_value: fallback.trim(),
      };
      if (row) {
        check(await supabase.from('variables').update(fields).eq('id', row.id));
      } else {
        // Clé créée à partir du libellé, unique dans l'espace (jamais montrée ailleurs que pour le CSV)
        const base = keyFromLabel(label);
        let key = base;
        for (let i = 2; taken.includes(key); i++) key = `${base.slice(0, 36)}_${i}`;
        check(await supabase.from('variables').insert({ workspace_id: wsId, key, ...fields }));
      }
      toast(t(row ? 'vars.saved' : 'vars.created', { name: label.trim() }));
      onSaved();
    });
  }

  const field = (
    id: string,
    name: string,
    v: string,
    set: (s: string) => void,
    max: number,
    opts: { required?: boolean; help?: string; autoFocus?: boolean } = {},
  ) => (
    <div className="field">
      <label htmlFor={id}>
        {name} {!opts.required && <span className="opt">{t('plans.optional')}</span>}
      </label>
      <input
        id={id}
        className="input"
        maxLength={max}
        required={opts.required}
        autoFocus={opts.autoFocus}
        value={v}
        aria-describedby={opts.help ? `${id}-h` : undefined}
        onChange={(e) => set(e.target.value)}
      />
      {opts.help && (
        <span className="help" id={`${id}-h`}>
          {opts.help}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="modal-backdrop var-drawer-back"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="modal var-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="var-drawer-t"
        onSubmit={submit}
      >
        <div className="modal-head">
          <h2 id="var-drawer-t">{row ? t('vars.editTitle') : t('vars.new')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body fd-stack">
          {(error || err) && (
            <div className="alert alert-danger" role="alert">
              {error || err}
            </div>
          )}
          {field('var-label', t('vars.name'), label, setLabel, 40, { required: true, autoFocus: true })}
          {field('var-desc', t('vars.description'), description, setDescription, 80)}
          {field('var-ex', t('vars.example'), example, setExample, 80, {
            required: true,
            help: t('vars.exampleHelp'),
          })}
          {field('var-value', t('vars.value'), value, setValue, 200, { help: t('vars.valueHelp') })}
          {field('var-fb', t('vars.ifUnknown'), fallback, setFallback, 40, { help: t('vars.ifUnknownHelp') })}
          {row && (
            <p className="help">
              {t('vars.keyForCsv')} <span className="t-mono">{row.key}</span>
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {row ? t('common.save') : t('vars.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
