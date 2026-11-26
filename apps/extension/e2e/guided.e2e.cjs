/**
 * L26-04 : capture guidée d'une démo créée depuis un modèle. La popup propose « Compléter : … », la
 * barre affiche « Étape à capturer : titre (n / N) », et l'envoi remplit les étapes « À capturer »
 * (sans créer de démo). Données fictives, faux Supabase (mock-supabase.cjs).
 * Usage : comme capture.e2e.cjs, puis node e2e/guided.e2e.cjs
 */
const { chromium } = require('playwright');
// L'éditeur s'ouvre après l'envoi sur le faux serveur : construction vérifiée avant tout
require('./build-app-url.cjs')();
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
  // Comme dans le vrai popup, l'onglet actif est la page à capturer (sinon la destination est masquée)
  await page.bringToFront();
  await popup.reload();
  await popup.waitForSelector('#dest-row:not([hidden])');
  // L60 §1 : la démo à compléter se choisit dans la destination (« Changer »)
  // Recette UX lot E : plus de liste « Démo » dans « Nouvelle démo » ; la démo à compléter est en tête de
  // « Ajouter à une démo », avec la pastille « n étapes à capturer »
  await popup.click('#dest-change');
  await popup.click('#dest-kind [data-value="new"]');
  const newTab = {
    lists: await popup.locator('#dest [role="listbox"]:visible, #dest button#fill').count(),
    texts: await popup.locator('#dest').innerText(),
  };
  await popup.click('#dest-kind [data-value="append"]');
  const first = popup.locator('#demos [role="option"]').first();
  await first.waitFor();
  const firstRow = {
    id: await first.getAttribute('data-demo'),
    text: (await first.innerText()).replace(/\s+/g, ' '),
    todo: await first.locator('.todo').innerText(),
  };
  await first.click();
  const help = await popup.locator('#demos-h').innerText();
  // La vidéo crée toujours une nouvelle démo : sa ligne reste visible, grisée, avec la raison
  await popup.click('#dest-back');
  const video = popup.locator('.mode[data-mode="video"]');
  const videoRow = { off: await video.getAttribute('aria-disabled'), text: await video.innerText() };
  const destLine = await popup.locator('#dest-text').innerText();
  const noTitle = (await popup.locator('#title').count()) === 0;
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
  const badge1 = await page.locator('[data-fd-ui] .chips').textContent();
  // Une seule puce, coupée au-delà de 200 px (recette l60-lot-d)
  const chipCss = await page
    .locator('[data-fd-ui] .chips')
    .evaluate((c) => [getComputedStyle(c).maxWidth, getComputedStyle(c).textOverflow].join(' '));
  if (process.env.SHOTS_DIR)
    await page.screenshot({ path: `${process.env.SHOTS_DIR}/l26-04-extension-barre.png` });
  await page.click('#go');
  await page.waitForTimeout(2500);
  const badge2 = await page.locator('[data-fd-ui] .chips').textContent();
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
    newTab.lists === 0 && !/Démo\s*\n\s*Nouvelle démo|Compléter/.test(newTab.texts),
    'popup : l’onglet « Nouvelle démo » n’a pas de liste « Démo »',
  );
  ok(
    firstRow.id === '33333333-3333-3333-3333-333333333333' &&
      /Prise en main/.test(firstRow.text) &&
      sp(firstRow.todo) === '2 étapes à capturer',
    `popup : démo à compléter en tête de « Ajouter à une démo », pastille « 2 étapes à capturer » (${firstRow.text})`,
  );
  ok(
    sp(help) === 'Chaque clic remplit l’étape « À capturer » suivante.',
    `popup : aide de la démo à compléter (« ${help} »)`,
  );
  ok(
    videoRow.off === 'true' && /Vidéo : nouvelle démo seulement/.test(sp(videoRow.text)),
    `popup : Vidéo grisée avec la raison quand la destination est une démo existante (${sp(videoRow.text)})`,
  );
  ok(
    destLine === 'Dans Acme · Prise en main' && noTitle,
    `popup : destination « ${destLine} », pas de titre à saisir`,
  );
  ok(/Étape à capturer : Se connecter \(1 \/ 2\)/.test(sp(badge1)), `barre : 1 / 2 (${badge1})`);
  ok(chipCss === '200px ellipsis', `puce unique, 200 px au plus, « … » (${chipCss})`);
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
