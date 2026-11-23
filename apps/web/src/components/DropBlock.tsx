/**
 * MEDIA-01 (COMP-01 §18.2) : dans le panneau de 320 px, pas de zone de dépôt visible. Un bouton
 * « Importer… » range avec les autres actions, et le dépôt marche sur tout le bloc : au survol avec un
 * fichier, pointillé primary de 2 px, fond à 7 % et « Déposer le fichier ici » au centre.
 */
import { Upload } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');

export function DropBlock({
  onFile,
  disabled = false,
  className,
  children,
}: {
  /** Premier fichier déposé (le type et la taille sont contrôlés par l'appelant, comme pour le bouton). */
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState(false);
  // dragenter et dragleave se répondent pour chaque enfant survolé : seul le dernier départ compte
  const depth = useRef(0);
  const over = (e: DragEvent) => {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  return (
    <div
      className={`fd-drop${drag ? ' is-drag' : ''}${className ? ` ${className}` : ''}`}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setDrag(true);
      }}
      onDragOver={over}
      onDragLeave={() => {
        if (!drag) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDrag(false);
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      {children}
      {drag && (
        <span className="fd-drop__veil" aria-hidden="true">
          <Upload />
          {t('dropzone.dropBlock')}
        </span>
      )}
    </div>
  );
}

/** Envoi en cours : barre indéterminée de 6 px (le stockage ne donne pas d'avancement). */
export function UploadBar({ label }: { label: string }) {
  return (
    <span className="fd-dz__bar fd-drop__bar" role="progressbar" aria-label={label}>
      <span />
    </span>
  );
}
