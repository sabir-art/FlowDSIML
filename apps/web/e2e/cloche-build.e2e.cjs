/**
 * Cloche sur le build de production, réseau ralenti : un clic fait pendant le chargement ouvre le
 * panneau, qui reste ouvert. Défaut vu sur le site publié (une fois sur deux), invisible en
 * développement où tout se charge d'un bloc : le bouton d'attente est remplacé par la cloche quand son
 * code arrive, puis la cloche est remontée quand la page quitte son squelette.
 * Le débit change d'un essai à l'autre, pour que le clic tombe à des moments différents du chargement.
 * Usage : APP_URL=http://localhost:5175 (vite build + vite preview) [TRIES=10] node e2e/cloche-build.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5175';
const TRIES = Number(process.env.TRIES || 10);

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  for (let i = 0; i < TRIES; i++) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, seed());
    const latency = 40 + i * 30;
    const kbps = 300 + i * 150;
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency,
      downloadThroughput: (kbps * 1024) / 8,
      uploadThroughput: (200 * 1024) / 8,
    });
    // Dès que la navigation est engagée : aucun état « prêt » n'est attendu avant le clic
    await page.goto(`${BASE}/#/`, { waitUntil: 'commit' });
    await page
      .getByRole('button', { name: /^Notifications/ })
      .first()
      .click();
    const dlg = page.getByRole('dialog', { name: 'Notifications' });
    const opened = await dlg
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForLoadState('networkidle');
    const kept = opened && (await dlg.isVisible());
    ok(
      opened && kept,
      `essai ${i + 1} (${kbps} kbit/s, ${latency} ms) : le panneau s’ouvre${opened ? '' : ' PAS'} et reste ouvert${kept ? '' : ' : NON'}`,
    );
    await ctx.close();
  }
  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
