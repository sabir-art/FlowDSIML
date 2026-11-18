import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Info, Puzzle, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';

/**
 * DSH-06 : modale « Nouvelle démo » de la maquette. Deux choix : capturer avec l'extension (recommandé)
 * et importer des images (Bientôt, DSH-07). Le dossier préremplit celui qui est filtré ; il s'applique
 * à la démo vide, seul parcours de création directe aujourd'hui (lien secondaire).
 */
export function NewDemoDialog({
  open,
  folders,
  defaultFolder,
  onEmpty,
  onClose,
}: {
  open: boolean;
  folders: Tables<'folders'>[];
  defaultFolder: string | null;
  onEmpty: (folderId: string | null) => Promise<void> | void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [folder, setFolder] = useState<string>(defaultFolder ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setFolder(defaultFolder ?? '');
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, defaultFolder]);

  return (
    <dialog ref={ref} className="dialog new-demo-dialog" onClose={onClose} aria-labelledby="nd-title">
      <div className="nd-head">
        <h2 id="nd-title">{t('demos.newTitle')}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="nd-choices">
        <div className="nd-choice is-selected" aria-current="true">
          <Puzzle aria-hidden="true" />
          <b>{t('demos.newExtension')}</b>
          <span className="fd-muted">{t('demos.newExtensionBody')}</span>
        </div>
        <div className="nd-choice is-soon" aria-disabled="true">
          <ImagePlus aria-hidden="true" />
          <b>
            {t('demos.newImport')} <span className="fd-badge nd-soon">{t('shell.soon')}</span>
          </b>
          <span className="fd-muted">{t('demos.newImportBody')}</span>
        </div>
      </div>
      <p className="nd-help">
        <Info aria-hidden="true" />
        {t('demos.newExtensionHelp')}
      </p>
      <label className="fd-field nd-folder">
        <span className="fd-label">{t('demos.colFolder')}</span>
        <select className="fd-input" value={folder} onChange={(e) => setFolder(e.target.value)}>
          <option value="">{t('demos.noFolder')}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <div className="dialog-actions nd-actions">
        <button
          type="button"
          className="fd-btn fd-btn--ghost nd-empty"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onEmpty(folder || null);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('demos.newEmpty')}
        </button>
        <span className="grow" />
        <button type="button" className="fd-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </dialog>
  );
}
