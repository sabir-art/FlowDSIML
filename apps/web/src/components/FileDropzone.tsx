/**
 * MEDIA-01 §18.1 : zone de dépôt d'un fichier (format « zone », pleine largeur). Une seule rangée :
 * l'aperçu ou une tuile d'icône, le titre et une ligne d'aide, puis une source par bouton (« Choisir un
 * fichier », « Médiathèque »). Jamais de bouton dans une phrase. États : vide, rempli, glisser-déposer,
 * envoi, erreur. Le champ fichier natif reste dans la page, masqué à l'œil et relié à son bouton
 * (COMP-01 §5).
 */
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, ImageUp, Images, Trash2, Upload } from 'lucide-react';
import { Button } from '@flowdsiml/ui';

/** Fichier CSV d'après son nom ou son type (les navigateurs ne donnent pas toujours le type). */
export const isCsvFile = (f: File) => /\.csv$/i.test(f.name) || f.type === 'text/csv';

export function FileDropzone({
  label,
  accept,
  multiple = false,
  hint,
  icon,
  file,
  busy = false,
  busyLabel,
  error,
  readOnly = false,
  describedBy,
  inputId,
  onFiles,
  onLibrary,
  extra,
  onRemove,
  removeLabel,
}: {
  /** Nom du groupe pour les lecteurs d'écran (« Logo »). */
  label: string;
  accept: string;
  multiple?: boolean;
  /** Ligne d'aide de l'état vide : formats et taille. */
  hint: string;
  /** Icône de la tuile à vide (par défaut une image ; FileUp pour un CSV, un son, des sous-titres). */
  icon?: ReactNode;
  /** Fichier en place : son nom, ses détails (type, poids, date) et son aperçu. */
  file?: { name: string; meta?: string; preview?: ReactNode } | null;
  busy?: boolean;
  /** Nom de la barre d'envoi (« Envoi du logo »). */
  busyLabel?: string;
  /** Raison de l'échec du dernier envoi (l'ancien fichier reste en place). */
  error?: string | null;
  /** Lecture seule : ni dépôt, ni choix de fichier, ni retrait (la Médiathèque reste ouverte). */
  readOnly?: boolean;
  describedBy?: string;
  inputId?: string;
  onFiles: (files: File[]) => void;
  onLibrary?: () => void;
  /** Autre source, en bouton à la suite (ex. « Générer avec l'IA »). */
  extra?: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const { t } = useTranslation();
  const auto = useId();
  const id = inputId ?? `${auto}-f`;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const can = !readOnly && !busy;
  const drag = over && can;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!can) return;
    const files = [...(e.dataTransfer.files ?? [])];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  const cls = [
    'fd-dz',
    drag && 'is-drag',
    error && !drag && 'is-error',
    file && !drag && !error && 'is-filled',
    busy && 'is-busy',
  ]
    .filter(Boolean)
    .join(' ');

  // Envoi : barre indéterminée (le stockage ne donne pas d'avancement), ni pourcentage ni « Annuler »
  const bar = (
    <span className="fd-dz__bar" role="progressbar" aria-label={busyLabel ?? t('dropzone.sending')}>
      <span />
    </span>
  );

  return (
    <div
      className={cls}
      role="group"
      aria-label={label}
      aria-busy={busy || undefined}
      /* ALIGN-01 : la zone prend toute la ligne ; l'e2e mesure son cadre */
      data-align-zone=""
      onDragOver={(e) => {
        if (!can) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {!readOnly && (
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) onFiles(files);
          }}
        />
      )}
      <span
        className={`fd-dz__pre${file?.preview && !drag && !error ? ' fd-dz__pre--img' : ''}`}
        aria-hidden="true"
      >
        {drag ? <Upload /> : error ? <CircleAlert /> : (file?.preview ?? icon ?? <ImageUp />)}
      </span>
      {/* §18.6 : titre et ligne d'aide, 4 px (typographie) */}
      <div className="fd-dz__txt" data-gap-exempt="">
        {drag ? (
          <>
            <b>{t('dropzone.dropHere')}</b>
            <span>{hint}</span>
          </>
        ) : error ? (
          <>
            <b>{t('dropzone.failed')}</b>
            <span role="alert">{error}</span>
          </>
        ) : file ? (
          <>
            <b>{file.name}</b>
            {busy && bar}
            <span>{busy ? t('dropzone.sending') : (file.meta ?? hint)}</span>
          </>
        ) : (
          <>
            <b>{busy ? t('dropzone.sending') : t(readOnly ? 'dropzone.none' : 'dropzone.title')}</b>
            {busy && bar}
            <span>{hint}</span>
          </>
        )}
      </div>
      {!drag && (
        <div className="fd-dz__acts">
          {!readOnly && (
            <Button
              icon={<Upload />}
              disabled={busy}
              aria-controls={id}
              aria-describedby={describedBy}
              onClick={() => input.current?.click()}
            >
              {t(file ? 'dropzone.replace' : 'dropzone.pick')}
            </Button>
          )}
          {onLibrary && (
            <Button icon={<Images />} onClick={onLibrary}>
              {t('media.open')}
            </Button>
          )}
          {extra}
          {file && onRemove && !readOnly && (
            <button
              type="button"
              className="fd-btn fd-btn--ghost fd-btn--icon fd-dz__rm"
              aria-label={removeLabel ?? t('dropzone.remove')}
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
