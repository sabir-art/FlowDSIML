/**
 * L25-01 : capture multi-onglets, taille de l'onglet et capture pleine page (faux Supabase).
 * Usage : node e2e/mock-supabase.cjs & ; build avec WXT_SUPABASE_URL=http://localhost:54400 ;
 * SHOTS_DIR=… node e2e/tabs.e2e.cjs (captures de la popup en clair et en sombre).
 */
const { chromium } = require('playwright');
const ui = require('./popup-ui.cjs');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MOCK = 'http://localhost:54400';
const WS = '11111111-1111-1111-1111-111111111111';
const SHOTS = process.env.SHOTS_DIR;
const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const log = async () => (await fetch(`${MOCK}/__log`)).json();

(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-tabs-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 1512, height: 862 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto(`${MOCK}/tabs`);
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 300, height: 860 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');

  // ===== Popup (L25-01, L60 §1 : réglages de capture) =====
  const cards = (await ui.modes(popup)).map((o) => o.name);
  ok(cards[1] === 'HTML', 'la capture HTML est le 2e mode');
  await ui.openPrefs(popup);
  ok(!(await ui.isOn(popup, 'follow')), '« Suivre les nouveaux onglets » désactivé par défaut');
  ok(
    (await popup.locator('.ppf .ok').innerText()).trim() === 'Données vérifiées',
    'vérification des données toujours active (pied du popup)',
  );
  ok(
    /^Mobile.: captures d’écran seulement\.$/.test(await popup.textContent('#size-h')),
    'aide de la taille de l’onglet',
  );
  ok(
    (await popup.textContent('#follow-h')) === 'Captures et HTML.' &&
      /^Vidéo\./.test(await popup.textContent('#mic-h')),
    'chaque réglage dit le mode auquel il s’applique',
  );
  for (const theme of ['light', 'dark']) {
    await popup.emulateMedia({ colorScheme: theme });
    const sfx = theme === 'dark' ? '-sombre' : '';
    await ui.setSwitch(popup, 'follow', true);
    await popup.locator('#size [data-value=current]').click();
    if (SHOTS) await popup.screenshot({ path: `${SHOTS}/l25-01-suivi${sfx}.png`, fullPage: true });
    await ui.setSwitch(popup, 'follow', false);
    await popup.locator('#size [data-value="1440x900"]').click();
    if (SHOTS) await popup.screenshot({ path: `${SHOTS}/l25-01-taille${sfx}.png`, fullPage: true });
  }
  ok(
    (await popup.evaluate(() => chrome.storage.local.get('fd.tabSize')))['fd.tabSize'] === '1440x900',
    'taille 1440 mémorisée',
  );
  await popup.locator('#size [data-value=current]').click();
  await popup.emulateMedia({ colorScheme: 'light' });

  // ===== Capture : taille imposée, onglet suivi, onglet ouvert à la main ignoré =====
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/tabs*' }))[0].id,
  );
  await popup.evaluate(
    async ({ tabId, WS }) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: WS,
        title: 'Rapports',
        tabId,
        mode: 'clicks',
        followTabs: true,
        size: { w: 1280, h: 720 },
      }),
    { tabId, WS },
  );
  await page.bringToFront();
  await page.waitForTimeout(1200);
  const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  ok(vp.w === 1280 && vp.h === 720, `onglet redimensionné le temps de la capture (${vp.w} × ${vp.h})`);
  await page.click('#new');
  await page.waitForTimeout(1500);
  // Lien qui ouvre l'aide dans un nouvel onglet (ouvert PAR l'onglet capturé)
  const [aide] = await Promise.all([ctx.waitForEvent('page'), page.click('#help')]);
  await aide.waitForLoadState('load');
  await aide.bringToFront();
  await aide.waitForTimeout(1500);
  const chip = await aide.locator('[data-fd-ui] .chips').textContent();
  const live = await aide.locator('[data-fd-ui] .sr').textContent();
  ok(/Onglet 2 · Aide/.test(chip), `barre : « Onglet 2 · Aide » (${chip})`);
  if (SHOTS) await aide.screenshot({ path: `${SHOTS}/l25-01-barre-onglet.png` });
  ok(/Capture dans l’onglet 2 : Aide/.test(live), 'annonce de l’onglet pour les lecteurs d’écran');
  await aide.click('#ok');
  await aide.waitForTimeout(1500);
  // Onglet ouvert à la main : jamais capturé
  // (chrome.tabs.create sans openerTabId, comme un onglet ouvert depuis la barre d'adresse)
  const [manual] = await Promise.all([
    ctx.waitForEvent('page'),
    popup.evaluate((u) => chrome.tabs.create({ url: u, active: true }), `${MOCK}/page2`),
  ]);
  await manual.waitForLoadState('load');
  await manual.waitForTimeout(800);
  ok(!(await manual.$('[data-fd-ui]')), 'onglet ouvert à la main : pas de barre');
  const status = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  ok(status.steps === 3 && !status.lastError, `trois étapes, dans deux onglets (${status.steps})`);
  ok(
    status.tabs?.length === 2 && status.tabs[1].n === 2,
    `onglets suivis : 1 et 2 (${JSON.stringify(status.tabs)})`,
  );

  // Fin : aucune donnée repérée sur ces pages, l'envoi part sans écran de vérification (L60 §3)
  const before = (await log()).length;
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  const after = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  ok(after.w !== 1280 || after.h !== 720, `taille imposée retirée à la fin (${after.w} × ${after.h})`);
  await review.waitForURL(/22222222-2222-2222-2222-222222222222/, { timeout: 15000 }).catch(() => {});
  const sent = (await log()).slice(before);
  const steps = sent.filter((l) => l.u.startsWith('/rest/v1/steps')).map((l) => JSON.parse(l.body));
  ok(steps.length === 3, 'trois étapes envoyées');
  ok(steps[0]?.image_width === 1280 && steps[0]?.image_height === 720, 'capture à la taille demandée');
  ok(
    steps[0]?.options?.tab?.n === 1 &&
      steps[2]?.options?.tab?.n === 2 &&
      steps[2]?.options?.tab?.title === 'Aide',
    'chaque étape mémorise son onglet (numéro et titre)',
  );
  const fp = steps[0]?.options?.fullPage;
  ok(
    !!fp && /-page\.webp$/.test(fp.path) && fp.height > 1800 && fp.viewportHeight === 720,
    `capture pleine page (${fp && `${fp.width} × ${fp.height}`})`,
  );
  ok(
    sent.some((l) => l.u.includes('-page.webp') && l.len > 1000),
    'la page entière floutée est téléversée',
  );
  ok(!steps[2]?.options?.fullPage, 'page courte : pas de capture pleine page');
  ok(
    !sent
      .map((l) => l.body ?? '')
      .join(' ')
      .includes('lea.martin'),
    'aucune valeur dans le réseau',
  );
  await ctx.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
