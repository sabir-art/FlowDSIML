// Tests du script de réécriture du bucket « published » (L37) : node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refresh, storageClient, walk } from './refresh-published-cache.mjs';

// Bucket fictif : une démo publiée avant L11 (fichiers anciens), une autre après
const tree = {
  '': [
    { name: 'demo-a', id: null },
    { name: 'demo-b', id: null },
  ],
  'demo-a/': [
    { name: 'assets', id: null },
    {
      name: 'latest.json',
      id: '1',
      updated_at: '2026-11-10T10:00:00Z',
      metadata: { mimetype: 'application/json', cacheControl: 'max-age=30' },
    },
  ],
  'demo-a/assets/': [
    {
      name: 's1.webp',
      id: '2',
      updated_at: '2026-11-10T10:00:00Z',
      metadata: { mimetype: 'image/webp', cacheControl: 'max-age=31536000' },
    },
  ],
  'demo-b/': [
    {
      name: 'latest.json',
      id: '3',
      updated_at: '2026-11-19T10:00:00Z',
      metadata: { mimetype: 'application/json' },
    },
  ],
};
const list = async (prefix) => tree[prefix] ?? [];

test('parcours récursif du bucket', async () => {
  const paths = [];
  for await (const o of walk(list)) paths.push(o.path);
  assert.deepEqual(paths, ['demo-a/assets/s1.webp', 'demo-a/latest.json', 'demo-b/latest.json']);
});

test('sans --apply : liste seulement, rien n’est écrit', async () => {
  let writes = 0;
  const touched = await refresh({
    list,
    download: async () => new Uint8Array(),
    upload: async () => writes++,
  });
  assert.deepEqual(touched, ['demo-a/assets/s1.webp', 'demo-a/latest.json']);
  assert.equal(writes, 0);
});

test('avec --apply : réécriture à l’identique des seuls fichiers antérieurs à L11, type et cache gardés', async () => {
  const uploads = [];
  await refresh({
    list,
    download: async (p) => new TextEncoder().encode(`contenu de ${p}`),
    upload: async (p, body, opts) => uploads.push({ p, body: new TextDecoder().decode(body), ...opts }),
    apply: true,
  });
  assert.deepEqual(uploads, [
    {
      p: 'demo-a/assets/s1.webp',
      body: 'contenu de demo-a/assets/s1.webp',
      contentType: 'image/webp',
      cacheControl: 'max-age=31536000',
    },
    {
      p: 'demo-a/latest.json',
      body: 'contenu de demo-a/latest.json',
      contentType: 'application/json',
      cacheControl: 'max-age=30',
    },
  ]);
});

test('date invalide refusée', async () => {
  await assert.rejects(() =>
    refresh({ list, download: async () => null, upload: async () => null, before: 'hier' }),
  );
});

test('client Storage : clé en en-tête, upsert, chemins encodés, pagination', async () => {
  const calls = [];
  const fake = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/list/published')) {
      const { offset } = JSON.parse(init.body);
      return new Response(
        JSON.stringify(
          offset === 0
            ? Array.from({ length: 1000 }, (_, i) => ({ name: `f${i}`, id: String(i) }))
            : [{ name: 'last', id: 'x' }],
        ),
      );
    }
    return new Response('octets');
  };
  const c = storageClient('https://api.tutoclick.example/', 'cle-de-test', fake);
  let n = 0;
  for await (const _ of walk(c.list)) n++;
  assert.equal(n, 1001, 'deux pages lues');
  assert.equal(new TextDecoder().decode(await c.download('démo a/latest.json')), 'octets');
  await c.upload('démo a/latest.json', new Uint8Array([1]), {
    contentType: 'application/json',
    cacheControl: 'max-age=30',
  });
  const put = calls.at(-1);
  assert.equal(
    put.url,
    'https://api.tutoclick.example/storage/v1/object/published/d%C3%A9mo%20a/latest.json',
  );
  assert.equal(put.init.method, 'PUT');
  assert.equal(put.init.headers['x-upsert'], 'true');
  assert.equal(put.init.headers['cache-control'], 'max-age=30');
  assert.equal(put.init.headers.authorization, 'Bearer cle-de-test');
});
