// L49 §4.1 : Safe Browsing sans appel réel (fetch simulé), ni adresse complète envoyée.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { checkUrls, expressions } from './safebrowsing.ts';

const TEST = 'https://testsafebrowsing.appspot.com/s/malware.html';
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const hash = async (s: string) =>
  b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));

Deno.test('expressions : suffixes d’hôte et préfixes de chemin, sans fragment', () => {
  const e = expressions('https://a.b.c.example.com/1/2/3.html?x=1#frag');
  assert(e.includes('a.b.c.example.com/1/2/3.html?x=1'));
  assert(e.includes('example.com/'));
  assert(e.includes('c.example.com/1/'));
  assert(!e.some((x) => x.includes('#')));
  assert(e.length <= 30);
  assertEquals(expressions('javascript:alert(1)'), []);
});

Deno.test(
  'lien signalé : seuls des préfixes de 4 octets sortent, correspondance faite localement',
  async () => {
    const calls: string[] = [];
    const flaggedHash = await hash('testsafebrowsing.appspot.com/s/malware.html');
    const fake = ((url: string) => {
      calls.push(url);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            fullHashes: [{ fullHash: flaggedHash, fullHashDetails: [{ threatType: 'MALWARE' }] }],
          }),
        ),
      );
    }) as unknown as typeof fetch;
    const r = await checkUrls([TEST, 'https://docs.globex.example/guide'], 'k-test', fake);
    assertEquals(r.status, 'ok');
    assertEquals([...r.flagged], [TEST]);
    for (const c of calls) {
      assert(!c.includes('testsafebrowsing') && !c.includes('globex'), 'aucune adresse dans la requête');
      for (const p of new URL(c).searchParams.getAll('hashPrefixes')) assertEquals(atob(p).length, 4);
    }
  },
);

Deno.test('panne, quota ou sans clé : vérification indisponible, rien de signalé', async () => {
  for (const status of [429, 500, 503]) {
    const fake = (() => Promise.resolve(new Response('{}', { status }))) as unknown as typeof fetch;
    const r = await checkUrls([TEST], 'k-test', fake);
    assertEquals(r.status, 'unavailable');
    assertEquals(r.flagged.size, 0);
  }
  const boom = (() => Promise.reject(new Error('réseau'))) as unknown as typeof fetch;
  assertEquals((await checkUrls([TEST], 'k-test', boom)).status, 'unavailable');
  assertEquals((await checkUrls([TEST], undefined)).status, 'unavailable');
  assertEquals((await checkUrls([], undefined)).status, 'ok');
});
