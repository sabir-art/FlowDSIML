import { assert, assertEquals } from 'jsr:@std/assert@1';
import { LIVE_MAX, applyFlags, liveMeta, liveUrls, parseLive } from './live.ts';

const base = () => ({
  url: 'https://app.example.com/clients',
  html:
    '<!doctype html><html><head><meta http-equiv="refresh" content="0;url=https://ailleurs.example/">' +
    '<title>T</title></head><body><h1>Clients</h1>' +
    '<script data-fd-script="s1"></script><script data-fd-script="s2"></script>' +
    '<script>alert("non déclaré")</script><script data-fd-script="s9"></script></body></html>',
  scripts: [
    { id: 's1', code: 'rendre()', keep: true, category: 'page', source: 'page' },
    { id: 's2', code: 'chat()', keep: false, category: 'third', source: 'https://chat.example/w.js' },
    { id: 's3', code: 'jamaisPlace()', keep: true, category: 'page' },
  ],
  responses: [
    { url: 'https://app.example.com/api/clients', status: 200, type: 'application/json', body: '[]' },
    {
      method: 'POST',
      url: 'https://app.example.com/api/note',
      status: 200,
      type: 'application/json',
      body: '{}',
    },
  ],
});

Deno.test('live : document nettoyé, seules les marques des scripts déclarés restent', () => {
  const r = parseLive(base());
  assert('record' in r);
  const h = r.record.html;
  assert(!/http-equiv/.test(h), 'meta http-equiv retirée');
  assert(!/non déclaré/.test(h), 'script non déclaré retiré');
  assert(!/data-fd-script="s9"/.test(h), 'marque sans script retirée');
  assert(/data-fd-script="s1"/.test(h) && /data-fd-script="s2"/.test(h));
  assertEquals(
    r.record.scripts.map((s) => s.id),
    ['s1', 's2'],
    'script déclaré sans marque : non gardé',
  );
});

Deno.test('live : une marque qui contient du code est retirée', () => {
  const v = base();
  v.html = v.html.replace(
    '<script data-fd-script="s1"></script>',
    '<script data-fd-script="s1">fuite()</script>',
  );
  const r = parseLive(v);
  assert('record' in r);
  assert(!/fuite/.test(r.record.html));
  assertEquals(
    r.record.scripts.map((s) => s.id),
    ['s2'],
  );
});

Deno.test('live : seules les lectures (GET) sont gardées', () => {
  const r = parseLive(base());
  assert('record' in r);
  assertEquals(r.record.responses.length, 1);
  assertEquals(r.record.responses[0]!.method, 'GET');
});

Deno.test('live : formes refusées', () => {
  assertEquals(parseLive({ ...base(), url: 'javascript:alert(1)' }), { error: 'BAD_REQUEST' });
  assertEquals(parseLive({ ...base(), scripts: [{ id: 'x1', code: '', keep: true, category: 'page' }] }), {
    error: 'BAD_REQUEST',
  });
  const dup = base();
  dup.scripts[1]!.id = 's1';
  assertEquals(parseLive(dup), { error: 'BAD_REQUEST' });
  const cat = base();
  (cat.scripts[0] as { category: string }).category = 'autre';
  assertEquals(parseLive(cat), { error: 'BAD_REQUEST' });
  const st = base();
  st.responses[0]!.status = 42;
  assertEquals(parseLive(st), { error: 'BAD_REQUEST' });
});

Deno.test('live : tailles bornées', () => {
  const big = base();
  big.responses[0]!.body = 'x'.repeat(LIVE_MAX.response + 1);
  assertEquals(parseLive(big), { error: 'TOO_BIG' });
  const many = base();
  many.responses = Array.from({ length: 301 }, (_, i) => ({
    url: `https://app.example.com/${i}`,
    status: 200,
    type: 'text/plain',
    body: '',
  }));
  assertEquals(parseLive(many), { error: 'TOO_BIG' });
  const code = base();
  code.scripts[0]!.code = 'x'.repeat(LIVE_MAX.script + 1);
  assertEquals(parseLive(code), { error: 'TOO_BIG' });
});

Deno.test('live : Safe Browsing bloque le script et retire la réponse signalés ; fiches sans code', () => {
  const r = parseLive(base());
  assert('record' in r);
  const urls = liveUrls(r.record);
  assertEquals(urls.sort(), ['https://app.example.com/api/clients', 'https://chat.example/w.js'].sort());
  const v = applyFlags(
    { ...r.record, scripts: r.record.scripts.map((s) => ({ ...s, keep: true })) },
    new Set(['https://chat.example/w.js', 'https://app.example.com/api/clients']),
  );
  assertEquals(
    v.scripts.map((s) => s.keep),
    [true, false],
  );
  assertEquals(v.responses.length, 0);
  const m = liveMeta(r.record);
  assertEquals(m.responses, 1);
  assertEquals(m.scripts[0], { id: 's1', source: 'page', category: 'page', keep: true, bytes: 8 });
  assert(!JSON.stringify(m).includes('rendre()'), 'aucun code dans les fiches');
});
