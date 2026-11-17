import { Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { authRedirect, supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { AuthLayout } from './AuthLayout';

export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const { busy, error, success, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(
      async () =>
        check(
          await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirect('/reset-password') }),
        ),
      t('auth.resetSent'),
    );
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.email')} htmlFor="email">
          <input
            id="email"
            className="fd-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button icon={<Mail />} type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
          {t('auth.sendResetLink')}
        </Button>
      </form>
      <div className="auth-links">
        <Link to="/login">{t('auth.backToLogin')}</Link>
      </div>
    </AuthLayout>
  );
}
