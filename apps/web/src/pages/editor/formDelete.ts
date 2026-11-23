import type { TFunction } from 'i18next';
import type { DemoEditor } from './useDemoEditor';
import type { FormRow } from './types';

type Ask = (o: { title: string; body?: string; confirmLabel: string; danger?: boolean }) => Promise<boolean>;
type Toast = (text: string, action?: { label: string; durationMs?: number; onClick: () => void }) => void;

/**
 * Suppression du formulaire de la démo, depuis son menu dans la liste des étapes ou depuis son panneau :
 * confirmation qui dit ce qui est retiré, puis notification avec « Annuler » (comme pour une étape).
 * Les réponses déjà reçues ne sont pas liées au formulaire : elles restent dans Leads.
 * Renvoie true si le formulaire a été supprimé.
 */
export async function deleteFormWithUndo(
  editor: DemoEditor,
  form: FormRow,
  ask: Ask,
  toast: Toast,
  t: TFunction,
): Promise<boolean> {
  const yes = await ask({
    title: t('editor.confirmDeleteForm'),
    body: t('editor.confirmDeleteFormBody'),
    confirmLabel: t('common.delete'),
    danger: true,
  });
  if (!yes) return false;
  const stepId = editor.steps.find((s) => s.gate_form_id === form.id)?.id ?? null;
  await editor.deleteForm(form.id);
  toast(t('editor.form.deletedToast'), {
    label: t('common.undo'),
    durationMs: 6000,
    onClick: () => void editor.restoreForm(form, stepId),
  });
  return true;
}
