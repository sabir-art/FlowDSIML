/**
 * Test e2e L30-06 : Jeu de données > « Générer des données fictives » (colonnes décrites, 10/20/50
 * lignes, aperçu des 10 premières lignes, garde-fou des colonnes personnelles avant et après envoi,
 * Utiliser ce jeu de données, Ignorer). Données fictives, aucun appel au fournisseur.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/donnees-fictives.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

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
  const shot = async (name) => {
    await page.waitForTimeout(250);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.ai = {
    enabled: true,
    features: {
      write: true,
      translate: true,
      suggest: true,
      generate: true,
      dataset: true,
      chart: true,
      assistant: true,
    },
    used: 3,
    quota: 500,
    userToday: 0,
    userDailyRequests: 30,
    workspaceQuotaReached: false,
    userQuotaReached: false,
    renewsOn: '2026-12-01',
    canEdit: true,
    canManage: true,
  };
  const towns = ['Antenne Nord', 'Antenne Sud', 'Antenne Est', 'Antenne Ouest', 'Centre'];
  state.aiReply = (task, input) => ({
    rows: Array.from({ length: input.rows }, (_, i) =>
      input.columns.map((c, j) => (j === 0 ? towns[i % 5] : String(10 + i * 3))),
    ),
  });
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await openTool(page, 'settings');
  await page.getByRole('button', { name: 'Importer un fichier CSV' }).click();
  const dlg = page.locator('.ds-dialog');
  await dlg.waitFor();
  await dlg.getByRole('button', { name: 'Générer des données fictives' }).click();
  // Garde-fou avant envoi
  await dlg.getByLabel('Décrivez les colonnes').fill('structure, e-mail du conseiller');
  await dlg.getByRole('button', { name: 'Générer', exact: true }).click();
  ok(
    (await dlg.getByRole('alert').textContent()).includes(
      'Un jeu de données ne doit contenir ni nom, ni e-mail, ni identifiant de personne.',
    ),
    'Colonne personnelle refusée avant l’envoi',
  );
  ok(!(state.aiCalls || []).length, 'Rien n’est envoyé');
  await dlg
    .getByLabel('Décrivez les colonnes')
    .fill('structure, nombre de jeunes suivis, taux d’entrée en formation');
  await dlg.getByLabel('Nombre de lignes').selectOption('20');
  await shot('l30-06-saisie');
  await dlg.getByRole('button', { name: 'Générer', exact: true }).click();
  await dlg.getByRole('button', { name: 'Utiliser ce jeu de données' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'dataset' && call.input.rows === 20 && call.input.columns.length === 3,
    'Demande : 3 colonnes, 20 lignes',
  );
  ok((await dlg.locator('.ai-ds-table tbody tr').count()) === 10, 'Aperçu : 10 premières lignes');
  ok(
    (await dlg.getByText('Données inventées : aucun nom ni identifiant de personne.').count()) === 1,
    'Ligne « Données inventées »',
  );
  ok((await dlg.getByText('Généré par IA, à vérifier').count()) === 1, 'Mention de la règle 2');
  await shot('l30-06-apercu');
  await dlg.getByRole('button', { name: 'Utiliser ce jeu de données' }).click();
  ok(
    /20 lignes/.test(await dlg.locator('.ds-file').textContent()),
    'Jeu de données repris dans la modale (20 lignes)',
  );
  // Garde-fou après génération : noms de personnes dans les valeurs
  await dlg.getByRole('button', { name: 'Générer des données fictives' }).click();
  state.aiReply = (task, input) => ({
    rows: Array.from({ length: input.rows }, () => ['Camille DURAND', '12']),
  });
  await dlg.getByLabel('Décrivez les colonnes').fill('référent, total');
  await dlg.getByRole('button', { name: 'Générer', exact: true }).click();
  await dlg.getByRole('alert').filter({ hasText: 'Un jeu de données ne doit contenir' }).waitFor();
  ok(true, 'Valeurs ressemblant à des noms : refusées après génération');
  await dlg.getByRole('button', { name: 'Ignorer' }).click();
  ok((await dlg.locator('.ai-dataset').count()) === 0, 'Ignorer : panneau fermé');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
