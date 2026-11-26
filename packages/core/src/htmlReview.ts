/**
 * EXT-02 §2 : ce que la capture HTML retire ou remplace sur une page, élément par élément, pour l'écran
 * de vérification. Six groupes (décision du chef, 23/11) ; chaque élément porte une raison plus fine
 * (libellé de ligne et texte du « Pourquoi ? ») et dit s'il peut être gardé.
 *
 * Règles de « Garder » (décision du chef) :
 *  - scripts, gestionnaires, formulaires : jamais (la page publiée est une copie inerte, la navigation est
 *    rejouée à partir des clics) ;
 *  - cadres intégrés : seulement ceux d'une liste blanche de fournisseurs, en https ;
 *  - données personnelles remplacées et liens externes : oui, au choix de la personne qui capture.
 * Le serveur (html-ingest) applique de toute façon ses propres contrôles.
 *
 * Le classement passe par `classifyRemoved`, qui interroge d'abord les classeurs enregistrés avec
 * `registerHtmlClassifier` : c'est le point d'extension où une IA pourra plus tard dire « malveillant ou non ».
 */
import { isExternalLink, siteOf } from './htmlSanitize';
import type { PiiType } from './pii';

export const HTML_REVIEW_GROUPS = [
  'pageScripts',
  'trackingScripts',
  'frames',
  'forms',
  'pii',
  'externalLinks',
] as const;
export type HtmlReviewGroup = (typeof HTML_REVIEW_GROUPS)[number];

export type HtmlReviewReason =
  | 'scriptInline'
  | 'scriptSameSite'
  | 'scriptThirdParty'
  | 'scriptTracking'
  /** Lot B : élément ajouté à la page par un script d'un autre site (lanceur de discussion, bandeau). */
  | 'widgetThirdParty'
  | 'frameVideo'
  | 'frameMap'
  | 'frameThirdParty'
  | 'form'
  | 'pii'
  | 'linkExternal';

export interface HtmlClassification {
  group: HtmlReviewGroup;
  reason: HtmlReviewReason;
  /** La personne qui capture peut garder cet élément. */
  keepable: boolean;
}

export interface HtmlRemovedItem extends HtmlClassification {
  /** Identifiant stable dans la page (ordre de rencontre). */
  id: string;
  /** Nom affiché : fichier du script, adresse du cadre, texte du lien… Jamais une donnée personnelle. */
  name: string;
  /** Domaine d'origine, ou chaîne vide pour « dans la page ». */
  source: string;
  /** Lien externe : sélecteur stable sur la page et adresse absolue (pour le garder, opération « extlink »). */
  sel?: string;
  href?: string;
  /** Donnée personnelle : son type (« E-mail », « Téléphone »…). */
  piiType?: PiiType;
}

/** Au-delà, la liste est tronquée (les compteurs du rapport restent exacts). */
export const HTML_REVIEW_MAX_ITEMS = 5000;

const TRACKERS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'facebook.net',
  'connect.facebook.com',
  'hotjar.com',
  'clarity.ms',
  'segment.com',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
  'matomo.cloud',
  'plausible.io',
  'fullstory.com',
  'intercom.io',
  'intercomcdn.com',
  'hs-scripts.com',
  'hs-analytics.net',
  'hubspot.com',
  'linkedin.com',
  'licdn.com',
  'bing.com',
  'sentry.io',
  'datadoghq.com',
  'newrelic.com',
  'nr-data.net',
  'criteo.com',
  'crisp.chat',
  'axept.io',
  'cookiebot.com',
  'onetrust.com',
  'cdn.cookielaw.org',
];
const TRACKER_CODE = /\b(gtag|ga|fbq|_paq\.push|hj|mixpanel\.|analytics\.(track|page)|dataLayer\.push)\s*\(/;

/** Fournisseurs dont un cadre intégré peut être gardé (https seulement). */
const FRAME_ALLOW: Array<{ host: RegExp; path?: RegExp; reason: 'frameVideo' | 'frameMap' }> = [
  { host: /^(www\.)?youtube(-nocookie)?\.com$/, path: /^\/embed\//, reason: 'frameVideo' },
  { host: /^player\.vimeo\.com$/, path: /^\/video\//, reason: 'frameVideo' },
  { host: /^(www\.)?loom\.com$/, path: /^\/embed\//, reason: 'frameVideo' },
  { host: /^(www\.)?openstreetmap\.org$/, path: /^\/export\/embed/, reason: 'frameMap' },
  { host: /^(www\.)?google\.[a-z.]{2,6}$/, path: /^\/maps\/embed/, reason: 'frameMap' },
];

const parse = (u: string, base?: string): URL | null => {
  try {
    return new URL(u, base);
  } catch {
    return null;
  }
};
const hostMatches = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

/** Cadre intégré d'un fournisseur de la liste blanche (https) : sa raison, sinon null. */
export function allowedFrame(src: string, pageUrl?: string): 'frameVideo' | 'frameMap' | null {
  const u = parse(src, pageUrl);
  if (!u || u.protocol !== 'https:') return null;
  const hit = FRAME_ALLOW.find((f) => f.host.test(u.hostname) && (!f.path || f.path.test(u.pathname)));
  return hit?.reason ?? null;
}

export type HtmlClassifier = (el: Element, pageUrl: string | undefined) => HtmlClassification | null;
const extra: HtmlClassifier[] = [];
/**
 * Point d'extension : un classeur enregistré est interrogé avant les règles par défaut (le dernier
 * enregistré d'abord). Il renvoie null pour laisser la main. Renvoie la fonction de retrait.
 */
export function registerHtmlClassifier(fn: HtmlClassifier): () => void {
  extra.unshift(fn);
  return () => {
    const i = extra.indexOf(fn);
    if (i >= 0) extra.splice(i, 1);
  };
}

function defaultClassify(el: Element, pageUrl: string | undefined): HtmlClassification | null {
  const tag = el.tagName.toLowerCase();
  if (tag === 'script') {
    const src = el.getAttribute('src');
    const u = src ? parse(src, pageUrl) : null;
    if (u && hostMatches(u.hostname, TRACKERS))
      return { group: 'trackingScripts', reason: 'scriptTracking', keepable: false };
    if (!src && TRACKER_CODE.test(el.textContent ?? ''))
      return { group: 'trackingScripts', reason: 'scriptTracking', keepable: false };
    if (!src) return { group: 'pageScripts', reason: 'scriptInline', keepable: false };
    const third = !!u && !!pageUrl && isExternalLink(u.href, pageUrl);
    return { group: 'pageScripts', reason: third ? 'scriptThirdParty' : 'scriptSameSite', keepable: false };
  }
  if (['iframe', 'frame', 'object', 'embed'].includes(tag)) {
    const src = el.getAttribute('src') ?? el.getAttribute('data') ?? '';
    const ok = tag === 'iframe' ? allowedFrame(src, pageUrl) : null;
    return ok
      ? { group: 'frames', reason: ok, keepable: true }
      : { group: 'frames', reason: 'frameThirdParty', keepable: false };
  }
  if (tag === 'form') {
    if (!(el.hasAttribute('action') || el.hasAttribute('method') || el.hasAttribute('target'))) return null;
    return { group: 'forms', reason: 'form', keepable: false };
  }
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    return href && isExternalLink(href, pageUrl)
      ? { group: 'externalLinks', reason: 'linkExternal', keepable: true }
      : null;
  }
  return null;
}

/** Raison pour laquelle un élément de la page est retiré ou désactivé, ou null s'il ne l'est pas. */
export function classifyRemoved(el: Element, pageUrl?: string): HtmlClassification | null {
  for (const fn of extra) {
    const c = fn(el, pageUrl);
    if (c) return c;
  }
  return defaultClassify(el, pageUrl);
}

const clip = (s: string, n = 120) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function describe(el: Element, pageUrl: string | undefined): { name: string; source: string } {
  const tag = el.tagName.toLowerCase();
  const raw =
    el.getAttribute('src') ??
    el.getAttribute('data') ??
    (tag === 'a' ? el.getAttribute('href') : tag === 'form' ? el.getAttribute('action') : null) ??
    '';
  const u = raw ? parse(raw, pageUrl) : null;
  const source = u && /^https?:$/.test(u.protocol) ? siteOf(u.hostname) : '';
  if (tag === 'script') return { name: u ? clip(u.pathname.split('/').pop() || u.hostname) : '', source };
  if (tag === 'a') return { name: clip(el.textContent ?? '') || (u ? u.hostname : ''), source };
  if (tag === 'form')
    return { name: clip(el.getAttribute('aria-label') ?? el.getAttribute('name') ?? el.id ?? ''), source };
  return { name: clip(el.getAttribute('title') ?? '') || (u ? clip(u.hostname + u.pathname) : ''), source };
}

/**
 * Liste des éléments que l'assainissement va retirer ou désactiver sur cette copie de la page. À appeler
 * AVANT sanitizeDom, sur la copie (jamais sur la page vivante). Les données personnelles sont ajoutées par
 * l'appelant, qui seul connaît les détections (`piiItem`).
 */
export function collectRemoved(
  root: Element,
  pageUrl?: string,
  /** Sélecteur et adresse d'un lien de la copie, connus de l'appelant (calculés sur la page vivante). */
  linkOf?: (el: Element) => { sel: string; href: string } | undefined,
): HtmlRemovedItem[] {
  const out: HtmlRemovedItem[] = [];
  for (const el of root.querySelectorAll('script,iframe,frame,object,embed,form,a[href]')) {
    if (out.length >= HTML_REVIEW_MAX_ITEMS) break;
    if (el.closest('[data-fd-ui]')) continue;
    const c = classifyRemoved(el, pageUrl);
    if (!c) continue;
    const link = c.group === 'externalLinks' ? linkOf?.(el) : undefined;
    out.push({ id: `r${out.length + 1}`, ...c, ...describe(el, pageUrl), ...(link ?? {}) });
  }
  return out;
}

/** Donnée personnelle remplacée : `name` est la valeur déjà masquée (« j••••@••••.fr »), jamais l'originale. */
export function piiItem(index: number, masked: string, piiType?: PiiType): HtmlRemovedItem {
  return {
    id: `p${index + 1}`,
    group: 'pii',
    reason: 'pii',
    keepable: true,
    name: clip(masked, 60),
    source: '',
    ...(piiType ? { piiType } : {}),
  };
}

/** Nombre d'éléments par groupe (bilan de l'écran de vérification). */
export function countByGroup(items: HtmlRemovedItem[]): Record<HtmlReviewGroup, number> {
  const out = Object.fromEntries(HTML_REVIEW_GROUPS.map((g) => [g, 0])) as Record<HtmlReviewGroup, number>;
  for (const i of items) out[i.group]++;
  return out;
}
