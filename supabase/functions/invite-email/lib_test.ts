// Tests de la logique d'invite-email avec des doubles (aucun envoi réel, aucun appel réseau).
import { assertEquals } from 'jsr:@std/assert@1';
import { handle, MAX_BATCH, redirectFor, type Deps, type Reserve } from './lib.ts';
import { acceptLink, renderInvite, sendInviteMail } from './mail.ts';

const ID = (n: number) => `0b5c1f0e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const APP = 'https://app.tutoclick.example/';

function fake(reserve: (id: string) => Reserve, sendOk = true, mailOk = true) {
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
    mail: (email, token, meta) => {
      calls.push(`mail:${email}:${token}:${meta.workspace_name}:${meta.inviter_name}`);
      return Promise.resolve(mailOk);
    },
  };
  return { deps, calls };
}
const mail = (email: string, mode: 'email' | 'notify' = 'email'): Reserve => ({
  ok: true,
  mode,
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

Deno.test("recette 3 : Auth et e-mail direct en échec, l'envoi est rendu au budget", async () => {
  const { deps, calls } = fake(() => mail('marie@acme.example'), false, false);
  const r = await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-admin', deps);
  assertEquals(r.body, { results: [{ id: ID(1), status: 'failed' }] });
  assertEquals(calls.at(-1), `undo:${ID(1)}`);
});

Deno.test(
  'recettes 2, 4 et 8 : plafond, compte existant (réponse « sent » comme un e-mail), budget',
  async () => {
    const by: Record<string, Reserve> = {
      [ID(1)]: mail('paul@acme.example', 'notify'),
      [ID(2)]: { ok: false, reason: 'rate_limit' },
      [ID(3)]: { ok: false, reason: 'budget' },
      [ID(4)]: { ok: false, reason: 'sent' },
    };
    const { deps, calls } = fake((id) => by[id]!);
    const r = await handle({ invitations: [ID(1), ID(2), ID(3), ID(4)], appUrl: APP }, 'jwt-admin', deps);
    assertEquals(r.body, {
      results: [
        { id: ID(1), status: 'sent' },
        { id: ID(2), status: 'rate_limit' },
        { id: ID(3), status: 'budget' },
        { id: ID(4), status: 'sent_before' },
      ],
    });
    assertEquals(calls, ['mail:paul@acme.example:tok-1:Acme:Olga Exemple']);
  },
);

Deno.test(
  'réinvitation, compte jamais confirmé : Auth renvoie son invitation, pas de second e-mail',
  async () => {
    const { deps, calls } = fake(() => mail('nina@acme.example'));
    const r = await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-admin', deps);
    assertEquals(r.body, { results: [{ id: ID(1), status: 'sent' }] });
    assertEquals(calls.length, 1);
    assertEquals(calls[0]!.startsWith('invite:nina@acme.example:'), true);
  },
);

Deno.test("réinvitation, Auth refuse (compte déjà enregistré) : l'e-mail part par TutoClick", async () => {
  const { deps, calls } = fake(() => mail('nina@acme.example'), false, true);
  const r = await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-admin', deps);
  assertEquals(r.body, { results: [{ id: ID(1), status: 'sent' }] });
  assertEquals(
    calls.map((c) => c.split(':')[0]),
    ['invite', 'mail'],
  );
  assertEquals(calls.at(-1), 'mail:nina@acme.example:tok-1:Acme:Olga Exemple');
});

Deno.test('compte confirmé : notification ET e-mail ; même réponse si cet e-mail échoue', async () => {
  for (const mailOk of [true, false]) {
    const { deps, calls } = fake(() => mail('paul@acme.example', 'notify'), true, mailOk);
    const r = await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-admin', deps);
    assertEquals(r.body, { results: [{ id: ID(1), status: 'sent' }] });
    // Jamais d'invitation Auth pour un compte existant, et rien n'est rendu au budget
    assertEquals(calls, ['mail:paul@acme.example:tok-1:Acme:Olga Exemple']);
  }
});

Deno.test("lien direct : bâti depuis l'adresse réglée de l'app, absent sans réglage", () => {
  assertEquals(
    acceptLink('https://app.tutoclick.example/FlowDSIML/', 'tok-1'),
    'https://app.tutoclick.example/FlowDSIML/#/invite/tok-1',
  );
  assertEquals(
    acceptLink('https://app.tutoclick.example/?x=1#/settings', 'tok-1'),
    'https://app.tutoclick.example/#/invite/tok-1',
  );
  for (const bad of [undefined, null, '', 'javascript:alert(1)', 'app.tutoclick.example'])
    assertEquals(acceptLink(bad, 'tok-1'), null);
});

Deno.test("e-mail direct : espace, invitant et lien seulement, texte venu de l'espace échappé", () => {
  const m = renderInvite({
    to: 'paul@acme.example',
    workspace: 'Acme <b>&</b>\nCo',
    inviter: 'Olga Exemple',
    url: 'https://app.tutoclick.example/#/invite/tok-1',
  });
  assertEquals(m.to, 'paul@acme.example');
  assertEquals(m.subject, 'Rejoignez votre espace TutoClick');
  assertEquals(m.html.includes('Acme &lt;b&gt;&amp;&lt;/b&gt; Co'), true);
  assertEquals(m.html.includes('<b>&</b>'), false);
  assertEquals(m.html.split('href="https://app.tutoclick.example/#/invite/tok-1"').length, 3);
  assertEquals(
    m.text.includes('Olga Exemple vous invite à rejoindre l’espace « Acme <b>&</b> Co » sur TutoClick.'),
    true,
  );
  assertEquals(m.text.includes('Accepter l’invitation : https://app.tutoclick.example/#/invite/tok-1'), true);
  // Aucune image de suivi : la seule image est le logo
  assertEquals(m.html.split('<img').length, 2);
});

Deno.test('envoi Brevo : clé en en-tête seulement, échec et panne rendus par false', async () => {
  const m = renderInvite({
    to: 'paul@acme.example',
    workspace: 'Acme',
    inviter: '',
    url: 'https://app.tutoclick.example/#/invite/t',
  });
  const seen: Array<{ url: string; key: string | null; body: Record<string, unknown> }> = [];
  const okFetch = ((url: string, init: RequestInit) => {
    seen.push({
      url,
      key: new Headers(init.headers).get('api-key'),
      body: JSON.parse(String(init.body)),
    });
    return Promise.resolve(new Response('{}', { status: 201 }));
  }) as unknown as typeof fetch;
  assertEquals(
    await sendInviteMail(
      m,
      'cle-factice',
      'ne-pas-repondre@tutoclick.example',
      okFetch,
      'https://brevo.invalid/',
    ),
    true,
  );
  assertEquals(seen[0]!.url, 'https://brevo.invalid/');
  assertEquals(seen[0]!.key, 'cle-factice');
  assertEquals(JSON.stringify(seen[0]!.body).includes('cle-factice'), false);
  assertEquals(seen[0]!.body.to, [{ email: 'paul@acme.example' }]);
  const ko = (() => Promise.resolve(new Response('{}', { status: 500 }))) as unknown as typeof fetch;
  assertEquals(
    await sendInviteMail(m, 'cle-factice', 'ne-pas-repondre@tutoclick.example', ko, 'https://brevo.invalid/'),
    false,
  );
  const down = (() => Promise.reject(new Error('panne'))) as unknown as typeof fetch;
  assertEquals(
    await sendInviteMail(
      m,
      'cle-factice',
      'ne-pas-repondre@tutoclick.example',
      down,
      'https://brevo.invalid/',
    ),
    false,
  );
});

Deno.test("pas admin de l'espace : 403", async () => {
  const { deps, calls } = fake(() => ({ ok: false, reason: 'forbidden' }));
  assertEquals((await handle({ invitations: [ID(1)], appUrl: APP }, 'jwt-admin', deps)).status, 403);
  assertEquals(calls, []);
});
