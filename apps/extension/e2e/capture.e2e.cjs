/**
 * Test de bout en bout de l'extension contre un faux Supabase (mock-supabase.cjs).
 * Usage :
 *   node e2e/mock-supabase.cjs &
 *   WXT_SUPABASE_URL=http://localhost:54400 WXT_SUPABASE_ANON_KEY=anon pnpm build
 *   node e2e/capture.e2e.cjs
 * Nécessite Playwright et Chromium (préinstallés dans l'environnement de dev).
 */
const { chromium } = require('playwright');
(async () => {
  const path = require('path');
  const os = require('os');
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const ctx = await chromium.launchPersistentContext(
    require('fs').mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')),
    {
      headless: true,
      channel: 'chromium',
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    },
  );
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto('http://localhost:54400/page');
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('#login button[type=submit]');
  await popup.waitForSelector('#setup:not([hidden])');
  const wsOpts = await popup.$$eval('#workspace option', (o) => o.map((x) => x.textContent));
  // Démarrage via message (le popup ouvert dans un onglet n'a pas l'onglet test comme onglet actif)
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  const st = await popup.evaluate(
    async (tabId) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: '11111111-1111-1111-1111-111111111111',
        title: 'Test',
        tabId,
      }),
    tabId,
  );
  await page.bringToFront();
  await page.waitForTimeout(800);
  const badge = await page.$('[data-fd-ui]');
  await page.click('#go');
  await page.waitForTimeout(2500);
  const status = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  // Pause : un clic pendant la pause ne crée pas d'étape
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:pause' }));
  await page.bringToFront();
  await page.click('#go');
  await page.waitForTimeout(1500);
  const paused = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  await popup.bringToFront();
  await popup.reload();
  await popup.waitForSelector('#recording:not([hidden])');
  if (process.env.SHOTS_DIR) await popup.screenshot({ path: `${process.env.SHOTS_DIR}/popup-recording.png` });
  const pauseLabel = await popup.textContent('#pause');
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:cancel' }));
  const cancelled = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const log = await (await fetch('http://localhost:54400/__log')).json();
  await ctx.close();
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  ok(wsOpts.includes('Acme'), 'le popup liste les workspaces');
  ok(st.recording && st.demoId, "l'enregistrement démarre et crée la démo");
  ok(badge, 'le badge REC est injecté dans la page');
  ok(status.steps === 1 && !status.lastError, 'un clic crée une étape');
  ok(
    log.some((l) => l.u.startsWith('/storage/v1/object/captures/') && l.len > 1000),
    'la capture WebP est téléversée',
  );
  const step = log.find((l) => l.u.startsWith('/rest/v1/steps'));
  ok(step && JSON.parse(step.body).blurs.length === 1, 'le champ mot de passe est flouté');
  ok(
    log.some((l) => l.u.startsWith('/rest/v1/hotspots') && l.body.includes('Créer un projet')),
    'le hotspot porte le libellé du bouton',
  );
  ok(paused.paused && paused.steps === 1, 'la pause suspend la capture');
  ok(/Reprendre|Resume/.test(pauseLabel), 'bouton Reprendre affiché pendant la pause');
  ok(
    !cancelled.recording && log.some((l) => l.m === 'DELETE' && l.u.startsWith('/rest/v1/demos')),
    'annuler supprime la démo créée',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
