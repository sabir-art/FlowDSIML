// Tests de la logique d'access-email avec des doubles (aucun envoi réel, aucun appel réseau).
import { assertEquals } from 'jsr:@std/assert@1';
import { handle, redirectFor, type Deps, type Reserve } from './lib.ts';

const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

function fake(over: Partial<Deps> = {}, reserve?: (email: string) => Reserve) {
  const calls: string[] = [];
  const deps: Deps = {
    playerUrl: 'https://demos.tutoclick.example/',
    userOf: (jwt) => Promise.resolve(jwt === 'jwt-admin' ? { id: 'u-admin' } : null),
    reserve: (_k, _d, email) =>
      Promise.resolve(
        reserve?.(email) ?? { ok: true, email, demoTitle: 'Créer une fiche', workspace: 'Acme' },
      ),
    linkCheck: (_d, email) =>
      Promise.resolve({ ok: true, email, demoTitle: 'Créer une fiche', workspace: 'Acme' }),
    accountOf: (email) =>
      Promise.resolve(
        email.startsWith('connu') ? { id: 'u-connu', visitor: email.includes('visiteur') } : null,
      ),
    invite: (email, to, meta) => {
      calls.push(`invite:${email}:${to}:${meta.demo_title}`);
      return Promise.resolve('u-new');
    },
    magicLink: (email, to) => {
      calls.push(`magic:${email}:${to}`);
      return Promise.resolve(true);
    },
    markVisitor: (id, meta, isNew) => {
      calls.push(`mark:${id}:${meta.workspace_name}:${isNew}`);
      return Promise.resolve();
    },
    signLink: (demoId, email) => Promise.resolve(`tcl1.${demoId}.${email}`),
    ...over,
  };
  return { deps, calls };
}

Deno.test('lien de retour : lecteur, ?acces=<démo>, sans fragment', () => {
  assertEquals(
    redirectFor('https://demos.tutoclick.example/', DEMO),
    `https://demos.tutoclick.example/?acces=${DEMO}`,
  );
});

Deno.test('demande : nouveau visiteur invité (gabarit invite, compte marqué visiteur)', async () => {
  const { deps, calls } = fake();
  const r = await handle(
    { action: 'request', demoId: DEMO, email: ' Lea@Nord.example ' },
    '',
    'k'.repeat(64),
    deps,
  );
  assertEquals(r.body, { status: 'sent' });
  assertEquals(calls, [
    `invite:lea@nord.example:https://demos.tutoclick.example/?acces=${DEMO}:Créer une fiche`,
    'mark:u-new:Acme:true',
  ]);
});

Deno.test('demande : compte visiteur existant (lien magique, textes mis à jour)', async () => {
  const { deps, calls } = fake();
  await handle({ action: 'request', demoId: DEMO, email: 'connu-visiteur@nord.example' }, '', null, deps);
  assertEquals(calls, [
    'mark:u-connu:Acme:false',
    `magic:connu-visiteur@nord.example:https://demos.tutoclick.example/?acces=${DEMO}`,
  ]);
});

Deno.test('demande : compte de l’app (pas visiteur) : lien magique, métadonnées intactes', async () => {
  const { deps, calls } = fake();
  await handle({ action: 'request', demoId: DEMO, email: 'connu@nord.example' }, '', null, deps);
  assertEquals(calls, [`magic:connu@nord.example:https://demos.tutoclick.example/?acces=${DEMO}`]);
});

Deno.test('demande : adresse non autorisée ou plafond atteint : même réponse, aucun envoi', async () => {
  for (const reason of ['not_allowed', 'rate_limited', 'not_found'] as const) {
    const { deps, calls } = fake({}, () => ({ ok: false, reason }));
    const r = await handle({ action: 'request', demoId: DEMO, email: 'x@nord.example' }, '', null, deps);
    assertEquals(r.body, { status: 'sent' });
    assertEquals(calls, []);
  }
});

Deno.test('demande : domaine refusé annoncé (connu du visiteur)', async () => {
  const { deps } = fake({}, () => ({ ok: false, reason: 'domain_refused' }));
  const r = await handle({ action: 'request', demoId: DEMO, email: 'x@ailleurs.example' }, '', null, deps);
  assertEquals(r.body, { status: 'domain_refused' });
});

Deno.test('invitation : JWT exigé ; admin : envoyés, en attente (plafond), refus si non admin', async () => {
  const { deps } = fake({}, (e) =>
    e.startsWith('trop')
      ? { ok: false, reason: 'rate_limited' }
      : { ok: true, email: e, demoTitle: 'D', workspace: 'W' },
  );
  assertEquals(
    (await handle({ action: 'invite', demoId: DEMO, emails: ['a@nord.example'] }, '', null, deps)).status,
    401,
  );
  const r = await handle(
    { action: 'invite', demoId: DEMO, emails: ['a@nord.example', 'trop@nord.example', 'A@nord.example'] },
    'jwt-admin',
    null,
    deps,
  );
  assertEquals(r.body, { sent: ['a@nord.example'], limited: ['trop@nord.example'], failed: [] });
  const no = fake({}, () => ({ ok: false, reason: 'forbidden' }));
  assertEquals(
    (await handle({ action: 'invite', demoId: DEMO, emails: ['a@nord.example'] }, 'jwt-admin', null, no.deps))
      .status,
    403,
  );
});

Deno.test('invitation : 50 adresses au plus, toutes valides', async () => {
  const { deps } = fake();
  const many = Array.from({ length: 51 }, (_, i) => `p${i}@nord.example`);
  assertEquals(
    (await handle({ action: 'invite', demoId: DEMO, emails: many }, 'jwt-admin', null, deps)).status,
    400,
  );
  assertEquals(
    (await handle({ action: 'invite', demoId: DEMO, emails: ['pas-une-adresse'] }, 'jwt-admin', null, deps))
      .status,
    400,
  );
});

Deno.test('lien à copier : aucun envoi, jeton limité à la démo dans le fragment', async () => {
  const { deps, calls } = fake();
  const r = await handle(
    { action: 'link', demoId: DEMO, email: 'sami@nord.example' },
    'jwt-admin',
    null,
    deps,
  );
  assertEquals(r.body, {
    url: `https://demos.tutoclick.example/?acces=${DEMO}#access_token=tcl1.${DEMO}.sami@nord.example`,
  });
  assertEquals(calls, []);
});

Deno.test('lien à copier : compte existant (membre ou visiteur), aucun appel à Auth', async () => {
  for (const email of ['connu@nord.example', 'connu.visiteur@nord.example']) {
    const { deps, calls } = fake();
    const r = await handle({ action: 'link', demoId: DEMO, email }, 'jwt-admin', null, deps);
    assertEquals(r.status, 200);
    // Ni invitation, ni lien magique, ni modification de compte : rien qui ouvre une session
    assertEquals(calls, []);
    assertEquals(String(r.body.url).includes('/verify'), false);
    assertEquals(String(r.body.url).split('#access_token=')[1], `tcl1.${DEMO}.${email}`);
  }
});

Deno.test('lien à copier : la dépendance ne peut plus fabriquer de lien Auth', () => {
  const { deps } = fake();
  assertEquals('generateLink' in deps, false);
});

Deno.test('démo invalide refusée', async () => {
  const { deps } = fake();
  assertEquals(
    (await handle({ action: 'request', demoId: 'x', email: 'a@nord.example' }, '', null, deps)).status,
    400,
  );
});
