// L49 §3 : compteurs du rapport d'analyse de sécurité, calculés par le serveur sur la page reçue.
// Mêmes règles que sanitizeDom (packages/core/src/htmlSanitize.ts) : mêmes chiffres sur la même page.
// Arbre HTML de htmlparser2 (MIT, déjà utilisé par sanitize-html).
import { parseDocument } from 'npm:htmlparser2@8.0.2';

export const SECURITY_KEYS = [
  'scripts',
  'handlers',
  'frames',
  'forms',
  'externalLinks',
  'piiReplaced',
  'other',
] as const;
export type SecurityKey = (typeof SECURITY_KEYS)[number];
export type SecurityCounts = Record<SecurityKey, number>;

const SCRIPTS = new Set(['script', 'noscript']);
const FRAMES = new Set(['iframe', 'frame', 'frameset', 'object', 'embed', 'applet']);
const OTHER = new Set(['base', 'template', 'portal', 'link']);
const URL_ATTRS = new Set([
  'href',
  'src',
  'xlink:href',
  'action',
  'formaction',
  'poster',
  'background',
  'cite',
  'data',
]);
const SCRIPT_URL = /^\s*(javascript|vbscript):/i;
const BAD_URL = /^\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp|svg\+xml|avif)[;,]))/i;
const CSS_HITS =
  /@import|expression\s*\(|(behavior|-moz-binding)\s*:|url\(\s*['"]?\s*(javascript|vbscript):/gi;

const empty = (): SecurityCounts => ({
  scripts: 0,
  handlers: 0,
  frames: 0,
  forms: 0,
  externalLinks: 0,
  piiReplaced: 0,
  other: 0,
});
const cssHits = (css: string) => css.match(CSS_HITS)?.length ?? 0;
const siteOf = (host: string) => host.toLowerCase().replace(/\.$/, '').split('.').slice(-2).join('.');

function isExternal(href: string, pageUrl: string | null): boolean {
  if (!pageUrl) return false;
  try {
    const u = new URL(href, pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return siteOf(u.hostname) !== siteOf(new URL(pageUrl).hostname);
  } catch {
    return false;
  }
}

interface Node {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: Node[];
  data?: string;
}
const textOf = (n: Node): string => (n.children ?? []).map((c) => c.data ?? textOf(c)).join('');

export function countSecurity(html: string, pageUrl: string | null): SecurityCounts {
  const c = empty();
  const walk = (n: Node) => {
    const tag = n.name?.toLowerCase();
    const at = n.attribs ?? {};
    if (tag) {
      // Élément retiré avec son contenu : compté une fois, sans ce qu'il contient
      if (SCRIPTS.has(tag)) return void c.scripts++;
      if (FRAMES.has(tag)) return void c.frames++;
      if (OTHER.has(tag) || (tag === 'meta' && 'http-equiv' in at)) return void c.other++;
      for (const [k, v] of Object.entries(at)) {
        const name = k.toLowerCase();
        if (name.startsWith('on')) c.handlers++;
        else if (name === 'srcdoc' || name === 'formaction') c.other++;
        else if (URL_ATTRS.has(name) && BAD_URL.test(v)) {
          if (SCRIPT_URL.test(v)) c.scripts++;
          else c.other++;
        } else if (name === 'style') c.other += cssHits(v);
      }
      if (tag === 'form' && ('action' in at || 'method' in at || 'target' in at)) c.forms++;
      if (
        tag === 'a' &&
        typeof at.href === 'string' &&
        !BAD_URL.test(at.href) &&
        isExternal(at.href, pageUrl)
      )
        c.externalLinks++;
      if (tag === 'style') c.other += cssHits(textOf(n));
      if ((tag === 'set' || tag === 'animate') && /href/i.test(at.attributename ?? '')) return void c.other++;
      if (tag === 'style') return;
    }
    for (const ch of n.children ?? []) walk(ch);
  };
  walk(parseDocument(html) as unknown as Node);
  return c;
}

/**
 * Compteurs enregistrés : pour chaque compteur, le plus grand entre celui du serveur (sur la page reçue,
 * déjà nettoyée par l'extension) et celui déclaré par l'extension (sur la page d'origine). Le serveur ne
 * peut pas sous-estimer ce qu'il retire lui-même ; une valeur déclarée illisible compte pour 0.
 * piiReplaced n'est connu que de l'extension (remplacement avant l'envoi).
 */
export function mergeSecurity(server: SecurityCounts, declared: unknown): SecurityCounts {
  const d = (declared && typeof declared === 'object' ? declared : {}) as Record<string, unknown>;
  const out = empty();
  for (const k of SECURITY_KEYS) {
    const v = d[k];
    const dv = typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100000 ? v : 0;
    out[k] = Math.max(server[k], dv);
  }
  return out;
}
