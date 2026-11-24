import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp, TriangleAlert } from 'lucide-react';
import { Button, Modal } from '@flowdsiml/ui';

/**
 * Modale de confirmation (remplace confirm/prompt natifs), au format MODAL-01. `requireText` : saisie
 * exacte exigée. Entrée dans le champ valide ; sans champ, le focus va à « Annuler ».
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  alert,
  requireText,
  secondary,
  requireLabel,
  icon,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Action définitive qui demande une réponse : annoncée comme `alertdialog`, avec son texte. */
  alert?: boolean;
  requireText?: string;
  /** Action secondaire à la place de « Annuler » (ex. « Voir les plans ») ; Échap annule toujours. */
  secondary?: { label: string; onSelect: () => void };
  /** Libellé du champ de saisie (sinon « Saisissez … pour confirmer »). */
  requireLabel?: ReactNode;
  /** Icône de la tuile d'en-tête (par défaut : point d'interrogation, ou alerte pour `danger`). */
  icon?: ReactNode;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const blocked = requireText !== undefined && text !== requireText;
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={icon ?? (danger ? <TriangleAlert /> : <CircleHelp />)}
      tone={danger ? 'danger' : 'default'}
      title={title}
      closeLabel={t('common.close')}
      className="dialog-confirm"
      role={alert ? 'alertdialog' : undefined}
      describedBy={alert && body ? `${formId}-b` : undefined}
      footer={
        <>
          {secondary ? (
            <Button
              onClick={() => {
                onClose();
                secondary.onSelect();
              }}
            >
              {secondary.label}
            </Button>
          ) : (
            <Button onClick={onClose}>{t('common.cancel')}</Button>
          )}
          <Button
            type="submit"
            form={formId}
            variant={danger ? 'danger' : 'primary'}
            disabled={blocked || busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="dialog-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (blocked) return;
          setBusy(true);
          try {
            await onConfirm();
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        {body && (
          <div className="dialog-body" id={`${formId}-b`}>
            {body}
          </div>
        )}
        {requireText !== undefined && (
          <div className="fd-modal__field dialog-require">
            <label htmlFor={`${formId}-t`}>
              {requireLabel ?? t('common.typeToConfirm', { text: requireText })}
            </label>
            <input
              id={`${formId}-t`}
              className="fd-input"
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

interface AskOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  alert?: boolean;
  requireText?: string;
  requireLabel?: ReactNode;
  secondary?: { label: string; onSelect: () => void };
}

/**
 * Remplace confirm()/prompt() : `const [dialog, ask] = useConfirm();` puis `if (await ask({...}))`.
 * Rendre `{dialog}` dans le composant.
 */
export function useConfirm(): [ReactNode, (o: AskOptions) => Promise<boolean>] {
  const [state, setState] = useState<(AskOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = (o: AskOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve }));
  const dialog = (
    <ConfirmDialog
      open={!!state}
      title={state?.title ?? ''}
      body={state?.body}
      confirmLabel={state?.confirmLabel ?? ''}
      danger={state?.danger}
      alert={state?.alert}
      requireText={state?.requireText}
      requireLabel={state?.requireLabel}
      secondary={state?.secondary}
      onConfirm={() => {
        state?.resolve(true);
      }}
      onClose={() => {
        state?.resolve(false);
        setState(null);
      }}
    />
  );
  return [dialog, ask];
}
