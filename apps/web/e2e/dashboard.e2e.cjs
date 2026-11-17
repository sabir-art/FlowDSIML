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
  page.on('dialog', (d) => errors.push(`dialog natif inattendu : ${d.message()}`) && d.dismiss());
  const state = await install(page);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  await page.goto(`${APP}/#/`);
  await page.waitForSelector('.demo-card');
  ok((await page.locator('.demo-card').count()) === 2, 'deux démos affichées');
  ok((await page.locator('.demo-cover img').count()) >= 1, 'vignette de la première étape');
  ok(
    !(await page.textContent('main')).includes('1 / 25'),
    'pas de quota dans le sous-titre (il est dans Plans)',
  );
  ok(
    (await page.locator('.stat-tile a[href="#/analytics"]').count()) === 1,
    'KPI Vues : bouton ↗ vers Analytics',
  );
  ok(!/Invalid Date/.test(await page.textContent('main')), 'dates formatées (pas de « Invalid Date »)');

  await page.fill('input[type=search]', 'onboard');
  ok((await page.locator('.demo-card').count()) === 1, 'recherche par titre');
  await page.fill('input[type=search]', '');
  ok((await page.locator('.stat-tile').count()) === 4, 'KPI du workspace (4 cartes)');
  ok((await page.locator('.stat-tile.fd-card--hero').count()) === 1, 'une seule carte héro');
  await page.getByRole('button', { name: /^Brouillons · 1/ }).click();
  ok((await page.locator('.demo-card').count()) === 1, 'filtre par statut (segmenté)');
  await page.getByRole('button', { name: /^Toutes · 2/ }).click();
  ok((await page.locator('.demo-new__btn').count()) === 1, 'carte « Nouvelle démo » en fin de grille');

  // Dossiers : menu « Dossiers ▾ » (pas de rangée de pilules)
  ok((await page.locator('.folder-pills').count()) === 0, 'pas de rangée de dossiers');
  await page.getByRole('button', { name: 'Dossiers' }).click();
  await page.getByRole('menuitem', { name: 'Nouveau dossier' }).click();
  await page.fill('dialog[open] input', 'Ventes');
  await page.locator('dialog[open]').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(400);
  ok(state.tables.folders.length === 1, 'dossier créé (modale, sans prompt natif)');

  // Menu ⋯ d'une carte → Déplacer
  await page.getByRole('button', { name: 'Actions pour Démo CRM' }).click();
  ok((await page.locator('[role=menuitem]').count()) >= 5, 'menu d’actions de la carte');
  await page.getByRole('menuitem', { name: 'Déplacer vers un dossier' }).click();
  await page.locator('dialog[open] select').selectOption({ label: 'Ventes' });
  await page.waitForTimeout(300);
  await page.locator('dialog[open]').getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Dossiers' }).click();
  await page.getByRole('menuitem', { name: /^Ventes/ }).click();
  ok((await page.locator('.demo-card').count()) === 1, 'démo rangée dans le dossier');
  await page.getByRole('button', { name: 'Ventes' }).click();
  await page.getByRole('menuitem', { name: /^Tous les dossiers/ }).click();

  await page.getByRole('button', { name: 'Actions pour Onboarding' }).click();
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('.demo-card').count()) === 3, 'démo dupliquée');

  await page.getByRole('button', { name: 'Actions pour Onboarding (copie)' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  await page.waitForSelector('dialog[open]');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard-confirm.png` });
  await page.locator('dialog[open]').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('.demo-card').count()) === 2, 'suppression confirmée par modale');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dashboard.png` });

  await page
    .locator('.demo-card')
    .first()
    .click({ position: { x: 40, y: 40 } });
  await page.waitForURL(/\/edit$/);
  ok(true, 'la carte entière ouvre l’éditeur');

  const m = await b.newPage({ viewport: { width: 390, height: 800 } });
  await install(m, state);
  await m.goto(`${APP}/#/`);
  await m.waitForSelector('.demo-card');
  ok(
    await m.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right <= 0),
    'mobile : barre latérale repliée',
  );
  await m.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await m.waitForTimeout(300);
  ok(
    await m.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().left >= 0),
    'mobile : menu ouvert au tap',
  );
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/dashboard-mobile-menu.png` });

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
