import { Check, KeyRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Field, Select } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useAuth } from '../../auth/AuthProvider';
import { setLocale } from '../../i18n';

export function Profile() {
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [locale, setLoc] = useState<'fr' | 'en'>('fr');
  const [password, setPassword] = useState('');
  const info = useAction();
  const pwd = useAction();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setLoc(profile.locale === 'en' ? 'en' : 'fr');
    }
  }, [profile]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await info.run(async () => {
      check(await supabase.from('profiles').update({ full_name: fullName, locale }).eq('id', user!.id));
      setLocale(locale);
      await refreshProfile();
    }, t('common.saved'));
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    await pwd.run(async () => {
      check(await supabase.auth.updateUser({ password }));
      setPassword('');
    }, t('profile.passwordUpdated'));
  }

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <div className="page-head">
        <h1>{t('profile.title')}</h1>
      </div>
      <Card>
        <form onSubmit={saveProfile}>
          {info.error && <Alert kind="error">{info.error}</Alert>}
          {info.success && <Alert kind="success">{info.success}</Alert>}
          <Field label={t('auth.email')} htmlFor="pf-email">
            <input
              id="pf-email"
              className="fd-input"
              value={user?.email ?? ''}
              readOnly
              aria-describedby="pf-email-hint"
            />
            <p id="pf-email-hint" className="fd-help">
              {t('profile.emailHint')}
            </p>
          </Field>
          <Field label={t('auth.fullName')} htmlFor="fn">
            <input
              id="fn"
              className="fd-input"
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label={t('common.language')} htmlFor="loc">
            <Select id="loc" value={locale} onChange={(e) => setLoc(e.target.value === 'en' ? 'en' : 'fr')}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Button icon={<Check />} type="submit" variant="primary" disabled={info.busy}>
            {t('common.save')}
          </Button>
        </form>
      </Card>
      <Card>
        <h2 style={{ marginTop: 0 }}>{t('profile.changePassword')}</h2>
        <form onSubmit={savePassword}>
          {pwd.error && <Alert kind="error">{pwd.error}</Alert>}
          {pwd.success && <Alert kind="success">{pwd.success}</Alert>}
          <Field label={t('auth.passwordNew')} htmlFor="np">
            <input
              id="np"
              className="fd-input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button icon={<KeyRound />} type="submit" disabled={pwd.busy}>
            {t('auth.updatePassword')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
