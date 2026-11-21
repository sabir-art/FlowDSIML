import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '@flowdsiml/core';
import { BrandMark } from '../../components/BrandMark';
import legal from '../../legal/legal.fr.json';
import '../../legal/legal.css';

type Section = { h: string; p?: string[]; ul?: string[] };
type Doc = { title: string; intro: string; sections: Section[] };

/**
 * Pages légales : politique de confidentialité et conditions d'utilisation.
 * Contenu unique dans legal/legal.fr.json, repris tel quel par la copie statique
 * public/legal/*.html (scripts/build-legal.mjs) que lisent Google et les robots.
 * Rédigées en français pour le réseau des Missions Locales (attribut lang="fr").
 */
export function LegalPage() {
  const { t } = useTranslation();
  const { doc } = useParams();
  if (doc !== 'terms' && doc !== 'privacy') return <Navigate to="/login" replace />;
  const d = legal[doc] as Doc;
  const other = doc === 'privacy' ? 'terms' : 'privacy';
  return (
    <div className="legal">
      <header className="legal__bar">
        <Link to="/" aria-label={t('auth.home', { app: APP_NAME })}>
          <BrandMark size={40} />
        </Link>
        <Link to="/">{t('legal.back')}</Link>
      </header>
      <main className="legal__doc" id="main" lang="fr">
        <h1>{d.title}</h1>
        <p className="legal__meta">Mise à jour : {legal.updated}</p>
        <p className="legal__draft" role="note">
          {legal.draft}
        </p>
        <p>{d.intro}</p>
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((x) => (
              <p key={x}>{x}</p>
            ))}
            {s.ul && (
              <ul>
                {s.ul.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <nav className="legal__links" aria-label={t('legal.other')}>
          <Link to={`/legal/${other}`}>{legal[other].title}</Link>
          <Link to="/">{t('legal.back')}</Link>
        </nav>
      </main>
    </div>
  );
}
