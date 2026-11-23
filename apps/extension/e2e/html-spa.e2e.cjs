/**
 * A8 : capture HTML d'une application à page unique (routeur côté client, sans rechargement), riche en
 * scripts. Chaque changement d'adresse qui suit un clic est capturé tout seul, une fois l'affichage
 * stabilisé ; le dernier clic avant la page suivante devient le lien proposé ; le Sandbox se remplit.
 * Site fictif de mock-supabase.cjs (/spa). Usage : comme html.e2e.cjs.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WS = '11111111-1111-1111-1111-111111111111';
(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const start = (await (await fetch('http://localhost:54400/__log')).json()).length;
  const getLog = async () => (await (await fetch('http://localhost:54400/__log')).json()).slice(start);
  await fetch('http://localhost:54400/__html-capture', {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const results = [];
  const ok = (cond, label) => results.push([!!cond, label]);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto('http://localhost:54400/spa');
  await page.getByRole('heading', { name: 'Accueil' }).waitFor();
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('#login button[type=submit]');
  await popup.waitForSelector('#setup:not([hidden])');
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: 'Appli fictive',
        tabId: a.tabId,
        mode: 'html',
      }),
    { tabId, WS },
  );
  await page.bringToFront();
  const steps = () =>
    popup.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'fd:status' })).steps);
  // Attente sur l'état réel : le compteur du service est relu jusqu'à la valeur attendue (20 s au plus)
  const waitSteps = async (n) => {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if ((await steps()) >= n) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  };
  const count = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('[data-fd-ui]')]
          .find((e) => e.shadowRoot)
          ?.shadowRoot.querySelector('.n')?.textContent,
    );
  const dump = async (tag) =>
    process.env.DEBUG &&
    console.log(
      '#',
      tag,
      JSON.stringify(
        await popup.evaluate(
          () =>
            new Promise((res) => {
              const r = indexedDB.open('fd-html', 1);
              r.onsuccess = () => {
                const g = r.result.transaction('pages').objectStore('pages').getAll();
                g.onsuccess = () => res(g.result.map((p) => [p.order, p.url, p.clickLabel]));
              };
            }),
        ),
      ),
      await steps(),
    );
  ok(await waitSteps(1), 'page de départ capturée au démarrage');
  await dump('depart');

  // 1. Lien du menu : l'adresse change sans rechargement
  await page.getByRole('link', { name: 'Clients' }).click();
  await page.getByRole('heading', { name: 'Clients' }).waitFor();
  ok(await waitSteps(2), 'changement d’adresse sans rechargement : page capturée toute seule');
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-fd-ui]')].find((e) => e.shadowRoot)?.shadowRoot.querySelector('.n')
        ?.textContent === '2 pages',
  );
  await dump('clients');
  ok((await count()) === '2 pages', 'la barre compte 2 pages');
  ok(
    await page.evaluate(() => !!document.querySelector('[data-fd-ui]')),
    'la barre reste en place (pas de rechargement)',
  );

  // 2. Menu déroulant : son ouverture ne capture rien, l'entrée choisie navigue
  await page.getByRole('button', { name: 'Plus' }).click();
  await page.getByRole('link', { name: 'Rapports' }).waitFor();
  ok((await steps()) === 2, 'ouvrir un menu ne capture pas de page');
  await page.getByRole('link', { name: 'Rapports' }).click();
  await page.getByRole('heading', { name: 'Rapports' }).waitFor();
  ok(await waitSteps(3), 'entrée du menu : page capturée');
  await dump('rapports');

  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/html-review.html'));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await review.waitForSelector('#pages li');
  const pages = await review.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('fd-html', 1);
        r.onsuccess = () => {
          const g = r.result.transaction('pages').objectStore('pages').getAll();
          g.onsuccess = () => res(g.result);
        };
      }),
  );
  if (process.env.DEBUG)
    console.log('#', JSON.stringify(pages.map((p) => [p.order, p.url, p.clickLabel, p.title])));
  ok(
    pages.length === 3 &&
      /\/spa$/.test(pages[0].url) &&
      /\/spa\/clients$/.test(pages[1].url) &&
      /\/spa\/rapports$/.test(pages[2].url),
    `3 pages, une par adresse (${pages.map((p) => new URL(p.url).pathname).join(', ')})`,
  );
  ok(
    /<h1>Clients<\/h1>/.test(pages[1]?.html ?? '') &&
      !/Chargement/.test(pages[1]?.html ?? '') &&
      /<h1>Rapports<\/h1>/.test(pages[2]?.html ?? ''),
    'chaque page est copiée une fois son contenu affiché (pas l’état « Chargement »)',
  );
  ok(pages[0]?.clickLabel === 'Clients', `lien proposé de la page 1 : « ${pages[0]?.clickLabel} »`);
  ok(
    pages[1]?.clickLabel === 'Rapports',
    `lien proposé de la page 2 : le dernier clic, pas l’ouverture du menu (« ${pages[1]?.clickLabel} »)`,
  );
  ok(
    pages.every((p) => !/<script|<iframe/i.test(p.html)),
    'pages inertes : ni script ni cadre dans la copie',
  );
  ok(
    pages.every((p) => p.security.scripts >= 26 && p.security.frames === 1),
    `rapport : scripts et cadre comptés (${pages[0]?.security.scripts} scripts, ${pages[0]?.security.frames} cadre)`,
  );

  // Envoi en Sandbox : les pages sont reliées dans l'ordre des clics
  await review.click('input[value=sandbox]');
  await review.click('#send');
  await review.waitForURL(/22222222/, { timeout: 15000 }).catch(() => undefined);
  const log = await getLog();
  const sent = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps'))
    .map((l) => JSON.parse(l.body));
  ok(sent.length === 3 && sent.every((s) => s.kind === 'html'), 'Sandbox : 3 pages créées');
  const link = (i) => sent[i]?.html_ops?.find((o) => o.op === 'link');
  ok(
    link(0)?.value === sent[1]?.id && link(1)?.value === sent[2]?.id,
    'Sandbox : page 1 reliée à la page 2, page 2 reliée à la page 3',
  );
  await ctx.close();
  for (const [c, l] of results) console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (results.some(([c]) => !c)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
