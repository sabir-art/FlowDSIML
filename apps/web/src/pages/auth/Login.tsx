import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authRedirect, supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { fieldA11y, focusFirstError, validateForm, type FieldErrors } from '../../lib/validation';
import { useAuth } from '../../auth/AuthProvider';
import { PasswordInput } from '../../components/PasswordField';
import { AuthLayout, GoogleMark, MkFieldError } from './AuthLayout';

/** Connexion (CNX-01), à l'identique de la maquette connexion.html. */
export function Login() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params] = useSearchParams();
  // L28-08 : compte supprimé (drapeau de session, lu une fois)
  const [deletedNotice] = useState(() => {
    try {
      const v = sessionStorage.getItem('fd.accountDeleted') === '1' || params.get('deleted') === '1';
      sessionStorage.removeItem('fd.accountDeleted');
      return v;
    } catch {
      return params.get('deleted') === '1';
    }
  });
  const redirect = params.get('redirect') || '/';
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [badCredentials, setBadCredentials] = useState(false);
  const { busy, error, success, run } = useAction({ inline: true });

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
        // Lot 7 : encadré en haut du formulaire, erreur sous le mot de passe (seul champ marqué
        // invalide) ; la saisie est gardée, le mot de passe est focalisé et sélectionné pour le corriger
        setBadCredentials(true);
        const pwd = form.querySelector<HTMLInputElement>('#password');
        pwd?.focus();
        pwd?.select();
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

  const bad = { 'aria-invalid': true as const, 'aria-describedby': 'login-error' };

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      {/* L28-08 : retour après la suppression du compte */}
      {deletedNotice && (
        <div className="alert alert-success" role="status">
          {t('myData.deletedNotice')}
        </div>
      )}
      <div className="oauth">
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
          {t('auth.google')}
        </button>
      </div>
      <div className="or">{t('auth.orEmail')}</div>

      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}
      {badCredentials && mode === 'password' && (
        <div className="alert alert-danger auth-alert" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <b>{t('auth.badTitle')}</b>
            <span>{t('auth.badHelp')}</span>
          </div>
        </div>
      )}
      {error && !badCredentials && mode === 'magic' && (
        <div className="alert alert-danger" role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">{t('auth.workEmail')}</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            name="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((x) => ({ ...x, email: '' }));
            }}
            {...(badCredentials ? { 'aria-describedby': 'login-error' } : fieldA11y('email', errors))}
          />
          <MkFieldError id="email" errors={errors} />
        </div>
        {mode === 'password' && (
          <div className="field">
            <div className="row between">
              <label htmlFor="password">{t('auth.password')}</label>
              <Link to="/forgot-password" className="t-caption">
                {t('auth.forgot')}
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              name="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setBadCredentials(false);
                setErrors((x) => ({ ...x, password: '' }));
              }}
              {...(badCredentials ? bad : fieldA11y('password', errors))}
            />
            <MkFieldError id="password" errors={errors} />
            {/* L'encadré du haut annonce l'erreur d'identifiants ; ce message la rattache au champ */}
            {(badCredentials || (error && mode === 'password')) && (
              <span className="error-msg" id="login-error" role={badCredentials ? undefined : 'alert'}>
                <CircleAlert aria-hidden="true" />
                {badCredentials ? t('auth.badPassword') : error}
              </span>
            )}
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block auth-submit" type="submit" disabled={busy}>
          {mode === 'password' ? t('auth.signIn') : t('auth.sendMagicLink')}
        </button>
        <p className="t-caption subtle auth-alt">
          {mode === 'password' ? (
            <>
              {t('auth.orMagicBefore')}
              <button
                type="button"
                className="mk-link"
                onClick={() => {
                  setMode('magic');
                  setErrors({});
                  setBadCredentials(false);
                }}
              >
                {t('auth.orMagicLink')}
              </button>
              .
            </>
          ) : (
            <button
              type="button"
              className="mk-link"
              onClick={() => {
                setMode('password');
                setErrors({});
              }}
            >
              {t('auth.usePassword')}
            </button>
          )}
        </p>
      </form>

      <p className="muted auth-switch">
        {t('auth.noAccount')}{' '}
        <Link to={`/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>
          {t('auth.signupLink')}
        </Link>
      </p>
    </AuthLayout>
  );
}
