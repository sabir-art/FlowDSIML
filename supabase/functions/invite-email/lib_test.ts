// Tests de la logique d'invite-email avec des doubles (aucun envoi réel, aucun appel réseau).
import { assertEquals } from 'jsr:@std/assert@1';
import { handle, MAX_BATCH, redirectFor, type Deps, type Reserve } from './lib.ts';

const ID = (n: number) => `0b5c1f0e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const APP = 'https://app.tutoclick.example/';

function fake(reserve: (id: string) => Reserve, sendOk = true) {
  const calls: string[] = [];
  const deps: Deps = {
    userOf: (jwt) => Promise.resolve(jwt === 'jwt-admin' ? { id: 'u-admin' } : null),
    reserve: (id) => Promise.resolve(reserve(id)),
    undo: (id) => {
      calls.push(`undo:${id}`);
      return Promise.resolve();
    },
    invite: (email, to, meta) => {
      calls.push(`invite:${email}:${to}:${JSON.stringify(meta)}`);
      return Promise.resolve(sendOk);
    },
  };
  return { deps, calls };
}
const mail = (email: string): Reserve => ({
  ok: true,
  mode: 'email',
  email,
  token: 'tok-1',
  workspace_name: 'Acme',
  inviter_name: 'Olga Exemple',
});

Deno.test("lien de retour : l'app, ?next=/invite/<jeton>, sans fragment", () => {
  assertEquals(
    redirectFor('https://app.tutoclick.example/FlowDSIML/?x=1#/settings', 'tok'),
    'https://app.tutoclick.example/FlowDSIML/?next=%2Finvite%2Ftok',
  );
});

Deno.test("sans JWT valide : 401, rien n'est envoyé", async () => {
  const { deps, calls } = fake(() => mail('marie@acme.example'));
  const r = await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-autre', deps);
  assertEquals(r.status, 401);
  assertEquals(calls, []);
});

Deno.test('requête invalide : 400', async () => {
  const { deps } = fake(() => mail('marie@acme.example'));
  for (const body of [
    {},
    { invitations: [], appUrl: APP },
    { invitations: ['pas-un-uuid'], appUrl: APP },
    { invitations: [ID(1)], appUrl: 'javascript:alert(1)' },
    { invitations: Array.from({ length: MAX_BATCH + 1 }, (_, i) => ID(i)), appUrl: APP },
  ])
    assertEquals((await handle(body, 'jwt-admin', deps)).status, 400);
});

Deno.test("recette 1 : deux adresses, deux e-mails avec l'espace et l'invitant seulement", async () => {
  const emails: Record<string, string> = { [ID(1)]: 'marie@acme.example', [ID(2)]: 'paul@acme.example' };
  const { deps, calls } = fake((id) => mail(emails[id]!));
  const r = await handle({ invitations: [ID(1), ID(2)], appUrl: APP }, 'jwt-admin', deps);
  assertEquals(r.body, {
    results: [
      { id: ID(1), status: 'sent' },
      { id: ID(2), status: 'sent' },
    ],
  });
  assertEquals(calls, [
    `invite:marie@acme.example:${APP}?next=%2Finvite%2Ftok-1:{"workspace_name":"Acme","inviter_name":"Olga Exemple","demo_title":""}`,
    `invite:paul@acme.example:${APP}?next=%2Finvite%2Ftok-1:{"workspace_name":"Acme","inviter_name":"Olga Exemple","demo_title":""}`,
  ]);
});

Deno.test("recette 3 : envoi en échec, l'envoi est rendu au budget", async () => {
  const { deps, calls } = fake(() => mail('marie@acme.example'), false);
  const r = await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-admin', deps);
  assertEquals(r.body, { results: [{ id: ID(1), status: 'failed' }] });
  assertEquals(calls.at(-1), `undo:${ID(1)}`);
});

Deno.test('recettes 2, 4 et 8 : plafond, compte existant, budget, sans e-mail', async () => {
  const by: Record<string, Reserve> = {
    [ID(1)]: { ok: true, mode: 'notify' },
    [ID(2)]: { ok: false, reason: 'rate_limit' },
    [ID(3)]: { ok: false, reason: 'budget' },
    [ID(4)]: { ok: false, reason: 'sent' },
  };
  const { deps, calls } = fake((id) => by[id]!);
  const r = await handle({ invitations: [ID(1), ID(2), ID(3), ID(4)], appUrl: APP }, 'jwt-admin', deps);
  assertEquals(r.body, {
    results: [
      { id: ID(1), status: 'notified' },
      { id: ID(2), status: 'rate_limit' },
      { id: ID(3), status: 'budget' },
      { id: ID(4), status: 'sent_before' },
    ],
  });
  assertEquals(calls, []);
});

Deno.test("pas admin de l'espace : 403", async () => {
  const { deps, calls } = fake(() => ({ ok: false, reason: 'forbidden' }));
  assertEquals((await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-admin', deps)).status, 403);
  assertEquals(calls, []);
});
