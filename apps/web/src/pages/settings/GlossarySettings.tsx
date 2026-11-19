import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { Json, Tables } from '@flowdsiml/supabase-types';
import { foldText } from '@flowdsiml/core';
import { SettingsShell } from './SettingsShell';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { downloadText } from '../../lib/download';
import { formatNumber } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { Menu } from '../../components/Menu';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  DEF_MAX,
  GLOSSARY_MAX,
  TERM_MAX,
  exportCsv,
  previewImport,
  splitForms,
  termKey,
  type ImportPreview,
} from './glossaryCsv';
import './glossary.css';

type Term = Tables<'glossary_terms'>;

/** Réglage du workspace : soulignement actif par défaut. */
function underlineOn(settings: Json | null | undefined): boolean {
  const g = (settings as { glossary?: { underline?: boolean } } | null)?.glossary;
  return g?.underline !== false;
}

/**
 * L17-06 à 08 : Paramètres › Glossaire (propriétaires, admins et éditeurs). Tableau trié sur le nouveau
 * terme, recherche, nombre de modules publiés qui contiennent le terme, ajout et modification,
 * suppression confirmée, import CSV avec aperçu, export, réglage « Souligner les termes ».
 */
export function GlossarySettings() {
  const { t } = useTranslation();
  const { current, can, reload } = useWorkspace();
  const ws = current!;
  const toast = useToast();
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Term | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Term | null>(null);
  const [importing, setImporting] = useState(false);
  const [underline, setUnderline] = useState(() => underlineOn(ws.settings));
  const editable = can('demo.edit');

  const load = useCallback(async () => {
    const [r, u] = await Promise.all([
      supabase.from('glossary_terms').select('*').eq('workspace_id', ws.id),
      supabase.rpc('glossary_usage', { p_ws: ws.id }),
    ]);
    setTerms([...(r.data ?? [])].sort((a, b) => a.term.localeCompare(b.term, 'fr', { sensitivity: 'base' })));
    const list = Array.isArray(u.data) ? (u.data as Array<{ id: string; modules: number }>) : [];
    setUsage(Object.fromEntries(list.map((x) => [x.id, x.modules])));
  }, [ws.id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setUnderline(underlineOn(ws.settings)), [ws.settings]);

  const fq = foldText(q.trim());
  const shown = useMemo(
    () =>
      (terms ?? []).filter(
        (x) => !fq || [x.term, x.old_term ?? '', x.definition].some((s) => foldText(s).includes(fq)),
      ),
    [terms, fq],
  );

  async function toggleUnderline(on: boolean) {
    setUnderline(on);
    const { error } = await supabase.rpc('glossary_set_underline', { p_ws: ws.id, p_on: on });
    if (error) {
      setUnderline(!on);
      toast(error.message);
      return;
    }
    toast(t(on ? 'glossary.underlineOn' : 'glossary.underlineOff'));
    void reload();
  }

  if (!editable) return <SettingsShell>{null}</SettingsShell>;

  return (
    <SettingsShell>
      <section className="gl-page" aria-labelledby="gl-title">
        <div className="gl-head">
          <div>
            <h2 className="t-h2" id="gl-title">
              {t('glossary.title')}
            </h2>
            <p className="muted">{t('glossary.intro')}</p>
          </div>
          <div className="gl-acts">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}>
              <Upload aria-hidden="true" />
              {t('glossary.import')}
            </button>
            {!!terms?.length && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => downloadText('glossaire.csv', exportCsv(terms))}
              >
                <Download aria-hidden="true" />
                {t('glossary.export')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={(terms?.length ?? 0) >= GLOSSARY_MAX}
              onClick={() => setEditing('new')}
            >
              <Plus aria-hidden="true" />
              {t('glossary.add')}
            </button>
          </div>
        </div>

        {terms && terms.length === 0 ? (
          <div className="card">
            <div className="empty" role="status">
              <h3 className="t-h3">{t('glossary.emptyTitle')}</h3>
              <p className="muted">{t('glossary.emptyBody')}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                {t('glossary.add')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="card-head">
                <div className="input-affix gl-search">
                  <Search aria-hidden="true" />
                  <input
                    className="input input-sm"
                    type="search"
                    placeholder={t('glossary.search')}
                    aria-label={t('glossary.search')}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <span className="t-caption muted" role="status">
                  {terms ? t('glossary.count', { count: shown.length }) : ''}
                </span>
              </div>
              <div className="table-wrap">
                <table className="table gl-table">
                  <caption className="sr-only">{t('glossary.caption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('glossary.colTerm')}</th>
                      <th scope="col">{t('glossary.colOld')}</th>
                      <th scope="col">{t('glossary.colDef')}</th>
                      <th scope="col" className="r">
                        {t('glossary.colModules')}
                      </th>
                      <th scope="col">
                        <span className="sr-only">{t('glossary.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((x) => (
                      <tr key={x.id}>
                        <th scope="row">{x.term}</th>
                        <td className="gl-old">{x.old_term ? <s>{x.old_term}</s> : null}</td>
                        <td className="gl-def">{x.definition}</td>
                        <td className="r num">{formatNumber(usage[x.id] ?? 0)}</td>
                        <td className="r">
                          <Menu
                            label={t('glossary.actionsFor', { term: x.term })}
                            items={[
                              {
                                label: t('glossary.edit'),
                                icon: <Pencil aria-hidden="true" />,
                                onSelect: () => setEditing(x),
                              },
                              {
                                label: t('glossary.delete'),
                                icon: <Trash2 aria-hidden="true" />,
                                danger: true,
                                onSelect: () => setDeleting(x),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {terms && shown.length === 0 && (
                  <p className="muted gl-nomatch">{t('glossary.noMatch', { q: q.trim() })}</p>
                )}
              </div>
            </div>
            <div className="card gl-setting">
              <label className="setting">
                <span>
                  <span className="t-label">{t('glossary.underline')}</span>
                  <span className="help">{t('glossary.underlineHelp')}</span>
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={underline}
                    onChange={(e) => void toggleUnderline(e.target.checked)}
                  />
                  <span aria-hidden="true" />
                </span>
              </label>
            </div>
          </>
        )}
      </section>

      {editing && (
        <TermDialog
          wsId={ws.id}
          term={editing === 'new' ? null : editing}
          terms={terms ?? []}
          onClose={() => setEditing(null)}
          onSaved={(added) => {
            setEditing(null);
            toast(t(added ? 'glossary.added' : 'glossary.saved'));
            void load();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        danger
        title={t('glossary.deleteTitle', { term: deleting?.term ?? '' })}
        body={t('glossary.deleteBody')}
        confirmLabel={t('glossary.delete')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const d = deleting!;
          check(await supabase.from('glossary_terms').delete().eq('id', d.id));
          setDeleting(null);
          toast(t('glossary.deleted', { term: d.term }));
          void load();
        }}
      />
      {importing && (
        <ImportDialog
          wsId={ws.id}
          terms={terms ?? []}
          onClose={() => setImporting(false)}
          onDone={(summary) => {
            setImporting(false);
            toast(t('glossary.imported', { summary }));
            void load();
          }}
        />
      )}
    </SettingsShell>
  );
}

/** L17-08 : modale « Ajouter un terme » / « Modifier le terme ». */
function TermDialog({
  wsId,
  term,
  terms,
  onClose,
  onSaved,
}: {
  wsId: string;
  term: Term | null;
  terms: Term[];
  onClose: () => void;
  onSaved: (added: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(term?.term ?? '');
  const [old, setOld] = useState(term?.old_term ?? '');
  const [def, setDef] = useState(term?.definition ?? '');
  const [forms, setForms] = useState((term?.forms ?? []).join(', '));
  const [errs, setErrs] = useState<{ term?: string; def?: string }>({});
  const { busy, error, run } = useAction();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const d = def.trim();
    const next: typeof errs = {};
    if (!n) next.term = t('glossary.errTermEmpty');
    else if (terms.some((x) => x.id !== term?.id && termKey(x.term) === termKey(n)))
      next.term = t('glossary.errTaken');
    if (!d) next.def = t('glossary.errDefEmpty');
    setErrs(next);
    if (next.term || next.def) return;
    await run(async () => {
      const row = { term: n, old_term: old.trim() || null, definition: d, forms: splitForms(forms) };
      const res = term
        ? await supabase.from('glossary_terms').update(row).eq('id', term.id)
        : await supabase.from('glossary_terms').insert({ ...row, workspace_id: wsId });
      if (res.error?.code === '23505') {
        setErrs({ term: t('glossary.errTaken') });
        return;
      }
      if (res.error?.message.includes('GLOSSARY_LIMIT')) throw new Error(t('glossary.errLimit'));
      check(res);
      onSaved(!term);
    });
  }

  const titleKey = term ? 'glossary.editTitle' : 'glossary.addTitle';
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal gl-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gl-term-t"
        onSubmit={submit}
        noValidate
      >
        <div className="modal-head">
          <h2 id="gl-term-t">{t(titleKey)}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body gl-fields">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="gl-new">{t('glossary.fTerm')}</label>
            <input
              id="gl-new"
              className="input"
              autoFocus
              maxLength={TERM_MAX}
              value={name}
              aria-invalid={errs.term ? true : undefined}
              aria-describedby={errs.term ? 'gl-new-err' : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setErrs((x) => ({ ...x, term: undefined }));
              }}
            />
            {errs.term && (
              <p id="gl-new-err" className="field-error">
                {errs.term}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="gl-old">
              {t('glossary.fOld')} <span className="opt">{t('glossary.optional')}</span>
            </label>
            <input
              id="gl-old"
              className="input"
              maxLength={TERM_MAX}
              value={old}
              aria-describedby="gl-old-help"
              onChange={(e) => setOld(e.target.value)}
            />
            <span id="gl-old-help" className="help">
              {t('glossary.fOldHelp')}
            </span>
          </div>
          <div className="field">
            <label htmlFor="gl-def">{t('glossary.fDef')}</label>
            <textarea
              id="gl-def"
              className="textarea"
              rows={3}
              maxLength={DEF_MAX}
              value={def}
              aria-invalid={errs.def ? true : undefined}
              aria-describedby={errs.def ? 'gl-def-err gl-def-n' : 'gl-def-n'}
              onChange={(e) => {
                setDef(e.target.value);
                setErrs((x) => ({ ...x, def: undefined }));
              }}
            />
            {errs.def && (
              <p id="gl-def-err" className="field-error">
                {errs.def}
              </p>
            )}
            <span id="gl-def-n" className="help num gl-counter">
              {def.length} / {DEF_MAX}
            </span>
          </div>
          <div className="field">
            <label htmlFor="gl-forms">
              {t('glossary.fForms')} <span className="opt">{t('glossary.optional')}</span>
            </label>
            <input
              id="gl-forms"
              className="input"
              value={forms}
              aria-describedby="gl-forms-help"
              onChange={(e) => setForms(e.target.value)}
            />
            <span id="gl-forms-help" className="help">
              {t('glossary.fFormsHelp')}
            </span>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {term ? t('common.save') : t('glossary.addGo')}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Import CSV : choix du fichier, aperçu (ajouts, mises à jour, lignes ignorées et motif), import. */
function ImportDialog({
  wsId,
  terms,
  onClose,
  onDone,
}: {
  wsId: string;
  terms: Term[];
  onClose: () => void;
  onDone: (summary: string) => void;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [readErr, setReadErr] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useAction();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function pick(file: File | undefined) {
    setPreview(null);
    setReadErr(false);
    if (!file) return;
    try {
      setPreview(previewImport(await file.text(), terms));
    } catch {
      setReadErr(true);
    }
  }

  async function go() {
    if (!preview) return;
    await run(async () => {
      const rows = [...preview.add, ...preview.update];
      const { data, error: e } = await supabase.rpc('glossary_import', {
        p_ws: wsId,
        p_rows: rows as unknown as Json,
      });
      if (e) throw e;
      const r = (data ?? {}) as { added?: number; updated?: number };
      const add = r.added ?? preview.add.length;
      const update = r.updated ?? preview.update.length;
      onDone([t('glossary.addedN', { count: add }), t('glossary.updatedN', { count: update })].join(', '));
    });
  }

  const count = preview ? preview.add.length + preview.update.length : 0;
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal gl-modal" role="dialog" aria-modal="true" aria-labelledby="gl-imp-t">
        <div className="modal-head">
          <h2 id="gl-imp-t">{t('glossary.importTitle')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body gl-fields">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <p className="muted">{t('glossary.importHelp')}</p>
          <div className="field">
            <label htmlFor="gl-file">{t('glossary.importFile')}</label>
            {/* Sélecteur natif masqué (son libellé suit la langue du navigateur) : bouton traduit */}
            <input
              id="gl-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileName(f?.name ?? '');
                void pick(f);
              }}
            />
            <div className="gl-file">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                {t('glossary.chooseFile')}
              </button>
              <span className={fileName ? undefined : 'muted'}>{fileName || t('glossary.noFile')}</span>
            </div>
          </div>
          {readErr && (
            <p className="field-error" role="alert">
              {t('glossary.importError')}
            </p>
          )}
          {preview && (
            <div className="gl-preview" role="status">
              <ul className="gl-counts">
                <li>{t('glossary.importAdd', { count: preview.add.length })}</li>
                <li>{t('glossary.importUpdate', { count: preview.update.length })}</li>
                <li>{t('glossary.importSkipped', { count: preview.skipped.length })}</li>
              </ul>
              {preview.skipped.length > 0 && (
                <ul className="gl-skipped">
                  {preview.skipped.map((s) => (
                    <li key={s.line}>
                      {t('glossary.importLine', { line: s.line, reason: t(`glossary.reason.${s.reason}`) })}
                    </li>
                  ))}
                </ul>
              )}
              {count === 0 && <p className="muted">{t('glossary.importNothing')}</p>}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!preview || count === 0 || busy}
            onClick={() => void go()}
          >
            {t('glossary.importGo')}
          </button>
        </div>
      </div>
    </div>
  );
}
