import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { setTheme, useTheme, type ThemePref } from '../lib/theme';

export const THEME_OPTIONS: Array<{ value: ThemePref; icon: typeof Sun }> = [
  // PRM-09 : ordre de la maquette (Système, Clair, Sombre)
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

/** Applique le thème et le mémorise sur le compte si une session existe (sans bloquer l'interface). */
export async function chooseTheme(pref: ThemePref) {
  setTheme(pref);
  const { data } = await supabase.auth.getSession();
  if (data.session && data.session.user.user_metadata?.theme !== pref) {
    await supabase.auth.updateUser({ data: { theme: pref } });
  }
}

/** Contrôle segmenté Système / Clair / Sombre (icônes Lucide, libellés optionnels). */
export function ThemeSwitcher({
  withLabels = false,
  className = '',
}: {
  withLabels?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <div
      className={`segmented theme-switch ${className}`.trim()}
      role="radiogroup"
      aria-label={t('theme.label')}
      onKeyDown={(e) => {
        // Groupe radio : flèches pour changer d'option, une seule tabulation pour le groupe
        const dir =
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? -1
              : 0;
        if (!dir) return;
        e.preventDefault();
        e.stopPropagation();
        const group = e.currentTarget;
        const i = THEME_OPTIONS.findIndex((o) => o.value === theme);
        const next = THEME_OPTIONS[(i + dir + THEME_OPTIONS.length) % THEME_OPTIONS.length]!;
        void chooseTheme(next.value);
        requestAnimationFrame(() => group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
      }}
    >
      {THEME_OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          tabIndex={theme === value ? 0 : -1}
          aria-label={withLabels ? undefined : t(`theme.${value}`)}
          title={withLabels ? undefined : t(`theme.${value}`)}
          onClick={() => void chooseTheme(value)}
        >
          <Icon size={16} aria-hidden="true" />
          {withLabels && <span>{t(`theme.${value}`)}</span>}
        </button>
      ))}
    </div>
  );
}
