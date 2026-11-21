import { CircleAlert, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
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
import { AuthLayout, GoogleMark, MkFieldError, StepsAside } from './AuthLayout';

/** Inscription (INS-01), à l'identique de la maquette inscription.html. */
export function Signup() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/onboarding';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentTo, setSentTo] = useState('');
  const { busy, error, run } = useAction();
  const resend = useAction();
  const strength = passwordStrength(password);
  // Jauge à 4 segments de la maquette : 1 segment sous 8 caractères, puis 2 à 4 selon la robustesse
  const segments = password ? strength + 1 : 0;

  if (user) return <Navigate to={redirect} replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const errs = validateForm(form, t);
    setErrors(errs);
    if (focusFirstError(form, errs)) return;
    const r = await run(async () =>
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
    );
    if (r !== undefined) setSentTo(email);
  }

  const help = password
    ? strength === 0
      ? t('auth.passwordHelpWeak', { min: 8 })
      : t('auth.passwordHelp', { min: 8, level: t(`auth.strength_${strength}`) })
    : t('auth.passwordMinShort', { min: 8 });

  return (
    <AuthLayout
      title={t('auth.signupTitle')}
      subtitle={t('auth.signupSubtitle')}
      aside={<StepsAside />}
      compact
      footer={false}
    >
      {sentTo ? (
        <div className="alert alert-success auth-sent" role="status">
          <Mail aria-hidden="true" />
          <div>
            <b>{t('auth.sentTitle')}</b>
            <br />
            <span className="muted">{t('auth.sentBody', { email: sentTo })}</span>{' '}
            <button
              type="button"
              className="mk-link"
              disabled={resend.busy}
              onClick={() =>
                void resend.run(
                  async () =>
                    check(
                      await supabase.auth.resend({
                        type: 'signup',
                        email: sentTo,
                        options: { emailRedirectTo: authRedirect(redirect) },
                      }),
                    ),
                  t('auth.resent'),
                )
              }
            >
              {t('auth.resend')}
            </button>
            {(resend.success || resend.error) && (
              <span className={resend.error ? 'error-msg' : 'help'} role="status">
                {resend.error || resend.success}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="oauth oauth--signup">
            {/* Connexion avec Google (OAuth, flux PKCE) : retour sur l'app avec ?code=, comme le lien magique */}
            <button
              type="button"
              className="btn btn-secondary btn-lg btn-block"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  check(
                    await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: authRedirect(redirect) },
                    }),
                  ),
                )
              }
            >
              <GoogleMark />
              {t('auth.googleSignup')}
            </button>
            <p className="help">
              <Trans
                i18nKey="auth.googleConsent"
                components={{
                  terms: <a href="#/legal/terms" target="_blank" rel="noopener" />,
                  privacy: <a href="#/legal/privacy" target="_blank" rel="noopener" />,
                }}
              />
            </p>
          </div>
          <div className="or">{t('auth.orEmail')}</div>
          {error && (
            <div className="alert alert-danger" role="alert">
              <CircleAlert aria-hidden="true" />
              {error}
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="name">{t('auth.fullName')}</label>
              <input
                id="name"
                className="input"
                autoComplete="name"
                placeholder={t('auth.namePlaceholder')}
                required
                maxLength={120}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors((x) => ({ ...x, name: '' }));
                }}
                {...fieldA11y('name', errors)}
              />
              <MkFieldError id="name" errors={errors} />
            </div>
            <div className="field">
              <label htmlFor="email">{t('auth.workEmail')}</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((x) => ({ ...x, email: '' }));
                }}
                {...fieldA11y('email', errors)}
              />
              <MkFieldError id="email" errors={errors} />
            </div>
            <div className="field">
              <label htmlFor="password">{t('auth.password')}</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((x) => ({ ...x, password: '' }));
                }}
                aria-describedby={errors.password ? 'password-error pwd-help' : 'pwd-help'}
                aria-invalid={errors.password ? true : undefined}
              />
              <div className="pwd-meter" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={i < segments ? 'on' : undefined} />
                ))}
              </div>
              <MkFieldError id="password" errors={errors} />
              <span className="help" id="pwd-help" aria-live="polite">
                {help}
              </span>
            </div>
            <label className="check auth-consent">
              <input
                type="checkbox"
                id="consent"
                required
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setErrors((x) => ({ ...x, consent: '' }));
                }}
                {...fieldA11y('consent', errors)}
              />
              {/* Pages légales ouvertes dans un nouvel onglet */}
              <span className="muted">
                <Trans
                  i18nKey="auth.consent"
                  components={{
                    terms: <a href="#/legal/terms" target="_blank" rel="noopener" />,
                    privacy: <a href="#/legal/privacy" target="_blank" rel="noopener" />,
                  }}
                />
              </span>
            </label>
            <MkFieldError id="consent" errors={errors} />
            <button className="btn btn-primary btn-lg btn-block auth-submit" type="submit" disabled={busy}>
              {t('auth.signUp')}
            </button>
          </form>
        </>
      )}
      <p className="muted auth-switch auth-switch--signup">
        {t('auth.hasAccount')} <Link to="/login">{t('auth.loginLink')}</Link>
      </p>
    </AuthLayout>
  );
}
