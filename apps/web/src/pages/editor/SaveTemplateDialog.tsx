/**
 * L26-05 : « Enregistrer comme modèle » (menu ⋯ de l'éditeur, éditeurs et plus). Nom (60), description
 * (200, facultative), catégorie, captures : sans (par défaut, chaque étape devient « À capturer ») ou avec,
 * comme exemple. Le modèle est visible par tous les membres de l'espace.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Alert } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { CATEGORIES, copyImagesIntoTemplate, type TemplateCategory } from '../demos/templates';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

export function SaveTemplateDialog({
  demoId,
  demoTitle,
  onSaved,
  onClose,
}: {
  demoId: string;
  demoTitle: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(demoTitle.slice(0, 60));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('procedure');
  const [captures, setCaptures] = useState<'without' | 'with'>('without');
  // Bilan RGPD : avec les captures, même confirmation qu'avant une publication
  const [ack, setAck] = useState(false);
  const { current } = useWorkspace();
  const { busy, error, run } = useAction();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = await run(async () => {
      const tplId = check(
        await supabase.rpc('save_demo_as_template', {
          p_demo: demoId,
          p_name: name.trim(),
          p_description: description.trim(),
          p_category: category,
          p_with_captures: captures === 'with',
          p_ack: captures === 'with' ? ack : null,
        }),
      );
      // Les images d'exemple sont copiées dans le dossier du modèle (indépendant de la démo d'origine)
      if (captures === 'with' && current) await copyImagesIntoTemplate(current.id, tplId);
      return tplId;
    });
    if (id) onSaved();
  };

  return (
    <dialog ref={ref} className="dialog svt-dialog" onClose={onClose} aria-labelledby="svt-title">
      <form onSubmit={submit}>
        <div className="nd-head">
          <h2 id="svt-title">{t('templates.save.title')}</h2>
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="svt-body">
          <label className="fd-field">
            <span className="fd-label">{t('templates.name')}</span>
            <input
              className="fd-input"
              value={name}
              maxLength={60}
              required
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="fd-field">
            <span className="fd-label">
              {t('templates.save.description')}{' '}
              <span className="fd-muted">{t('templates.save.optional')}</span>
            </span>
            <textarea
              className="fd-input"
              rows={2}
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="fd-field">
            <span className="fd-label">{t('templates.save.category')}</span>
            <select
              className="fd-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`templates.cat.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="svt-caps">
            <legend className="fd-label">{t('templates.save.captures')}</legend>
            {(['without', 'with'] as const).map((k) => (
              <label key={k} className="svt-radio">
                <input
                  type="radio"
                  name="svt-captures"
                  checked={captures === k}
                  onChange={() => setCaptures(k)}
                  aria-describedby={`svt-${k}-h`}
                />
                <span>
                  <b>{t(`templates.save.${k}`)}</b>
                  {k === 'without' && <> {t('templates.save.recommended')}</>}
                  <span className="fd-help" id={`svt-${k}-h`}>
                    {t(`templates.save.${k}Help`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {captures === 'with' && (
            <label className="svt-ack">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>{t('templates.save.ack')}</span>
            </label>
          )}
          <p className="fd-help">{t('templates.save.kept')}</p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="fd-btn fd-btn--primary"
            disabled={busy || !name.trim() || (captures === 'with' && !ack)}
          >
            {t('templates.save.submit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
