import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { localPasswordError, passwordErrorMessage } from '../../lib/errors';
import {
  PasswordError,
  PasswordInput,
  PasswordMatch,
  PasswordMeter,
  PasswordRules,
} from '../../components/PasswordField';
import { useAuth } from '../../auth/AuthProvider';
import { AuthLayout } from './AuthLayout';
import { Loading } from '../../components/guards';

export function ResetPassword() {
  const { t } = useTranslation();
  const { loading, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, run } = useAction();
  /** EXT-02 §7 : erreur sous le champ (règle manquante ou refus du serveur), règles en échec, confirmation. */
  const [pwError, setPwError] = useState('');
  const [failed, setFailed] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [touched, setTouched] = useState(false);

  if (loading) return <Loading />;
  if (!user)
    return (
      <AuthLayout title={t('auth.resetTitle')}>
        <Alert kind="error">{t('auth.resetLinkInvalid')}</Alert>
        <Link to="/forgot-password">{t('auth.sendResetLink')}</Link>
      </AuthLayout>
    );

  const refuse = (message: string) => {
    setPwError(message);
    setFailed(true);
    document.getElementById('password')?.focus();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    const local = localPasswordError(t, password);
    if (local) return refuse(local);
    if (password !== confirm) {
      setMismatch(true);
      document.getElementById('confirm')?.focus();
      return;
    }
    const ok = await run(async () => {
      const res = await supabase.auth.updateUser({ password });
      const refused = res.error && passwordErrorMessage(t, res.error, password);
      if (refused) {
        refuse(refused);
        return false;
      }
      check(res);
      return true;
    });
    if (ok) navigate('/', { replace: true });
  }

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.password')} htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            name="new-password"
            required
            value={password}
            aria-invalid={pwError ? true : undefined}
            aria-describedby={pwError ? 'password-error password-rules' : 'password-rules'}
            onFocus={() => setTouched(true)}
            onChange={(e) => {
              setPassword(e.target.value);
              setPwError('');
              setFailed(false);
              setMismatch(false);
            }}
          />
          <PasswordMeter password={password} />
          <PasswordError id="password-error">{pwError}</PasswordError>
          {(touched || password) && <PasswordRules id="password-rules" password={password} failed={failed} />}
        </Field>
        <Field label={t('password.confirmLabel')} htmlFor="confirm">
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            name="confirm-password"
            required
            value={confirm}
            aria-invalid={mismatch ? true : undefined}
            aria-describedby={mismatch ? 'confirm-error' : confirm ? 'confirm-rule' : undefined}
            onChange={(e) => {
              setConfirm(e.target.value);
              setMismatch(false);
            }}
          />
          <PasswordError id="confirm-error">{mismatch ? t('password.mismatch') : ''}</PasswordError>
          {!mismatch && <PasswordMatch id="confirm-rule" password={password} confirm={confirm} />}
        </Field>
        <Button icon={<KeyRound />} type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
          {t('auth.updatePassword')}
        </Button>
      </form>
    </AuthLayout>
  );
}
