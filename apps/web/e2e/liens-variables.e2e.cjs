/**
 * Texte riche, liens et variables dans le lecteur. La valeur d'une variable reste du texte ; elle est
 * encodée quand elle complète une adresse ; une adresse faite d'une seule variable n'est gardée que si
 * elle est en http, https ou mailto ; l'adresse d'un lien n'est jamais retouchée par la mise en forme.
 * Données fictives. Usage : node e2e/liens-variables.e2e.cjs
 */
const { chromium } = require('playwright');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const PID = '0b5c1f0e-0000-4000-8000-0000000000a1';

const manifest = {
  schemaVersion: 1,
  demoId: PID,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000a9',
  workspaceId: 'w',
  title: 'Liens',
  locale: 'fr',
  publishedAt: '2026-11-19T10:00:00Z',
  theme: {},
  variables: [
    { key: 'first_name', label: 'Prénom', default: '' },
    { key: 'lien', label: 'Lien', default: '' },
  ],
  steps: [
    {
      id: 't1',
      kind: 'text',
      title: 'Bonjour {{first_name}}',
      body:
        'Bienvenue {{first_name}}. [Votre fiche](https://exemple.test/fiche/{{first_name}}) · [Suite]({{lien}}) · ' +
        '[Doc](https://exemple.test/**a**/*b*) et **important**.',
      cta: { label: 'Ouvrir', url: 'https://exemple.test/go?n={{first_name}}' },
    },
    { id: 't2', kind: 'text', title: 'Fin', body: 'Merci.' },
  ],
};

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'not ok'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (qs) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const dialogs = [];
    p.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest }),
      }),
    );
    await p.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
    await p.goto(`${PLAYER}/${qs}#/d/${PID}`);
    await p.locator('.p-text-step .p-rich').waitFor();
    const links = () =>
      p
        .locator('.p-text-step .p-rich a')
        .evaluateAll((els) => els.map((a) => [a.textContent, a.getAttribute('href')]));
    return { ctx, p, links, dialogs };
  };
  const q = (o) => `?${new URLSearchParams(o).toString()}`;

  // Valeurs ordinaires
  {
    const { ctx, p, links } = await open(
      q({ first_name: 'Camille', lien: 'https://exemple.test/suite?a=1' }),
    );
    const l = await links();
    ok(
      /Bienvenue Camille\./.test(await p.locator('.p-rich').innerText()),
      'valeur ordinaire : affichée dans le texte',
    );
    ok(
      l.length === 3 &&
        l[0][1] === 'https://exemple.test/fiche/Camille' &&
        l[1][1] === 'https://exemple.test/suite?a=1' &&
        l[2][1] === 'https://exemple.test/**a**/*b*',
      `trois liens, adresses attendues (${l.map((x) => x[1]).join(' | ')})`,
    );
    ok(
      (await p
        .locator('.p-rich a')
        .evaluateAll((els) => els.every((a) => a.target === '_blank' && /noopener/.test(a.rel)))) &&
        (await p.locator('.p-rich strong').allTextContents()).join('|') === 'important' &&
        (await p.locator('.p-rich a strong, .p-rich a em').count()) === 0,
      'liens en nouvel onglet ; le gras ne touche pas l’adresse d’un lien',
    );
    await ctx.close();
  }
  // Valeur qui imite la mise en forme : elle reste du texte
  {
    const evil = '[Cliquez ici](https://autre.test/piege) **x** <img src=x onerror=alert(1)>';
    const { ctx, p, links, dialogs } = await open(
      q({ first_name: evil, lien: 'https://exemple.test/suite' }),
    );
    const l = await links();
    ok(
      l.length === 3 && !l.some((x) => /autre\.test/.test(new URL(x[1]).host)),
      'aucun lien ajouté par la valeur',
    );
    ok(
      (await p.locator('.p-rich').innerText()).includes(evil) &&
        (await p.locator('.p-rich img').count()) === 0 &&
        (await p.locator('.p-rich strong').allTextContents()).join('|') === 'important',
      'la valeur s’affiche telle quelle, sans balise ni mise en forme',
    );
    ok(
      new URL(l[0][1]).host === 'exemple.test' && l[0][1].includes('%5BCliquez'),
      'valeur encodée dans l’adresse',
    );
    ok((await p.locator('.p-step-h').innerText()).includes('[Cliquez ici]'), 'titre : valeur en texte');
    ok(dialogs.length === 0, 'aucun script exécuté');
    await ctx.close();
  }
  // Valeur qui tente de changer l'hôte
  {
    const { ctx, links } = await open(q({ first_name: '@autre.test/x', lien: 'https://exemple.test/suite' }));
    const l = await links();
    ok(new URL(l[0][1]).host === 'exemple.test', `l’hôte du lien ne change pas (${l[0][1]})`);
    await ctx.close();
  }
  // Adresse faite d'une seule variable : http, https ou mailto seulement
  for (const [value, kept] of [
    ['mailto:contact@exemple.test', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['//autre.test/x', false],
  ]) {
    const { ctx, p, links, dialogs } = await open(q({ first_name: 'Camille', lien: value }));
    const l = await links();
    const suite = l.find((x) => x[0] === 'Suite');
    ok(
      kept ? suite && suite[1] === value : !suite && /Suite/.test(await p.locator('.p-rich').innerText()),
      `adresse « ${value.slice(0, 24)} » : ${kept ? 'gardée' : 'retirée, le libellé reste en texte'}`,
    );
    ok(dialogs.length === 0, `« ${value.slice(0, 12)}… » : aucun script exécuté`);
    await ctx.close();
  }
  // Bouton d'action : la valeur est encodée, l'adresse ouverte reste sur l'hôte prévu
  {
    const { ctx, p } = await open(q({ first_name: 'a&b=c #d', lien: 'https://exemple.test/suite' }));
    // Adresse fictive servie par le test (rien ne sort vers le réseau)
    await ctx.route('https://exemple.test/**', (r) => r.fulfill({ contentType: 'text/html', body: 'ok' }));
    const [popup] = await Promise.all([
      ctx.waitForEvent('page'),
      p.getByRole('button', { name: 'Ouvrir' }).click(),
    ]);
    await popup.waitForURL(/^https:\/\/exemple\.test\//);
    const u = new URL(popup.url());
    ok(
      u.host === 'exemple.test' &&
        u.searchParams.get('n') === 'a&b=c #d' &&
        [...u.searchParams.keys()].join() === 'n',
      `bouton d’action : valeur encodée (${u.href})`,
    );
    await ctx.close();
  }
  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})();
