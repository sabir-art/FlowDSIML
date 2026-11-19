/**
 * Test e2e L18-05 : styles prédéfinis de l'onglet Design (6 styles, style actif, application à toute
 * la démo, Annuler, style personnalisé, styles du workspace : enregistrer, renommer, supprimer).
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/styles.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const N = ' ';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  state.tables.themes = [];
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('tab', { name: 'Design' }).click();
  const group = page.getByRole('group', { name: 'Choisir un style' });
  await group.waitFor();
  const theme = () => state.tables.demos.find((d) => d.id === DEMO).settings.theme || {};

  ok((await group.getByRole('button', { pressed: undefined }).count()) >= 6, '6 styles livrés');
  ok(
    (await group.getByRole('button', { name: /DSI Prune/ }).getAttribute('aria-pressed')) === 'true',
    'DSI Prune actif par défaut (badge « Par défaut »)',
  );

  // Appliquer « Vert DSI »
  await group.getByRole('button', { name: 'Vert DSI' }).click();
  await page.waitForTimeout(900);
  ok(
    theme().primary === '#95C11F' && theme().onPrimary === '#080808' && theme().hotspot === '#557014',
    'Vert DSI appliqué à toute la démo (texte noir sur le bouton)',
  );
  ok(
    (await page.getByText(`Style «${N}Vert DSI${N}» appliqué à toute la démo.`).count()) === 1,
    'toast avec le nom du style',
  );
  ok(
    (await group.getByRole('button', { name: 'Vert DSI' }).getAttribute('aria-pressed')) === 'true',
    'style actif',
  );
  const cta = page.locator('.canvas-frame .p-btn-primary').first();
  if (await cta.count())
    ok(
      (await cta.evaluate((e) => getComputedStyle(e).color)) === 'rgb(8, 8, 8)',
      'canevas : bouton en texte noir',
    );
  // L18-05 : capture avec le toast « Style … appliqué » et son action « Annuler » (exception
  // demandée à la règle « captures sans toast »)
  if (SHOTS) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/l18-05-styles${sfx}.png` });
  }

  // Annuler (toast)
  await group.getByRole('button', { name: 'Nuit' }).click();
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).last().click();
  await page.waitForTimeout(900);
  ok(theme().primary === '#95C11F', '« Annuler » rétablit le style précédent');

  // Réglage fin : plus aucun style actif
  const hex = page.locator('#th-hotspot-hex');
  await hex.fill('#123456');
  await hex.blur();
  await page.waitForTimeout(900);
  ok((await group.locator('[aria-pressed="true"]').count()) === 0, 'réglage fin : aucun style actif');
  ok((await page.getByText('Style personnalisé').count()) === 1, '« Style personnalisé »');

  // Enregistrer le style actuel, renommer, supprimer
  await page.getByRole('button', { name: 'Enregistrer le style actuel' }).click();
  const dlg = page.getByRole('dialog', { name: 'Enregistrer le style actuel' });
  await dlg.getByLabel('Nom du style').fill('Ma charte');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await group.getByRole('button', { name: 'Ma charte', exact: true }).waitFor();
  ok(
    state.tables.themes.length === 1 && state.tables.themes[0].tokens.hotspot === '#123456',
    'style du workspace enregistré (valeurs actuelles)',
  );
  ok(
    (await group.getByRole('button', { name: 'Ma charte', exact: true }).getAttribute('aria-pressed')) ===
      'true',
    'style enregistré actif',
  );
  await page.getByRole('button', { name: 'Actions pour Ma charte' }).click();
  await page.getByRole('menuitem', { name: 'Renommer' }).click();
  const ren = page.getByRole('dialog', { name: 'Renommer le style' });
  await ren.getByLabel('Nom du style').fill('Charte Acme');
  await ren.getByRole('button', { name: 'Enregistrer' }).click();
  await group.getByRole('button', { name: 'Charte Acme', exact: true }).waitFor();
  ok(state.tables.themes[0].name === 'Charte Acme', 'style renommé');
  await page.getByRole('button', { name: 'Actions pour Charte Acme' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  await page
    .getByRole('dialog', { name: /Supprimer le style/ })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await page.waitForTimeout(500);
  ok(state.tables.themes.length === 0, 'style supprimé');

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
