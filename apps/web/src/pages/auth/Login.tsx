import { LogIn } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { authRedirect, supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { fieldA11y, focusFirstError, validateForm, type FieldErrors } from '../../lib/validation';
import { useAuth } from '../../auth/AuthProvider';
import { FieldError } from '../../components/FieldError';
import { AuthLayout } from './AuthLayout';

export function Login() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [badCredentials, setBadCredentials] = useState(false);
  const pwdRef = useRef<HTMLInputElement>(null);
  const { busy, error, success, run } = useAction();

  if (user) return <Navigate to={redirect} replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const errs = validateForm(form, t);
    setErrors(errs);
    setBadCredentials(false);
    if (focusFirstError(form, errs)) return;
    if (mode === 'password') {
      const r = await run(async () => check(await supabase.auth.signInWithPassword({ email, password })));
      if (r === undefined) {
        // L2 : erreur portée par le formulaire (alerte annoncée), les deux champs marqués invalides,
        // mot de passe vidé et focalisé (W20)
        setPassword('');
        setBadCredentials(true);
        pwdRef.current?.focus();
      }
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
      {badCredentials ? (
        <Alert kind="error">
          <span id="login-error">{t('errors.badCredentials')}</span>
        </Alert>
      ) : (
        error && <Alert kind="error">{error}</Alert>
      )}
      {success && <Alert kind="success">{success}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.workEmail')} htmlFor="email">
          <input
            id="email"
            className="fd-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((x) => ({ ...x, email: '' }));
            }}
            {...(badCredentials
              ? { 'aria-invalid': true as const, 'aria-describedby': 'login-error' }
              : fieldA11y('email', errors))}
          />
          <FieldError id="email" errors={errors} />
        </Field>
        {mode === 'password' && (
          <div className="fd-field">
            <div className="label-row">
              <label className="fd-label" htmlFor="password">
                {t('auth.password')}
              </label>
              <Link to="/forgot-password" className="label-link">
                {t('auth.forgot')}
              </Link>
            </div>
            <input
              ref={pwdRef}
              id="password"
              className="fd-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((x) => ({ ...x, password: '' }));
              }}
              {...(badCredentials
                ? { 'aria-invalid': true as const, 'aria-describedby': 'login-error' }
                : fieldA11y('password', errors))}
            />
            <FieldError id="password" errors={errors} />
          </div>
        )}
        <Button icon={<LogIn />} type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
          {mode === 'password' ? t('auth.signIn') : t('auth.sendMagicLink')}
        </Button>
      </form>
      <p className="auth-alt">
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'password' ? 'magic' : 'password');
            setErrors({});
          }}
        >
          {mode === 'password' ? t('auth.orMagic') : t('auth.usePassword')}
        </button>
      </p>
      <p className="auth-foot">
        {t('auth.noAccount')}{' '}
        <Link to={`/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>
          {t('auth.signupLink')}
        </Link>
      </p>
    </AuthLayout>
  );
}
