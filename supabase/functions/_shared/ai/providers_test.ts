// L41 étape 1 : catalogue, clés et adaptateurs (fetch simulé, aucun appel réel). Données fictives.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { CATALOGUE, isRetired, labelOf, modelsFor, publicCatalogue } from './catalogue.ts';
import { providerKey, scrub } from './keys.ts';
import * as claude from './providers/anthropic.ts';
import * as eleven from './providers/elevenlabs.ts';

const KEY = 'sk-fictive-0123456789abcdef';

Deno.test('catalogue : noms affichés inchangés (pied « Auto · Claude Sonnet »)', () => {
  assertEquals(labelOf('claude-sonnet-5-5'), 'Claude Sonnet');
  assertEquals(labelOf('claude-opus-5-5'), 'Claude Opus');
  assertEquals(labelOf('claude-haiku-5-5'), 'Claude Haiku');
  assertEquals(labelOf('inconnu'), '');
});

Deno.test('catalogue : modèles par fournisseur et capacité ; retrait par date', () => {
  assertEquals(
    modelsFor('anthropic', 'text').map((m) => m.id),
    ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
  );
  assertEquals(
    modelsFor('elevenlabs', 'tts').map((m) => m.id),
    ['eleven_multilingual_v2'],
  );
  assertEquals(
    modelsFor('elevenlabs', 'stt').map((m) => m.id),
    ['scribe_v1'],
  );
  const m = { ...CATALOGUE[0]!, retired: '2026-12-01' };
  assertEquals(isRetired(m, '2026-11-30'), false);
  assertEquals(isRetired(m, '2026-12-01'), true);
});

Deno.test('catalogue public : ni adresse ni clé', () => {
  const txt = JSON.stringify(publicCatalogue());
  assert(!/https?:|key|sk-/i.test(txt), txt);
});

Deno.test('clés : variables de déploiement en repli ; scrub', () => {
  const env = (n: string) => (n === 'ANTHROPIC_API_KEY' ? KEY : undefined);
  assertEquals(providerKey('anthropic', env), { key: KEY, source: 'env' });
  assertEquals(providerKey('openai', env), null);
  assertEquals(scrub(`refus pour ${KEY}`, KEY), 'refus pour [clé]');
});

/** Fournisseur simulé : statut et corps donnés ; le corps répète la clé reçue (pire cas). */
function fake(status: number, body: (key: string) => unknown, seen: Request[] = []) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push(req);
    const key = req.headers.get('x-api-key') ?? req.headers.get('xi-api-key') ?? '';
    return new Response(JSON.stringify(body(key)), {
      status,
      headers: { 'content-type': 'application/json', 'request-id': 'req_fictif' },
    });
  }) as typeof fetch;
}

const ok = (text: string) => ({
  id: 'msg_fictif',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 12, output_tokens: 3 },
});

Deno.test('Anthropic : texte, JSON, jetons, refus et sortie illisible', async () => {
  const seen: Request[] = [];
  const req = {
    model: 'claude-haiku-5-5',
    maxTokens: 50,
    system: 's',
    messages: [{ role: 'user' as const, content: 'x' }],
  };
  const r = await claude.text(KEY, req, { fetch: fake(200, () => ok('Bonjour'), seen) });
  assertEquals(r, { usage: { input: 12, output: 3 }, out: { text: 'Bonjour' } });
  const sent = await seen[0]!.clone().json();
  assertEquals(sent.output_config.effort, 'low');
  assertEquals(sent.fallbacks, undefined);
  const j = await claude.text(
    KEY,
    { ...req, model: 'claude-sonnet-5-5', schema: { type: 'object' } },
    {
      fetch: fake(200, () => ok('{"a":1}'), seen),
    },
  );
  assertEquals(j.out, { a: 1 });
  const sent2 = await seen[1]!.clone().json();
  assertEquals([sent2.output_config.effort, sent2.fallbacks], ['medium', 'default']);
  const bad = await claude.text(
    KEY,
    { ...req, schema: { type: 'object' } },
    { fetch: fake(200, () => ok('pas du json')) },
  );
  assertEquals(bad.error, 'BAD_OUTPUT');
  const ref = await claude.text(KEY, req, {
    fetch: fake(200, () => ({ ...ok(''), stop_reason: 'refusal' })),
  });
  assertEquals(ref.error, 'REFUSED');
});

Deno.test('Anthropic : échec rendu sans le message du fournisseur', async () => {
  for (const [status, http] of [
    [429, 503],
    [529, 503],
    [500, 502],
    [401, 502],
  ] as const) {
    let f;
    try {
      await claude.text(
        KEY,
        { model: 'claude-haiku-5-5', maxTokens: 5, system: '', messages: [] },
        {
          fetch: fake(status, (k) => ({ type: 'error', error: { type: 'x', message: `clé ${k} refusée` } })),
        },
      );
    } catch (e) {
      f = claude.failure(e);
    }
    assertEquals(f?.http, http);
    assert(!JSON.stringify(f).includes(KEY));
  }
});

Deno.test('Tester une clé : délai, ou cause nommée ; la clé n’apparaît jamais', async () => {
  const good = await claude.test(KEY, { fetch: fake(200, () => ok('o')) });
  assert(good.ok);
  const cases: Array<[number, string]> = [
    [401, 'KEY_REFUSED'],
    [403, 'KEY_FORBIDDEN'],
    [404, 'MODEL_UNKNOWN'],
    [529, 'BUSY'],
    [503, 'PROVIDER_DOWN'],
  ];
  for (const [status, cause] of cases) {
    const r = await claude.test(KEY, {
      fetch: fake(status, (k) => ({ type: 'error', error: { type: 'x', message: `clé ${k}` } })),
    });
    assertEquals(r.ok ? '' : r.cause, cause);
    assert(!JSON.stringify(r).includes(KEY));
  }
  const e = await eleven.test(
    KEY,
    fake(401, (k) => ({ detail: { status: 'invalid_api_key', message: k } })),
  );
  assertEquals(e.ok ? '' : e.cause, 'KEY_REFUSED');
  assert(!JSON.stringify(e).includes(KEY));
  assert(
    (
      await eleven.test(
        KEY,
        fake(200, () => []),
      )
    ).ok,
  );
  const down = await eleven.test(KEY, (() => Promise.reject(new Error('réseau'))) as typeof fetch);
  assertEquals(down.ok ? '' : down.cause, 'NETWORK');
});

Deno.test('ElevenLabs : mêmes adresses et en-têtes qu’avant', async () => {
  const seen: Request[] = [];
  const f = fake(200, () => ({}), seen);
  await eleven.voices(KEY, f);
  await eleven.tts(KEY, 'v1', 'mp3_44100_128', { text: 't', model_id: 'eleven_multilingual_v2' }, f);
  await eleven.stt(KEY, new FormData(), f);
  await eleven.purge(KEY, `${eleven.ELEVEN}/history/h1`, 'tts', f);
  assertEquals(
    seen.map((r) => `${r.method} ${r.url}`),
    [
      'GET https://api.elevenlabs.io/v1/voices?show_legacy=true',
      'POST https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128',
      'POST https://api.elevenlabs.io/v1/speech-to-text',
      'DELETE https://api.elevenlabs.io/v1/history/h1',
    ],
  );
  assert(seen.every((r) => r.headers.get('xi-api-key') === KEY));
  assertEquals(seen[1]!.headers.get('accept'), 'audio/mpeg');
});
