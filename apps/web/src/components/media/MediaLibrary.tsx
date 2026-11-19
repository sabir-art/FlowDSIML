import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileType, Search, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { foldText } from '@flowdsiml/core';
import { supabase } from '../../lib/supabase';
import { useConfirm } from '../ConfirmDialog';
import './media.css';

export type MediaFile = Tables<'media_files'>;
type Filter = 'all' | 'logo' | 'image' | 'font';

export const MEDIA_QUOTA = 500 * 1024 * 1024;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.png,.jpg,.jpeg,.svg,.woff2,image/png,image/jpeg,image/svg+xml,font/woff2';

/** URL publique d'un fichier de la médiathèque (logo, image, police). */
export const mediaUrl = (path: string) => supabase.storage.from('media').getPublicUrl(path).data.publicUrl;

/** L18-03 : taille réelle lisible, en Ko sous 1 Mo, sinon en Mo à une décimale. */
export const sizeLabel = (n: number, locale: string) => {
  const fr = locale.startsWith('fr');
  return n < 1024 * 1024
    ? `${Math.max(n > 0 ? 1 : 0, Math.round(n / 1024)).toLocaleString(locale)}${fr ? '\u202fKo' : ' KB'}`
    : `${(n / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })}${fr ? '\u202fMo' : ' MB'}`;
};

/**
 * L18-03 / 04 : médiathèque du workspace (modale de 720 px). Recherche, filtre Tout / Logos / Images /
 * Polices, grille avec « Importer » en première case (glisser-déposer), sélection, pied avec usage et
 * quota. Les fichiers passent par la fonction media (type réel, SVG assaini, quota). Un SVG n'est
 * affiché qu'en <img>.
 */
export function MediaLibrary({
  wsId,
  kind,
  onPick,
  onClose,
}: {
  wsId: string;
  /** Usage du champ qui ouvre la médiathèque (filtre initial et type importé). */
  kind?: 'logo' | 'image' | 'font';
  /** Absent : consultation (Paramètres › Marque), sans « Utiliser ce fichier ». */
  onPick?: (file: MediaFile) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [dialog, ask] = useConfirm();
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [used, setUsed] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>(kind ?? 'all');
  // L18-03 : fichier importé non vérifié (l'avertissement lui est rattaché, pas en bandeau)
  const [warnId, setWarnId] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const load = useCallback(async () => {
    const [f, u, s] = await Promise.all([
      supabase
        .from('media_files')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false }),
      supabase.rpc('media_usage', { p_ws: wsId }),
      supabase.rpc('media_used', { p_ws: wsId }),
    ]);
    setFiles(f.data ?? []);
    const list = Array.isArray(u.data) ? (u.data as Array<{ id: string; demos: number }>) : [];
    setUsage(Object.fromEntries(list.map((x) => [x.id, x.demos])));
    setUsed(Number(s.data ?? 0));
  }, [wsId]);
  useEffect(() => {
    void load();
  }, [load]);

  const fq = foldText(q.trim());
  const shown = useMemo(
    () =>
      (files ?? []).filter(
        (f) => (filter === 'all' || f.kind === filter) && (!fq || foldText(f.name).includes(fq)),
      ),
    [files, filter, fq],
  );
  const selected = files?.find((f) => f.id === sel) ?? null;

  async function upload(list: FileList | File[]) {
    const file = list[0];
    if (!file) return;
    setErr(null);
    if (file.size > MAX_BYTES) return setErr(t('media.tooBig'));
    if (used + file.size > MEDIA_QUOTA) return setErr(t('media.full'));
    const font = /\.woff2$/i.test(file.name) || file.type === 'font/woff2';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('ws', wsId);
    fd.append('kind', font ? 'font' : kind === 'logo' || filter === 'logo' ? 'logo' : 'image');
    fd.append('name', file.name.slice(0, 120));
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('media', { body: fd });
    setBusy(false);
    if (error || !data?.id) {
      const code = await readCode(error);
      return setErr(
        code === 'MEDIA_QUOTA'
          ? t('media.full')
          : code === 'TOO_BIG'
            ? t('media.tooBig')
            : code === 'BAD_TYPE'
              ? t('media.badType')
              : code === 'SVG_REJECTED'
                ? t('media.svgRejected')
                : t('media.error'),
      );
    }
    await load();
    setSel(data.id as string);
    // L18-03 : une image importée n'est pas vérifiée automatiquement (données personnelles)
    setWarnId(font ? null : (data.id as string));
  }

  async function remove(f: MediaFile) {
    const n = usage[f.id] ?? 0;
    const yes = await ask({
      title: t('media.deleteTitle', { name: f.name }),
      body: n ? t('media.inUse', { count: n }) : t('media.deleteBody'),
      confirmLabel: t('media.delete'),
      danger: true,
    });
    if (!yes) return;
    const { error } = await supabase.functions.invoke('media', { method: 'DELETE', body: { id: f.id } });
    if (error) return setErr(t('media.error'));
    setSel(null);
    await load();
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };
  const empty = files !== null && files.length === 0;
  const quota = t('media.quota', { used: sizeLabel(used, i18n.language), total: '500' });

  return (
    <dialog ref={ref} className="mk md-dialog" aria-labelledby="md-title" onClose={onClose}>
      {dialog}
      <div className="modal-head">
        <h2 id="md-title">{t('media.title')}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('common.close')}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body md-body">
        <input
          ref={input}
          type="file"
          hidden
          accept={ACCEPT}
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = '';
          }}
        />
        {err && (
          <div className="alert alert-danger" role="alert">
            {err}
          </div>
        )}
        {/* L18-04 : recherche et filtre toujours présents (inactifs quand la médiathèque est vide) */}
        <div className="md-tools">
          <div className="input-affix md-search">
            <Search aria-hidden="true" />
            <input
              className="input input-sm"
              type="search"
              placeholder={t('media.search')}
              aria-label={t('media.search')}
              value={q}
              disabled={empty}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="segmented" role="radiogroup" aria-label={t('media.filter')}>
            {(['all', 'logo', 'image', 'font'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                disabled={empty}
                onClick={() => setFilter(f)}
              >
                {t(`media.filter_${f}`)}
              </button>
            ))}
          </div>
          <span className="sr-only" role="status">
            {files ? t('media.count', { count: shown.length }) : ''}
          </span>
        </div>
        {empty ? (
          <button
            type="button"
            className={`md-drop md-drop--first${drag ? ' is-over' : ''}`}
            disabled={busy}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            <Upload aria-hidden="true" />
            <b>{t('media.importFirst')}</b>
            <span className="help">{t('media.importHelp')}</span>
          </button>
        ) : (
          <>
            <ul className="md-grid" aria-label={t('media.files')}>
              <li>
                <button
                  type="button"
                  className={`md-drop${drag ? ' is-over' : ''}`}
                  disabled={busy}
                  onClick={() => input.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={onDrop}
                >
                  <Upload aria-hidden="true" />
                  <b>{busy ? t('media.uploading') : t('media.import')}</b>
                  <span className="help">{t('media.types')}</span>
                </button>
              </li>
              {shown.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="md-tile"
                    aria-pressed={sel === f.id}
                    title={f.name}
                    onClick={() => {
                      setSel(f.id);
                      setErr(null);
                    }}
                    onDoubleClick={() => onPick && (onPick(f), ref.current?.close())}
                  >
                    <span className="md-thumb">
                      {f.kind === 'font' ? (
                        <FileType aria-hidden="true" />
                      ) : (
                        // SVG compris : toujours en <img>, jamais en ligne
                        <img src={mediaUrl(f.path)} alt="" loading="lazy" />
                      )}
                    </span>
                    <span className="md-name">{f.name}</span>
                    {warnId === f.id && (
                      <span className="md-tile-warn" title={t('editor.importUnverified')}>
                        <TriangleAlert aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="modal-foot md-foot">
        <div className="md-info">
          {selected ? (
            <>
              <b className="md-sel-name">{selected.name}</b>
              <span className="help">
                {t('media.usedIn', { count: usage[selected.id] ?? 0 })} ·{' '}
                {sizeLabel(selected.size_bytes ?? 0, i18n.language)} · {quota}
              </span>
              {warnId === selected.id && (
                <span className="md-sel-warn" role="status">
                  <TriangleAlert aria-hidden="true" />
                  {t('editor.importUnverified')}
                </span>
              )}
            </>
          ) : (
            <span className="help">{quota}</span>
          )}
        </div>
        {selected && (
          <button type="button" className="btn btn-ghost btn-sm md-del" onClick={() => void remove(selected)}>
            <Trash2 aria-hidden="true" />
            {t('media.delete')}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
          {onPick ? t('common.cancel') : t('common.close')}
        </button>
        {onPick && (
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onPick(selected);
              ref.current?.close();
            }}
          >
            {t('media.use')}
          </button>
        )}
      </div>
    </dialog>
  );
}

/** Code d'erreur renvoyé par la fonction media (corps JSON de la réponse). */
async function readCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response } | null)?.context;
  try {
    return ctx ? (((await ctx.json()) as { error?: string }).error ?? null) : null;
  } catch {
    return null;
  }
}
