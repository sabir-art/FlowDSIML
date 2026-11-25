/**
 * L60, lot A : la détection de données personnelles en mode CAPTURES D'ÉCRAN, sur le banc. Un clic sur
 * un bouton de la fiche « /donnees » crée une étape ; ses zones à flouter doivent couvrir le nom et
 * l'adresse e-mail (fictifs), jamais le bouton ni le lien (faux positif corrigé : une phrase cachée
 * « Indiquez votre nom. » faisait du bouton suivant une « valeur de nom »).
 * Prérequis : node e2e/mock-supabase.cjs, node e2e/banc/serveur.cjs, build WXT_E2E=1.
 * Usage : node e2e/banc/etat-captures.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const BANC = 'http://localhost:54410';
const ext = path.resolve(__dirname, '../../.output/chrome-mv3');

(async () => {
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-banc-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto(`${BANC}/donnees`);
  await page.getByRole('heading', { name: 'Fiche contact' }).waitFor();
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  const tabId = await popup.evaluate(async (u) => (await chrome.tabs.query({ url: u + '/*' }))[0].id, BANC);
  await popup.evaluate(
    (tabId) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: '11111111-1111-1111-1111-111111111111',
        title: 'Banc, captures',
        tabId,
      }),
    tabId,
  );
  await page.bringToFront();
  await page.locator('[data-fd-ui]').first().waitFor({ state: 'attached' });
  // Rectangles des éléments de la page, pour situer les zones repérées
  const boxes = await page.evaluate(() => {
    const r = (sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return {
        x: b.left / innerWidth,
        y: b.top / innerHeight,
        w: b.width / innerWidth,
        h: b.height / innerHeight,
      };
    };
    return { nom: r('#v-nom'), mail: r('#v-mail'), bouton: r('button.btn'), lien: r('main a') };
  });
  await page.getByRole('button', { name: 'Modifier la fiche' }).click();
  const steps = () =>
    popup.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'fd:status' })).steps);
  const fin = Date.now() + 15000;
  while (Date.now() < fin && (await steps()) < 1) await new Promise((r) => setTimeout(r, 200));
  ok((await steps()) >= 1, 'un clic sur le bouton crée une étape');
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'), { timeout: 20000 });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await review.waitForLoadState('domcontentloaded');
  const captures = await review.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('fd-pending', 1);
        r.onsuccess = () => {
          const g = r.result.transaction('captures').objectStore('captures').getAll();
          g.onsuccess = () => res(g.result.map(({ image, full, ...c }) => c));
        };
      }),
  );
  const zones = (captures[0]?.detections ?? captures[0]?.zones ?? []).map((d) => ({
    type: d.type,
    rect: d.rect,
  }));
  const touche = (z, b) =>
    z.rect.x < b.x + b.w && z.rect.x + z.rect.w > b.x && z.rect.y < b.y + b.h && z.rect.y + z.rect.h > b.y;
  if (process.env.DEBUG)
    console.log('#', JSON.stringify({ zones, boxes, cles: Object.keys(captures[0] ?? {}) }));
  ok(
    zones.some((z) => touche(z, boxes.nom)) && zones.some((z) => touche(z, boxes.mail)),
    `le nom et l’adresse e-mail fictifs sont repérés (${zones.map((z) => z.type).join(', ')})`,
  );
  ok(
    !zones.some((z) => touche(z, boxes.bouton)) && !zones.some((z) => touche(z, boxes.lien)),
    'ni le bouton « Modifier la fiche » ni le lien ne sont repérés : aucun flou à tort',
  );
  await ctx.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
