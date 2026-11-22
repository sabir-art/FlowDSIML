import { SettingsShell } from './SettingsShell';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { setLocale } from '../../i18n';
import { CircleAlert } from 'lucide-react';
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
  const info = useAction();
  const pwd = useAction();
  const soon = <span className="stg-soon">{t('shell.soon')}</span>;

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
    if (password !== confirm) {
      setMismatch(true);
      document.getElementById('np2')?.focus();
      return;
    }
    await pwd.run(async () => {
      check(await supabase.auth.updateUser({ password }));
      setPassword('');
      setConfirm('');
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
            <div className="stg-row stg-row--inline">
              <div className="stg-text">
                <div className="stg-lab" id="pf-n1">
                  {t('profile.notifLead')} {soon}
                </div>
              </div>
              <div className="stg-ctl">
                <label className="fd-switch">
                  <input type="checkbox" role="switch" disabled aria-labelledby="pf-n1" />
                  <span className="fd-switch__track" aria-hidden="true" />
                </label>
              </div>
            </div>
            <div className="stg-row stg-row--inline">
              <div className="stg-text">
                <div className="stg-lab" id="pf-n2">
                  {t('profile.notifWeekly')} {soon}
                </div>
              </div>
              <div className="stg-ctl">
                <label className="fd-switch">
                  <input type="checkbox" role="switch" disabled aria-labelledby="pf-n2" />
                  <span className="fd-switch__track" aria-hidden="true" />
                </label>
              </div>
            </div>
          </div>
        </section>
      </form>

      <form
        id="pf-pwd-form"
        className="stg-sec st-pf-pwd"
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
            <Button type="submit" disabled={pwd.busy}>
              {t('auth.updatePassword')}
            </Button>
          </div>
        </div>
        {pwd.error && (
          <div className="alert alert-danger" role="alert">
            {pwd.error}
          </div>
        )}
        <div className="stg-row">
          <div className="stg-text" data-gap-exempt="">
            <label className="stg-lab" htmlFor="np">
              {t('profile.passwordNew')}
            </label>
            <div id="np-help" className="stg-help">
              {t('profile.passwordHelp')}
            </div>
          </div>
          <div className="stg-ctl">
            <div className="stg-two">
              <input
                id="np"
                className="fd-input"
                type="password"
                autoComplete="new-password"
                name="new-password"
                minLength={8}
                required
                aria-describedby="np-help"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setMismatch(false);
                }}
              />
              <input
                id="np2"
                className="fd-input"
                type="password"
                autoComplete="new-password"
                name="new-password-confirm"
                minLength={8}
                required
                placeholder={t('profile.passwordConfirm')}
                aria-label={t('profile.passwordConfirm')}
                aria-invalid={mismatch || undefined}
                aria-describedby={mismatch ? 'np2-error' : undefined}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setMismatch(false);
                }}
              />
            </div>
            {mismatch && (
              <p id="np2-error" className="stg-error">
                <CircleAlert size={16} aria-hidden="true" />
                {t('profile.passwordMismatch')}
              </p>
            )}
          </div>
        </div>
      </form>

      {/* Mes données (export) et Zone de danger (suppression du compte) */}
      <MyDataCard />
    </SettingsShell>
  );
}
