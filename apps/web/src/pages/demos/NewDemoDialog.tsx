import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Info, LayoutTemplate, Puzzle, WandSparkles, X } from 'lucide-react';
import { aiBlock, useAiStatus } from '../../lib/ai';
import { useBlockText } from '../../components/ai/AiWrite';
import { Link } from 'react-router-dom';
import type { Tables } from '@flowdsiml/supabase-types';
import { IMAGE_ACCEPT } from './importImages';

/**
 * DSH-06 : modale « Nouvelle démo » de la maquette. L26-04 : troisième carte « Partir d'un modèle ».
 * Capturer avec l'extension (recommandé) ; REV-06 : importer des images (plusieurs fichiers, une étape par
 * image). Le dossier préremplit celui qui est filtré ; il s'applique à l'import, au modèle et à la démo vide.
 */
export function NewDemoDialog({
  open,
  folders,
  defaultFolder,
  onEmpty,
  onTemplate,
  onImport,
  onGenerate,
  ws,
  onClose,
}: {
  open: boolean;
  folders: Tables<'folders'>[];
  defaultFolder: string | null;
  onEmpty: (folderId: string | null) => Promise<void> | void;
  /** L26-04 : troisième carte, « Partir d'un modèle ». */
  onTemplate: (folderId: string | null) => void;
  /** REV-06 : images choisies (au moins une). */
  onImport: (files: File[], folderId: string | null) => Promise<void> | void;
  /** L30-05 : quatrième carte, « Générer avec l'IA ». */
  onGenerate: (folderId: string | null) => void;
  ws: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>(defaultFolder ?? '');
  const [busy, setBusy] = useState(false);
  const { status: ai } = useAiStatus(open ? ws : undefined);
  const blockText = useBlockText();
  // Règle 4 : désactivée (espace, fonction, rôle) ; quota atteint : la carte reste active (message dans l'aperçu)
  const aiOff = aiBlock(ai, 'generate');
  const aiDisabled = aiOff === 'disabled' || aiOff === 'role';

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
        <button
          type="button"
          className="nd-choice nd-choice--btn"
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          <b>{t('demos.newImport')}</b>
          <span className="fd-muted">{t('demos.newImportBody')}</span>
        </button>
        <input
          ref={picker}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          aria-label={t('demos.newImport')}
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (!files.length) return;
            setBusy(true);
            try {
              await onImport(files, folder || null);
            } finally {
              setBusy(false);
            }
          }}
        />
        <button type="button" className="nd-choice nd-choice--btn" onClick={() => onTemplate(folder || null)}>
          <LayoutTemplate aria-hidden="true" />
          <b>{t('templates.title')}</b>
          <span className="fd-muted">{t('templates.cardBody')}</span>
        </button>
        <div className="ai-disabled-wrap nd-ai">
          <button
            type="button"
            className="nd-choice nd-choice--btn ai-entry"
            aria-disabled={aiDisabled || undefined}
            aria-describedby={aiDisabled ? 'nd-ai-tip' : undefined}
            onClick={() => !aiDisabled && onGenerate(folder || null)}
          >
            <WandSparkles aria-hidden="true" />
            <b>{t('ai.generate.card')}</b>
            <span className="fd-muted">{t('ai.generate.cardBody')}</span>
          </button>
          {aiDisabled && (
            <span id="nd-ai-tip" className="ai-tip" role="tooltip">
              {blockText(aiOff, ai)}
            </span>
          )}
          {aiDisabled && aiOff === 'disabled' && ai?.canManage && (
            <Link className="t-caption" to="/settings/ai">
              {t('ai.disabledAdmin')}
            </Link>
          )}
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
