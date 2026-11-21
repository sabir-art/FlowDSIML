/**
 * A8 : assainissement d'une capture HTML (côté extension ; le serveur assainit à nouveau). Retire
 * tout ce qui peut exécuter du code, charger un contenu tiers ou garder une saisie : scripts,
 * cadres, objets, gestionnaires on*, URL javascript:, valeurs des champs. Le résultat est inerte.
 * L49 §3 : renvoie aussi les compteurs du rapport d'analyse, avec les mêmes règles que countSecurity côté
 * serveur (supabase/functions/html-ingest/security.ts : mêmes chiffres sur la même page). Compteurs
 * déclaratifs côté extension ; garantie = assainissement serveur.
 */
import { getDomain } from 'tldts';

const SCRIPTS = 'script,noscript';
const FRAMES = 'iframe,frame,frameset,object,embed,applet';
const OTHER = 'base,template,portal,meta[http-equiv],link';
const DROP = `${SCRIPTS},${FRAMES},${OTHER}`;
const URL_ATTRS = [
  'href',
  'src',
  'xlink:href',
  'action',
  'formaction',
  'poster',
  'background',
  'cite',
  'data',
];
const SCRIPT_URL = /^\s*(javascript|vbscript):/i;
const BAD_URL = /^\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp|svg\+xml|avif)[;,]))/i;
const CSS_HITS =
  /@import|expression\s*\(|(behavior|-moz-binding)\s*:|url\(\s*['"]?\s*(javascript|vbscript):/gi;

/** L49 §3 : compteurs du rapport d'analyse de sécurité d'une page HTML capturée. */
export interface HtmlSecurityCounts {
  scripts: number;
  handlers: number;
  frames: number;
  forms: number;
  externalLinks: number;
  piiReplaced: number;
  other: number;
}
export const HTML_SECURITY_KEYS = [
  'scripts',
  'handlers',
  'frames',
  'forms',
  'externalLinks',
  'piiReplaced',
  'other',
] as const;
export const emptyHtmlSecurity = (): HtmlSecurityCounts => ({
  scripts: 0,
  handlers: 0,
  frames: 0,
  forms: 0,
  externalLinks: 0,
  piiReplaced: 0,
  other: 0,
});

/** Nombre de constructions CSS dangereuses (celles que sanitizeCss neutralise). */
export function cssHits(css: string): number {
  return css.match(CSS_HITS)?.length ?? 0;
}

/** CSS sans import ni exécution (expression(), javascript:, behavior, -moz-binding). */
export function sanitizeCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'x(')
    .replace(/(behavior|-moz-binding)\s*:[^;}]*/gi, '')
    .replace(/url\(\s*(['"]?)\s*(javascript|vbscript):[^)]*\)/gi, 'url()');
}

/**
 * Domaine de rattachement selon la liste des suffixes publics (tldts, MIT) : les sous-domaines d'un même
 * domaine sont internes (L49 §4), mais deux sites sous un suffixe à deux niveaux restent distincts
 * (travail-emploi.gouv.fr ≠ service-public.gouv.fr). Même règle côté serveur. Adresse IP ou nom local :
 * le nom complet.
 */
export function siteOf(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  return getDomain(h, { allowPrivateDomains: true }) ?? h;
}

/** Lien http(s) vers un autre domaine que celui de la page (L49 §4). */
export function isExternalLink(href: string, pageUrl: string | undefined): boolean {
  if (!pageUrl) return false;
  try {
    const u = new URL(href, pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return siteOf(u.hostname) !== siteOf(new URL(pageUrl).hostname);
  } catch {
    return false;
  }
}

export function sanitizeDom(root: Element, pageUrl?: string): HtmlSecurityCounts {
  const c = emptyHtmlSecurity();
  for (const el of [...root.querySelectorAll(DROP)]) {
    // Un élément déjà retiré avec son parent n'est pas compté deux fois
    if (!root.contains(el)) continue;
    if (el.matches(SCRIPTS)) c.scripts++;
    else if (el.matches(FRAMES)) c.frames++;
    else c.other++;
    el.remove();
  }
  const all = [root, ...root.querySelectorAll('*')];
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    for (const a of [...el.attributes]) {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) {
        c.handlers++;
        el.removeAttribute(a.name);
        continue;
      }
      if (name === 'srcdoc' || name === 'formaction') {
        c.other++;
        el.removeAttribute(a.name);
        continue;
      }
      if (name === 'autofocus' || name === 'nonce' || name === 'integrity') {
        el.removeAttribute(a.name);
        continue;
      }
      if (URL_ATTRS.includes(name) && BAD_URL.test(a.value)) {
        if (SCRIPT_URL.test(a.value)) c.scripts++;
        else c.other++;
        el.removeAttribute(a.name);
        continue;
      }
      if (name === 'style') {
        c.other += cssHits(a.value);
        el.setAttribute('style', sanitizeCss(a.value));
      }
    }
    if (tag === 'form') {
      if (el.hasAttribute('action') || el.hasAttribute('method') || el.hasAttribute('target')) c.forms++;
      el.removeAttribute('action');
      el.removeAttribute('method');
      el.removeAttribute('target');
    }
    if (tag === 'a' && el.hasAttribute('href') && isExternalLink(el.getAttribute('href') ?? '', pageUrl))
      c.externalLinks++;
    if (tag === 'input') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (!['button', 'submit', 'reset', 'image'].includes(type)) el.removeAttribute('value');
      el.removeAttribute('checked');
    }
    if (tag === 'textarea') el.textContent = '';
    if (tag === 'option') el.removeAttribute('selected');
    if (tag === 'style') {
      c.other += cssHits(el.textContent ?? '');
      el.textContent = sanitizeCss(el.textContent ?? '');
    }
    // SVG : animations qui réécrivent un lien
    if ((tag === 'set' || tag === 'animate') && /href/i.test(el.getAttribute('attributeName') ?? '')) {
      c.other++;
      el.remove();
    }
  }
  return c;
}

/** L49 §3 : rapport enregistré (compteurs du serveur, Safe Browsing à partir de P4). */
export type HtmlSecurityReport = Partial<HtmlSecurityCounts> & {
  dangerousLinks?: number;
  safeBrowsing?: 'ok' | 'unavailable';
  /** L49 §4.1 : adresses signalées par Google Safe Browsing (liens bloqués). */
  blocked?: string[];
  analyzedAt?: string;
};
export type HtmlSecurityStatus = 'safe' | 'removed' | 'partial';

/** Nombre d'éléments actifs retirés (ce qui pouvait s'exécuter ou envoyer des données). */
export function activeRemoved(r: HtmlSecurityReport): number {
  return (r.scripts ?? 0) + (r.handlers ?? 0) + (r.frames ?? 0) + (r.forms ?? 0) + (r.other ?? 0);
}

/**
 * « Page sûre » si rien d'actif n'a été retiré ni bloqué ; « Éléments retirés » sinon ; « Vérification
 * partielle » si rien n'a été retiré mais que Google Safe Browsing n'a pas répondu.
 */
export function htmlSecurityStatus(r: HtmlSecurityReport): HtmlSecurityStatus {
  if (activeRemoved(r) + (r.dangerousLinks ?? 0) > 0) return 'removed';
  return r.safeBrowsing === 'unavailable' ? 'partial' : 'safe';
}

/** Somme de plusieurs rapports (rapport cumulé de l'extension, liste de contrôle avant publication). */
export function sumHtmlSecurity(list: HtmlSecurityReport[]): HtmlSecurityReport {
  const out: HtmlSecurityReport = { ...emptyHtmlSecurity(), dangerousLinks: 0 };
  for (const r of list) {
    for (const k of HTML_SECURITY_KEYS) out[k] = (out[k] ?? 0) + (r[k] ?? 0);
    out.dangerousLinks = (out.dangerousLinks ?? 0) + (r.dangerousLinks ?? 0);
    if (r.safeBrowsing === 'unavailable') out.safeBrowsing = 'unavailable';
  }
  return out;
}
