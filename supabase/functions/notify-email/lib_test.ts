// Tests de notify-email : doubles et faux serveur Brevo local (aucun envoi réel, aucun appel externe).
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  handle,
  lineText,
  renderDigest,
  sendBrevo,
  type Claim,
  type Config,
  type Deps,
  type Mail,
} from './lib.ts';

const KEY = 'xkeysib-faux-0123456789';
const CFG: Config = {
  apiKey: KEY,
  from: 'notifications@tutoclick.example',
  appUrl: 'https://app.tutoclick.example/',
  selfUrl: 'https://api.tutoclick.example/functions/v1/notify-email',
};
const TOK = 'a'.repeat(48);
const line = (step: number) => ({
  kind: 'comment',
  actor: 'Camille',
  demo: 'Créer un rendez-vous',
  step,
  data: null,
});
const claim = (n: number, total = n): Claim => ({
  user: 'u-olga',
  email: 'olga@acme.example',
  ids: Array.from({ length: total }, (_, i) => `n-${i}`),
  previous: null,
  total,
  token: TOK,
  lines: Array.from({ length: n }, (_, i) => line(i + 1)),
});

function fake(over: Partial<Deps> = {}) {
  const sent: Mail[] = [];
  const calls: string[] = [];
  const deps: Deps = {
    config: CFG,
    secretOk: (b) => b === 'secret-tache',
    claim: () => {
      calls.push('claim');
      return Promise.resolve([claim(3)]);
    },
    undo: (c) => {
      calls.push(`undo:${c.user}`);
      return Promise.resolve();
    },
    unsubscribe: (t) => Promise.resolve(t === TOK),
    send: (m) => {
      sent.push(m);
      return Promise.resolve(true);
    },
    ...over,
  };
  return { deps, sent, calls };
}
// Les textes de l'app portent des espaces insécables (« … ») : comparés en espaces simples
const flat = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');
const run = (deps: Deps, bearer = 'secret-tache') =>
  handle({ action: 'run' }, new URLSearchParams(), bearer, deps);

Deno.test("lignes : même texte que dans l'app, sans contenu de commentaire", () => {
  assertEquals(flat(lineText(line(3))), 'Camille a commenté « Créer un rendez-vous » · étape 3');
  assertEquals(
    lineText({ kind: 'alert', actor: '', demo: 'Acme', step: null, data: { trigger: 'lead', count: 2 } }),
    '2 nouveaux leads · Acme',
  );
  assertEquals(
    flat(
      lineText({
        kind: 'invite',
        actor: '',
        demo: '',
        step: null,
        data: { actor: 'Olga', workspace: 'Acme' },
      }),
    ),
    'Olga vous invite à rejoindre « Acme »',
  );
});

Deno.test('recette 9 : sans BREVO_API_KEY, la tâche ne réserve rien et rien ne part', async () => {
  const { deps, sent, calls } = fake({ config: { ...CFG, apiKey: null } });
  assertEquals((await run(deps)).body, { skipped: true });
  assertEquals(calls, []);
  assertEquals(sent, []);
  assertEquals((await handle({ action: 'status' }, new URLSearchParams(), '', deps)).body, {
    available: false,
  });
});

Deno.test('tâche : secret partagé exigé', async () => {
  const { deps, calls } = fake();
  assertEquals((await run(deps, '')).status, 401);
  assertEquals((await run(deps, 'autre')).status, 401);
  assertEquals(calls, []);
});

Deno.test('recette 5 : un seul e-mail groupé, objet, lignes, bouton et pied de page', async () => {
  const { deps, sent } = fake();
  assertEquals((await run(deps)).body, { sent: 1, failed: 0 });
  const m = sent[0]!;
  assertEquals(m.to, 'olga@acme.example');
  assertEquals(m.subject, '3 nouvelles notifications dans TutoClick');
  assertStringIncludes(flat(m.html), 'Camille a commenté « Créer un rendez-vous » · étape 3');
  assertStringIncludes(m.html, 'href="https://app.tutoclick.example/#/?notifications=1"');
  assertStringIncludes(m.html, 'Ouvrir les notifications');
  assertStringIncludes(m.html, 'Vous recevez cet e-mail parce que vous avez activé');
  assertStringIncludes(m.html, `href="https://app.tutoclick.example/#/unsubscribe/${TOK}"`);
  // Une seule image : le logo des gabarits d'authentification ; aucun pixel de suivi
  const imgs = [...m.html.matchAll(/<img [^>]*>/gi)].map((x) => x[0]);
  assert(
    imgs.length === 1 &&
      imgs[0]!.includes('logo-tutoclick.png') &&
      imgs[0]!.includes('alt="TutoClick, porté par la DSIML"') &&
      imgs[0]!.includes('width="400"'),
    'logo seul, aucun pixel de suivi',
  );
  assertStringIncludes(m.html, '[data-ogsc] .em-text');
  assertStringIncludes(m.html, '[data-ogsb] .em-bg');
  assert(!/font-size:12px/.test(m.html), 'bas de page en 14 px');
  const links = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]!);
  assert(
    links.every((h) => h.startsWith('https://app.tutoclick.example/')),
    'liens de l’app seulement',
  );
});

Deno.test('au plus 10 lignes, puis « Et n autres » ; singulier', () => {
  const m = renderDigest(claim(10, 14), CFG);
  assertEquals((m.html.match(/<tr><td class="em-text em-rule"/g) ?? []).length, 10);
  assertStringIncludes(m.html, 'Et 4 autres dans TutoClick');
  assertEquals(renderDigest(claim(1), CFG).subject, '1 nouvelle notification dans TutoClick');
});

Deno.test('texte échappé (titre de démo hostile)', () => {
  const c = claim(1);
  c.lines[0]!.demo = '<img src=x onerror=alert(1)>';
  assert(!renderDigest(c, CFG).html.includes('<img src=x'));
});

Deno.test('envoi en échec : rendu (budget, rythme, notifications)', async () => {
  const { deps, calls } = fake({ send: () => Promise.resolve(false) });
  assertEquals((await run(deps)).body, { sent: 0, failed: 1 });
  assertEquals(calls, ['claim', 'undo:u-olga']);
});

Deno.test('recette 7 : désinscription par le lien et à un clic (List-Unsubscribe-Post)', async () => {
  const { deps } = fake();
  assertEquals((await handle({ action: 'unsubscribe', token: TOK }, new URLSearchParams(), '', deps)).body, {
    ok: true,
  });
  assertEquals((await handle({}, new URLSearchParams({ u: TOK }), '', deps)).body, { ok: true });
  assertEquals((await handle({}, new URLSearchParams({ u: 'pas-un-jeton' }), '', deps)).body, { ok: false });
  const m = renderDigest(claim(1), CFG);
  assertEquals(m.headers, {
    'List-Unsubscribe': `<https://api.tutoclick.example/functions/v1/notify-email?u=${TOK}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });
});

Deno.test(
  'recette 9 : faux serveur Brevo, en-tête api-key et désinscription, clé jamais journalisée',
  async () => {
    const got: Array<{ key: string | null; body: Record<string, unknown> }> = [];
    const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, async (req) => {
      const key = req.headers.get('api-key');
      got.push({ key, body: await req.json() });
      if (key !== KEY) return new Response('{"code":"unauthorized"}', { status: 401 });
      return new Response('{"messageId":"<faux@example.com>"}', { status: 201 });
    });
    const url = `http://127.0.0.1:${server.addr.port}/v3/smtp/email`;
    const logs: string[] = [];
    const keep = { log: console.log, error: console.error, warn: console.warn, info: console.info };
    for (const k of ['log', 'error', 'warn', 'info'] as const)
      console[k] = (...a: unknown[]) => logs.push(a.join(' '));
    try {
      const mail = renderDigest(claim(2), CFG);
      assert(await sendBrevo(mail, KEY, CFG.from!, fetch, url));
      // Refus du serveur (401) : false, sans exception ni journal
      assertEquals(await sendBrevo(mail, 'xkeysib-mauvaise', CFG.from!, fetch, url), false);
    } finally {
      Object.assign(console, keep);
      await server.shutdown();
    }
    assertEquals(got[0]!.key, KEY);
    const b = got[0]!.body as {
      sender: { email: string };
      to: Array<{ email: string }>;
      headers: Record<string, string>;
    };
    assertEquals(b.sender.email, 'notifications@tutoclick.example');
    assertEquals(b.to, [{ email: 'olga@acme.example' }]);
    assertEquals(b.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert(
      logs.every((l) => !l.includes(KEY)),
      'clé absente des journaux',
    );
  },
);
