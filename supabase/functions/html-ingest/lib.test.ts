import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { inert, sanitizeCss, sanitizePage } from './lib.ts';

Deno.test('retire scripts, cadres, gestionnaires, URL dangereuses et saisies', () => {
  const out = sanitizePage(`<!doctype html><html><head><base href="https://evil.example/">
    <meta http-equiv="refresh" content="0;url=https://evil.example"><link rel="stylesheet" href="x.css">
    <script>alert(1)</script><style>@import url(x.css); .a{color:red;width:expression(alert(1))}</style></head>
    <body onload="x()"><img src="a.png" onerror="x()"><a href="javascript:alert(1)">a</a><a href="https://acme.example/ok" target="_blank">b</a>
    <iframe src="https://tiers.example"></iframe><object data="x"></object><embed src="x">
    <form action="/send" method="post"><input name="n" value="Camille"><input type="password" value="secret">
    <input type="submit" value="Envoyer"><textarea>notes</textarea><select><option selected>Paris</option></select></form>
    <div style="background:url(javascript:alert(1))">x</div><img src="data:text/html,<script>alert(1)</script>">
    <img src="data:image/webp;base64,AAAA"><svg><a href="javascript:x()"><set attributeName="href" to="javascript:x()"/></a></svg>
    <noscript><img src=x></noscript><SCRIPT SRC=//evil.example></SCRIPT></body></html>`);
  assert(inert(out), out);
  for (const bad of [
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<base/i,
    /<link/i,
    /<noscript/i,
    /http-equiv/i,
    /onload|onerror/i,
    /expression\(/i,
    /@import/i,
    /Camille|secret|notes/,
    /data:text\/html/,
    /selected/,
    /target=/,
  ])
    assert(!bad.test(out), `${bad} : ${out}`);
  assertMatch(out, /^<!doctype html>/);
  assertMatch(out, /href="https:\/\/acme\.example\/ok"/);
  assertMatch(out, /value="Envoyer"/);
  assertMatch(out, /data:image\/webp;base64,AAAA/);
  assertMatch(out, /\.a\{color:red;/);
});

Deno.test('garde le texte, les styles et la structure', () => {
  const out = sanitizePage(
    '<main class="kpi"><b class="value" style="color:#a3195b">312</b> dossiers</main>',
  );
  assertMatch(out, /<main class="kpi"><b class="value" style="color:#a3195b">312<\/b> dossiers<\/main>/);
});

Deno.test('CSS sans @import ni exécution', () => {
  assertEquals(
    sanitizeCss('@import url(x.css); a{behavior:url(x.htc);color:red} b{background:url("javascript:x")}'),
    ' a{;color:red} b{background:url()}',
  );
});

// ===== L49 P1 : réglage « Captures HTML » =====
import { captureVerdict, pageHost } from './lib.ts';

// Même règle que public.html_capture_allows (mode domaines : app.example.com et *.outils.example)
const rule = (mode: 'allowed' | 'domains' | 'disabled') => (host: string) =>
  Promise.resolve(
    mode === 'disabled'
      ? 'HTML_CAPTURE_DISABLED'
      : mode === 'domains' &&
          !(host === 'app.example.com' || (host.endsWith('.outils.example') && host !== 'outils.example'))
        ? 'HTML_CAPTURE_DOMAIN'
        : 'ok',
  );

Deno.test('L49 : désactivées, toute page est refusée', async () => {
  assertEquals(await captureVerdict('https://app.example.com/a', rule('disabled')), 'HTML_CAPTURE_DISABLED');
});

Deno.test('L49 : domaines, hors liste refusé, dans la liste accepté', async () => {
  assertEquals(
    await captureVerdict('https://crm.partenaire.example/x', rule('domains')),
    'HTML_CAPTURE_DOMAIN',
  );
  assertEquals(await captureVerdict('https://app.example.com/x?y=1', rule('domains')), 'ok');
  assertEquals(await captureVerdict('https://a.outils.example/', rule('domains')), 'ok');
});

Deno.test('L49 : seule l’adresse de la page compte, jamais un en-tête trafiqué', async () => {
  // La requête porte des en-têtes qui prétendent venir d'un domaine autorisé : ils ne sont jamais lus
  const req = new Request('https://fonction.example/html-ingest', {
    method: 'POST',
    headers: {
      origin: 'https://app.example.com',
      referer: 'https://app.example.com/page',
      'x-forwarded-host': 'app.example.com',
      host: 'app.example.com',
    },
  });
  assertEquals(req.headers.get('origin'), 'https://app.example.com');
  assertEquals(
    await captureVerdict('https://crm.partenaire.example/x', rule('domains')),
    'HTML_CAPTURE_DOMAIN',
  );
  // Hôte trompeur dans l'adresse : l'hôte réel est lu par l'analyseur d'URL
  assertEquals(pageHost('https://app.example.com@crm.partenaire.example/'), 'crm.partenaire.example');
  assertEquals(pageHost('https://APP.Example.com/'), 'app.example.com');
});

Deno.test('L49 : adresse absente ou non http(s) refusée', async () => {
  for (const u of [
    undefined,
    '',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'pas une url',
    'x'.repeat(2001),
  ])
    assertEquals(await captureVerdict(u, rule('allowed')), 'BAD_URL');
});

// ===== L49 P2 : compteurs du rapport (même page et mêmes chiffres que packages/core/src/htmlSanitize.test.ts) =====
import { countSecurity, mergeSecurity } from './security.ts';

const SECURITY_PAGE = `<html><head><base href="https://evil.example/"><meta http-equiv="refresh" content="0"><link rel="stylesheet" href="x.css">
<script>alert(1)</script><style>@import url(x.css); .a{width:expression(alert(1))}</style></head>
<body onload="x()"><img src="a.png" onerror="x()" onclick="y()"><a href="javascript:alert(1)">a</a>
<a href="https://app.example.com/ok">interne</a><a href="https://aide.app.example.com/doc">sous-domaine</a>
<a href="https://docs.tiers.example/guide">externe 1</a><a href="http://autre.example/">externe 2</a><a href="mailto:x@example.com">m</a>
<iframe src="https://tiers.example" onload="z()"></iframe><object data="x"><param name="a"></object><embed src="x">
<form action="/send" method="post"><input name="n" value="Camille"><button formaction="/x">b</button></form><form><input></form>
<div style="background:url(javascript:alert(1))">x</div><img src="data:text/html,x"><iframe srcdoc="<p>x</p>"></iframe>
<svg><a href="javascript:x()"><set attributeName="href" to="javascript:x()"/></a></svg><noscript><script>x()</script></noscript></body></html>`;

Deno.test('compteurs identiques à ceux de l’extension sur la page de test', () => {
  assertEquals(countSecurity(SECURITY_PAGE, 'https://app.example.com/dossiers'), {
    scripts: 4,
    handlers: 3,
    frames: 4,
    forms: 1,
    externalLinks: 2,
    piiReplaced: 0,
    other: 9,
  });
});

Deno.test('page déjà nettoyée : plus rien à compter, sauf les liens externes', () => {
  const page = sanitizePage(SECURITY_PAGE);
  const c = countSecurity(page, 'https://app.example.com/dossiers');
  assertEquals(
    { ...c, externalLinks: 0 },
    {
      scripts: 0,
      handlers: 0,
      frames: 0,
      forms: 0,
      externalLinks: 0,
      piiReplaced: 0,
      other: 0,
    },
  );
  assertEquals(c.externalLinks, 2);
});

Deno.test('compteurs déclarés : le plus grand des deux, valeurs illisibles ignorées', () => {
  const server = { scripts: 1, handlers: 0, frames: 0, forms: 0, externalLinks: 2, piiReplaced: 0, other: 0 };
  assertEquals(
    mergeSecurity(server, {
      scripts: 0,
      handlers: 5,
      frames: -1,
      forms: 1.5,
      piiReplaced: 3,
      other: '9',
      x: 7,
    }),
    { scripts: 1, handlers: 5, frames: 0, forms: 0, externalLinks: 2, piiReplaced: 3, other: 0 },
  );
  assertEquals(mergeSecurity(server, null), server);
});

// ===== L49 P3 : liens externes désactivés par défaut =====
Deno.test(
  'liens vers un autre domaine : désactivés, adresse gardée ; internes et sous-domaines intacts',
  () => {
    const out = sanitizePage(
      `<a href="https://app.example.com/a">i</a><a href="https://aide.app.example.com/b">s</a>
     <a href="https://docs.tiers.example/guide">e</a><a href="/relatif">r</a>
     <span data-tc-ext="on" data-tc-href="https://evil.example/">x</span>`,
      'https://app.example.com/dossiers',
    );
    assertMatch(out, /href="https:\/\/app\.example\.com\/a"/);
    assertMatch(out, /href="https:\/\/aide\.app\.example\.com\/b"/);
    assertMatch(out, /href="\/relatif"/);
    assertMatch(out, /<a data-tc-href="https:\/\/docs\.tiers\.example\/guide" data-tc-ext="off">e<\/a>/);
    assert(!/href="https:\/\/docs\.tiers/.test(out.replace(/data-tc-href/g, '')), out);
    assert(!/evil\.example|data-tc-ext="on"/.test(out), 'marques de la page reçue retirées');
  },
);
