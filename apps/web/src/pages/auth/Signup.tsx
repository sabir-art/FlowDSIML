import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field } from '@flowdsiml/ui';
import { authRedirect, supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import {
  fieldA11y,
  focusFirstError,
  passwordStrength,
  validateForm,
  type FieldErrors,
} from '../../lib/validation';
import { useAuth } from '../../auth/AuthProvider';
import { FieldError } from '../../components/FieldError';
import { AuthLayout } from './AuthLayout';

export function Signup() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/onboarding';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const { busy, error, success, run } = useAction();
  const strength = passwordStrength(password);

  if (user) return <Navigate to={redirect} replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const errs = validateForm(form, t);
    setErrors(errs);
    if (focusFirstError(form, errs)) return;
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
        <form onSubmit={submit} noValidate>
          <Field label={t('auth.fullName')} htmlFor="name">
            <input
              id="name"
              className="fd-input"
              autoComplete="name"
              required
              maxLength={120}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrors((x) => ({ ...x, name: '' }));
              }}
              {...fieldA11y('name', errors)}
            />
            <FieldError id="name" errors={errors} />
          </Field>
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
              {...fieldA11y('email', errors)}
            />
            <FieldError id="email" errors={errors} />
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
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((x) => ({ ...x, password: '' }));
              }}
              {...fieldA11y('password', errors)}
            />
            <FieldError id="password" errors={errors} />
            {password && (
              <div className="strength" data-score={strength} aria-live="polite">
                <span />
                <span />
                <span />
                <em>
                  {t('auth.strength')} :{' '}
                  {strength ? t(`auth.strength_${strength}`) : t('validation.passwordMin', { min: 8 })}
                </em>
              </div>
            )}
          </Field>
          <Button
            icon={<UserPlus />}
            type="submit"
            variant="primary"
            disabled={busy}
            style={{ width: '100%' }}
          >
            {t('auth.signUp')}
          </Button>
        </form>
      )}
      <p className="auth-foot">
        {t('auth.hasAccount')} <Link to="/login">{t('auth.loginLink')}</Link>
      </p>
    </AuthLayout>
  );
}
