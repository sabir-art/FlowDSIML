import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileType, Images, Search, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Modal } from '@flowdsiml/ui';
import { foldText } from '@flowdsiml/core';
import { FileDropzone } from '../FileDropzone';
import { QuotaDialog } from '../QuotaDialog';
import { supabase } from '../../lib/supabase';
import { MEDIA_QUOTA, useMedia, type MediaFile, type MediaFilter } from './useMedia';
import type { MediaKind } from './mediaKind';
import './media.css';

export { MEDIA_QUOTA, type MediaFile } from './useMedia';

/** URL publique d'un fichier de la médiathèque (logo, image, police). */
export const mediaUrl = (path: string) => supabase.storage.from('media').getPublicUrl(path).data.publicUrl;

/** L18-03 : taille réelle lisible, en Ko sous 1 Mo, sinon en Mo à une décimale. */
export const sizeLabel = (n: number, locale: string) => {
  const fr = locale.startsWith('fr');
  return n < 1024 * 1024
    ? `${Math.max(n > 0 ? 1 : 0, Math.round(n / 1024)).toLocaleString(locale)}${fr ? ' Ko' : '\u202fKB'}`
    : `${(n / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })}${fr ? ' Mo' : '\u202fMB'}`;
};

const FILTERS: MediaFilter[] = ['all', 'logo', 'image', 'font'];
/** Types de fichier proposés à l'import, selon ce qu'on choisit. */
const ACCEPT: Record<MediaKind, string> = {
  logo: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
  image: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
  font: '.woff2,font/woff2',
};
/** Un logo ou une image ne reçoit pas une police, et inversement. */
const compatible = (wanted: MediaKind, f: MediaFilter | string) =>
  f === 'all' || (wanted === 'font' ? f === 'font' : f !== 'font');

/**
 * Fenêtre de sélection de la médiathèque (retours client du 24/11 §3.3, maquette
 * retours-2411/media-choisir) : la même partout où l'on choisit un fichier. Le titre dit ce qu'on choisit,
 * le sous-titre où il ira. Zone d'import réduite (le fichier importé est choisi d'office), recherche,
 * filtres réglés sur la catégorie demandée (les catégories incompatibles sont désactivées), cartes à choix
 * unique, puis « Utiliser ce logo ». La gestion des fichiers (renommer, catégorie, suppression) est sur
 * la page /media.
 */
export function MediaLibrary({
  wsId,
  kind,
  destination,
  onPick,
  onClose,
}: {
  wsId: string;
  /** Ce qu'on choisit : il règle le titre, le filtre de départ et le type importé. */
  kind: MediaKind;
  /** Où ira le fichier (« Logo de la démo « Démo CRM » »), sous le titre. */
  destination?: string;
  onPick: (file: MediaFile) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const m = useMedia(wsId);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<MediaFilter>(kind);
  const [sel, setSel] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  // L18-03 : fichier importé non vérifié (l'avertissement lui est rattaché, pas en bandeau)
  const [warnId, setWarnId] = useState<string | null>(null);

  const fq = foldText(q.trim());
  const shown = useMemo(
    () =>
      (m.files ?? []).filter(
        (f) =>
          compatible(kind, f.kind) &&
          (filter === 'all' || f.kind === filter) &&
          (!fq || foldText(f.name).includes(fq)),
      ),
    [m.files, kind, filter, fq],
  );
  const selected = shown.find((f) => f.id === sel) ?? null;

  const upload = async (list: FileList | File[]) => {
    const file = list[0];
    if (!file) return;
    setUpErr(null);
    // Importé d'ici, le fichier prend la catégorie du filtre choisi, sinon celle qu'on demande
    // (une police reste une police)
    const r = await m.upload(file, filter === 'all' ? kind : filter);
    if (!r.ok) {
      if (r.error === 'quota') setFull(true);
      else setUpErr(t(`media.${r.error === 'error' ? 'error' : r.error}`));
      return;
    }
    if (!compatible(kind, r.file.kind)) return setUpErr(t(`media.wrongKind.${kind}`));
    // Choisi d'office : visible (filtre sur sa catégorie, recherche vidée) et prêt pour « Utiliser »
    setQ('');
    setFilter(r.file.kind as MediaKind);
    setSel(r.file.id);
    // L18-03 : une image importée n'est pas vérifiée automatiquement (données personnelles)
    setWarnId(r.file.kind === 'font' ? null : r.file.id);
  };
  const use = (f: MediaFile | null) => {
    if (!f) return;
    onPick(f);
    onClose();
  };
  const meta = (f: MediaFile) => {
    const n = m.usage[f.id] ?? 0;
    return `${t(`media.kind.${f.kind}`)} · ${n ? t('media.usedIn', { count: n }) : t('media.unused')}`;
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      className="md-pick"
      icon={<Images />}
      title={t(`media.pick.title.${kind}`)}
      subtitle={destination}
      closeLabel={t('common.close')}
      footerLead={t('media.pick.dblclick')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" aria-disabled={!selected || undefined} onClick={() => use(selected)}>
            {t(`media.pick.use.${kind}`)}
          </Button>
        </>
      }
    >
      <div className="md-pick__body">
        <FileDropzone
          className="md-pick__zone"
          label={t(`media.pick.import.${kind}`)}
          inputId={`${id}-file`}
          accept={ACCEPT[kind]}
          title={t(`media.pick.import.${kind}`)}
          hint={t(`media.pick.hint.${kind}`)}
          pickLabel={t('dropzone.import')}
          busy={m.busy}
          busyLabel={t('media.uploading')}
          error={upErr}
          onFiles={(list) => void upload(list)}
        />
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
        {/* L48-B §5 : à partir de 80 % du stockage, alerte discrète */}
        {m.used / MEDIA_QUOTA >= 0.8 && (
          <div className="alert alert-warning md-near" role="note">
            <TriangleAlert aria-hidden="true" />
            <span>
              {t('quota.near', {
                used: sizeLabel(m.used, i18n.language),
                total: sizeLabel(MEDIA_QUOTA, i18n.language),
              })}{' '}
              <Link to="/settings/usage">{t('quota.seeUsage')}</Link>
            </span>
          </div>
        )}
        <div className="fd-toolbar md-pick__tools">
          <div className="fd-toolbar__group" role="group" aria-label={t('toolbar.filters')}>
            <label className="fd-toolbar__search md-pick__search">
              <span className="sr-only">{t('media.pick.search')}</span>
              <Search aria-hidden="true" />
              <input
                className="fd-input"
                type="search"
                placeholder={t('media.pick.search')}
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
                  // Catégorie incompatible avec ce qu'on choisit : visible, non sélectionnable
                  aria-disabled={!compatible(kind, f) || undefined}
                  onClick={() => compatible(kind, f) && setFilter(f)}
                >
                  {t(`media.filter_${f}`)}
                </button>
              ))}
            </div>
          </div>
          <span className="sr-only" role="status">
            {m.files ? t('media.count', { count: shown.length }) : ''}
          </span>
        </div>
        {m.files !== null && shown.length === 0 ? (
          <p className="md-pick__none">{t(m.files.length ? 'media.noMatch' : 'media.pick.empty')}</p>
        ) : (
          // Groupe de boutons radio : des div, pas une liste (un li n'a pas sa place dans un radiogroup)
          <div className="md-pick__grid" role="radiogroup" aria-label={t('media.files')}>
            {shown.map((f) => (
              <label
                key={f.id}
                className={`md-pick__card${sel === f.id ? ' is-sel' : ''}`}
                onDoubleClick={() => use(f)}
              >
                <input
                  type="radio"
                  name={`${id}-m`}
                  checked={sel === f.id}
                  aria-label={f.name}
                  onChange={() => setSel(f.id)}
                />
                <span className="md-pick__thumb" aria-hidden="true">
                  {f.kind === 'font' ? (
                    <FileType />
                  ) : (
                    // SVG compris : toujours en <img>, jamais en ligne
                    <img src={mediaUrl(f.path)} alt="" loading="lazy" />
                  )}
                </span>
                <span className="md-pick__info" aria-hidden="true">
                  <b title={f.name}>{f.name}</b>
                  <span>{meta(f)}</span>
                </span>
                {warnId === f.id && (
                  <span className="md-pick__warn" title={t('editor.importUnverified')}>
                    <TriangleAlert aria-hidden="true" />
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
        {selected && warnId === selected.id && (
          <p className="md-pick__unverified" role="status">
            <TriangleAlert aria-hidden="true" />
            {t('editor.importUnverified')}
          </p>
        )}
      </div>
    </Modal>
  );
}
