/**
 * /media : la Médiathèque de l'espace (retours client du 24/11 §3.4, maquettes retours-2411/media-page,
 * media-menu, media-import). Zone d'import, recherche, filtres avec compteurs, occupation, cartes.
 * La catégorie d'un fichier est déduite à l'import et se change dans le menu de sa carte.
 * Rôle lecteur : consultation seule, sans import ni menu.
 */
import { useId, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Download, FileType, Pencil, Presentation, Search, Trash2 } from 'lucide-react';
import { Button, Modal } from '@flowdsiml/ui';
import { foldText } from '@flowdsiml/core';
import { AppPage } from '../../components/AppPage';
import { FileDropzone } from '../../components/FileDropzone';
import { Menu } from '../../components/Menu';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { QuotaDialog } from '../../components/QuotaDialog';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { mediaUrl, sizeLabel } from '../../components/media/MediaLibrary';
import {
  MEDIA_ACCEPT,
  MEDIA_QUOTA,
  useMedia,
  type MediaFile,
  type MediaFilter,
} from '../../components/media/useMedia';
import './media-page.css';

const FILTERS: MediaFilter[] = ['all', 'logo', 'image', 'font'];

export function MediaPage() {
  const { t, i18n } = useTranslation();
  const { current, can } = useWorkspace();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const m = useMedia(current?.id);
  const editable = can('demo.edit');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [upErr, setUpErr] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [renaming, setRenaming] = useState<MediaFile | null>(null);
  const [usedBy, setUsedBy] = useState<{
    file: MediaFile;
    demos: Array<{ id: string; title: string }>;
  } | null>(null);

  const files = m.files;
  const counts = useMemo(() => {
    const c: Record<MediaFilter, number> = { all: files?.length ?? 0, logo: 0, image: 0, font: 0 };
    for (const f of files ?? []) c[f.kind as 'logo' | 'image' | 'font']++;
    return c;
  }, [files]);
  const fq = foldText(q.trim());
  const shown = useMemo(
    () =>
      (files ?? []).filter(
        (f) => (filter === 'all' || f.kind === filter) && (!fq || foldText(f.name).includes(fq)),
      ),
    [files, filter, fq],
  );
  const empty = files !== null && files.length === 0;

  /** Ouvre le menu de la carte (toast « Changer » : la catégorie s'y trouve). */
  const openMenu = (id: string) => {
    const btn = document.querySelector<HTMLButtonElement>(`[data-media-card="${id}"] .mp-card__menu button`);
    btn?.scrollIntoView({ block: 'nearest' });
    btn?.focus();
    btn?.click();
  };

  const upload = async (list: FileList | File[]) => {
    setUpErr(null);
    for (const file of Array.from(list)) {
      const r = await m.upload(file, filter);
      if (!r.ok) {
        if (r.error === 'quota') setFull(true);
        else setUpErr(t(`media.${r.error === 'error' ? 'error' : r.error}`));
        return;
      }
      toast(
        t('media.imported', { name: r.file.name, category: t(`media.filter_${r.file.kind}`) }),
        r.file.kind === 'font' ? undefined : { label: t('media.change'), onClick: () => openMenu(r.file.id) },
        // La raison du classement, quand il a été déduit du fichier
        r.reason === 'svg' || r.reason === 'transparentSquare'
          ? { detail: t(`media.reason.${r.reason}`) }
          : undefined,
      );
    }
  };

  const remove = async (f: MediaFile) => {
    const n = m.usage[f.id] ?? 0;
    const yes = await ask({
      title: t('media.deleteTitle', { name: f.name }),
      body: n ? t('media.inUse', { count: n }) : t('media.deleteBody'),
      confirmLabel: t('media.delete'),
      danger: true,
    });
    if (yes && !(await m.remove(f.id))) toast(t('media.error'), undefined, { tone: 'warning' });
  };
  const showDemos = async (f: MediaFile) => {
    const { data } = await supabase.rpc('media_file_demos', { p_id: f.id });
    setUsedBy({ file: f, demos: (data ?? []) as Array<{ id: string; title: string }> });
  };
  const download = (f: MediaFile) => {
    const a = document.createElement('a');
    a.href = `${mediaUrl(f.path)}?download=${encodeURIComponent(f.name)}`;
    a.download = f.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const setKind = async (f: MediaFile, kind: 'logo' | 'image') => {
    if (f.kind === kind) return;
    if (await m.setKind(f.id, kind))
      toast(t('media.kindChanged', { name: f.name, category: t(`media.filter_${kind}`) }));
    else toast(t('media.error'), undefined, { tone: 'warning' });
  };

  const meta = (f: MediaFile) => {
    const n = m.usage[f.id] ?? 0;
    return `${t(`media.kind.${f.kind}`)} · ${n ? t('media.usedIn', { count: n }) : t('media.unused')}`;
  };

  return (
    <AppPage title={t('media.title')} className="mp">
      {dialog}
      {editable && (
        <FileDropzone
          className="mp-zone"
          label={t('media.import')}
          inputId="media-page-file"
          accept={MEDIA_ACCEPT}
          multiple
          title={t(empty ? 'media.importFirst' : 'media.dropHere')}
          hint={t('media.pageHint')}
          pickLabel={t('dropzone.import')}
          busy={m.busy}
          busyLabel={t('media.uploading')}
          error={upErr}
          onFiles={(list) => void upload(list)}
        />
      )}
      {full && (
        <QuotaDialog
          title={t('quota.title')}
          body={t('usage.blocked.storage')}
          figures={t('quota.storage', {
            used: sizeLabel(m.used, i18n.language),
            total: sizeLabel(MEDIA_QUOTA, i18n.language),
          })}
          onClose={() => setFull(false)}
        />
      )}
      {empty && !editable && <p className="mp-none">{t('media.noneYet')}</p>}
      {/* Médiathèque vide : seulement la zone d'import (ni recherche ni filtres sur une liste vide) */}
      {!empty && files !== null && (
        <>
          <div className="fd-toolbar mp-tools">
            <div className="fd-toolbar__group" role="group" aria-label={t('toolbar.filters')}>
              <label className="fd-toolbar__search mp-search">
                <span className="sr-only">{t('media.search')}</span>
                <Search aria-hidden="true" />
                <input
                  className="fd-input"
                  type="search"
                  placeholder={t('media.search')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <div className="fd-segmented" role="radiogroup" aria-label={t('media.category')}>
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {t(`media.filter_${f}`)} <span className="mp-n">{counts[f]}</span>
                  </button>
                ))}
              </div>
            </div>
            <span className="mp-quota">
              {t('media.quota', { used: sizeLabel(m.used, i18n.language), total: '500' })}
            </span>
            <span className="sr-only" role="status">
              {t('media.count', { count: shown.length })}
            </span>
          </div>
          {shown.length === 0 ? (
            <div className="mp-nomatch">
              <p className="mp-none">{t('media.noMatch')}</p>
              {q && <Button onClick={() => setQ('')}>{t('media.clearSearch')}</Button>}
            </div>
          ) : (
            <ul className="mp-grid" aria-label={t('media.files')}>
              {shown.map((f) => (
                <li key={f.id} className="mp-card" data-media-card={f.id}>
                  <span className="mp-thumb" aria-hidden="true">
                    {f.kind === 'font' ? (
                      <FileType />
                    ) : (
                      // SVG compris : toujours en <img>, jamais en ligne
                      <img src={mediaUrl(f.path)} alt="" loading="lazy" />
                    )}
                  </span>
                  <div className="mp-card__info">
                    <b title={f.name}>{f.name}</b>
                    <span>{meta(f)}</span>
                  </div>
                  {editable && (
                    <span className="mp-card__menu">
                      <Menu
                        label={t('media.actionsFor', { name: f.name })}
                        items={[
                          { label: t('media.rename'), icon: <Pencil />, onSelect: () => setRenaming(f) },
                          ...(f.kind === 'font'
                            ? []
                            : (['logo', 'image'] as const).map((k) => ({
                                label: t(`media.kind.${k}`),
                                // Coche de 16 px devant la catégorie actuelle, colonne vide devant l'autre
                                icon: f.kind === k ? <Check /> : <span className="mp-blank" />,
                                group: t('media.category'),
                                radio: true,
                                current: f.kind === k,
                                onSelect: () => void setKind(f, k),
                              }))),
                          { label: t('media.download'), icon: <Download />, onSelect: () => download(f) },
                          {
                            label: t('media.seeDemos'),
                            icon: <Presentation />,
                            onSelect: () => void showDemos(f),
                          },
                          'separator' as const,
                          {
                            label: t('media.delete'),
                            icon: <Trash2 />,
                            danger: true,
                            onSelect: () => void remove(f),
                          },
                        ]}
                      />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {renaming && (
        <RenameFile
          file={renaming}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            const ok = await m.rename(renaming.id, name);
            if (!ok) toast(t('media.error'), undefined, { tone: 'warning' });
            setRenaming(null);
          }}
        />
      )}
      {usedBy && (
        <Modal
          open
          onClose={() => setUsedBy(null)}
          size="sm"
          icon={<Presentation />}
          title={t('media.demosTitle', { name: usedBy.file.name })}
          closeLabel={t('common.close')}
          footer={<Button onClick={() => setUsedBy(null)}>{t('common.close')}</Button>}
        >
          {usedBy.demos.length ? (
            <ul className="mp-demos">
              {usedBy.demos.map((d) => (
                <li key={d.id}>
                  <Link to={`/demos/${d.id}/edit`}>{d.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mp-demos-none">{t('media.demosNone')}</p>
          )}
        </Modal>
      )}
    </AppPage>
  );
}

function RenameFile({
  file,
  onClose,
  onSave,
}: {
  file: MediaFile;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(file.name);
  const [busy, setBusy] = useState(false);
  const clean = name.trim();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clean || busy) return;
    setBusy(true);
    await onSave(clean);
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={<Pencil />}
      title={t('media.renameTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            type="submit"
            form={`${id}-f`}
            aria-disabled={!clean || busy || undefined}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} className="st-invite__form" onSubmit={submit} noValidate>
        <div className="fd-modal__field">
          <label htmlFor={`${id}-n`}>{t('media.name')}</label>
          <input
            id={`${id}-n`}
            className="fd-input"
            autoComplete="off"
            maxLength={120}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
