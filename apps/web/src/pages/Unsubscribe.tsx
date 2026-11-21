import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@flowdsiml/ui';
import { supabase } from '../lib/supabase';
import { AuthLayout } from './auth/AuthLayout';
import { Loading } from '../components/guards';

/**
 * E-mails P2 (spec §3.4) : « Ne plus recevoir ces e-mails », sans connexion. Le jeton (usage unique,
 * 90 jours) est vérifié par notify-email ; un second clic sur le même lien affiche la même confirmation.
 */
export function Unsubscribe() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    void supabase.functions
      .invoke<{ ok: boolean }>('notify-email', { body: { action: 'unsubscribe', token } })
      .then(({ data, error }) => setOk(!error && data?.ok === true))
      .catch(() => setOk(false));
  }, [token]);
  if (ok === null) return <Loading />;
  return (
    <AuthLayout title={t('unsubscribe.title')}>
      {/* Retour UX : 8 px sous le titre, 24 px avant le bouton (comme les autres écrans d'authentification) */}
      <div className="unsub-msg">
        {ok ? <p>{t('unsubscribe.done')}</p> : <Alert kind="error">{t('unsubscribe.invalid')}</Alert>}
      </div>
      <Link className="fd-btn" to="/">
        {t('unsubscribe.open')}
      </Link>
    </AuthLayout>
  );
}
