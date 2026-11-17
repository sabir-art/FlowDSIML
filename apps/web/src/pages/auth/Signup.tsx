import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { authRedirect, supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { AuthLayout } from './AuthLayout';

export function Signup() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/onboarding';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, success, run } = useAction();

  if (user) return <Navigate to={redirect} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(
      async () =>
        check(
          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: authRedirect(redirect),
              data: { full_name: fullName, locale: i18n.language === 'en' ? 'en' : 'fr' },
            },
          }),
        ),
      t('auth.checkEmail'),
    );
  }

  return (
    <AuthLayout title={t('auth.signupTitle')} subtitle={t('auth.signupSubtitle')}>
      {error && <Alert kind="error">{error}</Alert>}
      {success ? (
        <Alert kind="success">{success}</Alert>
      ) : (
        <form onSubmit={submit}>
          <Field label={t('auth.fullName')} htmlFor="name">
            <input
              id="name"
              className="fd-input"
              autoComplete="name"
              required
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
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
          <Button type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
            {t('auth.signUp')}
          </Button>
        </form>
      )}
      <div className="auth-links">
        <Link to="/login">{t('auth.haveAccount')}</Link>
      </div>
    </AuthLayout>
  );
}
