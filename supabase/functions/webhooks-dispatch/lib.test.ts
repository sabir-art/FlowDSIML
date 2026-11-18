// Tests unitaires du dispatch (deno test) : signature, refus d'IP privée après DNS, pas de redirection.
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { checkUrl, deliver, isPrivateIp, safeEqual, sign, signatureHeader, type Delivery } from './lib.ts';

const d: Delivery = {
  id: 'd1',
  url: 'https://hooks.example.com/tutoclick',
  event_id: 'e1',
  event_type: 'lead.created',
  attempt: 1,
  body: '{"id":"e1","type":"lead.created"}',
  secrets: ['tcsec_test'],
};
const publicDns = () => Promise.resolve(['93.184.215.14']);

Deno.test('signature HMAC-SHA256 de « t.corps » (vecteur de référence)', async () => {
  // Vecteur calculé indépendamment : printf '1700000000.{}' | openssl dgst -sha256 -hmac tcsec_test
  assertEquals(
    await sign('tcsec_test', 1700000000, '{}'),
    '94c635e1fc75d7c9dc771237cd60b227b0413e255235bf507b05e45249b53cbf',
  );
  const h = await signatureHeader(['a', 'b'], 1700000000, '{}');
  assertMatch(h, /^t=1700000000, v1=[0-9a-f]{64}, v1=[0-9a-f]{64}$/);
  assert(h.split('v1=')[1] !== h.split('v1=')[2], 'un v1 par secret');
});

Deno.test('IP privées et réservées refusées (IPv4, IPv6, IPv4 mappée)', () => {
  for (const ip of [
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.20.0.1',
    '192.168.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    '::ffff:127.0.0.1',
  ]) {
    assert(isPrivateIp(ip), ip);
  }
  for (const ip of ['93.184.215.14', '8.8.8.8', '2606:4700::1111', '::ffff:8.8.8.8'])
    assert(!isPrivateIp(ip), ip);
});

Deno.test('URL : https, pas d’identifiants, pas d’IP privée ni de nom interne', () => {
  assert(checkUrl('https://hooks.example.com/x'));
  for (const u of [
    'http://hooks.example.com/x',
    'https://u:p@hooks.example.com/x',
    'https://127.0.0.1/x',
    'https://2130706433/x',
    'https://[::1]/x',
    'https://api.internal/x',
    'https://hooks.example.com:22/x',
  ]) {
    assertEquals(checkUrl(u), null, u);
  }
});

Deno.test('refus après DNS : un nom qui résout vers une IP privée n’est jamais appelé', async () => {
  let called = false;
  const r = await deliver(d, {
    resolve: () => Promise.resolve(['93.184.215.14', '10.0.0.5']),
    fetch: () => {
      called = true;
      return Promise.resolve(new Response('ok'));
    },
  });
  assertEquals(called, false);
  assertEquals(r.status, 0);
  assertMatch(r.error ?? '', /privée/);
});

Deno.test('pas de redirection : redirect=manual et 3xx compté comme échec', async () => {
  let init: RequestInit | undefined;
  const r = await deliver(d, {
    resolve: publicDns,
    fetch: (_u, i) => {
      init = i;
      return Promise.resolve(new Response('', { status: 302, headers: { location: 'http://10.0.0.1/' } }));
    },
  });
  assertEquals(init?.redirect, 'manual');
  assertEquals(r.status, 302);
  assertMatch(r.error ?? '', /Redirection/);
});

Deno.test('en-têtes signés, corps envoyé tel quel, réponse tronquée à 2 Ko', async () => {
  let headers: Record<string, string> = {};
  let body = '';
  const r = await deliver(d, {
    resolve: publicDns,
    now: () => 1_700_000_000_000,
    fetch: (_u, i) => {
      headers = i.headers as Record<string, string>;
      body = i.body as string;
      return Promise.resolve(new Response('x'.repeat(5000), { status: 200 }));
    },
  });
  assertEquals(body, d.body);
  assertEquals(headers['tutoclick-event-id'], 'e1');
  assertEquals(
    headers['tutoclick-signature'],
    `t=1700000000, v1=${await sign('tcsec_test', 1700000000, d.body)}`,
  );
  assertEquals(r.status, 200);
  assertEquals(r.body.length, 2048);
  assertEquals(r.error, null);
});

Deno.test('échec HTTP et DNS introuvable', async () => {
  const r = await deliver(d, {
    resolve: publicDns,
    fetch: () => Promise.resolve(new Response('non', { status: 500 })),
  });
  assertEquals([r.status, r.error], [500, 'HTTP 500']);
  const r2 = await deliver(d, {
    resolve: () => Promise.resolve([]),
    fetch: () => Promise.resolve(new Response('ok')),
  });
  assertMatch(r2.error ?? '', /DNS/);
});

Deno.test('comparaison du secret partagé', () => {
  assert(safeEqual('Bearer abc', 'Bearer abc'));
  assert(!safeEqual('Bearer abc', 'Bearer abd'));
  assert(!safeEqual('Bearer ab', 'Bearer abc'));
});
