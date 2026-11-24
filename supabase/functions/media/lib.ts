// Médiathèque (L18) : contrôle du type réel d'un fichier et assainissement des SVG.
// Aucune dépendance : le SVG est relu balise par balise et entièrement reconstruit à partir d'une
// liste fermée de balises et d'attributs (rien n'est recopié tel quel). Refus net de DOCTYPE, ENTITY,
// CDATA et instructions de traitement ; liens limités aux ancres internes (#id) ; url() externes
// refusées dans style et dans les attributs de présentation. Le lecteur n'affiche un SVG qu'en <img> ou
// en fond CSS, jamais en ligne (deuxième barrière : aucun script ne s'exécute dans ces contextes).

export type Kind = 'logo' | 'image' | 'font';
export type Mime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' | 'font/woff2';

export const MAX_BYTES = 5 * 1024 * 1024;

export class MediaError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Type réel d'après les premiers octets (le type annoncé par le navigateur est ignoré). */
export function sniff(bytes: Uint8Array): Mime | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 4 && b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x32) return 'font/woff2';
  // WebP : conteneur RIFF (« RIFF », taille, « WEBP ») suivi d'un bloc VP8, VP8L ou VP8X
  if (
    b.length >= 16 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50 &&
    b[12] === 0x56 &&
    b[13] === 0x50 &&
    b[14] === 0x38 &&
    (b[15] === 0x20 || b[15] === 0x4c || b[15] === 0x58)
  )
    return 'image/webp';
  const head = new TextDecoder().decode(b.subarray(0, 512)).replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return 'image/svg+xml';
  return null;
}

/** Dimensions d'un PNG (en-tête IHDR). */
export function pngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const width = v.getUint32(16);
  const height = v.getUint32(20);
  return width > 0 && height > 0 && width <= 20000 && height <= 20000 ? { width, height } : null;
}

/** Dimensions d'un WebP (blocs VP8X, VP8L ou VP8), ou null si l'en-tête est tronqué ou incohérent. */
export function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let width = 0;
  let height = 0;
  if (b[15] === 0x58) {
    // VP8X : largeur et hauteur moins 1, sur 24 bits
    width = 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16));
    height = 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16));
  } else if (b[15] === 0x4c) {
    // VP8L : signature 0x2f, puis 14 bits de largeur moins 1 et 14 bits de hauteur moins 1
    if (b[20] !== 0x2f) return null;
    const bits = v.getUint32(21, true);
    width = 1 + (bits & 0x3fff);
    height = 1 + ((bits >> 14) & 0x3fff);
  } else {
    // VP8 : code de début 9d 01 2a, puis largeur et hauteur sur 14 bits
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    width = v.getUint16(26, true) & 0x3fff;
    height = v.getUint16(28, true) & 0x3fff;
  }
  return width > 0 && height > 0 && width <= 20000 && height <= 20000 ? { width, height } : null;
}

const ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'pattern',
  'filter',
  'fegaussianblur',
  'feoffset',
  'feblend',
  'fecolormatrix',
  'feflood',
  'fecomposite',
  'femerge',
  'femergenode',
  'fedropshadow',
]);

const ATTRS = new Set([
  'id',
  'class',
  'viewbox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'fx',
  'fy',
  'patternunits',
  'patterncontentunits',
  'patterntransform',
  'clippathunits',
  'maskunits',
  'maskcontentunits',
  'clip-path',
  'mask',
  'filter',
  'preserveaspectratio',
  'xmlns',
  'xmlns:xlink',
  'version',
  'href',
  'xlink:href',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'dx',
  'dy',
  'style',
  'visibility',
  'display',
  'color',
  'stddeviation',
  'in',
  'in2',
  'result',
  'mode',
  'values',
  'type',
  'operator',
  'k1',
  'k2',
  'k3',
  'k4',
  'flood-color',
  'flood-opacity',
  'filterunits',
  'primitiveunits',
  'role',
  'aria-label',
  'aria-hidden',
  'focusable',
  'xml:space',
]);

/** Valeurs qui pourraient appeler une ressource externe ou du code. */
const DANGEROUS =
  /javascript:|vbscript:|data:(?!image\/(png|jpeg);base64,)|expression\s*\(|@import|behavior\s*:|-moz-binding/i;

function safeUrlRefs(v: string): boolean {
  // url(...) seulement vers une ancre interne : url(#id)
  for (const m of v.matchAll(/url\s*\(\s*(['"]?)([^'")]*)\1\s*\)/gi))
    if (!m[2]!.trim().startsWith('#')) return false;
  return true;
}

function escAttr(v: string): string {
  return v
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
function escText(v: string): string {
  return v
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Décode les références numériques pour contrôler la valeur réelle d'un attribut. */
function decodeRefs(v: string): string {
  return v
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16) % 0x110000))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCodePoint(Number(d) % 0x110000))
    .replace(
      /&(colon|tab|newline);/gi,
      (_m, n: string) => ({ colon: ':', tab: '\t', newline: '\n' })[n.toLowerCase()]!,
    );
}

const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[|<![^>]*>|<\?[\s\S]*?\?>|<\/\s*([a-zA-Z][\w:.-]*)\s*>|<([a-zA-Z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/**
 * Rend un SVG sûr : renvoie le texte reconstruit, ou lève MediaError('SVG_REJECTED') pour un fichier
 * qui contient une construction refusée (DOCTYPE, ENTITY, CDATA, instruction de traitement autre que
 * la déclaration XML, balise mal formée).
 */
export function sanitizeSvg(src: string): string {
  const text = src.replace(/^﻿/, '');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(text)) throw new MediaError('SVG_REJECTED');
  const out: string[] = [];
  const stack: Array<{ name: string; kept: boolean }> = [];
  let skipDepth = 0;
  let sawRoot = false;
  let pos = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index !== pos) throw new MediaError('SVG_REJECTED');
    pos = m.index + m[0].length;
    const tok = m[0];
    if (tok.startsWith('<!--')) continue;
    if (tok.startsWith('<?')) {
      if (sawRoot || !/^<\?xml\s/i.test(tok)) throw new MediaError('SVG_REJECTED');
      continue;
    }
    if (tok.startsWith('<!') || tok === '<') throw new MediaError('SVG_REJECTED');
    if (m[1]) {
      const name = m[1].toLowerCase();
      const top = stack.pop();
      if (!top || top.name !== name) throw new MediaError('SVG_REJECTED');
      if (skipDepth > 0) skipDepth--;
      else if (top.kept) out.push(`</${top.name}>`);
      continue;
    }
    if (m[2]) {
      const name = m[2].toLowerCase();
      const selfClosing = m[4] === '/';
      if (!sawRoot && name !== 'svg') throw new MediaError('SVG_REJECTED');
      sawRoot = true;
      const kept = skipDepth === 0 && ELEMENTS.has(name);
      if (kept) {
        const attrs: string[] = [];
        for (const a of (m[3] ?? '').matchAll(ATTR)) {
          const an = a[1]!.toLowerCase();
          const raw = a[2] ?? a[3] ?? a[4] ?? '';
          if (!ATTRS.has(an)) continue;
          const real = decodeRefs(raw);
          if (DANGEROUS.test(real.replace(/[\s\u0000-\u001f]/g, ''))) continue;
          if ((an === 'href' || an === 'xlink:href') && !/^#[\w.-]+$/.test(real.trim())) continue;
          if (an === 'xmlns' && real !== 'http://www.w3.org/2000/svg') continue;
          if (an === 'xmlns:xlink' && real !== 'http://www.w3.org/1999/xlink') continue;
          if (!safeUrlRefs(real)) continue;
          attrs.push(`${an}="${escAttr(raw)}"`);
        }
        const tag =
          name === 'lineargradient'
            ? 'linearGradient'
            : name === 'radialgradient'
              ? 'radialGradient'
              : name === 'clippath'
                ? 'clipPath'
                : name;
        out.push(`<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${selfClosing ? '/>' : '>'}`);
        if (!selfClosing) stack.push({ name, kept: true });
      } else {
        // Balise hors liste (script, foreignObject, style, image, a, animate…) : retirée avec son contenu
        if (!selfClosing) {
          stack.push({ name, kept: false });
          skipDepth++;
        }
      }
      continue;
    }
    // Texte : gardé seulement dans une balise conservée
    if (skipDepth === 0 && stack.length && /\S/.test(tok)) out.push(escText(tok));
  }
  if (pos !== text.length || stack.length || !sawRoot) throw new MediaError('SVG_REJECTED');
  // Fermetures : le nom d'origine de la balise ouvrante (casse SVG) est rétabli
  return out
    .join('')
    .replace(/<\/lineargradient>/g, '</linearGradient>')
    .replace(/<\/radialgradient>/g, '</radialGradient>')
    .replace(/<\/clippath>/g, '</clipPath>');
}

/** Types acceptés par usage. */
export function allowed(kind: Kind, mime: Mime): boolean {
  return kind === 'font' ? mime === 'font/woff2' : mime !== 'font/woff2';
}

export const EXT: Record<Mime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'font/woff2': 'woff2',
};

// ===== Logo pris dans la médiathèque (retours client du 24/11 §3.1) =====
// Choisir un fichier de la médiathèque comme logo de l'espace ou du centre de formation en fait une COPIE
// à l'emplacement habituel du logo (bucket « branding »), avec les mêmes règles qu'un téléversement.
export type LogoTarget = 'workspace' | 'center';

/** Types et poids acceptés par emplacement : ceux du téléversement direct (Marque, Parcours de formation). */
export const LOGO_RULES: Record<LogoTarget, { mimes: Mime[]; maxBytes: number }> = {
  workspace: { mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], maxBytes: 2 * 1024 * 1024 },
  center: { mimes: ['image/png', 'image/webp', 'image/svg+xml'], maxBytes: 512 * 1024 },
};

/**
 * Vérifie les octets du fichier avant la copie : la signature est relue (le type enregistré ne fait pas
 * foi), le type et le poids doivent convenir à l'emplacement, un SVG est assaini de nouveau.
 * Lève MediaError('BAD_TYPE' | 'TOO_BIG' | 'SVG_REJECTED').
 */
export function logoCopy(
  bytes: Uint8Array,
  target: LogoTarget,
): { mime: Mime; ext: string; bytes: Uint8Array } {
  const rules = LOGO_RULES[target];
  const mime = sniff(bytes);
  if (!mime || !rules.mimes.includes(mime)) throw new MediaError('BAD_TYPE');
  let out = bytes;
  if (mime === 'image/svg+xml') {
    try {
      out = new TextEncoder().encode(sanitizeSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    } catch (e) {
      throw new MediaError(e instanceof MediaError ? e.code : 'SVG_REJECTED');
    }
  }
  if (out.length > rules.maxBytes) throw new MediaError('TOO_BIG');
  return { mime, ext: EXT[mime], bytes: out };
}

/** Chemin du logo copié, au format attendu par chaque emplacement (voir center_draft_valid). */
export function logoPath(ws: string, target: LogoTarget, ext: string, rand: () => string): string {
  return target === 'workspace'
    ? `${ws}/logo-${rand()}.${ext}`
    : `${ws}/center-logo-${rand()
        .replace(/[^0-9a-z]/g, '')
        .slice(0, 12)}.${ext}`;
}
