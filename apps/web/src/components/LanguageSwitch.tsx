import { Select } from '@flowdsiml/ui';
import { useTranslation } from 'react-i18next';
import { setLocale } from '../i18n';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  return (
    <label className="fd-field">
      <span className="fd-label">{t('common.language')}</span>
      <Select
        value={i18n.language}
        onChange={(e) => {
          const lng = e.target.value === 'en' ? 'en' : 'fr';
          setLocale(lng);
          if (user) void supabase.from('profiles').update({ locale: lng }).eq('id', user.id);
        }}
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
      </Select>
    </label>
  );
}
