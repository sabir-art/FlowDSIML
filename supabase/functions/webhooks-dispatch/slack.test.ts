// Tests unitaires de l'envoi Slack (deno test) : lien construit depuis APP_URL, hôte imposé, pas de
// redirection, aucun appel réel (faux fetch, adresses fictives).
import { assertEquals } from 'jsr:@std/assert@1';
import { appBase, postSlack, slackText, type SlackMessage } from './slack.ts';

const m: SlackMessage = {
  id: 1,
  url: 'https://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice',
  text: 'TutoClick · Nouveau lead : 2 sur « Créer un rendez-vous »',
  path: '/#/analytics',
};

Deno.test('lien « Voir dans Analytics » construit depuis APP_URL', () => {
  assertEquals(
    slackText(m, 'https://app.acme.example/tutoclick/'),
    'TutoClick · Nouveau lead : 2 sur « Créer un rendez-vous » — <https://app.acme.example/tutoclick/#/analytics|Voir dans Analytics>',
  );
});

Deno.test('APP_URL absent, non https ou avec paramètres : message sans lien', () => {
  for (const bad of [
    null,
    undefined,
    '',
    'http://app.acme.example',
    'https://app.acme.example/?next=x',
    'javascript:alert(1)',
  ])
    assertEquals(slackText(m, bad), m.text);
  assertEquals(appBase('https://app.acme.example///'), 'https://app.acme.example');
});

Deno.test('message de test (sans chemin) ou chemin inattendu : pas de lien', () => {
  assertEquals(
    slackText({ text: 'TutoClick · Test', path: null }, 'https://app.acme.example'),
    'TutoClick · Test',
  );
  assertEquals(slackText({ text: 'x', path: '/#/analytics|<!channel>' }, 'https://app.acme.example'), 'x');
  assertEquals(slackText({ text: 'x', path: 'https://evil.example' }, 'https://app.acme.example'), 'x');
});

Deno.test('envoi : POST JSON vers le webhook, sans suivre de redirection', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fake = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response('ok', { status: 200 }));
  }) as unknown as typeof fetch;
  assertEquals(await postSlack(m, 'https://app.acme.example', fake), true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0]!.url, m.url);
  assertEquals(calls[0]!.init.method, 'POST');
  assertEquals(calls[0]!.init.redirect, 'error');
  assertEquals(JSON.parse(String(calls[0]!.init.body)), {
    text: 'TutoClick · Nouveau lead : 2 sur « Créer un rendez-vous » — <https://app.acme.example/#/analytics|Voir dans Analytics>',
  });
});

Deno.test('autre hôte que hooks.slack.com : aucun appel', async () => {
  let called = 0;
  const fake = (() => {
    called++;
    return Promise.resolve(new Response('ok'));
  }) as unknown as typeof fetch;
  for (const url of [
    'https://hooks.slack.com.evil.example/services/T000FICTIF/B000FICTIF/cle-factice',
    'http://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice',
    'https://127.0.0.1/services/T000FICTIF/B000FICTIF/cle-factice',
  ])
    assertEquals(await postSlack({ ...m, url }, null, fake), false);
  assertEquals(called, 0);
});

Deno.test('refus de Slack ou erreur réseau : false, sans exception', async () => {
  const refuse = (() =>
    Promise.resolve(new Response('no_service', { status: 404 }))) as unknown as typeof fetch;
  const broken = (() => Promise.reject(new Error('réseau'))) as unknown as typeof fetch;
  assertEquals(await postSlack(m, null, refuse), false);
  assertEquals(await postSlack(m, null, broken), false);
});
