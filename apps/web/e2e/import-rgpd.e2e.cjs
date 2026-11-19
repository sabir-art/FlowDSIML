/**
 * REV-07 : une image importée (rail des étapes) est signalée à l'import et comptée au bilan RGPD
 * (« n images importées non vérifiées »). Données fictives. Usage : node e2e/import-rgpd.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light',
  });
  await ctx.addInitScript(
    (th) => {
      try {
        localStorage.setItem('fd.theme', th);
      } catch {
        /* stockage indisponible */
      }
    },
    process.env.THEME === 'dark' ? 'dark' : 'light',
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  const before = state.tables.steps.filter((s) => s.demo_id === DEMO).length;
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 200 } });
  await page
    .locator('.rail-foot input[type=file]')
    .first()
    .setInputFiles({ name: 'ecran.png', mimeType: 'image/png', buffer: png });
  await page.getByText(/Image importée.: aucune détection automatique/).waitFor();
  ok(true, 'avertissement à l’import');
  const added = state.tables.steps.filter((s) => s.demo_id === DEMO);
  ok(added.length === before + 1 && added.some((s) => s.element_meta?.imported), 'étape importée marquée');

  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const gdpr = page.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  ok(
    /1 image importée non vérifiée/.test(sp(await gdpr.innerText())),
    'bilan RGPD : « 1 image importée non vérifiée »',
  );
  if (process.env.SHOTS_DIR)
    await page.screenshot({
      path: `${process.env.SHOTS_DIR}/rev-07-bilan-import${process.env.THEME === 'dark' ? '-sombre' : ''}.png`,
    });

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
