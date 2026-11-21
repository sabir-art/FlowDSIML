import { SettingsShell } from './SettingsShell';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { setLocale } from '../../i18n';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { useToast } from '../../components/Toast';
import { MyDataCard } from './MyDataCard';
import { Status } from '@flowdsiml/ui';

/**
 * Paramètres › Mon profil (PRM-09), mise en page de la maquette : une carte à sections en deux colonnes
 * (Profil, Préférences), puis le mot de passe. Les notifications par e-mail sont annoncées Bientôt
 * (aucun envoi d'e-mail n'existe encore).
 */
export function Profile() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [locale, setLoc] = useState<'fr' | 'en'>('fr');
  const [password, setPassword] = useState('');
  const info = useAction();
  const pwd = useAction();
  const soon = <Status size="sm">{t('shell.soon')}</Status>;

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

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    await pwd.run(async () => {
      check(await supabase.auth.updateUser({ password }));
      setPassword('');
      toast(t('profile.passwordUpdated'));
    });
  }

  return (
    <SettingsShell>
      <form className="card st-gen st-pf" onSubmit={saveProfile}>
        {info.error && (
          <div className="alert alert-danger st-gen-alert" role="alert">
            {info.error}
          </div>
        )}
        <div className="form-sec">
          <div className="intro">
            <h2 className="t-h3">{t('profile.section')}</h2>
          </div>
          <div>
            <div className="field">
              <label htmlFor="fn">{t('profile.name')}</label>
              <input
                id="fn"
                className="input"
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-email">{t('profile.email')}</label>
              <input
                id="pf-email"
                className="input"
                value={user?.email ?? ''}
                readOnly
                aria-describedby="pf-email-hint"
              />
              <span id="pf-email-hint" className="help">
                {t('profile.emailHint')}
              </span>
            </div>
          </div>
        </div>
        <div className="form-sec">
          <div className="intro">
            <h2 className="t-h3">{t('profile.prefs')}</h2>
          </div>
          <div>
            <div className="field">
              <label htmlFor="loc">{t('profile.uiLanguage')}</label>
              <select
                id="loc"
                className="select"
                value={locale}
                onChange={(e) => setLoc(e.target.value === 'en' ? 'en' : 'fr')}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <fieldset className="field st-pf-fs">
              <legend className="label">{t('profile.appearance')}</legend>
              <ThemeSwitcher withLabels />
            </fieldset>
            <div className="setting st-pf-notif">
              <div>
                <b id="pf-n1">{t('profile.notifLead')}</b> {soon}
              </div>
              <span className="switch">
                <input type="checkbox" disabled aria-labelledby="pf-n1" />
                <span />
              </span>
            </div>
            <div className="setting">
              <div>
                <b id="pf-n2">{t('profile.notifWeekly')}</b> {soon}
              </div>
              <span className="switch">
                <input type="checkbox" disabled aria-labelledby="pf-n2" />
                <span />
              </span>
            </div>
          </div>
        </div>
        <div className="form-sec st-gen-foot">
          <button type="button" className="btn btn-secondary" onClick={reset} disabled={info.busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={info.busy}>
            {t('common.save')}
          </button>
        </div>
      </form>

      <form className="card st-gen st-pf-pwd" onSubmit={savePassword}>
        {pwd.error && (
          <div className="alert alert-danger st-gen-alert" role="alert">
            {pwd.error}
          </div>
        )}
        <div className="form-sec">
          <div className="intro">
            <h2 className="t-h3">{t('profile.changePassword')}</h2>
            {/* E-mails P1 : un compte créé par invitation se connecte par lien magique, sans mot de passe */}
            <p className="help">{t('profile.passwordHint')}</p>
          </div>
          <div>
            <div className="field">
              <label htmlFor="np">{t('auth.passwordNew')}</label>
              <input
                id="np"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="st-pf-pwd-act">
              <button type="submit" className="btn btn-secondary" disabled={pwd.busy}>
                {t('auth.updatePassword')}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* L28-07 / L28-08 : mes données (export, suppression du compte) */}
      <MyDataCard />
    </SettingsShell>
  );
}
