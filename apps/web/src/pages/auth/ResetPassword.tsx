import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { AuthLayout } from './AuthLayout';
import { Loading } from '../../components/guards';

export function ResetPassword() {
  const { t } = useTranslation();
  const { loading, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, run, setError } = useAction();

  if (loading) return <Loading />;
  if (!user)
    return (
      <AuthLayout title={t('auth.resetTitle')}>
        <Alert kind="error">{t('auth.resetLinkInvalid')}</Alert>
        <Link to="/forgot-password">{t('auth.sendResetLink')}</Link>
      </AuthLayout>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError(t('auth.passwordMismatch'));
    const ok = await run(async () => check(await supabase.auth.updateUser({ password })));
    if (ok !== undefined) navigate('/', { replace: true });
  }

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.passwordNew')} htmlFor="password">
          <input
            id="password"
            className="fd-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={t('auth.passwordConfirm')} htmlFor="confirm">
          <input
            id="confirm"
            className="fd-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button icon={<KeyRound />} type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
          {t('auth.updatePassword')}
        </Button>
      </form>
    </AuthLayout>
  );
}
