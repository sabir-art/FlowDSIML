import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from '@flowdsiml/ui';
import { supabase } from '../lib/supabase';
import { check, useAction } from '../lib/useAction';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { AuthLayout } from './auth/AuthLayout';
import { Loading } from '../components/guards';

interface InviteInfo {
  workspace_name: string;
  email: string;
  role: string;
  expired: boolean;
  accepted: boolean;
}

export function AcceptInvite() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const { user, loading } = useAuth();
  const { reload, select } = useWorkspace();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const { busy, error, run } = useAction();

  useEffect(() => {
    void supabase.rpc('get_invitation', { p_token: token }).then(({ data }) => setInfo(data?.[0] ?? null));
  }, [token]);

  if (loading || info === undefined) return <Loading />;
  const here = `/invite/${token}`;

  return (
    <AuthLayout title={t('invite.title')}>
      {!info && <Alert kind="error">{t('errors.inviteNotFound')}</Alert>}
      {info && (
        <>
          <p>{t('invite.body', { workspace: info.workspace_name, role: t(`roles.${info.role}`) })}</p>
          {info.expired && <Alert kind="error">{t('errors.inviteExpired')}</Alert>}
          {info.accepted && <Alert kind="error">{t('errors.inviteUsed')}</Alert>}
          {error && <Alert kind="error">{error}</Alert>}
          {!user ? (
            <div className="stack">
              <p className="fd-muted">{t('invite.loginFirst', { email: info.email })}</p>
              <Link className="fd-btn fd-btn--primary" to={`/login?redirect=${encodeURIComponent(here)}`}>
                {t('auth.signIn')}
              </Link>
              <Link className="fd-btn" to={`/signup?redirect=${encodeURIComponent(here)}`}>
                {t('auth.signUp')}
              </Link>
            </div>
          ) : (
            !info.expired &&
            !info.accepted && (
              <Button
                icon={<Check />}
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  const wsId = await run(async () =>
                    check(await supabase.rpc('accept_invitation', { p_token: token })),
                  );
                  if (wsId) {
                    await reload();
                    select(wsId);
                    navigate('/', { replace: true });
                  }
                }}
              >
                {t('invite.accept')}
              </Button>
            )
          )}
        </>
      )}
    </AuthLayout>
  );
}
