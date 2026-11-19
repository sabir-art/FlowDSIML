import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { MediaError, pngSize, sanitizeSvg, sniff } from './lib.ts';

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
