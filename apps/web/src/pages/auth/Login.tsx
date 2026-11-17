import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { authRedirect, supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { AuthLayout } from './AuthLayout';

export function Login() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, success, run } = useAction();

  if (user) return <Navigate to={redirect} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'password') {
      await run(async () => check(await supabase.auth.signInWithPassword({ email, password })));
    } else {
      await run(
        async () =>
          check(
            await supabase.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: authRedirect(redirect), shouldCreateUser: false },
            }),
          ),
        t('auth.magicSent'),
      );
    }
  }

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'password'} onClick={() => setMode('password')}>
          {t('auth.withPassword')}
        </button>
        <button role="tab" aria-selected={mode === 'magic'} onClick={() => setMode('magic')}>
          {t('auth.withMagicLink')}
        </button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}
      <form onSubmit={submit}>
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
        {mode === 'password' && (
          <Field label={t('auth.password')} htmlFor="password">
            <input
              id="password"
              className="fd-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        <Button type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
          {mode === 'password' ? t('auth.signIn') : t('auth.sendMagicLink')}
        </Button>
      </form>
      <div className="auth-links">
        <Link to="/forgot-password">{t('auth.forgot')}</Link>
        <Link to={`/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>
          {t('auth.noAccount')}
        </Link>
      </div>
    </AuthLayout>
  );
}
