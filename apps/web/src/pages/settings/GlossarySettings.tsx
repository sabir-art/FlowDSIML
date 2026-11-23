import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BookA, CircleAlert, Download, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
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
import { Button, Modal } from '@flowdsiml/ui';
import { FileUp } from 'lucide-react';
import { FileDropzone } from '../../components/FileDropzone';

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

  if (!editable) return <SettingsShell legacy={false}>{null}</SettingsShell>;

  const full = (terms?.length ?? 0) >= GLOSSARY_MAX;
  return (
    <SettingsShell
      legacy={false}
      actions={
        <>
          <Button icon={<Upload size={16} />} onClick={() => setImporting(true)}>
            {t('glossary.import')}
          </Button>
          {!!terms?.length && (
            <Button
              icon={<Download size={16} />}
              onClick={() => downloadText('glossaire.csv', exportCsv(terms))}
            >
              {t('glossary.export')}
            </Button>
          )}
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            disabled={full}
            onClick={() => setEditing('new')}
          >
            {t('glossary.add')}
          </Button>
        </>
      }
    >
      <section className="stg-sec gl-page" aria-labelledby="gl-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="gl-title">{t('glossary.title')}</h2>
            <p>{t('glossary.intro')}</p>
          </div>
          {!!terms?.length && (
            <div className="stg-sec__acts">
              <label className="stg-search">
                <span className="sr-only">{t('glossary.search')}</span>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder={t('glossary.search')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        {terms && terms.length === 0 ? (
          <div className="stg-empty">
            <span className="stg-empty__tile" aria-hidden="true">
              <BookA size={20} />
            </span>
            <h3>{t('glossary.emptyTitle')}</h3>
            <p>{t('glossary.emptyBody')}</p>
            <div className="stg-empty__acts">
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
                {t('glossary.add')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="sr-only" role="status">
              {terms ? t('glossary.count', { count: shown.length }) : ''}
            </p>
            <table className="stg-table gl-table">
              <caption className="sr-only">{t('glossary.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('glossary.colTerm')}</th>
                  <th scope="col">{t('glossary.colOld')}</th>
                  <th scope="col" className="stg-table__m-hide">
                    {t('glossary.colDef')}
                  </th>
                  <th scope="col" className="gl-num stg-table__m-hide">
                    {t('glossary.colModules')}
                  </th>
                  <th scope="col" className="stg-table__act">
                    <span className="sr-only">{t('glossary.actions')}</span>
                  </th>
                </tr>
              </thead>
              {/* §18.6 : lignes à filets, l'écart est porté par la hauteur des lignes */}
              <tbody data-gap-exempt="">
                {shown.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">{x.term}</th>
                    <td className="stg-muted">{x.old_term ? <s>{x.old_term}</s> : null}</td>
                    <td className="gl-def stg-table__m-hide">{x.definition}</td>
                    <td className="gl-num num stg-table__m-hide">{formatNumber(usage[x.id] ?? 0)}</td>
                    <td className="stg-table__act">
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
              <p className="stg-table__empty">{t('glossary.noMatch', { q: q.trim() })}</p>
            )}
          </>
        )}
      </section>
      {!!terms?.length && (
        <section className="stg-sec" aria-labelledby="gl-player">
          <div className="stg-sec__head">
            <div>
              <h2 id="gl-player">{t('glossary.playerTitle')}</h2>
            </div>
          </div>
          <div className="stg-row stg-row--inline">
            <div className="stg-text" data-gap-exempt="">
              <div className="stg-lab" id="gl-ul">
                {t('glossary.underline')}
              </div>
              <div className="stg-help" id="gl-ul-h">
                {t('glossary.underlineHelp')}
              </div>
            </div>
            <div className="stg-ctl">
              <label className="fd-switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-labelledby="gl-ul"
                  aria-describedby="gl-ul-h"
                  checked={underline}
                  onChange={(e) => void toggleUnderline(e.target.checked)}
                />
                <span className="fd-switch__track" aria-hidden="true" />
              </label>
            </div>
          </div>
        </section>
      )}

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

  const opt = <span className="stg-soon">{t('glossary.optional')}</span>;
  const err = (id: string, text?: string) =>
    text && (
      <p id={id} className="stg-error">
        <CircleAlert size={16} aria-hidden="true" />
        {text}
      </p>
    );
  return (
    <Modal
      open
      onClose={onClose}
      icon={<BookA />}
      title={t(term ? 'glossary.editTitle' : 'glossary.addTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="gl-form" disabled={busy}>
            {term ? t('common.save') : t('glossary.addGo')}
          </Button>
        </>
      }
    >
      <form id="gl-form" className="st-invite__form" onSubmit={submit} noValidate>
        {error && (
          <p className="stg-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="fd-modal__field">
          <label htmlFor="gl-new">{t('glossary.fTerm')}</label>
          <input
            id="gl-new"
            className="fd-input"
            autoFocus
            autoComplete="off"
            maxLength={TERM_MAX}
            value={name}
            aria-invalid={errs.term ? true : undefined}
            aria-describedby={errs.term ? 'gl-new-err' : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setErrs((x) => ({ ...x, term: undefined }));
            }}
          />
          {err('gl-new-err', errs.term)}
        </div>
        <div className="fd-modal__field">
          <label htmlFor="gl-old">
            {t('glossary.fOld')} {opt}
          </label>
          <input
            id="gl-old"
            className="fd-input"
            autoComplete="off"
            maxLength={TERM_MAX}
            value={old}
            aria-describedby="gl-old-help"
            onChange={(e) => setOld(e.target.value)}
          />
          <span id="gl-old-help" className="stg-help">
            {t('glossary.fOldHelp')}
          </span>
        </div>
        <div className="fd-modal__field">
          <label htmlFor="gl-def">{t('glossary.fDef')}</label>
          <textarea
            id="gl-def"
            className="fd-textarea"
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
          {err('gl-def-err', errs.def)}
          <span id="gl-def-n" className="stg-help num gl-counter">
            {def.length} / {DEF_MAX}
          </span>
        </div>
        <div className="fd-modal__field">
          <label htmlFor="gl-forms">
            {t('glossary.fForms')} {opt}
          </label>
          <input
            id="gl-forms"
            className="fd-input"
            autoComplete="off"
            value={forms}
            aria-describedby="gl-forms-help"
            onChange={(e) => setForms(e.target.value)}
          />
          <span id="gl-forms-help" className="stg-help">
            {t('glossary.fFormsHelp')}
          </span>
        </div>
      </form>
    </Modal>
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
  /** Fichier refusé (pas un CSV) : nom affiché dans l'erreur de la zone, rien n'est importé. */
  const [badType, setBadType] = useState('');
  const { busy, error, run } = useAction();

  async function pick(file: File | undefined) {
    setPreview(null);
    setReadErr(false);
    setBadType('');
    setFileName('');
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') return setBadType(file.name);
    setFileName(file.name);
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
    <Modal
      open
      onClose={onClose}
      icon={<Upload />}
      title={t('glossary.importTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!preview || count === 0 || busy} onClick={() => void go()}>
            {t('glossary.importGo')}
          </Button>
        </>
      }
    >
      <div className="st-invite__form">
        {error && (
          <p className="stg-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </p>
        )}
        <p className="stg-help gl-imp-help">{t('glossary.importHelp')}</p>
        {/* MEDIA-01 §18.2 : zone de dépôt sans Médiathèque */}
        <FileDropzone
          label={t('glossary.importFile')}
          accept=".csv,text/csv"
          hint={t('dropzone.csvHint')}
          icon={<FileUp />}
          inputId="gl-file"
          file={fileName ? { name: fileName, meta: t('dropzone.csvHint') } : null}
          error={badType ? t('glossary.importBadType', { name: badType }) : undefined}
          onFiles={(files) => void pick(files[0])}
        />
        {readErr && (
          <p className="stg-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
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
            {count === 0 && <p className="stg-muted">{t('glossary.importNothing')}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
