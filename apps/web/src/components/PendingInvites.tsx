import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/errors';
import { useWorkspace } from '../workspace/WorkspaceProvider';

interface Pending {
  id: string;
  workspace_name: string;
  inviter_name: string | null;
}

/**
 * E-mails P1 (arbitrage du chef) : le bouton de l'e-mail d'invitation ne vaut qu'une heure. Ensuite, la
 * personne se connecte avec l'adresse invitée et retrouve ici ses invitations en attente (prise en
 * main, compte sans espace). Accepter en premier, en bouton ; Refuser en lien discret.
 */
export function PendingInvites() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reload, select } = useWorkspace();
  const [list, setList] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void supabase.rpc('my_invitations').then(({ data }) => setList((data ?? []) as Pending[]));
  }, []);
  if (!list.length) return null;
  async function answer(p: Pending, accept: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('answer_invitation', {
      p_invitation: p.id,
      p_accept: accept,
    });
    setBusy(false);
    if (e) return setError(errorMessage(t, e));
    setList((l) => l.filter((x) => x.id !== p.id));
    if (accept && data) {
      await reload();
      select(data);
      navigate('/', { replace: true });
    }
  }
  return (
    <section className="pi-box" aria-labelledby="pi-t">
      <h2 id="pi-t" className="pi-title">
        <UserPlus aria-hidden="true" />
        {t('invite.pendingTitle')}
      </h2>
      {error && (
        <p className="error-msg" role="alert">
          {error}
        </p>
      )}
      <ul className="pi-list">
        {list.map((p) => (
          <li key={p.id}>
            <span>
              {t('notifications.k_invite', {
                actor: p.inviter_name || t('notifications.someone'),
                workspace: p.workspace_name,
              })}
            </span>
            <span className="pi-actions">
              <button
                type="button"
                className="fd-btn fd-btn--primary fd-btn--sm"
                disabled={busy}
                onClick={() => void answer(p, true)}
              >
                {t('notifications.accept')}
              </button>
              <button
                type="button"
                className="link-button pi-decline"
                disabled={busy}
                onClick={() => void answer(p, false)}
              >
                {t('notifications.decline')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
