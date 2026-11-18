/** L13-07 : formations et structures (maître-détail, modules, domaines, droits). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { learnersFixture, seedPathTables } = require('./learners-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = seed();
  s.learners = learnersFixture().progress;
  seedPathTables(s.tables, s.tables.workspaces[0].id);
  const state = await install(page, s);
  const t = state.tables;
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const toast = async () => (await page.locator('.mk-toasts').textContent()) || '';

  await page.goto(`${APP}/#/learners`);
  await page.getByRole('button', { name: 'Gérer les formations' }).click();
  const dlg = page.getByRole('dialog', { name: 'Formations et structures' });
  await dlg.waitFor();
  await dlg.locator('.gm-mods li').first().waitFor();
  ok((await dlg.locator('.gm-item').count()) === 3, 'L13-07 : une carte par formation');
  ok(
    (await dlg.locator('.gm-item[aria-current="true"] b').textContent()) === 'Logiciel métier',
    'L13-07 : première formation choisie',
  );
  ok(
    (await dlg.locator('.gm-item').first().textContent()).includes('35 apprenants'),
    'L13-07 : apprenants comptés',
  );
  ok(
    (await dlg.locator('.gm-meta').last().textContent()).includes('quiz, seuil 70'),
    'L13-07 : méta du module (étapes, quiz, seuil)',
  );
  ok(
    (await dlg.getByRole('button', { name: 'Monter le module Prise en main' }).isDisabled()) &&
      (await dlg.getByRole('button', { name: 'Descendre le module Quiz final' }).isDisabled()),
    'L13-07 : Monter et Descendre désactivés aux extrémités, noms qui citent le module',
  );

  // Descendre « Prise en main »
  await dlg.getByRole('button', { name: 'Descendre le module Prise en main' }).click();
  await page.waitForTimeout(400);
  const pos = (id) => t.path_modules.find((m) => m.path_id === 'p-logiciel' && m.demo_id === id).position;
  ok(pos('m-prise') === 1 && pos('m-fiches') === 0, 'L13-07 : ordre enregistré');
  ok((await toast()).includes('Modification enregistrée'), 'L13-07 : toast de confirmation');

  // Obligatoire
  await dlg
    .locator('.gm-mods li', { hasText: 'Agenda' })
    .getByRole('checkbox', { name: 'Obligatoire' })
    .click();
  await page.waitForTimeout(300);
  ok(t.path_modules.find((m) => m.demo_id === 'm-agenda').required === true, 'L13-07 : case Obligatoire');

  // Interrupteur d'ordre
  await dlg.getByRole('switch', { name: /Modules à suivre dans l'ordre/ }).click({ force: true });
  await page.waitForTimeout(300);
  ok(t.paths.find((p) => p.id === 'p-logiciel').ordered === false, 'L13-07 : interrupteur « dans l’ordre »');

  // Créer une formation et ajouter un module
  await dlg.getByRole('textbox', { name: 'Nom de la nouvelle formation' }).fill('Accueil des jeunes');
  await dlg.getByRole('button', { name: 'Créer une formation' }).click();
  await page.waitForTimeout(500);
  ok(
    (await dlg.locator('.gm-item[aria-current="true"] b').textContent()) === 'Accueil des jeunes',
    'L13-07 : formation créée et choisie',
  );
  await dlg
    .getByRole('combobox', { name: 'Ajouter un module' })
    .selectOption({ label: 'Saisir un rendez-vous' });
  await dlg.getByRole('button', { name: 'Ajouter un module' }).click();
  await page.waitForTimeout(400);
  const created = t.paths.find((p) => p.title === 'Accueil des jeunes');
  ok(
    t.path_modules.some((m) => m.path_id === created.id && m.demo_id === 'x-rdv'),
    'L13-07 : module ajouté',
  );
  ok((await toast()).includes('Module « Saisir un rendez-vous » ajouté'), 'L13-07 : toast d’ajout');

  // Supprimer la formation (avec confirmation)
  await dlg.getByRole('button', { name: 'Supprimer la formation' }).click();
  const cf = page.locator('dialog[open]');
  await cf.waitFor();
  await cf.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(400);
  ok(
    !t.paths.some((p) => p.id === created.id) && (await dlg.isVisible()),
    'L13-07 : formation supprimée après confirmation, modale ouverte',
  );

  // Structures
  await dlg.getByRole('tab', { name: 'Structures' }).click();
  await dlg.locator('.gm-st').first().waitFor();
  ok((await dlg.locator('.gm-st:not(.gm-st--new)').count()) === 3, 'L13-07 : une rangée par structure');
  const nord = dlg.getByRole('textbox', { name: 'Ajouter un domaine e-mail à Antenne Nord' });
  await nord.fill('gmail.com');
  await nord.press('Enter');
  await page.waitForTimeout(200);
  ok(
    (await dlg.locator('.fd-alert').textContent()).includes('grand public') &&
      !t.structures.find((x) => x.id === 'st-nord').domains.includes('gmail.com'),
    'L13-07 : messagerie grand public refusée',
  );
  await nord.fill('@Nord.Example');
  await nord.press(',');
  await page.waitForTimeout(400);
  ok(
    t.structures.find((x) => x.id === 'st-nord').domains.includes('nord.example'),
    'L13-07 : domaine ajouté (virgule), nettoyé',
  );
  await dlg.getByRole('button', { name: 'Retirer le domaine acme.example' }).click();
  await page.waitForTimeout(400);
  ok(
    !t.structures.find((x) => x.id === 'st-siege').domains.includes('acme.example'),
    'L13-07 : retrait d’un domaine',
  );
  await dlg.getByRole('textbox', { name: 'Nom de la nouvelle structure' }).fill('Antenne Est');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForTimeout(400);
  ok(
    t.structures.some((x) => x.name === 'Antenne Est'),
    'L13-07 : structure ajoutée',
  );
  await dlg.getByRole('button', { name: 'Supprimer la structure Antenne Est' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(400);
  ok(!t.structures.some((x) => x.name === 'Antenne Est'), 'L13-07 : structure supprimée après confirmation');
  ok(
    (await dlg.getByRole('button', { name: 'Supprimer la formation' }).count()) === 0,
    'L13-07 : pas de suppression de formation sur l’onglet Structures',
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok((await dlg.count()) === 0, 'L13-07 : Échap ferme');

  // Droits : un éditeur ne voit pas le bouton
  t.members[0].role = 'editor';
  await page.reload();
  await page.waitForSelector('.l13-table');
  ok(
    (await page.getByRole('button', { name: 'Gérer les formations' }).count()) === 0,
    'L13-07 : réservé aux propriétaires et admins',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
