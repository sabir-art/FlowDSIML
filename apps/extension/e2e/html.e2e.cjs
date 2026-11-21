/**
 * A8 : capture HTML de bout en bout (faux Supabase, mock-supabase.cjs). Usage : comme
 * capture.e2e.cjs, puis node e2e/html.e2e.cjs. SHOTS_DIR pour les captures.
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
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const sfx = process.env.THEME === 'dark' ? '-sombre' : '';
  const shot = (p, name, fullPage = false) =>
    process.env.SHOTS_DIR && p.screenshot({ path: `${process.env.SHOTS_DIR}/${name}${sfx}.png`, fullPage });
  const results = [];
  const ok = (cond, label) => results.push([!!cond, label]);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto('http://localhost:54400/page');
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 340, height: 900 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('#login button[type=submit]');
  await popup.waitForSelector('#setup:not([hidden])');
  await popup.click('.type-card:has(input[value=html])');
  ok((await popup.$$('.type-card')).length === 4, 'quatrième carte « Capture HTML »');
  ok(await popup.isVisible('#opt-html'), 'aide de la capture HTML');
  ok(/HTML/.test(await popup.textContent('#start')), 'bouton « Démarrer la capture HTML »');
  await shot(popup, 'l20-00-popup-html');

  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: 'HTML',
        tabId: a.tabId,
        mode: 'html',
      }),
    { tabId, WS },
  );
  await page.bringToFront();
  const status = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const waitSteps = async (n) => {
    for (let i = 0; i < 40; i++) {
      if ((await status()).steps >= n) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  ok(await waitSteps(1), 'page de départ capturée au démarrage');
  const bar = await page.evaluate(() => {
    const host = [...document.querySelectorAll('[data-fd-ui]')].find((e) => e.shadowRoot);
    return {
      label: host?.shadowRoot.querySelector('[role=toolbar]')?.getAttribute('aria-label'),
      n: host?.shadowRoot.querySelector('.n')?.textContent,
    };
  });
  ok(bar.label === 'Capture HTML en cours' && bar.n === '1 page', `barre de capture HTML (${bar.n})`);
  await page.click('a[href="/page2"]');
  await page.waitForURL(/page2/);
  ok(await waitSteps(2), 'page suivante capturée après le clic');
  // Application à page unique : « Capturer cette page »
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const host = [...document.querySelectorAll('[data-fd-ui]')].find((e) => e.shadowRoot);
    host.shadowRoot.querySelector('.cap').click();
  });
  ok(await waitSteps(3), '« Capturer cette page »');
  await shot(page, 'l20-00-barre-html');
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/html-review.html'));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await review.setViewportSize({ width: 1280, height: 900 });
  review.on('pageerror', (e) => console.log('# pageerror', e.message));
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
  ok(pages.length === 3, '3 pages gardées localement');
  ok(
    pages[0].clickSel && /Suivant/.test(pages[0].clickLabel ?? ''),
    `clic vers la page suivante noté (${pages[0].clickLabel})`,
  );
  const p2 = pages[1].html;
  if (process.env.DEBUG)
    console.log(
      '# p2',
      pages.map((p) => p.url),
      p2.slice(0, 1500),
      JSON.stringify(pages[1].links),
    );
  ok(!/<script|onclick|window\.__x/i.test(p2), 'aucun script ni gestionnaire');
  ok(!/secret|recherche/.test(p2), 'champs vidés (mot de passe, saisie)');
  ok(!/Camille|MARTIN|06 12 34/.test(p2) && /Xxxxxxx XXXXXX/.test(p2), 'données remplacées dans la source');
  ok(/data-fd-blurred/.test(p2) && /blur\(6px\)/.test(p2), 'données floutées');
  ok(/rgb\(163, 25, 91\)/i.test(p2), 'feuille de style externe intégrée');
  ok(/<img[^>]+src="data:image\/webp/.test(p2), 'image intégrée en WebP');
  ok(!/<link/i.test(p2), 'aucun chargement externe');
  ok(
    pages[1].links.some((l) => l.sel === '#menu > a:nth-of-type(1)' && /\/page$/.test(l.href)),
    'liens repérés avec sélecteur stable',
  );
  ok(
    await review.$$eval('#pages iframe', (f) => f.every((x) => x.getAttribute('sandbox') === '' && x.title)),
    'aperçus en iframe sandbox vide, nommés',
  );
  ok(
    /Xxxxxxx/.test(
      (await review.frameLocator('#pages li:nth-child(2) iframe').locator('body').textContent()) ?? '',
    ),
    'aperçu fidèle',
  );
  await shot(review, 'l20-00-verification', true);
  await review.click('input[value=sandbox]');
  await review.click('#send');
  await review
    .waitForURL(/22222222/, { timeout: 15000 })
    .catch(async () => console.log('# envoi :', await review.textContent('#alert')));
  ok(
    /22222222-2222-2222-2222-222222222222(\/|%2F)edit/.test(review.url()),
    'après envoi : ouverture de l’éditeur',
  );
  const log = await getLog();
  const ing = log.filter((l) => l.u.startsWith('/functions/v1/html-ingest'));
  ok(
    ing.length === 3 && ing.every((l) => JSON.parse(l.body).workspaceId === WS),
    'pages envoyées à html-ingest',
  );
  // L49 §3 : compteurs de la page d'origine envoyés avec chaque page (le serveur recompte de son côté)
  const KEYS = ['scripts', 'handlers', 'frames', 'forms', 'externalLinks', 'piiReplaced', 'other'];
  ok(
    ing.every((l) => {
      const sec = JSON.parse(l.body).security;
      return sec && KEYS.every((k) => Number.isInteger(sec[k]) && sec[k] >= 0);
    }),
    'L49 : compteurs du rapport envoyés avec chaque page',
  );
  const demo = JSON.parse(log.find((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos')).body);
  ok(
    demo.kind === 'sandbox' && demo.sandbox?.autoLink === true && demo.sandbox.unlinked === 'toast',
    'démo Sandbox (liaison automatique, message par défaut)',
  );
  const steps = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps'))
    .map((l) => JSON.parse(l.body));
  ok(
    steps.length === 3 && steps.every((s) => s.kind === 'html' && /\.html$/.test(s.html_path)),
    'étapes HTML créées',
  );
  ok(
    steps[0]?.html_ops[0]?.op === 'link' && steps[0].html_ops[0].value === steps[1]?.id,
    'lien proposé vers l’étape suivante',
  );
  ok(demo.sandbox?.start === steps[0]?.id, 'page de départ');
  ok(!log.some((l) => /secret|Camille|06 12 34/.test(l.html ?? '')), 'aucune donnée réelle envoyée');
  await ctx.close();
  for (const [c, l] of results) console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (results.some(([c]) => !c)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
