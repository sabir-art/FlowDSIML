/**
 * L60 §3 : arrivée d'une capture dans l'éditeur. L'extension ouvre `#/demos/:id/edit?ready=n` :
 *  - toast « Démo prête : n étapes capturées » avec « Aperçu » (qui ouvre l'aperçu) ;
 *  - l'adresse perd « ready » (un rechargement ne rejoue pas le toast) ;
 *  - chaque étape porte l'étiquette verte « Nouvelle » jusqu'à sa première modification, y compris
 *    après un rechargement.
 * Faux Supabase, données fictives. Usage : node e2e/arrivee-capture.e2e.cjs (THEME=dark)
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: THEME });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  await install(page, state);
  const n = state.tables.steps.filter((s) => s.demo_id === DEMO).length;
  await page.goto(`${APP}/#/demos/${DEMO}/edit?ready=${n}`);
  const toast = page.locator('.toast', { hasText: 'Démo prête' });
  await toast.waitFor();
  ok(
    (await toast.innerText()).includes(`Démo prête : ${n} étapes capturées`) &&
      (await toast.getByRole('button', { name: 'Aperçu' }).count()) === 1,
    `toast « Démo prête : ${n} étapes capturées » avec « Aperçu »`,
  );
  ok(!/ready=/.test(page.url()), 'l’adresse perd « ready »');
  const badges = page.locator('.rail-li .rail-arrived');
  await page.waitForFunction((n) => document.querySelectorAll('.rail-li .rail-arrived').length === n, n);
  const look = await badges.first().evaluate((b) => ({
    text: b.textContent,
    color: getComputedStyle(b).color,
    bg: getComputedStyle(b).backgroundColor,
  }));
  ok(
    look.text === 'Nouvelle' && look.color !== look.bg,
    `chaque étape porte « Nouvelle » (${n}) (${JSON.stringify(look)})`,
  );
  // La liste anime ses lignes à l'arrivée (MOTION-01) : capture une fois l'animation finie
  await page.waitForTimeout(600);
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/arrivee-editeur${THEME === 'dark' ? '-sombre' : ''}.png` });
  await toast.getByRole('button', { name: 'Aperçu' }).click();
  await page.locator('dialog.preview-dialog[open]').waitFor();
  ok(true, '« Aperçu » ouvre l’aperçu de la démo');
  await page.keyboard.press('Escape');
  await page
    .locator('dialog.preview-dialog[open]')
    .waitFor({ state: 'detached' })
    .catch(() => undefined);

  // Première modification : l'étape 1 perd « Nouvelle », les autres la gardent
  await page.locator('[data-step-index="0"]').click();
  await openTool(page, 'step');
  const title = page.getByLabel('Titre de l’étape').or(page.getByLabel("Titre de l'étape")).first();
  await title.fill('Créer un projet (revu)');
  await page.waitForFunction((n) => document.querySelectorAll('.rail-li .rail-arrived').length === n - 1, n);
  ok(
    (await page.locator('.rail-li').first().locator('.rail-arrived').count()) === 0,
    'modifier une étape lui retire « Nouvelle »',
  );
  // Rechargement : les étiquettes restantes sont gardées, le toast ne revient pas
  await page.reload();
  await page.locator('.rail-li').first().waitFor();
  await page.waitForTimeout(800);
  ok(
    (await page.locator('.rail-li .rail-arrived').count()) === n - 1 &&
      (await page.locator('.toast', { hasText: 'Démo prête' }).count()) === 0,
    'après un rechargement : « Nouvelle » gardée sur les autres étapes, pas de nouveau toast',
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await browser.close();
})();
