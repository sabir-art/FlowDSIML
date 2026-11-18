import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';

/** Modale de confirmation (remplace confirm/prompt natifs). `requireText` : saisie exacte exigée. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  requireText,
  secondary,
  requireLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  requireText?: string;
  /** Action secondaire à la place de « Annuler » (ex. « Voir les plans ») ; Échap annule toujours. */
  secondary?: { label: string; onSelect: () => void };
  /** Libellé du champ de saisie (sinon « Saisissez … pour confirmer »). */
  requireLabel?: ReactNode;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setText('');
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const blocked = requireText !== undefined && text !== requireText;
  return (
    <dialog ref={ref} className="dialog dialog-confirm" onClose={onClose} aria-labelledby={titleId}>
      <form
        method="dialog"
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
        {/* PRM-05 / PRM-06 : en-tête, corps et pied séparés, comme les modales de la maquette */}
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
        </div>
        {(body || requireText !== undefined) && (
          <div className="dialog-body">
            {body}
            {requireText !== undefined && (
              <label className="fd-field dialog-require">
                <span className="fd-label">
                  {requireLabel ?? t('common.typeToConfirm', { text: requireText })}
                </span>
                <input
                  className="fd-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                />
              </label>
            )}
          </div>
        )}
        <div className="dialog-actions">
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
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={blocked || busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

interface AskOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
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
