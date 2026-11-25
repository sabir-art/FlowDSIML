/**
 * L26-04 : capture guidée d'une démo créée depuis un modèle. La popup propose « Compléter : … », la
 * barre affiche « Étape à capturer : titre (n / N) », et l'envoi remplit les étapes « À capturer »
 * (sans créer de démo). Données fictives, faux Supabase (mock-supabase.cjs).
 * Usage : comme capture.e2e.cjs, puis node e2e/guided.e2e.cjs
 */
const { chromium } = require('playwright');
const ui = require('./popup-ui.cjs');
(async () => {
  const path = require('path');
  const os = require('os');
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const ctx = await chromium.launchPersistentContext(
    require('fs').mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')),
    {
      headless: true,
      locale: 'fr-FR',
      channel: 'chromium',
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    },
  );
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  // Journal du faux serveur partagé avec les autres suites : seules les requêtes de ce test comptent
  const from = (await (await fetch('http://localhost:54400/__log')).json()).length;
  const page = await ctx.newPage();
  await page.goto('http://localhost:54400/crm');
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  await popup.waitForSelector('#fill-field:not([hidden])');
  const fillOpts = (await ui.options(popup, 'fill')).map((o) => o.label);
  await ui.pick(popup, 'fill', '33333333-3333-3333-3333-333333333333');
  const titleHidden = await popup.$eval('#title-field', (e) => e.hidden);
  if (process.env.SHOTS_DIR)
    await popup.screenshot({ path: `${process.env.SHOTS_DIR}/l26-04-extension-popup.png` });
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  const fill = {
    demoId: '33333333-3333-3333-3333-333333333333',
    title: 'Prise en main',
    steps: [
      { id: 's-a', title: 'Se connecter' },
      { id: 's-b', title: 'Repérer le menu' },
    ],
  };
  await popup.evaluate(
    async ([tabId, fill]) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: '11111111-1111-1111-1111-111111111111',
        title: '',
        tabId,
        fill,
      }),
    [tabId, fill],
  );
  await page.bringToFront();
  await page.waitForTimeout(900);
  const badge1 = await page.locator('[data-fd-ui] .count').textContent();
  if (process.env.SHOTS_DIR)
    await page.screenshot({ path: `${process.env.SHOTS_DIR}/l26-04-extension-barre.png` });
  await page.click('#go');
  await page.waitForTimeout(2500);
  const badge2 = await page.locator('[data-fd-ui] .count').textContent();
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await review.waitForSelector('#state.is-done');
  await review.click('#send');
  await review.waitForURL(/33333333-3333-3333-3333-333333333333/, { timeout: 15000 }).catch(() => {});
  const finalUrl = review.url();
  const log = (await (await fetch('http://localhost:54400/__log')).json()).slice(from);
  await ctx.close();
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const sp = (s) => (s || '').replace(/[  ]/g, ' ');
  ok(
    fillOpts.some((o) => /Compléter : Prise en main \(2 à capturer\)/.test(sp(o))),
    'popup : « Compléter : … »',
  );
  ok(titleHidden, 'popup : pas de titre à saisir quand on complète une démo');
  ok(/Étape à capturer : Se connecter \(1 \/ 2\)/.test(sp(badge1)), `barre : 1 / 2 (${badge1})`);
  ok(
    /Étape à capturer : Repérer le menu \(2 \/ 2\)/.test(sp(badge2)),
    `barre : 2 / 2 après un clic (${badge2})`,
  );
  ok(!log.some((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos')), 'aucune nouvelle démo');
  const patch = log.find((l) => l.m === 'PATCH' && l.u.startsWith('/rest/v1/steps') && l.u.includes('s-a'));
  const body = patch ? JSON.parse(patch.body) : {};
  ok(
    body.to_capture === false && /^1111.*\/s-a-/.test(body.image_path || ''),
    'étape « À capturer » remplie',
  );
  ok(!('title' in body), 'titre du modèle gardé');
  ok(
    log.some((l) => l.m === 'PATCH' && l.u.startsWith('/rest/v1/hotspots') && l.u.includes('h-1')),
    'bulle replacée',
  );
  ok(finalUrl.includes('33333333'), 'retour à la démo complétée');
})();
