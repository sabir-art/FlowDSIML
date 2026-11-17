/** Test e2e du tableau de bord des démos (faux Supabase). */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('Ventes') : d.accept()));
  const state = await install(page);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  await page.goto(`${APP}/#/`);
  await page.waitForSelector('.demo-card');
  ok((await page.locator('.demo-card').count()) === 2, 'deux démos affichées');
  ok((await page.locator('.demo-cover img').count()) >= 1, 'vignette de la première étape');
  ok((await page.textContent('.fd-alert')).includes('1 / 25'), 'usage du plan affiché');

  await page.fill('input[type=search]', 'onboard');
  ok((await page.locator('.demo-card').count()) === 1, 'recherche par titre');
  await page.fill('input[type=search]', '');
  await page.selectOption('select[aria-label="Statut"]', 'draft');
  ok((await page.locator('.demo-card').count()) === 1, 'filtre par statut');
  await page.selectOption('select[aria-label="Statut"]', 'all');

  await page.getByRole('button', { name: '+ Nouveau dossier' }).click();
  await page.waitForSelector('text=📁 Ventes');
  ok(state.tables.folders.length === 1, 'dossier créé');
  await page.locator('.demo-move').first().selectOption({ label: 'Ventes' });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /📁 Ventes/ }).click();
  ok((await page.locator('.demo-card').count()) === 1, 'démo rangée dans le dossier');
  await page.getByRole('button', { name: /Toutes les démos/ }).click();

  await page.getByRole('button', { name: 'Dupliquer' }).first().click();
  await page.waitForTimeout(400);
  ok((await page.locator('.demo-card').count()) === 3, 'démo dupliquée');

  await page
    .getByRole('button', { name: /^Supprimer Démo CRM \(copie\)|^Supprimer Onboarding \(copie\)/ })
    .click();
  await page.waitForTimeout(400);
  ok((await page.locator('.demo-card').count()) === 2, 'démo supprimée (suppression logique)');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard.png` });

  await page.getByRole('button', { name: '+ Nouvelle démo' }).click();
  await page.waitForURL(/\/edit$/);
  ok(true, 'création d’une démo vide et ouverture de l’éditeur');
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
