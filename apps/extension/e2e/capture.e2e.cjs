/**
 * Test de bout en bout de l'extension contre un faux Supabase (mock-supabase.cjs).
 * Usage :
 *   node e2e/mock-supabase.cjs &
 *   WXT_E2E=1 WXT_SUPABASE_URL=http://localhost:54400 WXT_SUPABASE_ANON_KEY=anon pnpm build
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
      locale: 'fr-FR',
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
  const logDuring = await (await fetch('http://localhost:54400/__log')).json();
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

  // Fin : l'écran de vérification s'ouvre, rien n'est encore envoyé
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await review.setViewportSize({ width: 1440, height: 900 });
  review.on('console', (m) => process.env.DEBUG && console.log('# console', m.type(), m.text()));
  review.on('pageerror', (e) => console.log('# pageerror', e.message));
  await review.waitForSelector('#state.is-done');
  await review.waitForSelector('.rv-row');
  const types = await review.$$eval('.rv-row', (els) => els.map((e) => e.dataset.type));
  const excerpts = await review.$$eval('.rv-row__excerpt', (els) => els.map((e) => e.textContent).join(' '));
  if (process.env.SHOTS_DIR)
    await review.screenshot({ path: `${process.env.SHOTS_DIR}/f1-verification-flous.png` });
  // Faux positif : décocher le nom en colonne (un par un)
  const first = review.locator('.rv-row[data-type="address"] .rv-switch').first();
  await first.click();
  const unticked = await first.getAttribute('aria-checked');
  const warn = await review.textContent('#warning');
  if (process.env.SHOTS_DIR)
    await review.screenshot({ path: `${process.env.SHOTS_DIR}/f1-verification-decoche.png` });
  const logBeforeSend = await (await fetch('http://localhost:54400/__log')).json();
  await review.click('#send');
  await review.waitForURL(/22222222-2222-2222-2222-222222222222/, { timeout: 15000 }).catch(() => {});
  const finalUrl = review.url();
  if (!finalUrl.includes('22222222'))
    console.log('# erreur d’envoi :', finalUrl, await review.textContent('#error').catch(() => '?'));

  // Seconde capture puis annulation : rien n'est envoyé, le tampon local est vidé
  await popup.evaluate(
    async (tabId) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: '11111111-1111-1111-1111-111111111111',
        title: 'B',
        tabId,
      }),
    tabId,
  );
  await page.bringToFront();
  await page.waitForTimeout(800);
  await page.click('#go');
  await page.waitForTimeout(2000);
  const nUploadsBefore = (await (await fetch('http://localhost:54400/__log')).json()).filter((l) =>
    l.u.startsWith('/storage/v1/object/captures/'),
  ).length;
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:cancel' }));
  const cancelled = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const log = await (await fetch('http://localhost:54400/__log')).json();
  await ctx.close();
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  ok(wsOpts.includes('Acme'), 'le popup liste les workspaces');
  ok(st.recording && !st.demoId, "l'enregistrement démarre sans rien créer côté serveur");
  ok(badge, 'le badge REC est injecté dans la page');
  ok(status.steps === 1 && !status.lastError, 'un clic crée une capture locale');
  ok(
    !logDuring.some(
      (l) =>
        l.u.startsWith('/storage/') ||
        (l.m !== 'GET' && l.u.startsWith('/rest/v1/steps')) ||
        (l.m === 'POST' && l.u.startsWith('/rest/v1/demos')),
    ),
    'rien n’est envoyé pendant la capture',
  );
  ok(paused.paused && paused.steps === 1, 'la pause suspend la capture');
  ok(/Reprendre|Resume/.test(pauseLabel), 'bouton Reprendre affiché pendant la pause');
  for (const t of ['name', 'phone', 'email', 'nir', 'birthdate', 'address', 'zone'])
    ok(types.includes(t), `détection : ${t}`);
  ok(types.filter((t) => t === 'birthdate').length === 1, 'un rendez-vous n’est pas une date de naissance');
  ok(
    types.filter((t) => t === 'phone').length === 1 && types.filter((t) => t === 'nir').length === 1,
    'pas de doublon par libellé voisin',
  );
  ok(!/06 12|camille\.martin|DURAND|123 456/.test(excerpts), 'extraits masqués, jamais en clair');
  ok(
    unticked === 'false' && /ne sera pas floutée|ne seront pas floutées|will not be blurred/.test(warn),
    'faux positif décoché avec avertissement',
  );
  ok(
    !logBeforeSend.some((l) => l.u.startsWith('/storage/')),
    'rien n’est envoyé avant « Flouter et envoyer »',
  );
  ok(
    /demos(\/|%2F)22222222-2222-2222-2222-222222222222(\/|%2F)edit/.test(finalUrl),
    'après envoi : ouverture de l’éditeur',
  );
  ok(
    log.some((l) => l.u.startsWith('/storage/v1/object/captures/') && l.len > 1000),
    'la capture floutée (WebP) est téléversée',
  );
  const step = log.find((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps'));
  const meta = step && JSON.parse(step.body).element_meta;
  ok(
    meta &&
      meta.pii.length >= 7 &&
      meta.pii
        .filter((p) => !p.blurred)
        .map((p) => p.type)
        .join() === 'address',
    'métadonnées : type, boîte et état de flou',
  );
  ok(
    meta && meta.pii.every((p) => Object.keys(p).sort().join() === 'blurred,manual,rect,type'),
    'métadonnées sans texte ni extrait',
  );
  const bodies = log.map((l) => l.body ?? '').join(' ');
  ok(
    !/06 12 34|camille\.martin@|DURAND|04 07 75|14\/02\/2007|Lilas/.test(bodies),
    'aucune valeur détectée dans le réseau',
  );
  ok(
    log.some((l) => l.u.startsWith('/rest/v1/hotspots') && l.body.includes('Créer un projet')),
    'le hotspot porte le libellé du bouton',
  );
  ok(
    !cancelled.recording &&
      log.filter((l) => l.u.startsWith('/storage/v1/object/captures/')).length === nUploadsBefore,
    'annuler efface les captures locales sans rien envoyer',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
