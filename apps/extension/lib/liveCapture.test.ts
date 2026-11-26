// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { collectLive, pairsOf, readableText, redactLive, type LiveFetch, type LiveRaw } from './liveCapture';

const PAGE = 'https://app.exemple.test/clients';
const SOURCE = `<!doctype html><html><head><base href="https://app.exemple.test/">
<meta http-equiv="refresh" content="0;url=https://ailleurs.test/">
<link rel="stylesheet" href="/s.css"><link rel="preload" href="/x.js">
<script src="https://www.googletagmanager.com/gtm.js"></script>
<script type="application/json" id="etat">{"page":1}</script>
</head><body><h1>Clients</h1><img src="/logo.png" srcset="/logo@2x.png 2x">
<script>window.liste = [];</script>
<script src="/app.js"></script>
<script src="https://chat.tiers.test/w.js"></script>
<script type="text/template">non exécuté</script>
<script src="/introuvable.js"></script>
<iframe src="https://ailleurs.test/"></iframe></body></html>`;

const get: LiveFetch = async (url, kind) => {
  if (kind === 'css') return 'h1{background:url(/fond.png)}';
  if (kind === 'image') return 'data:image/webp;base64,AAAA';
  if (kind === 'js') return url.endsWith('/introuvable.js') ? null : `/* ${url} */`;
  if (kind === 'data')
    return JSON.stringify({ type: 'application/json', status: 200, body: '[{"nom":"Durand"}]' });
  return null;
};

describe('Sandbox v2 : enregistrement vivant (extension)', () => {
  it('document source : scripts marqués à leur place, CSS et images intégrés, rien qui sorte', async () => {
    const raw = (await collectLive({ source: SOURCE, pageUrl: PAGE, recorded: [], get }))!;
    expect(raw.html).not.toMatch(/http-equiv|<base|<iframe|<link|srcset|text\/template/);
    expect(raw.html).toContain('<style>h1{background:url(data:image/webp;base64,AAAA)}</style>');
    expect(raw.html).toContain('src="data:image/webp;base64,AAAA"');
    expect(raw.html).toContain('<script type="application/json" id="etat">{"page":1}</script>');
    expect(raw.html.match(/data-fd-script="s\d"/g)).toEqual([
      'data-fd-script="s1"',
      'data-fd-script="s2"',
      'data-fd-script="s3"',
      'data-fd-script="s4"',
    ]);
    expect(raw.missing).toBe(1);
  });

  it('scripts : page gardée, tiers et mesure d’audience bloqués (rétablissables)', async () => {
    const raw = (await collectLive({ source: SOURCE, pageUrl: PAGE, recorded: [], get }))!;
    expect(raw.scripts.map((s) => [s.source, s.category, s.keep])).toEqual([
      ['https://www.googletagmanager.com/gtm.js', 'tracking', false],
      ['page', 'page', true],
      ['https://app.exemple.test/app.js', 'page', true],
      ['https://chat.tiers.test/w.js', 'third', false],
    ]);
    expect(raw.scripts[1]!.code).toBe('window.liste = [];');
  });

  it('réponses : relevées, puis lues avant l’enregistreur (sans doublon)', async () => {
    const raw = (await collectLive({
      source: SOURCE,
      pageUrl: PAGE,
      recorded: [
        {
          method: 'GET',
          url: 'https://app.exemple.test/api/a',
          status: 200,
          type: 'application/json',
          body: '[]',
        },
      ],
      earlier: ['https://app.exemple.test/api/a', 'https://app.exemple.test/api/b'],
      get,
    }))!;
    expect(raw.responses.map((r) => r.url)).toEqual([
      'https://app.exemple.test/api/a',
      'https://app.exemple.test/api/b',
    ]);
    expect(raw.responses[1]!.body).toBe('[{"nom":"Durand"}]');
  });

  it('sans source lisible : pas d’enregistrement vivant', async () => {
    expect(await collectLive({ source: null, pageUrl: PAGE, recorded: [], get })).toBeNull();
  });

  it('données personnelles : mêmes valeurs neutres que la copie, clés JSON comme libellés', () => {
    const raw: LiveRaw = {
      url: PAGE,
      html: '<p>Camille Durand</p><p>Contact : camille.durand@acme.example</p>',
      scripts: [
        { id: 's1', code: 'var u = {"n":"Camille Durand"};', keep: true, source: 'page', category: 'page' },
      ],
      responses: [
        {
          method: 'GET',
          url: 'https://app.exemple.test/api/clients',
          status: 200,
          type: 'application/json',
          body: JSON.stringify([
            {
              nom: 'Martin',
              ville: 'Lyon',
              email: 'lea.martin@acme.example',
              tel: '06 12 34 56 78',
              note: 'Camille Durand',
            },
          ]),
        },
      ],
      missing: 0,
    };
    const pairs = pairsOf({ p1: { original: 'Camille Durand', masked: 'Xxxxxxx Xxxxxx' } });
    const out = redactLive(raw, pairs);
    expect(out.html).toBe('<p>Xxxxxxx Xxxxxx</p><p>Contact : xxxxxxx.xxxxxx@xxxx.xxxxxxx</p>');
    expect(out.scripts[0]!.code).toBe('var u = {"n":"Xxxxxxx Xxxxxx"};');
    const r = JSON.parse(out.responses[0]!.body)[0];
    expect(r.nom).toBe('Xxxxxx');
    expect(r.ville).toBe('Lyon');
    expect(r.email).not.toContain('martin');
    expect(r.tel).toBe('00 00 00 00 00');
    expect(r.note).toBe('Xxxxxxx Xxxxxx');
    expect(out.piiReplaced).toBeGreaterThanOrEqual(6);
  });

  it('valeur lisible dans la copie inerte (jugée non personnelle) : lisible aussi dans les réponses', () => {
    const raw: LiveRaw = {
      url: PAGE,
      html: '',
      scripts: [],
      responses: [
        {
          method: 'GET',
          url: 'https://app.exemple.test/api/clients',
          status: 200,
          type: 'application/json',
          body: JSON.stringify([{ nom: 'Atelier Durand' }, { nom: 'Léa Martin' }]),
        },
      ],
      missing: 0,
    };
    const copie = readableText('<h1>Clients</h1><p class="carte"><a href="/1">Atelier Durand</a> · Lyon</p>');
    const out = JSON.parse(redactLive(raw, [], copie).responses[0]!.body);
    expect(out[0].nom).toBe('Atelier Durand');
    expect(out[1].nom).toBe('Xxx Xxxxxx');
  });

  it('valeur gardée par l’auteur : non remplacée', () => {
    const pairs = pairsOf({ p1: { original: 'Camille Durand', masked: 'Xxxxxxx Xxxxxx' } }, new Set(['p1']));
    const out = redactLive(
      { url: PAGE, html: '<p>Camille Durand</p>', scripts: [], responses: [], missing: 0 },
      pairs,
    );
    expect(out.html).toBe('<p>Camille Durand</p>');
  });
});
