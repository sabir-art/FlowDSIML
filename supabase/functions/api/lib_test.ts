// Tests de l'API publique v1 : doubles en mémoire, aucune base, aucun appel externe, aucune clé réelle.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  bearerKey,
  csvCell,
  decodeCursor,
  encodeCursor,
  handle,
  sha256Hex,
  type Deps,
  type KeyCheck,
  type LeadRow,
} from './lib.ts';

// Valeurs factices au format attendu (tc_ puis 48 caractères hexadécimaux)
const KEY = `tc_${'0123456789abcdef'.repeat(3)}`;
const OTHER = `tc_${'f'.repeat(48)}`;
const WS = 'ws-acme';
const DEMO = '00000000-0000-4000-8000-0000000000d1';
const ELSEWHERE = '00000000-0000-4000-8000-0000000000d9';
const lead = (n: number): LeadRow => ({
  id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
  email: `visiteur-${n}@exemple.example`,
  created_at: `2026-11-${String(20 - n).padStart(2, '0')}T09:00:00+00:00`,
});

function world(check: Partial<Record<string, KeyCheck>> = {}) {
  const calls: string[] = [];
  const hashes: string[] = [];
  const deps: Deps = {
    playerUrl: 'https://lecteur.tutoclick.example/',
    useKey(hash) {
      hashes.push(hash);
      return Promise.resolve(check[hash] ?? { ok: false, reason: 'invalid' });
    },
    demos(ws) {
      calls.push(`demos:${ws}`);
      return Promise.resolve([
        { id: DEMO, title: 'Créer un rendez-vous', status: 'published', created_at: 'c1', updated_at: 'u1' },
        { id: 'd2', title: 'Brouillon', status: 'draft', created_at: 'c2', updated_at: 'u2' },
      ]);
    },
    stats(ws, demo, days) {
      calls.push(`stats:${ws}:${demo}:${days}`);
      return Promise.resolve(
        demo === DEMO
          ? { demo_id: DEMO, from: 'f', to: 't', views: 40, visitors: 30, completions: 10 }
          : null,
      );
    },
    leads(ws, demo, limit, before) {
      calls.push(`leads:${ws}:${demo}:${limit}:${before ? `${before.at}|${before.id}` : '-'}`);
      if (demo !== DEMO) return Promise.resolve(null);
      const all = [1, 2, 3].map(lead);
      const from = before ? all.findIndex((l) => l.id === before.id) + 1 : 0;
      return Promise.resolve(all.slice(from, from + limit + 1));
    },
  };
  return { deps, calls, hashes };
}
const keyed = async (scopes: string[], key = KEY) =>
  world({ [await sha256Hex(key)]: { ok: true, workspace_id: WS, scopes } });
const get = (deps: Deps, path: string, key: string | null = KEY, query = '') =>
  handle(
    { method: 'GET', path, query: new URLSearchParams(query), authorization: key ? `Bearer ${key}` : null },
    deps,
  );
const data = (body: string) => JSON.parse(body);

Deno.test('clé : en-tête Bearer au format attendu, sinon rien', () => {
  assertEquals(bearerKey(`Bearer ${KEY}`), KEY);
  assertEquals(bearerKey(`bearer   ${KEY}`), KEY);
  assertEquals(bearerKey(KEY), null);
  assertEquals(bearerKey('Bearer tc_court'), null);
  assertEquals(bearerKey(`Basic ${KEY}`), null);
  assertEquals(bearerKey(null), null);
});

Deno.test('sans clé, clé mal formée ou inconnue : 401, sans lecture', async () => {
  const w = await keyed(['demos']);
  for (const key of [null, 'tc_court', OTHER]) {
    const r = await get(w.deps, '/v1/demos', key);
    assertEquals(r.status, 401);
    assertEquals(r.headers['www-authenticate'], 'Bearer');
    assertEquals(data(r.body).error.code, 'unauthorized');
  }
  assertEquals(w.calls, []);
  // Une clé mal formée n'atteint pas la base
  assertEquals(w.hashes.length, 1);
});

Deno.test('la base ne reçoit que le condensé, et la réponse ne contient jamais la clé', async () => {
  const w = await keyed(['demos', 'stats', 'leads']);
  const replies = [
    await get(w.deps, '/v1/demos'),
    await get(w.deps, `/v1/demos/${DEMO}/stats`),
    await get(w.deps, `/v1/demos/${DEMO}/leads`),
    await get(w.deps, '/v1/inconnu'),
  ];
  assert(w.hashes.every((h) => /^[0-9a-f]{64}$/.test(h) && h !== KEY));
  for (const r of replies) assert(!r.body.includes(KEY) && !JSON.stringify(r.headers).includes(KEY));
});

Deno.test('clé révoquée ou expirée (refus de la base) : 401 ; limite de débit : 429', async () => {
  const hash = await sha256Hex(KEY);
  const revoked = world({ [hash]: { ok: false, reason: 'invalid' } });
  assertEquals((await get(revoked.deps, '/v1/demos')).status, 401);
  const limited = world({ [hash]: { ok: false, reason: 'rate' } });
  const r = await get(limited.deps, '/v1/demos');
  assertEquals(r.status, 429);
  assertEquals(r.headers['retry-after'], '60');
  assertEquals(limited.calls, []);
});

Deno.test('lecture seule : toute autre méthode est refusée avant tout', async () => {
  const w = await keyed(['demos']);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = await handle(
      { method, path: '/v1/demos', query: new URLSearchParams(), authorization: `Bearer ${KEY}` },
      w.deps,
    );
    assertEquals(r.status, 405);
    assertEquals(r.headers.allow, 'GET');
  }
  assertEquals(w.hashes, []);
});

Deno.test('accès de la clé : 403 sans l’accès demandé, et aucune lecture', async () => {
  const w = await keyed(['demos']);
  assertEquals((await get(w.deps, `/v1/demos/${DEMO}/stats`)).status, 403);
  assertEquals((await get(w.deps, `/v1/demos/${DEMO}/leads`)).status, 403);
  const only = await keyed(['leads']);
  assertEquals((await get(only.deps, '/v1/demos')).status, 403);
  assertEquals(w.calls.concat(only.calls), []);
});

Deno.test('démos : espace de la clé, lien seulement pour une démo publiée', async () => {
  const w = await keyed(['demos']);
  const r = await get(w.deps, '/v1/demos/');
  assertEquals(r.status, 200);
  assertEquals(r.headers['cache-control'], 'no-store');
  assertEquals(w.calls, [`demos:${WS}`]);
  const d = data(r.body).data;
  assertEquals(d[0].url, `https://lecteur.tutoclick.example/#/d/${DEMO}`);
  assertEquals(d[1].status, 'draft');
  assertEquals(d[1].url, null);
  assertEquals(Object.keys(d[0]).sort(), ['created_at', 'id', 'status', 'title', 'updated_at', 'url']);
});

Deno.test('statistiques : 30 jours par défaut, taux de complétion, paramètres bornés', async () => {
  const w = await keyed(['stats']);
  const r = await get(w.deps, `/v1/demos/${DEMO}/stats`);
  assertEquals(r.status, 200);
  assertEquals(data(r.body).data, {
    demo_id: DEMO,
    from: 'f',
    to: 't',
    views: 40,
    visitors: 30,
    completions: 10,
    completion_rate: 0.25,
  });
  assertEquals((await get(w.deps, `/v1/demos/${DEMO}/stats`, KEY, 'days=7')).status, 200);
  assertEquals(w.calls, [`stats:${WS}:${DEMO}:30`, `stats:${WS}:${DEMO}:7`]);
  for (const q of ['days=0', 'days=366', 'days=abc', 'days=-1'])
    assertEquals((await get(w.deps, `/v1/demos/${DEMO}/stats`, KEY, q)).status, 400);
});

Deno.test('démo d’un autre espace ou identifiant invalide : 404, comme une démo inexistante', async () => {
  const w = await keyed(['stats', 'leads']);
  assertEquals((await get(w.deps, `/v1/demos/${ELSEWHERE}/stats`)).status, 404);
  assertEquals((await get(w.deps, `/v1/demos/${ELSEWHERE}/leads`)).status, 404);
  assertEquals((await get(w.deps, '/v1/demos/pas-un-uuid/leads')).status, 404);
  assertEquals((await get(w.deps, '/v1/autre')).status, 404);
  assertEquals((await get(w.deps, '/v2/demos')).status, 404);
  // Toujours l'espace de la clé, jamais un espace venu de la demande
  assert(w.calls.every((c) => c.split(':')[1] === WS));
});

Deno.test('leads : adresse et date seulement, pagination par curseur', async () => {
  const w = await keyed(['leads']);
  const p1 = await get(w.deps, `/v1/demos/${DEMO}/leads`, KEY, 'limit=2');
  const b1 = data(p1.body);
  assertEquals(b1.data, [
    { email: 'visiteur-1@exemple.example', created_at: lead(1).created_at },
    { email: 'visiteur-2@exemple.example', created_at: lead(2).created_at },
  ]);
  assert(typeof b1.next_cursor === 'string');
  assertEquals(decodeCursor(b1.next_cursor), { at: lead(2).created_at, id: lead(2).id });
  const p2 = data(
    (await get(w.deps, `/v1/demos/${DEMO}/leads`, KEY, `limit=2&cursor=${b1.next_cursor}`)).body,
  );
  assertEquals(p2.data.length, 1);
  assertEquals(p2.next_cursor, null);
  for (const q of ['limit=0', 'limit=501', 'cursor=n%27importe', 'format=xml'])
    assertEquals((await get(w.deps, `/v1/demos/${DEMO}/leads`, KEY, q)).status, 400);
});

Deno.test('leads en CSV : en-tête, guillemets, formule de tableur neutralisée', async () => {
  const w = await keyed(['leads']);
  const r = await get(w.deps, `/v1/demos/${DEMO}/leads`, KEY, 'format=csv&limit=2');
  assertEquals(r.status, 200);
  assertEquals(r.headers['content-type'], 'text/csv; charset=utf-8');
  assertEquals(r.headers['x-next-cursor'], encodeCursor(lead(2)));
  assertEquals(r.body.split('\r\n')[0], 'email,created_at');
  assertEquals(r.body.split('\r\n')[1], `"visiteur-1@exemple.example","${lead(1).created_at}"`);
  assertEquals(csvCell('=cmd@exemple.example'), `"'=cmd@exemple.example"`);
  assertEquals(csvCell('a"b'), '"a""b"');
});
