/**
 * MEDIA-01 (COMP-01 §18) : vignette d'une image d'identité, ronde (photo de profil) ou carrée arrondie
 * (logo). L'image est le bouton : un clic ou Entrée ouvre le choix de fichier ; au survol et au focus, un
 * voile avec « Changer ». Glisser-déposer accepté. Un petit bouton ⋯ ouvre « Remplacer… » et « Retirer ».
 * Vide : bord pointillé et « Ajouter ». Erreur : bord danger et message sous l'image (l'ancienne reste).
 * Le champ fichier natif reste dans la page, masqué à l'œil et relié au bouton (COMP-01 §5).
 */
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CircleAlert, Ellipsis, Loader2, Trash2, Upload } from 'lucide-react';
import { Menu } from './Menu';

export function MediaThumb({
  shape,
  image,
  fallback,
  accept,
  inputId,
  describedBy,
  labels,
  busy = false,
  error,
  onFile,
  onRemove,
}: {
  shape: 'round' | 'square';
  /** L'image en place (null : état vide ou repli). */
  image: ReactNode | null;
  /** Repli quand il n'y a pas d'image (initiales) ; sans repli, l'état vide « Ajouter ». */
  fallback?: ReactNode;
  accept: string;
  inputId: string;
  describedBy?: string;
  labels: { change: string; add: string; options: string };
  busy?: boolean;
  error?: string | null;
  onFile: (f: File) => void;
  /** Retirer l'image en place (absent : pas de bouton ⋯). */
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const has = image !== null;
  const empty = !has && !fallback;
  const pick = () => !busy && input.current?.click();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !busy) onFile(f);
  };
  const cls = [
    'fd-mt',
    `fd-mt--${shape}`,
    empty && 'is-empty',
    over && !busy && 'is-drag',
    error && 'is-error',
    busy && 'is-busy',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    // §18.6 : l'image et son message d'erreur, 6 px (maquette media-01)
    <div className="fd-mt-wrap" data-gap-exempt="">
      <div className={cls}>
        <button
          type="button"
          className="fd-mt__img"
          aria-label={has ? labels.change : labels.add}
          aria-describedby={describedBy}
          aria-controls={inputId}
          aria-busy={busy || undefined}
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          {/* L'image (ou les initiales) est décorative : le bouton porte son nom */}
          {!empty && (
            <span className="fd-mt__pic" aria-hidden="true">
              {image ?? fallback}
            </span>
          )}
          <span className={`fd-mt__veil${over && !busy ? ' fd-mt__veil--drop' : ''}`} aria-hidden="true">
            {busy ? <Loader2 className="spin" /> : over ? <Upload /> : <Camera />}
            {!busy && (
              <span>{t(over ? 'mediaThumb.drop' : empty ? 'mediaThumb.add' : 'mediaThumb.change')}</span>
            )}
          </span>
        </button>
        {has && onRemove && (
          <Menu
            label={labels.options}
            align="end"
            custom={{
              className: 'fd-mt__more',
              content: (
                <>
                  <Ellipsis aria-hidden="true" />
                  <span className="sr-only">{labels.options}</span>
                </>
              ),
            }}
            items={[
              { label: t('dropzone.replace'), icon: <Upload />, onSelect: pick },
              { label: t('mediaThumb.remove'), icon: <Trash2 />, danger: true, onSelect: onRemove },
            ]}
          />
        )}
      </div>
      {error && (
        <p className="fd-mt__err" role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      )}
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
