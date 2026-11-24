import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Globe } from 'lucide-react';
import { APP_NAME } from '@flowdsiml/core';
import { BrandMark } from '../../components/BrandMark';
import { setLocale } from '../../i18n';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import type { FieldErrors } from '../../lib/validation';
import { DemoAside } from './AuthIllustration';

export { DemoAside, StepsAside } from './AuthIllustration';

/** Message d'erreur de champ au format de la maquette (`.error-msg`). */
export function MkFieldError({ id, errors }: { id: string; errors: FieldErrors }) {
  if (!errors[id]) return null;
  return (
    <span className="error-msg" id={`${id}-error`}>
      <CircleAlert aria-hidden="true" />
      {errors[id]}
    </span>
  );
}

/** Logo Google du bouton OAuth (marque tierce, couleurs imposées). */
export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}

/**
 * Écrans d'authentification, reconstruits à l'identique de la maquette (règle D13) :
 * formulaire à gauche, panneau illustré à droite (masqué sous 900 px), pied de page langue + liens.
 */
export function AuthLayout({
  title,
  subtitle,
  aside,
  compact,
  footer = true,
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  /** Logo plus proche du titre (inscription : 40 px au lieu de 48) */
  compact?: boolean;
  /** Bouton de langue du pied (absent de l'inscription) ; les liens légaux restent partout */
  footer?: boolean;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const other = i18n.language === 'en' ? 'fr' : 'en';
  return (
    <div className="mk">
      <div className="auth">
        <main className="auth-form" id="main">
          <Link
            to="/"
            className={`auth-logo-link${compact ? ' auth-logo-link--compact' : ''}`}
            aria-label={t('auth.home', { app: APP_NAME })}
          >
            {/* LOGO-01 (§16.5) : logo complet du client, 400 px ; logo compact sous 480 px de large */}
            <span className="auth-mark auth-mark--full">
              <BrandMark full width={400} />
            </span>
            <span className="auth-mark auth-mark--compact">
              <BrandMark size={40} />
            </span>
          </Link>
          <h1>{title}</h1>
          {subtitle && <p className="muted t-lg auth-sub">{subtitle}</p>}
          {children}
          {/* Pied : la langue (sauf sur l'inscription) et les liens légaux, sur toutes les pages d'accès */}
          <div className="row auth-footer">
            {footer && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setLocale(other)}>
                <Globe aria-hidden="true" />
                {/* Nom accessible = texte visible précédé de l'action (RGAA 11.2) */}
                <span className="sr-only">{t('auth.changeLanguage')} : </span>
                <span lang={i18n.language === 'en' ? 'en' : 'fr'}>
                  {i18n.language === 'en' ? 'English' : 'Français'}
                </span>
              </button>
            )}
            <span className="row auth-legal">
              <Link className="t-caption subtle" to="/legal/privacy">
                {t('auth.privacy')}
              </Link>
              <Link className="t-caption subtle" to="/legal/terms">
                {t('auth.terms')}
              </Link>
              {/* Mention imposée par le RGAA tant qu'aucun audit complet n'est fait */}
              <Link className="t-caption subtle" to="/legal/accessibility">
                {t('auth.accessibility')}
              </Link>
            </span>
          </div>
        </main>
        {aside ?? <DemoAside />}
      </div>
    </div>
  );
}
