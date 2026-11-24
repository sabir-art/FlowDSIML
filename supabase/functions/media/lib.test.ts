import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { LOGO_RULES, MediaError, logoCopy, logoPath, pngSize, sanitizeSvg, sniff, webpSize } from './lib.ts';

const enc = (s: string) => new TextEncoder().encode(s);
const svg = (inner: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>${inner}</svg>`;
const rejected = (s: string) => assertThrows(() => sanitizeSvg(s), MediaError, 'SVG_REJECTED');
const clean = (s: string) => {
  const out = sanitizeSvg(s);
  for (const bad of [
    /<script/i,
    /\son\w+=/i,
    /javascript:/i,
    /foreignobject/i,
    /<style/i,
    /href="(?!#)/i,
    /url\((?!#)/i,
  ])
    assert(!bad.test(out), `${bad} encore présent dans ${out}`);
  return out;
};

/** Refusé, ou accepté sans rien de dangereux : les deux issues sont sûres. */
const safe = (s: string) => {
  try {
    clean(s);
  } catch (e) {
    if (!(e instanceof MediaError)) throw e;
  }
};

Deno.test('type réel : premiers octets', () => {
  assertEquals(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assertEquals(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assertEquals(sniff(enc('wOF2xxxx')), 'font/woff2');
  assertEquals(
    sniff(enc('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>')),
    'image/svg+xml',
  );
  assertEquals(sniff(enc('<html><svg>')), null);
  assertEquals(sniff(enc('GIF89a')), null);
});

Deno.test('dimensions PNG', () => {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47], 0);
  new DataView(b.buffer).setUint32(16, 640);
  new DataView(b.buffer).setUint32(20, 480);
  assertEquals(pngSize(b), { width: 640, height: 480 });
});

Deno.test('SVG propre conservé (formes, dégradé, ancre interne)', () => {
  const out = clean(
    svg(
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#A3195B"/></linearGradient></defs>' +
        '<rect width="10" height="10" fill="url(#g)"/><use href="#g"/><text x="1">A &amp; B</text>',
      ' viewBox="0 0 10 10"',
    ),
  );
  assert(
    out.includes('<linearGradient id="g">') &&
      out.includes('fill="url(#g)"') &&
      out.includes('<use href="#g"/>'),
  );
  assert(out.includes('A &amp; B'));
});

Deno.test('vecteurs XSS : scripts et gestionnaires retirés', () => {
  clean(svg('<script>alert(1)</script><rect width="1" height="1"/>'));
  clean(svg('<rect onload="alert(1)" onclick=alert(1) width="1"/>'));
  clean(svg('<rect width="1"/>', ' onload="alert(1)"'));
  clean(svg('<SCRIPT type="text/javascript">alert(1)</SCRIPT>'));
  clean(svg('<g><script><![CDATA[alert(1)]]></script></g>').replace('<![CDATA[', ''));
});

Deno.test('vecteurs XSS : foreignObject, style, liens, animations', () => {
  safe(
    svg(
      '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)></body></foreignObject>',
    ),
  );
  clean(
    svg(
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml" onclick="alert(1)">x</div></foreignObject>',
    ),
  );
  clean(svg('<style>@import url(https://evil.example/x.css); rect{fill:red}</style><rect width="1"/>'));
  clean(svg('<a href="javascript:alert(1)"><rect width="1"/></a>'));
  clean(
    svg('<use href="https://evil.example/s.svg#x"/><use xlink:href="data:image/svg+xml;base64,PHN2Zz4="/>'),
  );
  clean(svg('<rect style="fill:url(https://evil.example/t)" width="1"/>'));
  clean(svg('<rect fill="url(\'https://evil.example/t\')" width="1"/>'));
  clean(svg('<rect width="1"><animate attributeName="href" to="javascript:alert(1)"/></rect>'));
  clean(svg('<set attributeName="onload" to="alert(1)"/>'));
  clean(svg('<image href="https://evil.example/pixel.png"/>'));
  clean(svg('<a href="&#106;avascript:alert(1)"><text>x</text></a>'));
  clean(svg('<rect style="background:url(java&#x09;script:alert(1))" width="1"/>'));
  clean(svg('<rect style="behavior:url(x.htc)" width="1"/>'));
  clean(svg('<iframe src="https://evil.example"></iframe>'));
});

Deno.test('constructions refusées : DOCTYPE, ENTITY, CDATA, instructions, balisage cassé', () => {
  rejected('<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>');
  rejected(svg('<![CDATA[<script>alert(1)</script>]]>'));
  rejected(
    '<svg xmlns="http://www.w3.org/2000/svg"><?xml-stylesheet href="https://evil.example/x.css"?></svg>',
  );
  rejected('<html><svg></svg></html>');
  rejected('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>');
  rejected('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" <script>alert(1)</script></svg>');
});

// ===== WebP : reconnu à sa signature, jamais à son extension =====
/** En-tête RIFF/WEBP factice : « RIFF », taille, « WEBP », puis le bloc donné. */
function webp(chunk: string, body: number[]): Uint8Array {
  const out = new Uint8Array(12 + 8 + body.length);
  out.set(enc('RIFF'), 0);
  out.set(enc('WEBP'), 8);
  out.set(enc(chunk), 12);
  out.set(body, 20);
  return out;
}

Deno.test('WebP : signature RIFF … WEBP et bloc VP8, VP8L ou VP8X', () => {
  assertEquals(sniff(webp('VP8 ', new Array(12).fill(0))), 'image/webp');
  assertEquals(sniff(webp('VP8L', new Array(12).fill(0))), 'image/webp');
  assertEquals(sniff(webp('VP8X', new Array(12).fill(0))), 'image/webp');
  // Un fichier RIFF d'un autre genre (son, vidéo) n'est pas une image
  const wav = webp('VP8 ', new Array(12).fill(0));
  wav.set(enc('WAVE'), 8);
  assertEquals(sniff(wav), null);
  // « WEBP » sans bloc d'image reconnu
  assertEquals(sniff(webp('ABCD', new Array(12).fill(0))), null);
  // Le nom du fichier ne compte pas : un script renommé en .webp reste refusé
  assertEquals(sniff(enc('<script>alert(1)</script>')), null);
  // Tronqué
  assertEquals(sniff(enc('RIFF\0\0\0\0WEBP')), null);
});

Deno.test('dimensions WebP (VP8X, VP8L, VP8)', () => {
  // VP8X : 4 octets de drapeaux, puis largeur - 1 et hauteur - 1 sur 24 bits (640 × 480)
  assertEquals(webpSize(webp('VP8X', [0, 0, 0, 0, 0x7f, 0x02, 0x00, 0xdf, 0x01, 0x00])), {
    width: 640,
    height: 480,
  });
  // VP8L : 0x2f, puis 14 bits de largeur - 1 et 14 bits de hauteur - 1 (256 × 128)
  const bits = 255 | (127 << 14);
  assertEquals(
    webpSize(
      webp('VP8L', [
        0x2f,
        bits & 0xff,
        (bits >> 8) & 0xff,
        (bits >> 16) & 0xff,
        (bits >> 24) & 0xff,
        0,
        0,
        0,
        0,
        0,
      ]),
    ),
    { width: 256, height: 128 },
  );
  // VP8 : 3 octets d'en-tête de trame, 9d 01 2a, largeur et hauteur sur 14 bits (320 × 200)
  assertEquals(webpSize(webp('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0xc8, 0x00])), {
    width: 320,
    height: 200,
  });
  // En-tête incohérent ou tronqué : pas de dimensions (le fichier reste accepté, sans largeur ni hauteur)
  assertEquals(webpSize(webp('VP8 ', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), null);
  assertEquals(webpSize(enc('RIFF')), null);
});

// ===== Logo pris dans la médiathèque : copie vérifiée =====
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 64, 0, 0, 0, 64,
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof MediaError ? e.code : 'autre';
  }
};

Deno.test('logo depuis la médiathèque : la signature est relue, pas le type enregistré', () => {
  assertEquals(logoCopy(PNG, 'workspace').mime, 'image/png');
  assertEquals(logoCopy(PNG, 'center').ext, 'png');
  // Octets qui ne sont pas une image (police, texte, script) : refusés quel que soit l'emplacement
  assertEquals(
    codeOf(() => logoCopy(enc('wOF2xxxxxxxx'), 'workspace')),
    'BAD_TYPE',
  );
  assertEquals(
    codeOf(() => logoCopy(enc('<script>alert(1)</script>'), 'workspace')),
    'BAD_TYPE',
  );
  assertEquals(
    codeOf(() => logoCopy(new Uint8Array(0), 'center')),
    'BAD_TYPE',
  );
});

Deno.test('logo depuis la médiathèque : mêmes types et mêmes plafonds qu’un téléversement', () => {
  // JPEG : accepté pour l'espace, pas pour le centre de formation (comme le téléversement direct)
  assertEquals(logoCopy(JPEG, 'workspace').ext, 'jpg');
  assertEquals(
    codeOf(() => logoCopy(JPEG, 'center')),
    'BAD_TYPE',
  );
  const big = (n: number) => {
    const b = new Uint8Array(n);
    b.set(PNG);
    return b;
  };
  assertEquals(logoCopy(big(LOGO_RULES.workspace.maxBytes), 'workspace').bytes.length, 2 * 1024 * 1024);
  assertEquals(
    codeOf(() => logoCopy(big(LOGO_RULES.workspace.maxBytes + 1), 'workspace')),
    'TOO_BIG',
  );
  assertEquals(
    codeOf(() => logoCopy(big(LOGO_RULES.center.maxBytes + 1), 'center')),
    'TOO_BIG',
  );
  assertEquals(logoCopy(big(LOGO_RULES.center.maxBytes), 'center').mime, 'image/png');
});

Deno.test('logo depuis la médiathèque : un SVG est assaini de nouveau à la copie', () => {
  const clean = new TextDecoder().decode(
    logoCopy(
      enc(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="4" onclick="x()"/></svg>',
      ),
      'center',
    ).bytes,
  );
  assertEquals(/script|onclick/.test(clean), false);
  // Construction refusée par l'assainissement (CDATA) : la copie échoue, rien n'est posé
  assertEquals(
    codeOf(() => logoCopy(enc('<svg xmlns="http://www.w3.org/2000/svg"><![CDATA[x]]></svg>'), 'workspace')),
    'SVG_REJECTED',
  );
  // Un fichier qui ne commence pas par un SVG n'est pas traité comme tel
  assertEquals(
    codeOf(() => logoCopy(enc('<!DOCTYPE svg [<!ENTITY x "y">]><svg/>'), 'workspace')),
    'BAD_TYPE',
  );
});

Deno.test('chemin du logo copié : dans le dossier de l’espace, au format de chaque emplacement', () => {
  const ws = '00000000-0000-4000-8000-000000000001';
  const rand = () => '3f2a9c1e-7b64-4d10-9a55-0c8e6f1b2d34';
  assertEquals(logoPath(ws, 'workspace', 'png', rand), `${ws}/logo-3f2a9c1e-7b64-4d10-9a55-0c8e6f1b2d34.png`);
  const center = logoPath(ws, 'center', 'webp', rand);
  // Format exigé par center_draft_valid
  assertEquals(new RegExp(`^${ws}/center-logo-[0-9a-z]{4,24}\\.(png|svg|webp)$`).test(center), true);
});
