import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { supportHref } from '../lib/support';
import { useWorkspace } from '../workspace/WorkspaceProvider';

/**
 * L48-B §5 : la fonction existe mais un quota de l'espace est atteint. Conséquence, chiffres lus dans
 * l'état de l'interface (jamais en dur), « Voir l'utilisation » et « Demander plus à la DSI ».
 */
export function QuotaDialog({
  title,
  body,
  figures,
  renews,
  onClose,
}: {
  title: string;
  /** Conséquence (« Ajout de fichiers bloqué… »). */
  body: string;
  /** Chiffres (« Stockage : 500 Mo sur 500 Mo »). */
  figures: string;
  /** Quota mensuel : date de remise à zéro. */
  renews?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const ask = current
    ? supportHref(current.settings, t('usage.askSubject', { workspace: current.name }))
    : null;
  return (
    <dialog ref={ref} className="dialog quota-dialog" onClose={onClose} aria-labelledby={`${id}-t`}>
      <div className="dialog-head">
        <h2 id={`${id}-t`}>
          <TriangleAlert aria-hidden="true" /> {title}
        </h2>
      </div>
      <div className="dialog-body">
        <p>{body}</p>
        <p className="quota-dialog__figures">{figures}</p>
        {renews && <p className="fd-muted">{t('quota.renews', { date: renews })}</p>}
      </div>
      <div className="dialog-actions">
        <Link className="fd-btn" to="/settings/usage" onClick={() => ref.current?.close()}>
          {t('quota.seeUsage')}
        </Link>
        {ask && (
          <a
            className="fd-btn fd-btn--primary"
            href={ask}
            target={ask.startsWith('https') ? '_blank' : undefined}
            rel="noopener noreferrer"
          >
            {t('usage.ask')}
          </a>
        )}
        <button type="button" className="fd-btn fd-btn--ghost" onClick={() => ref.current?.close()}>
          {t('common.close')}
        </button>
      </div>
    </dialog>
  );
}
