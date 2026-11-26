// L41 étape 2 : actions de la Console sur les fournisseurs (dépendances simulées). Données fictives.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { consoleAction, keyShapeOk, providerStates, type ConsoleDeps, type ProviderRow } from './console.ts';
import { forgetKey } from './keys.ts';
import type { KeyTest } from './providers/anthropic.ts';

const UID = '00000000-0000-0000-0000-0000000041a1';
const KEY = 'sk-fictive-console-0001';

function deps(over: Partial<ConsoleDeps> = {}, log: string[] = []) {
  const vault = new Map<string, string>();
  const rows: ProviderRow[] = [];
  const d: ConsoleDeps = {
    role: () => Promise.resolve({ uid: UID, admin: true }),
    vault: (p) => Promise.resolve(vault.get(p) ?? null),
    rows: () => Promise.resolve(rows),
    save: (p, key, _uid, ms) => {
      const replaced = vault.has(p);
      vault.set(p, key);
      rows.push({
        provider: p,
        added_at: '2026-11-12T10:00:00Z',
        last_test_at: '2026-11-12T10:00:00Z',
        last_test_ok: true,
        last_test_error: null,
        last_test_ms: ms,
      });
      log.push(`save ${p}`);
      return Promise.resolve({ replaced });
    },
    tested: (p, r) => {
      log.push(`tested ${p} ${r.ok ? 'ok' : r.cause}`);
      return Promise.resolve();
    },
    test: (_p, key) =>
      Promise.resolve<KeyTest>(
        key.includes('bonne')
          ? { ok: true, ms: 320 }
          : { ok: false, ms: 210, cause: 'KEY_REFUSED', status: 401 },
      ),
    env: (n) => (n === 'ELEVENLABS_API_KEY' ? 'xi-fictive-deploiement' : undefined),
    ...over,
  };
  return { d, vault, log };
}
const noKey = (x: unknown, key: string) => assert(!JSON.stringify(x).includes(key), JSON.stringify(x));

Deno.test('hors de la plateforme : NOT_FOUND ; Lecture seule : lecture sans écriture', async () => {
  const out = await consoleAction(
    { action: 'console_providers' },
    deps({ role: () => Promise.resolve(null) }).d,
  );
  assertEquals(out.status, 404);
  const ro = deps({ role: () => Promise.resolve({ uid: UID, admin: false }) });
  assertEquals((await consoleAction({ action: 'console_providers' }, ro.d)).status, 200);
  assertEquals((await consoleAction({ action: 'console_catalog' }, ro.d)).status, 200);
  const w = await consoleAction(
    { action: 'console_key_save', provider: 'openai', key: 'sk-bonne-fictive-01' },
    ro.d,
  );
  assertEquals([w.status, w.body.error], [403, 'READ_ONLY']);
  assertEquals(ro.vault.size, 0);
});

Deno.test('états : manquante, définie au déploiement, connectée depuis la Console, refusée', async () => {
  for (const p of ['anthropic', 'openai', 'elevenlabs'] as const) forgetKey(p);
  const x = deps();
  const before = (await consoleAction({ action: 'console_providers' }, x.d)).body.result as Array<
    Record<string, unknown>
  >;
  assertEquals(
    before.map((s) => [s.provider, s.state, s.source]),
    [
      ['anthropic', 'missing', null],
      ['openai', 'missing', null],
      ['elevenlabs', 'connected', 'env'],
    ],
  );
  await consoleAction(
    { action: 'console_key_save', provider: 'anthropic', key: 'sk-bonne-fictive-0001' },
    x.d,
  );
  const after = (await consoleAction({ action: 'console_providers' }, x.d)).body.result as Array<
    Record<string, unknown>
  >;
  assertEquals(
    [after[0]!.state, after[0]!.source, after[0]!.addedAt],
    ['connected', 'vault', '2026-11-12T10:00:00Z'],
  );
  noKey(after, 'sk-bonne-fictive-0001');
  noKey(after, 'xi-fictive-deploiement');
  const refused = providerStates(
    [
      {
        provider: 'elevenlabs',
        added_at: null,
        last_test_at: '2026-11-20T09:00:00Z',
        last_test_ok: false,
        last_test_error: 'KEY_REFUSED',
        last_test_ms: 200,
      },
    ],
    { anthropic: null, openai: null, elevenlabs: 'env' },
  );
  assertEquals([refused[2]!.state, refused[2]!.lastTest?.cause], ['refused', 'KEY_REFUSED']);
});

Deno.test(
  'Tester et enregistrer : échec, rien n’est gardé ; succès, enregistrée ; jamais la clé en réponse',
  async () => {
    const x = deps();
    const bad = await consoleAction({ action: 'console_key_save', provider: 'openai', key: KEY }, x.d);
    assertEquals([bad.status, bad.body.error, bad.body.cause], [422, 'KEY_TEST', 'KEY_REFUSED']);
    assertEquals(x.vault.size, 0);
    assertEquals(x.log, []);
    noKey(bad, KEY);
    const good = await consoleAction(
      { action: 'console_key_save', provider: 'openai', key: 'sk-bonne-fictive-0002' },
      x.d,
    );
    assertEquals([good.status, (good.body.result as Record<string, unknown>).replaced], [200, false]);
    noKey(good, 'sk-bonne-fictive-0002');
    const again = await consoleAction(
      { action: 'console_key_save', provider: 'openai', key: 'sk-bonne-fictive-0003' },
      x.d,
    );
    assertEquals((again.body.result as Record<string, unknown>).replaced, true);
    assertEquals(x.log, ['save openai', 'save openai']);
  },
);

Deno.test('Tester une clé enregistrée : relit le coffre ; sans clé : MISSING', async () => {
  for (const p of ['anthropic', 'openai', 'elevenlabs'] as const) forgetKey(p);
  const x = deps();
  const none = await consoleAction({ action: 'console_key_test', provider: 'openai' }, x.d);
  assertEquals([none.status, none.body.error], [409, 'MISSING']);
  const env = await consoleAction({ action: 'console_key_test', provider: 'elevenlabs' }, x.d);
  assertEquals(env.body.result, { ok: false, ms: 210, cause: 'KEY_REFUSED', status: 401 });
  assertEquals(x.log, ['tested elevenlabs KEY_REFUSED']);
  x.vault.set('anthropic', 'sk-bonne-fictive-0004');
  const ok = await consoleAction({ action: 'console_key_test', provider: 'anthropic' }, x.d);
  assertEquals(ok.body.result, { ok: true, ms: 320 });
});

Deno.test('entrées refusées : fournisseur inconnu, clé mal formée, action inconnue', async () => {
  const { d } = deps();
  assertEquals(
    (await consoleAction({ action: 'console_key_test', provider: 'autre' }, d)).body.error,
    'BAD_PROVIDER',
  );
  for (const key of ['court', 'sk avec espace 0001', 'x'.repeat(501), 42])
    assertEquals(
      (await consoleAction({ action: 'console_key_save', provider: 'openai', key }, d)).body.error,
      'BAD_KEY',
    );
  assertEquals((await consoleAction({ action: 'console_autre' }, d)).status, 400);
  assert(keyShapeOk('sk-fictive-0123') && !keyShapeOk(' sk-fictive-0123'));
});

Deno.test('enregistrement impossible (coffre absent) : 503 NO_VAULT, sans la clé', async () => {
  const { d } = deps({ save: () => Promise.reject(new Error('NO_VAULT')) });
  const r = await consoleAction(
    { action: 'console_key_save', provider: 'openai', key: 'sk-bonne-fictive-0005' },
    d,
  );
  assertEquals([r.status, r.body.error], [503, 'NO_VAULT']);
  noKey(r, 'sk-bonne-fictive-0005');
});
