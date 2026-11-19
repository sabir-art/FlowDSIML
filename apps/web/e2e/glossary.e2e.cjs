/**
 * Test e2e L17-06 à 08 : Paramètres › Glossaire (vide, ajout, unicité, tableau, recherche, modification,
 * suppression confirmée, import CSV avec aperçu, export, réglage « Souligner les termes »).
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/glossary.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const closeToasts = async () => {
    for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForTimeout(150);
  };
  const shot = async (name) => {
    await closeToasts();
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.glossaryUsage = { 'Tableau de bord': 4, 'Dossier usager': 3, 'Nouveau rapport': 2 };
  await install(page, state);
  await page.goto(`${APP}/#/settings/glossary`);

  // L17-07 : vide
  await page.getByRole('heading', { name: 'Aucun terme pour l’instant' }).waitFor();
  ok(
    (await page.getByRole('link', { name: 'Glossaire' }).count()) === 1,
    'Onglet Glossaire dans la navigation',
  );
  ok(
    (await page.getByRole('button', { name: 'Exporter' }).count()) === 0,
    'L17-07 : pas d’export sans terme',
  );
  await shot('l17-07-vide');

  // L17-08 : ajout
  await page.getByRole('button', { name: 'Ajouter un terme' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Ajouter un terme' });
  await dlg.waitFor();
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  ok(
    (await dlg.getByText('Saisissez le nouveau terme.').count()) === 1 &&
      (await dlg.getByText('Saisissez une définition.').count()) === 1,
    'L17-08 : champs obligatoires',
  );
  await dlg.getByLabel('Nouveau terme').fill('Rendez-vous');
  await dlg.getByLabel(/^Ancien terme/).fill('entretien planifié');
  const def = 'Rencontre prévue avec une personne accompagnée, visible dans l’agenda partagé.';
  await dlg.getByLabel('Définition').fill(def);
  await dlg.getByLabel(/^Autres formes/).fill('rendez-vous, RDV');
  const counter = await dlg.locator('.gl-counter').textContent();
  ok(counter === `${def.length} / 140`, `L17-08 : compteur de la définition (${counter})`);
  await shot('l17-08-ajout');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByRole('cell', { name: 'entretien planifié' }).waitFor();
  const t0 = state.tables.glossary_terms[0];
  ok(t0.forms.join('|') === 'rendez-vous|RDV', 'L17-08 : autres formes enregistrées');

  // Unicité insensible aux accents et à la casse
  await page.getByRole('button', { name: 'Ajouter un terme' }).click();
  await dlg.getByLabel('Nouveau terme').fill('RENDEZ-VOUS');
  await dlg.getByLabel('Définition').fill('Doublon.');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  ok((await dlg.getByText('Ce terme existe déjà.').count()) === 1, 'L17-08 : « Ce terme existe déjà »');
  await dlg.getByRole('button', { name: 'Annuler' }).click();

  // Import CSV : aperçu puis import
  const csv = [
    'nouveau;ancien;definition;formes',
    'Tableau de bord;synthèse mensuelle;Page d’accueil qui regroupe vos indicateurs, mise à jour en continu.;',
    'Dossier usager;fiche bénéficiaire;Toutes les informations d’une personne accompagnée, au même endroit.;',
    'Nouveau rapport;export tableur;Crée un rapport à partir d’un modèle, sans passer par un tableur.;',
    'rendez-vous;entretien planifié;Rencontre prévue, visible dans l’agenda partagé.;RDV',
    ';ancien;Sans terme.;',
    `Trop long;;${'x'.repeat(150)};`,
  ].join('\n');
  const file = path.join(os.tmpdir(), 'glossaire-test.csv');
  fs.writeFileSync(file, csv);
  await page.getByRole('button', { name: 'Importer un CSV' }).click();
  const imp = page.getByRole('dialog', { name: 'Importer un CSV' });
  await imp.getByLabel('Fichier CSV').setInputFiles(file);
  const prev = imp.getByRole('status');
  await prev.waitFor();
  const txt = await prev.textContent();
  ok(
    txt.includes('3 termes à ajouter') &&
      txt.includes('1 à mettre à jour') &&
      txt.includes('2 lignes ignorées'),
    'Import : aperçu (3 ajouts, 1 mise à jour, 2 ignorées)',
  );
  ok(
    txt.includes('Ligne 6\u202f: nouveau terme vide') &&
      txt.includes('Ligne 7\u202f: définition de plus de 140 caractères'),
    `Import : motif de chaque ligne ignorée (${txt})`,
  );
  await shot('l17-import-apercu');
  await imp.getByRole('button', { name: 'Importer' }).click();
  await page.getByRole('cell', { name: 'synthèse mensuelle' }).waitFor();
  ok(state.tables.glossary_terms.length === 4, 'Import : un terme existant est mis à jour, jamais dupliqué');

  // L17-06 : tableau trié, modules, recherche
  const rows = page.locator('.gl-table tbody th[scope="row"]');
  ok(
    (await rows.allTextContents()).join('|') === 'Dossier usager|Nouveau rapport|rendez-vous|Tableau de bord',
    `L17-06 : tri alphabétique sur le nouveau terme (${(await rows.allTextContents()).join('|')})`,
  );
  await closeToasts();
  ok((await page.locator('.gl-page [role="status"]').textContent()) === '4 termes', 'L17-06 : compteur');
  ok(
    (await page.locator('.gl-table tbody tr').nth(3).locator('td.num').textContent()) === '4',
    'L17-06 : nombre de modules',
  );
  await page.getByRole('searchbox', { name: 'Rechercher un terme' }).fill('tableur');
  ok(
    (await rows.count()) === 1 && (await page.getByText('1 terme', { exact: true }).count()) === 1,
    'L17-06 : recherche sur la définition',
  );
  await page.getByRole('searchbox', { name: 'Rechercher un terme' }).fill('');

  // Modification
  await page.getByRole('button', { name: 'Actions pour Rendez-vous' }).click();
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
  const ed = page.getByRole('dialog', { name: 'Modifier le terme' });
  await ed.waitFor();
  ok((await ed.getByLabel('Nouveau terme').inputValue()) === 'rendez-vous', 'Modifier : modale préremplie');
  await ed.getByLabel('Nouveau terme').fill('Rendez-vous');
  await ed.getByRole('button', { name: 'Enregistrer' }).click();
  await ed.waitFor({ state: 'detached' });
  // L17-06 : capture avec la donnée alignée (« Rendez-vous »)
  await page.getByRole('rowheader', { name: 'Rendez-vous', exact: true }).waitFor();
  await closeToasts();
  await shot('l17-06-glossaire');

  // Suppression confirmée
  await page.getByRole('button', { name: 'Actions pour Nouveau rapport' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  const conf = page.getByRole('dialog', { name: 'Supprimer « Nouveau rapport » ?' });
  await conf.waitFor();
  ok(
    (await conf.textContent()).includes('Il ne sera plus souligné dans les démos.'),
    'Suppression : message',
  );
  await conf.getByRole('button', { name: 'Supprimer' }).click();
  await page.getByRole('cell', { name: 'export tableur' }).waitFor({ state: 'detached' });
  ok(state.tables.glossary_terms.length === 3, 'Suppression effectuée');

  // Export
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter' }).click(),
  ]);
  const out = fs.readFileSync(await dl.path(), 'utf8');
  ok(
    out.replace(/^\uFEFF/, '').startsWith('nouveau,ancien,definition,formes') && out.includes('Rendez-vous'),
    `Export CSV (${JSON.stringify(out.slice(0, 60))})`,
  );

  // Réglage « Souligner les termes »
  const sw = page.getByRole('checkbox', { name: /Souligner les termes dans le lecteur/ });
  ok(await sw.isChecked(), 'Soulignement activé par défaut');
  await sw.uncheck();
  await page.waitForTimeout(300);
  ok(
    state.tables.workspaces[0].settings.glossary.underline === false,
    'Soulignement désactivé pour le workspace',
  );
  await sw.check();

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
