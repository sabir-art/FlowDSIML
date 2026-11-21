/** L12-07 : étiquettes des démos (menu de la carte, filtre, réglages de l'éditeur). */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  await page.goto(`${APP}/#/`);
  await page.waitForSelector('.demo-card');

  // Menu « … » de la carte → Étiquettes → créer « Logiciel métier » (vert)
  await page.getByRole('button', { name: 'Actions pour Démo CRM' }).click();
  await page.getByRole('menuitem', { name: 'Étiquettes' }).click();
  const dlg = page.getByRole('dialog', { name: 'Étiquettes de Démo CRM' });
  await dlg.waitFor();
  await dlg.getByRole('searchbox').fill('Logiciel métier');
  await dlg.getByRole('radio', { name: 'Vert' }).click();
  await dlg.getByRole('button', { name: /Créer/ }).click();
  await page.waitForTimeout(500);
  ok(
    state.tables.tags.some((x) => x.name === 'Logiciel métier' && x.color === 'green') &&
      state.tables.demo_tags.length === 1,
    'L12-07 : étiquette créée (couleur choisie) et posée sur la démo',
  );
  await dlg.getByRole('searchbox').fill('Jeunes');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  ok(state.tables.demo_tags.length === 2, 'L12-07 : création par Entrée');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l12-tags-card.png` });
  await page.keyboard.press('Escape');
  ok((await page.locator('.demo-card .tg').count()) === 2, 'L12-07 : pastilles sous la ligne de méta');

  // Filtre « Étiquettes »
  await page.locator('.tg-filter').click();
  ok(
    (await page.locator('.tg-filter').getAttribute('aria-expanded')) === 'true',
    'L12-07 : filtre aria-expanded',
  );
  await page.locator('.tg-pop').getByRole('checkbox').first().check();
  await page.waitForTimeout(200);
  ok((await page.locator('.demo-card').count()) === 1, 'L12-07 : filtre « Au moins une »');
  ok(
    (await page.locator('.tg-filter').getAttribute('class')).includes('fd-filter--active') &&
      (await page.locator('.tg-filter .fd-filter__value').textContent()).length > 0,
    'L12-07 / L40 : filtre actif (étiquette choisie en valeur)',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l12-tags-filter.png` });
  await page.getByRole('button', { name: 'Effacer' }).click();
  ok((await page.locator('.demo-card').count()) === 2, 'L12-07 : Effacer');
  await page.keyboard.press('Escape');
  // L52 §2.6 : un seul endroit pour gérer les étiquettes (la fenêtre « Gérer » est remplacée par la page)
  await page.locator('.tg-filter').click();
  await page.locator('.tg-pop').getByRole('link', { name: 'Gérer les étiquettes' }).click();
  await page.waitForSelector('.tgs-row .tg');
  ok(page.url().includes('#/settings/tags'), 'L52 : « Gérer les étiquettes » mène à Paramètres › Étiquettes');
  await page.goto(`${APP}/#/`);
  await page.waitForSelector('.demo-card');

  // Éditeur › Réglages : champ à pastilles
  await page.goto(`${APP}/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit?tab=settings`);
  await page.waitForSelector('.tg-field');
  await page.fill('.tg-field input', 'Module 1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  ok(
    state.tables.tags.some((x) => x.name === 'Module 1') &&
      (await page.locator('.tg-field .tg').count()) >= 1,
    'L12-07 : ajout depuis les réglages de la démo',
  );
  await page.getByRole('button', { name: 'Retirer Module 1' }).click();
  await page.waitForTimeout(500);
  ok(
    !state.tables.demo_tags.some(
      (l) => state.tables.tags.find((x) => x.id === l.tag_id)?.name === 'Module 1',
    ),
    'L12-07 : retrait par pastille',
  );

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
