import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, MousePointerClick, Share2, Sparkles } from 'lucide-react';
import { setLocale } from '../../i18n';

/** Écrans d'authentification (W5) : panneau de marque + formulaire, sélecteur de langue compact. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  return (
    <main className="auth-shell" id="main">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-logo">
          <span className="auth-logo-mark">
            <MousePointerClick size={20} />
          </span>
          {t('app.name')}
        </div>
        <div className="auth-pitch">
          <h2>{t('auth.pitchTitle')}</h2>
          <ul>
            <li>
              <Sparkles size={18} />
              {t('auth.pitch1')}
            </li>
            <li>
              <Share2 size={18} />
              {t('auth.pitch2')}
            </li>
            <li>
              <BarChart3 size={18} />
              {t('auth.pitch3')}
            </li>
          </ul>
        </div>
      </aside>
      <section className="auth-main">
        <div className="segmented auth-lang" role="group" aria-label={t('common.language')}>
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={i18n.language === l}
              onClick={() => setLocale(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="auth-card">
          <div className="auth-logo auth-logo--compact">
            <span className="auth-logo-mark">
              <MousePointerClick size={18} aria-hidden="true" />
            </span>
            {t('app.name')}
          </div>
          <h1>{title}</h1>
          {subtitle && <p className="fd-muted auth-subtitle">{subtitle}</p>}
          {children}
        </div>
      </section>
    </main>
  );
}
