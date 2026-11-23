import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Info, TriangleAlert, WandSparkles, X } from 'lucide-react';
import { readDataset, type CsvEncoding, type CsvSeparator, type DatasetError } from '@flowdsiml/core';
import type { DatasetBinding } from '@flowdsiml/manifest';
import { Button, Select } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asOps, htmlSelection, shortTrail } from '../html/htmlModel';
import { DATASET_OPEN } from '../html/ChartFields';
import { removeDataset, saveDataset, useDataset } from './datasetStore';
import { AiDataset } from '../../../components/ai/AiDataset';
import { asSettings } from '../types';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { FileUp } from 'lucide-react';
import { FileDropzone, isCsvFile } from '../../../components/FileDropzone';

const ICON = { size: 16, 'aria-hidden': true } as const;

interface Draft {
  name: string;
  columns: string[];
  rows: string[][];
  separator: CsvSeparator | null;
  encoding: CsvEncoding | null;
}
interface Target {
  value: string;
  label: string;
  binding: Omit<DatasetBinding, 'column'>;
}

/** Valeur d'une liaison dans le select (« el|étape|sélecteur », « chart|étape|op », « var|clé »). */
export const bindingValue = (b: Omit<DatasetBinding, 'column'>) =>
  b.kind === 'element'
    ? `el|${b.stepId}|${b.sel}`
    : b.kind === 'chart'
      ? `chart|${b.stepId}|${b.opId}`
      : `var|${b.key}`;

/**
 * L25-09 : modale « Jeu de données » (CSV). Fichier (lignes, colonnes, séparateur, encodage),
 * aperçu des 3 premières lignes, « Relier les colonnes » (élément d'une étape HTML, graphique,
 * variable), « Ligne utilisée ». Colonnes personnelles refusées à l'import. Ouverte depuis un
 * graphique (« Depuis un jeu de données ») ou depuis Réglages > Jeu de données.
 */
export function DatasetDialog({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const demo = editor.demo;
  const { dataset } = useDataset(demo?.id);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<{ stepId: string; sel: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [binds, setBinds] = useState<Record<string, string>>({});
  const [rowMode, setRowMode] = useState<'link' | 'first'>('first');
  const [error, setError] = useState<string | null>(null);
  /** Dernier fichier choisi refusé : erreur de la zone ; tant qu'elle est là, rien ne peut être relié. */
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // L30-06 : génération de données fictives (Assistance IA)
  const [generating, setGenerating] = useState(false);
  const { current: ws } = useWorkspace();

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ stepId?: string; sel?: string } | undefined>).detail;
      setFocus(d?.stepId && d.sel ? { stepId: d.stepId, sel: d.sel } : null);
      setOpen(true);
    };
    window.addEventListener(DATASET_OPEN, on);
    return () => window.removeEventListener(DATASET_OPEN, on);
  }, []);

  // À l'ouverture : le jeu enregistré (s'il y en a un)
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError(null);
      setDraft(
        dataset
          ? {
              name: dataset.name,
              columns: dataset.columns,
              rows: dataset.rows,
              separator: null,
              encoding: null,
            }
          : null,
      );
      setBinds(Object.fromEntries((dataset?.bindings ?? []).map((b) => [b.column, bindingValue(b)])));
      setRowMode(dataset?.row_mode ?? 'first');
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepNo = (stepId?: string) => editor.steps.findIndex((s) => s.id === stepId) + 1;
  /** Cibles proposées : élément sélectionné, éléments modifiés, graphiques, variables. */
  const targets = useMemo<Target[]>(() => {
    const out: Target[] = [];
    const seen = new Set<string>();
    const push = (x: Target) => {
      if (seen.has(x.value)) return;
      seen.add(x.value);
      out.push(x);
    };
    const cur = htmlSelection();
    if (cur.stepId && cur.selected && !cur.selected.chart)
      push({
        value: `el|${cur.stepId}|${cur.selected.sel}`,
        label: t('editor.dataset.targetEl', {
          sel: cur.selected.short,
          text: cur.selected.text.trim().slice(0, 30),
          n: stepNo(cur.stepId),
        }),
        binding: { kind: 'element', stepId: cur.stepId, sel: cur.selected.sel, label: cur.selected.short },
      });
    for (const s of editor.steps) {
      if (s.kind !== 'html') continue;
      for (const o of asOps(s.html_ops)) {
        if (o.op === 'text')
          push({
            value: `el|${s.id}|${o.sel}`,
            label: t('editor.dataset.targetEl', {
              sel: shortTrail(o.sel),
              text: (o.before ?? '').slice(0, 30),
              n: stepNo(s.id),
            }),
            binding: { kind: 'element', stepId: s.id, sel: o.sel, label: shortTrail(o.sel) },
          });
        if (o.op === 'chart') {
          const title = (o.value && typeof o.value === 'object' && 'rows' in o.value && o.value.title) || '';
          push({
            value: `chart|${s.id}|${o.id}`,
            label: t('editor.dataset.targetChart', { title, n: stepNo(s.id) }),
            binding: { kind: 'chart', stepId: s.id, opId: o.id, label: title },
          });
        }
      }
    }
    for (const v of editor.variables)
      push({
        value: `var|${v.key}`,
        label: t('editor.dataset.targetVar', { key: `{{${v.key}}}` }),
        binding: { kind: 'variable', key: v.key, label: v.label },
      });
    // Liaisons enregistrées dont la cible n'est plus proposée : gardées
    for (const b of dataset?.bindings ?? [])
      push({ value: bindingValue(b), label: b.label || bindingValue(b), binding: b });
    // Graphique d'où la modale est ouverte : en tête
    if (focus) {
      const op = asOps(editor.steps.find((s) => s.id === focus.stepId)?.html_ops).find(
        (o) => o.op === 'chart' && o.sel === focus.sel,
      );
      const i = op ? out.findIndex((x) => x.value === `chart|${focus.stepId}|${op.id}`) : -1;
      if (i > 0) out.unshift(...out.splice(i, 1));
    }
    return out;
  }, [open, editor.steps, editor.variables, dataset, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkCol = draft?.columns.find((c) => binds[c]?.startsWith('var|')) ?? null;
  const linkKey = linkCol ? binds[linkCol]!.slice(4) : '';

  const errorText = (e: DatasetError) =>
    e.code === 'personal' || e.code === 'duplicate' || e.code === 'cellTooLong'
      ? t(`editor.dataset.err_${e.code}`, { name: e.column })
      : t(`editor.dataset.err_${e.code}`);

  async function onFile(f: File) {
    setError(null);
    setFileError(null);
    // Recette UX du 23/11 : un fichier refusé se lit dans la zone ; l'aperçu de l'ancien fichier se retire
    if (!isCsvFile(f)) return setFileError(t('editor.dataset.err_notCsv', { name: f.name }));
    const r = readDataset(new Uint8Array(await f.arrayBuffer()));
    if (!r.ok) {
      setFileError(errorText(r.error));
      return;
    }
    setDraft({ name: f.name.slice(0, 120), ...r.data });
    setBinds((b) => Object.fromEntries(Object.entries(b).filter(([c]) => r.data.columns.includes(c))));
  }

  async function save() {
    if (!demo || !draft || readOnly) return;
    setBusy(true);
    setError(null);
    try {
      const bindings: DatasetBinding[] = draft.columns.flatMap((c) => {
        const tg = targets.find((x) => x.value === binds[c]);
        return tg ? [{ column: c, ...tg.binding }] : [];
      });
      const mode = rowMode === 'link' && linkCol ? 'link' : 'first';
      await saveDataset(demo.id, demo.workspace_id, {
        name: draft.name,
        columns: draft.columns,
        rows: draft.rows,
        bindings,
        row_mode: mode,
        link_column: mode === 'link' ? linkCol : null,
      });
      setOpen(false);
    } catch {
      setError(t('editor.dataset.saveError'));
    } finally {
      setBusy(false);
    }
  }

  const sepLabel = draft?.separator === ';' ? t('editor.dataset.sepSemi') : t('editor.dataset.sepComma');
  return (
    <dialog ref={ref} className="dialog ds-dialog" aria-labelledby={`${id}-t`} onClose={() => setOpen(false)}>
      <div className="gdpr-head">
        <span className="gdpr-chip" aria-hidden="true">
          <Database />
        </span>
        <h2 id={`${id}-t`}>{t('editor.dataset.title')}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon ds-close"
          aria-label={t('common.close')}
          onClick={() => setOpen(false)}
        >
          <X {...ICON} />
        </button>
      </div>
      <div className="dialog-body stack">
        {/* MEDIA-01 §18.2 : zone de dépôt du fichier CSV, sans Médiathèque ; l'IA est une autre source */}
        <FileDropzone
          label={t('editor.dataset.import')}
          accept=".csv,text/csv"
          hint={t('dropzone.csvHint')}
          icon={<FileUp />}
          inputId="datasetdialog-file"
          readOnly={readOnly}
          file={
            draft
              ? {
                  name: draft.name,
                  meta: draft.separator
                    ? t('editor.dataset.fileInfo', {
                        rows: t('editor.dataset.rowsN', { count: draft.rows.length }),
                        cols: t('editor.dataset.colsN', { count: draft.columns.length }),
                        sep: sepLabel,
                        enc: draft.encoding,
                      })
                    : t('editor.dataset.fileSaved', {
                        rows: t('editor.dataset.rowsN', { count: draft.rows.length }),
                        cols: t('editor.dataset.colsN', { count: draft.columns.length }),
                      }),
                }
              : null
          }
          error={fileError}
          onFiles={(files) => files[0] && void onFile(files[0])}
          extra={
            ws && !readOnly && !generating ? (
              <Button icon={<WandSparkles />} onClick={() => setGenerating(true)}>
                {t('ai.dataset.open')}
              </Button>
            ) : undefined
          }
        />
        {generating && ws && (
          <AiDataset
            ws={ws.id}
            lang={asSettings(editor.demo!.settings).locale ?? 'fr'}
            onCancel={() => setGenerating(false)}
            onUse={(d) => {
              setGenerating(false);
              setError(null);
              setFileError(null);
              setDraft({
                name: t('ai.dataset.name'),
                columns: d.columns,
                rows: d.rows,
                separator: null,
                encoding: null,
              });
              setBinds({});
            }}
          />
        )}
        {error && (
          <div className="fd-alert fd-alert--danger" role="alert">
            <TriangleAlert {...ICON} />
            <div>{error}</div>
          </div>
        )}
        {draft && !fileError && (
          <>
            <table className="ds-table">
              <caption>{t('editor.dataset.preview')}</caption>
              <thead>
                <tr>
                  {draft.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.rows.slice(0, 3).map((r, i) => (
                  <tr key={i}>
                    {r.map((x, j) => (
                      <td key={j}>{x}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="ds-table ds-binds">
              <caption>{t('editor.dataset.bind')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('editor.dataset.column')}</th>
                  <th scope="col">{t('editor.dataset.target')}</th>
                </tr>
              </thead>
              <tbody>
                {draft.columns.map((c) => (
                  <tr key={c}>
                    <th scope="row">{c}</th>
                    <td>
                      <Select
                        size="sm"
                        aria-label={t('editor.dataset.bindCol', { name: c })}
                        disabled={readOnly}
                        value={binds[c] ?? ''}
                        onChange={(e) => setBinds((b) => ({ ...b, [c]: e.target.value }))}
                      >
                        <option value="">{t('editor.dataset.noBind')}</option>
                        {targets.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <fieldset className="ds-mode">
              <legend>{t('editor.dataset.rowMode')}</legend>
              <label>
                <input
                  type="radio"
                  name={`${id}-mode`}
                  checked={rowMode === 'link' && !!linkCol}
                  disabled={readOnly || !linkCol}
                  onChange={() => setRowMode('link')}
                />
                <span>
                  {linkCol
                    ? t('editor.dataset.modeLink', { col: linkCol, key: `{{${linkKey}}}` })
                    : t('editor.dataset.modeLinkOff')}
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name={`${id}-mode`}
                  checked={rowMode === 'first' || !linkCol}
                  disabled={readOnly}
                  onChange={() => setRowMode('first')}
                />
                <span>{t('editor.dataset.modeFirst')}</span>
              </label>
              <p className="help">{t('editor.dataset.modeHelp')}</p>
            </fieldset>
          </>
        )}
        <div className="fd-alert fd-alert--info" role="note">
          <Info {...ICON} />
          <div>{t('editor.dataset.notice')}</div>
        </div>
      </div>
      <div className="dialog-actions">
        {dataset && !readOnly && (
          <Button
            variant="ghost"
            onClick={() =>
              void removeDataset(demo!.id)
                .then(() => setOpen(false))
                .catch(() => setError(t('editor.dataset.saveError')))
            }
          >
            {t('editor.dataset.remove')}
          </Button>
        )}
        <Button onClick={() => setOpen(false)}>{t('editor.dataset.cancel')}</Button>
        <Button
          variant="primary"
          disabled={readOnly || !draft || !!fileError || busy}
          onClick={() => void save()}
        >
          {t('editor.dataset.save')}
        </Button>
      </div>
    </dialog>
  );
}
