import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '@flowdsiml/core';
import { BrandMark } from '../../components/BrandMark';
import legal from '../../legal/legal.fr.json';
import '../../legal/legal.css';

type Section = { h: string; level?: number; p?: string[]; ul?: string[]; after?: string[] };
type Field = { label: string; value: string };
type Doc = {
  title: string;
  intro: string;
  draft?: string;
  fields?: Record<string, Field>;
  sections: Section[];
};
const DOCS = ['privacy', 'terms', 'accessibility'] as const;
type DocKey = (typeof DOCS)[number];

/**
 * Valeurs de configuration d'un document (`fields`) : `{{cle}}` devient la valeur fournie par le client,
 * ou sa mention entre crochets tant qu'elle manque (même règle que scripts/build-legal.mjs).
 */
const fill = (d: Doc, text: string) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => d.fields?.[k]?.value || `[${d.fields?.[k]?.label ?? k}]`);
const pending = (d: Doc) => !d.fields || Object.values(d.fields).some((f) => !f.value);

/**
 * Pages légales : politique de confidentialité, conditions d'utilisation, déclaration d'accessibilité.
 * Contenu unique dans legal/legal.fr.json, repris tel quel par la copie statique
 * public/legal/*.html (scripts/build-legal.mjs) que lisent Google et les robots.
 * Rédigées en français pour le réseau des Missions Locales (attribut lang="fr").
 */
export function LegalPage() {
  const { t } = useTranslation();
  const { doc } = useParams();
  if (!DOCS.includes(doc as DocKey)) return <Navigate to="/login" replace />;
  const d = legal[doc as DocKey] as Doc;
  const others = DOCS.filter((k) => k !== doc);
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
        {/* Encart « En attente de validation » tant qu'une valeur du client manque */}
        {pending(d) && (
          <p className="legal__draft" role="note">
            {d.draft ?? legal.draft}
          </p>
        )}
        <p>{fill(d, d.intro)}</p>
        {d.sections.map((s) => (
          <section key={s.h}>
            {s.level === 3 ? <h3>{s.h}</h3> : <h2>{s.h}</h2>}
            {s.p?.map((x) => (
              <p key={x}>{fill(d, x)}</p>
            ))}
            {s.ul && (
              <ul>
                {s.ul.map((x) => (
                  <li key={x}>{fill(d, x)}</li>
                ))}
              </ul>
            )}
            {s.after?.map((x) => (
              <p key={x}>{fill(d, x)}</p>
            ))}
          </section>
        ))}
        <nav className="legal__links" aria-label={t('legal.other')}>
          {others.map((k) => (
            <Link key={k} to={`/legal/${k}`}>
              {legal[k].title}
            </Link>
          ))}
          <Link to="/">{t('legal.back')}</Link>
        </nav>
      </main>
    </div>
  );
}
