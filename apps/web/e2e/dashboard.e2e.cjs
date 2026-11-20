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
  // Les vignettes arrivent après les URL signées : on les attend avant de compter
  await page.waitForSelector('.demo-cover img', { timeout: 5000 }).catch(() => undefined);
  ok((await page.locator('.demo-cover img').count()) >= 1, 'vignette de la première étape');
  ok(
    !(await page.textContent('main')).includes('1 / 25'),
    'pas de quota dans le sous-titre (il est dans Plans)',
  );
  // L47 §8 : 4 raccourcis identiques vers Analytics, chacun avec son indicateur
  ok(
    JSON.stringify(
      await page.locator('.kpi-short a.kpi-sc').evaluateAll((l) => l.map((a) => a.getAttribute('href'))),
    ) ===
      JSON.stringify([
        '#/analytics?indicateur=views',
        '#/analytics?indicateur=visitors',
        '#/analytics?indicateur=completion',
        '#/analytics?indicateur=leads',
      ]),
    'raccourcis vers Analytics (Vues, Visiteurs, Complétion, Leads)',
  );
  ok(
    /, voir dans Analytics$/.test(
      (await page.locator('.kpi-sc').nth(3).innerText()).replace(/\s+/g, ' ').trim(),
    ) ||
      (await page.locator('.kpi-sc').nth(3).locator('.sr-only').last().textContent()) ===
        ', voir dans Analytics',
    'nom accessible : « …, voir dans Analytics »',
  );
  ok(!/Invalid Date/.test(await page.textContent('main')), 'dates formatées (pas de « Invalid Date »)');

  await page.fill('input[type=search]', 'onboard');
  ok((await page.locator('.demo-card').count()) === 1, 'recherche par titre');
  await page.fill('input[type=search]', '');
  ok((await page.locator('.kpi-sc').count()) === 4, 'KPI du workspace (4 raccourcis)');
  ok(
    (await page.locator('.kpi-short .fd-card--hero, .kpi-action').count()) === 0,
    'aucune carte héro ni bouton rond',
  );
  await page.getByRole('button', { name: /^Brouillons · 1/ }).click();
  ok((await page.locator('.demo-card').count()) === 1, 'filtre par statut (segmenté)');
  await page.getByRole('button', { name: /^Toutes · 2/ }).click();
  ok((await page.locator('.demo-new__btn').count()) === 1, 'carte « Nouvelle démo » en fin de grille');

  // L48-A : colonne Dossiers (au-dessus de 1 024 px)
  ok((await page.locator('.folder-pills').count()) === 0, 'pas de rangée de dossiers');
  const col = page.getByRole('navigation', { name: 'Dossiers' });
  await col.getByRole('button', { name: 'Nouveau dossier' }).first().click();
  ok((await page.locator('dialog[open] form form').count()) === 0, 'REV-11 : pas de formulaire imbriqué');
  ok(
    (await page.locator('dialog[open]').getByRole('textbox', { name: 'Nom du dossier' }).count()) === 1,
    'REV-11 : champ nommé',
  );
  await page.fill('dialog[open] input', 'Ventes');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  ok(state.tables.folders.length === 1, 'dossier créé avec Entrée (modale, sans prompt natif)');
  ok((await page.locator('dialog[open]').count()) === 0, 'REV-11 : la modale se ferme');

  // Menu ⋯ d'une carte → Déplacer
  await page.getByRole('button', { name: 'Actions pour Démo CRM' }).click();
  ok((await page.locator('[role=menuitem]').count()) >= 5, 'menu d’actions de la carte');
  await page.getByRole('menuitem', { name: 'Déplacer vers…' }).click();
  await page.locator('dialog[open] select').selectOption({ label: 'Ventes' });
  await page.waitForTimeout(300);
  await page.locator('dialog[open]').getByRole('button', { name: 'Fermer' }).click();
  await col.getByRole('link', { name: /^Ventes/ }).click();
  await page.waitForTimeout(300);
  ok((await page.locator('.demo-card').count()) === 1, 'démo rangée dans le dossier');
  await col.getByRole('link', { name: /^Toutes les démos/ }).click();

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

  // DSH-02 / DSH-04 / DSH-06 : vue liste, tri « Créées récemment », modale « Nouvelle démo »
  const d2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await install(d2, state);
  await d2.goto(`${APP}/#/`);
  await d2.waitForSelector('.demo-card');
  await d2.getByRole('radio', { name: 'Liste' }).click();
  ok((await d2.locator('.demo-table tbody tr').count()) > 0, 'DSH-02 : vue liste en tableau');
  await d2.getByRole('radio', { name: 'Grille' }).click();
  await d2.getByRole('button', { name: /^Tri\s*: Modifiées récemment/ }).click();
  ok(
    (await d2.getByRole('menuitem', { name: 'Date de création' }).count()) === 1,
    'DSH-04 : tri « Date de création »',
  );
  await d2.keyboard.press('Escape');
  await d2.locator('.page-head__actions').getByRole('button', { name: 'Nouvelle démo' }).click();
  // L48-G : étape 1 (type de contenu), puis la source
  await d2.getByRole('button', { name: 'Continuer', exact: true }).click();
  await d2.waitForSelector('dialog.new-demo-dialog[open]');
  ok(
    (await d2.locator('.nd-choice.is-soon').count()) === 0 &&
      (await d2.getByRole('button', { name: /Importer des images/ }).count()) === 1,
    'DSH-06 / DSH-07 (REV-06) : import d’images actif',
  );
  await d2.getByRole('button', { name: 'Partir d’une démo vide' }).click();
  await d2.waitForURL(/\/edit$/);
  ok(true, 'DSH-06 : « Partir d’une démo vide » ouvre l’éditeur');

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
