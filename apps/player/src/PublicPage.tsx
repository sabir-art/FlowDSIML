import { safeExternalUrl } from '@flowdsiml/manifest';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ArrowRight, Clock, EyeOff, Lock, Play, Users } from 'lucide-preact';
import { personalTitle } from '@flowdsiml/core';
import { brandingUrl, personalPage, publicPage, type PersonalPageInfo, type PublicPageInfo } from './api';
import { fmt, strings } from './i18n';
import './public-page.css';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;
/**
 * La page elle-même intégrée par un site tiers : le lecteur n'y est pas embarqué (sinon la liste
 * d'origines autorisées de la démo serait contournée) ; le bouton ouvre la page dans un onglet.
 */
const framed = (() => {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
})();

/** Balise <meta> posée en JS (pas de rendu serveur : og:image et OG serveur « Bientôt »). */
function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Texte brut de l'écran de fin (gras Markdown retiré). */
const plain = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * L19b-03 / 04 / 05 : page publique d'une démo (#/p/<id>). Le vrai lecteur est intégré en iframe
 * (même origine, sandbox) et garde ses protections (mot de passe…). Page indisponible : même message
 * dans tous les cas, noindex.
 */
export function PublicPage({ id, code }: { id: string; code?: string }) {
  const t = strings(navigator.language.startsWith('en') ? 'en' : 'fr');
  const p = t.page;
  const [info, setInfo] = useState<PublicPageInfo | null | undefined>(undefined);
  /** L25-14 / 15 : page personnalisée d'un lien (contenu du lien, ou lien inactif). */
  const [personal, setPersonal] = useState<PersonalPageInfo | null>(null);
  const [started, setStarted] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const perso = personal?.status === 'ok' ? personal.personal : null;

  useEffect(() => {
    if (code) {
      // Page personnalisée : jamais indexée ni suivie, et le code ne fuit pas par le référent
      setMeta('robots', 'noindex, nofollow');
      setMeta('referrer', 'no-referrer');
      void personalPage(id, code)
        .catch(() => ({ status: 'not_found' }) as PersonalPageInfo)
        .then((r) => {
          setPersonal(r);
          setInfo(r.status === 'ok' ? r.page : null);
        });
      return;
    }
    void publicPage(id)
      .catch(() => null)
      .then((r) => setInfo(r ?? null));
  }, [id, code]);

  useEffect(() => {
    if (info === undefined) return;
    if (!info) {
      document.title = personal?.status === 'inactive' ? p.inactiveTitle : p.offTitle;
      setMeta('robots', code ? 'noindex, nofollow' : 'noindex');
      return;
    }
    if (perso) {
      // Pas d'Open Graph personnalisé : l'aperçu reste celui de la démo
      document.title = `${personalTitle(perso.title, perso.variables, info.title)} · ${info.workspace}`;
      document.documentElement.dataset.pageTheme = info.style === 'dark' ? 'dark' : 'light';
      return;
    }
    document.title = `${info.title} · ${info.workspace}`;
    setMeta('description', info.description);
    setMeta('robots', info.indexable ? 'index, follow' : 'noindex');
    setMeta('og:title', info.title, 'property');
    setMeta('og:description', info.description, 'property');
    setMeta('og:url', location.href, 'property');
    document.documentElement.dataset.pageTheme = info.style === 'dark' ? 'dark' : 'light';
  }, [info, p, perso, personal, code]);

  useEffect(() => {
    if (started) frame.current?.focus();
  }, [started]);

  if (info === undefined) return <div class="p-center">{t.loading}</div>;
  // L25-15 : lien expiré ou désactivé (un code inconnu garde la page « indisponible »)
  if (personal?.status === 'inactive')
    return (
      <div class="pp pp-off">
        <main class="pp-na">
          <Clock size={40} aria-hidden="true" />
          <h1>{p.inactiveTitle}</h1>
          <p>{p.inactiveBody}</p>
          {personal.publicPage && (
            <a class="pill pill-p" href={`#/p/${personal.demoId}`}>
              {p.seePublic}
            </a>
          )}
        </main>
      </div>
    );
  if (!info)
    return (
      <div class="pp pp-off">
        <main class="pp-na">
          <EyeOff size={40} aria-hidden="true" />
          <h1>{p.offTitle}</h1>
          <p>{p.offBody}</p>
        </main>
      </div>
    );

  const updated = new Date(info.updatedAt).toLocaleDateString(document.documentElement.lang || 'fr', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const title = perso ? personalTitle(perso.title, perso.variables, info.title) : info.title;
  const company = (perso?.variables.company ?? '').trim();
  const cta = perso ? perso.cta : info.cta;
  // Lecteur : le lien personnalisé (variables et ligne du jeu de données) ; démo protégée : écran habituel
  const playerSrc = perso?.token
    ? `${location.pathname}#/l/${perso.token}?ch=page`
    : `${location.pathname}#/d/${info.demoId}?ch=page`;
  const endTitle = plain(info.endTitle);
  const endBody = plain(info.endBody);
  const a11y = (p as Record<string, string>)[`a11y_${info.a11y}`] ?? p.a11y_non_evalue;
  return (
    <div class={`pp${info.style === 'dark' ? ' pp-dark' : ''}${perso ? ' pp-perso' : ''}`}>
      <header class="pp-top">
        {info.logoPath ? (
          <img class="pp-lg pp-logo" src={brandingUrl(info.logoPath)} alt="" width={32} height={32} />
        ) : (
          <span class="pp-lg" aria-hidden="true">
            {info.workspace.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <b>{info.workspace}</b>
        {cta && (
          <a
            class="pill pill-p pp-cta"
            href={safeExternalUrl(cta.url) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            {cta.label}
          </a>
        )}
      </header>
      <main>
        <section class="pp-hero">
          {perso && company && (
            <span class="pp-badge">
              <Users size={16} aria-hidden="true" />
              {fmt(p, 'preparedFor', { company })}
            </span>
          )}
          <h1>{title}</h1>
          {info.description && <p>{info.description}</p>}
          <div class="pp-meta">
            <span>{fmt(p, 'steps', { count: info.steps })}</span>
            <span>{fmt(p, 'updated', { date: updated })}</span>
          </div>
        </section>
        {perso && (perso.message || perso.signer) && (
          <section class="pp-msg">
            {perso.signer && (
              <span class="pp-avatar" aria-hidden="true">
                {perso.signer.initials}
              </span>
            )}
            <div>
              {perso.message && <p>{perso.message}</p>}
              {perso.signer && (
                <span class="pp-sign">
                  {fmt(p, 'signedBy', { name: perso.signer.name, workspace: info.workspace })}
                </span>
              )}
            </div>
          </section>
        )}
        <section class="pp-stage" aria-label={fmt(p, 'stage', { title: info.title })}>
          {started ? (
            <iframe
              ref={frame}
              title={fmt(p, 'stage', { title: info.title })}
              src={playerSrc}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              allow="fullscreen"
            />
          ) : (
            <div class="pp-cover">
              {framed ? (
                <a class="pill pill-p pill-lg" href={location.href} target="_blank" rel="noopener noreferrer">
                  <Play {...ICON} />
                  {p.start}
                </a>
              ) : (
                <button type="button" class="pill pill-p pill-lg" onClick={() => setStarted(true)}>
                  <Play {...ICON} />
                  {p.start}
                </button>
              )}
            </div>
          )}
        </section>
        {cta && (
          <section class="pp-action">
            <div>
              <h2>{endTitle || cta.label}</h2>
              {endTitle && endBody && <p>{endBody}</p>}
            </div>
            <a
              class="pill pill-k"
              href={safeExternalUrl(cta.url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              {cta.label}
              <ArrowRight {...ICON} />
            </a>
          </section>
        )}
        {!perso && info.related.length > 0 && (
          <section class="pp-related" aria-labelledby="pp-rel">
            <h2 id="pp-rel">{p.related}</h2>
            <ul>
              {info.related.map((r) => (
                <li key={r.demoId}>
                  <a href={`#/p/${r.demoId}`}>
                    <b>{r.title}</b>
                    {r.description && <span>{r.description}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer class="pp-foot">
        <span>{p.madeWith}</span>
        {info.privacyUrl && (
          <>
            <span aria-hidden="true">·</span>
            <a href={safeExternalUrl(info.privacyUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
              {p.privacy}
            </a>
          </>
        )}
        <span aria-hidden="true">·</span>
        {info.a11yUrl ? (
          <a href={safeExternalUrl(info.a11yUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
            {fmt(p, 'a11y', { status: a11y })}
          </a>
        ) : (
          <span>{fmt(p, 'a11y', { status: a11y })}</span>
        )}
        {perso && (
          <p class="pp-notice">
            <Lock size={14} aria-hidden="true" />
            {fmt(p, 'personalNotice', { workspace: info.workspace })}
          </p>
        )}
      </footer>
    </div>
  );
}
