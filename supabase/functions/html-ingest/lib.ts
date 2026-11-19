// Second assainissement d'une capture HTML (A8), côté serveur, avant le stockage. La page arrive
// déjà assainie par l'extension ; on ne lui fait pas confiance : tout ce qui peut exécuter du code,
// charger un contenu tiers ou garder une saisie est retiré à nouveau. Bibliothèque sanitize-html (MIT).
import sanitizeHtml from 'npm:sanitize-html@2.18.1';

export const MAX_BYTES = 10 * 1024 * 1024;

const DROP = new Set([
  'script',
  'noscript',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'base',
  'template',
  'portal',
  'link',
  'meta',
  'param',
  'video',
  'audio',
  'source',
  'track',
]);
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
const BAD_URL = /^\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp|svg\+xml|avif)[;,]))/i;

/** CSS sans import ni exécution (expression(), javascript:, behavior, -moz-binding). */
export function sanitizeCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'x(')
    .replace(/(behavior|-moz-binding)\s*:[^;}]*/gi, '')
    .replace(/url\(\s*(['"]?)\s*(javascript|vbscript):[^)]*\)/gi, 'url()');
}

function cleanAttribs(tag: string, attribs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attribs)) {
    const name = k.toLowerCase();
    if (
      name.startsWith('on') ||
      ['srcdoc', 'formaction', 'autofocus', 'nonce', 'integrity', 'http-equiv'].includes(name)
    )
      continue;
    if (URL_ATTRS.has(name) && BAD_URL.test(v)) continue;
    if (tag === 'input' && (name === 'value' || name === 'checked')) {
      const type = (attribs.type ?? 'text').toLowerCase();
      if (name === 'checked' || !['button', 'submit', 'reset', 'image'].includes(type)) continue;
    }
    if (tag === 'option' && name === 'selected') continue;
    if (tag === 'form' && ['action', 'method', 'target'].includes(name)) continue;
    if (tag === 'a' && name === 'target') continue;
    out[k] = name === 'style' ? sanitizeCss(v) : v;
  }
  return out;
}

export function sanitizePage(html: string): string {
  const clean = sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    // Les URL sont filtrées dans cleanAttribs (data: limité aux images)
    allowedSchemes: ['http', 'https', 'data', 'mailto', 'tel'],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    nonTextTags: ['script', 'noscript', 'textarea', 'title'],
    exclusiveFilter: (frame: { tag: string; attribs: Record<string, string> }) =>
      DROP.has(frame.tag) ||
      ((frame.tag === 'set' || frame.tag === 'animate') && /href/i.test(frame.attribs.attributename ?? '')),
    transformTags: {
      '*': (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: cleanAttribs(tagName.toLowerCase(), attribs),
      }),
    },
  });
  // Contenu des <style> (texte brut, non filtré par la bibliothèque) : CSS assaini à part
  const styled = clean.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m: string, open: string, css: string, close: string) =>
      open + sanitizeCss(css).replace(/<\/?style/gi, '') + close,
  );
  // Saisies : contenu des zones de texte vidé
  const emptied = styled.replace(/(<textarea\b[^>]*>)[\s\S]*?(<\/textarea>)/gi, '$1$2');
  return `<!doctype html>\n${emptied.replace(/^\s*<!doctype[^>]*>/i, '')}`;
}

/** Dernier garde-fou : rien d'exécutable ne doit rester. */
export function inert(html: string): boolean {
  return !/<\s*(script|iframe|object|embed|base|meta\s+http-equiv)\b|\son\w+\s*=|javascript:/i.test(html);
}
