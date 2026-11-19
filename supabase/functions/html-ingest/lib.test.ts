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
