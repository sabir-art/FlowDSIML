import { SettingsShell } from './SettingsShell';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
import { setLocale } from '../../i18n';
import { Button, Select } from '@flowdsiml/ui';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { useToast } from '../../components/Toast';
import { MyDataCard } from './MyDataCard';
import { ProfilePhoto } from './ProfilePhoto';

/**
 * Paramètres › Profil, maquette lot1-parametres/profil : sections posées sur le fond de contenu (Photo et
 * informations, Préférences, Mot de passe, Mes données), Annuler et Enregistrer dans la barre de page pour
 * les informations et les préférences, puis la Zone de danger encadrée. Le mot de passe garde son propre
 * bouton. Les notifications par e-mail sont annoncées « Bientôt » (aucun envoi n'existe encore).
 */
export function Profile() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [locale, setLoc] = useState<'fr' | 'en'>('fr');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwFailed, setPwFailed] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  /**
   * « Mot de passe actuel » (décision du chef, 23/11) : demandé seulement si le compte a déjà un mot de
   * passe. Un compte créé avec Google ou par lien e-mail en définit un, sans ce champ. null : pas encore su.
   */
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [currentError, setCurrentError] = useState('');
  // Sécurité (retour client du 24/11) : les champs n'existent qu'après « Mettre à jour le mot de passe »,
  // vides, et tout est vidé à l'annulation comme à l'enregistrement
  const [pwOpen, setPwOpen] = useState(false);
  const closePassword = () => {
    setPassword('');
    setConfirm('');
    setCurrent('');
    setCurrentError('');
    setMismatch(false);
    setPwError('');
    setPwFailed(false);
    setPwTouched(false);
    setPwOpen(false);
    requestAnimationFrame(() => document.getElementById('pf-pw-open')?.focus());
  };
  useEffect(() => {
    let alive = true;
    void supabase.rpc('account_deletion_check').then(({ data, error }) => {
      if (!alive) return;
      const known = !error && typeof (data as { hasPassword?: unknown } | null)?.hasPassword === 'boolean';
      // Sans réponse : le champ est demandé (le serveur reste juge)
      setHasPassword(known ? (data as { hasPassword: boolean }).hasPassword : true);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);
  const info = useAction();
  const pwd = useAction();

  const reset = () => {
    if (!profile) return;
    setFullName(profile.full_name);
    setLoc(profile.locale === 'en' ? 'en' : 'fr');
  };

  useEffect(reset, [profile]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await info.run(async () => {
      check(await supabase.from('profiles').update({ full_name: fullName, locale }).eq('id', user!.id));
      void setLocale(locale);
      await refreshProfile();
      toast(t('workspace.saved'));
    });
  }

  const refusePassword = (message: string) => {
    setPwError(message);
    setPwFailed(true);
    document.getElementById('np')?.focus();
  };
  async function savePassword(e: FormEvent) {
    e.preventDefault();
    const refuseCurrent = (message: string) => {
      setCurrentError(message);
      document.getElementById('cp')?.focus();
    };
    if (hasPassword && !current) return refuseCurrent(t('profile.passwordCurrentRequired'));
    const local = localPasswordError(t, password);
    if (local) return refusePassword(local);
    if (password !== confirm) {
      setMismatch(true);
      document.getElementById('np2')?.focus();
      return;
    }
    await pwd.run(async () => {
      if (hasPassword) {
        // Le mot de passe actuel est vérifié par une connexion, puis transmis avec la demande : le serveur
        // le revérifie quand « exiger le mot de passe actuel » est activé
        const check2 = await supabase.auth.signInWithPassword({
          email: user?.email ?? '',
          password: current,
        });
        if (check2.error) return refuseCurrent(t('profile.passwordCurrentWrong'));
      }
      const res = await supabase.auth.updateUser(
        hasPassword ? { password, current_password: current } : { password },
      );
      if (res.error && /current password/i.test(res.error.message))
        return refuseCurrent(t('profile.passwordCurrentWrong'));
      // Refus du serveur (trop court, caractères manquants, identique à l'actuel…) : sous le champ
      const refused = res.error && passwordErrorMessage(t, res.error, password);
      if (refused) return refusePassword(refused);
      check(res);
      setHasPassword(true);
      closePassword();
      toast(t('profile.passwordUpdated'));
    });
  }

  return (
    <SettingsShell
      legacy={false}
      actions={
        <>
          <Button onClick={reset} disabled={info.busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="pf-form" disabled={info.busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="pf-form" className="st-pf" onSubmit={saveProfile}>
        {info.error && (
          <div className="alert alert-danger" role="alert">
            {info.error}
          </div>
        )}
        <section className="stg-sec" aria-labelledby="pf-sec-info">
          <div className="stg-sec__head">
            <div>
              <h2 id="pf-sec-info">{t('profile.infoTitle')}</h2>
              <p>{t('profile.infoHelp')}</p>
            </div>
          </div>
          {/* §18.6 : rangées à filets, l'écart est porté par leur padding de 20 px */}
          <div data-gap-exempt="">
            <ProfilePhoto />
            <div className="stg-row">
              <div className="stg-text">
                <label className="stg-lab" htmlFor="fn">
                  {t('profile.name')}
                </label>
              </div>
              <div className="stg-ctl">
                <input
                  id="fn"
                  className="fd-input"
                  maxLength={120}
                  autoComplete="name"
                  name="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
            <div className="stg-row">
              <div className="stg-text" data-gap-exempt="">
                <label className="stg-lab" htmlFor="pf-email">
                  {t('profile.email')}
                </label>
                <div id="pf-email-hint" className="stg-help">
                  {t('profile.emailHint')}
                </div>
              </div>
              <div className="stg-ctl">
                <input
                  id="pf-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="fd-input stg-input--locked"
                  value={user?.email ?? ''}
                  readOnly
                  aria-describedby="pf-email-hint"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="stg-sec" aria-labelledby="pf-sec-prefs">
          <div className="stg-sec__head">
            <div>
              <h2 id="pf-sec-prefs">{t('profile.prefs')}</h2>
            </div>
          </div>
          <div data-gap-exempt="">
            <div className="stg-row">
              <div className="stg-text">
                <label className="stg-lab" htmlFor="loc">
                  {t('profile.uiLanguage')}
                </label>
              </div>
              <div className="stg-ctl">
                <Select
                  id="loc"
                  className="stg-short"
                  value={locale}
                  onChange={(e) => setLoc(e.target.value === 'en' ? 'en' : 'fr')}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Select>
              </div>
            </div>
            <div className="stg-row">
              <div className="stg-text">
                <div className="stg-lab">{t('profile.appearance')}</div>
              </div>
              <div className="stg-ctl">
                <ThemeSwitcher withLabels className="stg-seg" />
              </div>
            </div>
          </div>
        </section>
      </form>

      <form
        id="pf-pwd-form"
        className="stg-sec st-pf-pwd"
        // Pas de bulle native du navigateur (COMP-01) : les erreurs s'affichent sous les champs
        noValidate
        onSubmit={savePassword}
        aria-labelledby="pf-sec-pwd"
      >
        <div className="stg-sec__head">
          <div>
            <h2 id="pf-sec-pwd">{t('profile.changePassword')}</h2>
            {/* Un compte créé par invitation se connecte par lien magique, sans mot de passe */}
            <p>{t('profile.passwordHint')}</p>
          </div>
          <div className="stg-sec__acts">
            {pwOpen ? (
              <>
                <Button type="button" variant="ghost" disabled={pwd.busy} onClick={closePassword}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={pwd.busy}>
                  {t('profile.passwordSave')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                id="pf-pw-open"
                aria-expanded={false}
                onClick={() => {
                  setPwOpen(true);
                  requestAnimationFrame(() => document.getElementById(hasPassword ? 'cp' : 'np')?.focus());
                }}
              >
                {t(hasPassword === false ? 'profile.setPassword' : 'auth.updatePassword')}
              </Button>
            )}
          </div>
        </div>
        {pwOpen && pwd.error && (
          <div className="alert alert-danger" role="alert">
            {pwd.error}
          </div>
        )}
        {pwOpen && hasPassword && (
          <div className="stg-row">
            <div className="stg-text" data-gap-exempt="">
              <label className="stg-lab" htmlFor="cp">
                {t('profile.passwordCurrent')}
              </label>
            </div>
            <div className="stg-ctl pf-pw">
              {/* Pas d'œil sur le mot de passe actuel ; jamais prérempli à l'affichage */}
              <PasswordInput
                id="cp"
                noEye
                guard
                autoComplete="current-password"
                name="current-password"
                required
                value={current}
                aria-invalid={currentError ? true : undefined}
                aria-describedby={currentError ? 'cp-error' : undefined}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setCurrentError('');
                }}
              />
              <PasswordError id="cp-error">{currentError}</PasswordError>
            </div>
          </div>
        )}
        {/* EXT-02 §7 : œil, jauge de force, règles de la politique ; erreurs sous le champ */}
        {pwOpen && (
          <>
            <div className="stg-row">
              <div className="stg-text" data-gap-exempt="">
                <label className="stg-lab" htmlFor="np">
                  {t('profile.passwordNew')}
                </label>
              </div>
              <div className="stg-ctl pf-pw">
                <PasswordInput
                  id="np"
                  autoComplete="new-password"
                  name="new-password"
                  required
                  value={password}
                  aria-invalid={pwError ? true : undefined}
                  aria-describedby={pwError ? 'np-error np-rules' : 'np-rules'}
                  onFocus={() => setPwTouched(true)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setMismatch(false);
                    setPwError('');
                    setPwFailed(false);
                  }}
                />
                <PasswordMeter password={password} />
                <PasswordError id="np-error">{pwError}</PasswordError>
                {(pwTouched || password) && (
                  <PasswordRules id="np-rules" password={password} failed={pwFailed} />
                )}
              </div>
            </div>
            <div className="stg-row">
              <div className="stg-text" data-gap-exempt="">
                <label className="stg-lab" htmlFor="np2">
                  {t('password.confirmLabel')}
                </label>
              </div>
              <div className="stg-ctl pf-pw">
                <PasswordInput
                  id="np2"
                  autoComplete="new-password"
                  name="new-password-confirm"
                  required
                  value={confirm}
                  aria-invalid={mismatch || undefined}
                  aria-describedby={mismatch ? 'np2-error' : confirm ? 'np2-rule' : undefined}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setMismatch(false);
                  }}
                />
                <PasswordError id="np2-error">{mismatch ? t('password.mismatch') : ''}</PasswordError>
                {!mismatch && <PasswordMatch id="np2-rule" password={password} confirm={confirm} />}
              </div>
            </div>
          </>
        )}
      </form>

      {/* Mes données (export) et Zone de danger (suppression du compte) */}
      <MyDataCard />
    </SettingsShell>
  );
}
