/**
 * Test e2e L38 paquet 2 (revue « parcours de formation », n° 2 et 3). Données fictives.
 *  - n° 2 : Partager > Liens personnalisés > « Importer une liste (CSV) » : modèle, aperçu avec erreurs par
 *    ligne, création des seules lignes valides, export des liens (lien du centre compris).
 *  - n° 3 : groupe à la création d'un lien et à l'import ; filtre « Groupe » dans Apprenants, repris dans
 *    l'export ; groupe modifiable depuis la fiche de l'apprenant.
 * Usage : node e2e/formation-groupes.e2e.cjs
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { learnersFixture } = require('./learners-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PUBLIC = 'https://demos.tutoclick.example';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000002';
const GROUP = 'Session du 12 novembre';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    acceptDownloads: true,
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const read = async (dl) => fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');

  // ===== n° 2 : import d'une liste =====
  const state = seed();
  const t = state.tables;
  const ws = t.workspaces[0].id;
  const demo = t.demos.find((d) => d.id === DEMO);
  demo.status = 'published';
  demo.current_version_id = 'v-2';
  t.demo_versions.push({
    id: 'v-2',
    demo_id: DEMO,
    workspace_id: ws,
    number: 2,
    manifest: {},
    published_at: '2026-11-14T10:00:00Z',
  });
  t.share_links.push({
    id: 'sl-1',
    demo_id: DEMO,
    workspace_id: ws,
    token: 'jeton-alex-0001',
    name: 'Alex Exemple',
    variables: { first_name: 'Alex', email: 'alex@structure.example' },
    cohort: 'Session du 5 novembre',
    is_active: true,
    expires_at: null,
    page_enabled: false,
    page_code: null,
    created_at: '2026-11-15T10:00:00Z',
  });
  t.paths = [{ id: 'p-1', workspace_id: ws, title: 'Logiciel métier', ordered: true }];
  t.path_modules = [{ path_id: 'p-1', demo_id: DEMO, workspace_id: ws, position: 0, required: true }];
  t.training_centers = [
    {
      workspace_id: ws,
      slug: 'ml-exemple',
      draft: { paths: [{ id: 'p-1', visible: true }] },
      published: { paths: [{ id: 'p-1', visible: true }] },
      published_at: '2026-11-16T10:00:00Z',
      access_mode: 'link',
    },
  ];
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/share?tab=perso`);
  await page.locator('table.sh-links').waitFor();
  ok(
    (await page.locator('table.sh-links .sh-cohort-cell').first().textContent()) === 'Session du 5 novembre',
    'n° 3 : groupe affiché sur la ligne du lien',
  );
  // Retour Lead UX : colonne « Groupe » propre ; les 3 actions de l'en-tête sur une ligne, à droite de l'aide
  ok(
    (await page.locator('table.sh-links thead th').allTextContents()).includes('Groupe'),
    'Lead UX : colonne « Groupe » dans la liste des liens',
  );
  const acts = await page
    .locator('.sh-perso-acts > .btn')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  const helpBox = await page.locator('.sh-perso-head > p').boundingBox();
  const actsBox = await page.locator('.sh-perso-acts').boundingBox();
  ok(
    acts.length === 3 && new Set(acts).size === 1 && actsBox.x >= helpBox.x + helpBox.width,
    'Lead UX : Exporter, Importer et Nouveau lien sur une ligne, à droite de l’aide',
  );
  await page.getByRole('button', { name: 'Importer une liste (CSV)' }).click();
  const dlg = page.getByRole('dialog', { name: 'Importer une liste d’apprenants' });
  await dlg.waitFor();
  ok(
    (await dlg.getByRole('button', { name: /Choisir un fichier/ }).isVisible()) &&
      !(await dlg.locator('input[type=file]').isVisible()) &&
      (await dlg.locator('.sh-file-name').textContent()) === 'Aucun fichier choisi',
    'Lead UX : bouton « Choisir un fichier » (champ natif masqué)',
  );
  // Modèle
  const [tpl] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByRole('button', { name: 'Télécharger le modèle' }).click(),
  ]);
  ok(
    (await read(tpl)).startsWith('prénom;nom;e-mail;groupe'),
    'n° 2 : modèle prénom ; nom ; e-mail ; groupe',
  );
  // Fichier : 2 lignes valides, 3 en erreur
  const csv = [
    'Prénom;Nom;E-mail;Groupe',
    'Camille;Exemple;camille@structure.example;',
    'Sami;Test;SAMI@structure.example;Session du 19 novembre',
    'Léa;Sans;pas-un-email;',
    'Camille;Bis;camille@structure.example;',
    'Alex;Exemple;alex@structure.example;',
  ].join('\n');
  await dlg
    .locator('input[type=file]')
    .setInputFiles({ name: 'groupe.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await dlg.getByLabel(/^Groupe/).fill(GROUP);
  await dlg.locator('.sh-import-preview table').waitFor();
  ok((await dlg.locator('.sh-file-name').textContent()) === 'groupe.csv', 'Lead UX : nom du fichier affiché');
  const cellCss = await dlg
    .locator('.sh-import-preview tbody tr')
    .first()
    .evaluate((tr) => {
      const [, , email, group] = tr.querySelectorAll('td');
      return {
        group: getComputedStyle(group).whiteSpace,
        email: getComputedStyle(email).textOverflow,
        title: email.getAttribute('title'),
      };
    });
  ok(
    cellCss.group === 'nowrap' &&
      cellCss.email === 'ellipsis' &&
      cellCss.title === 'camille@structure.example',
    'Lead UX : groupe sur une ligne, e-mail tronqué avec infobulle',
  );
  const status = await dlg.locator('.sh-import-preview [role=status]').textContent();
  ok(
    status.includes('2 liens prêts à être créés.') &&
      status.includes('3 lignes en erreur ne seront pas importées.'),
    `n° 2 : aperçu compté (${status.trim()})`,
  );
  const cells = await dlg
    .locator('.sh-import-preview tbody tr')
    .evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent.trim())));
  ok(
    cells[0][3] === GROUP && cells[0][4] === 'Prêt' && cells[1][3] === 'Session du 19 novembre',
    'n° 2 : groupe du fichier, sinon groupe choisi pour l’import',
  );
  ok(
    cells[2][4] === 'E-mail invalide' &&
      cells[3][4] === 'Doublon dans le fichier' &&
      cells[4][4] === 'Déjà un lien pour cet e-mail',
    'n° 2 : erreurs par ligne (e-mail invalide, doublon, lien existant)',
  );
  const axe = await new AxeBuilder({ page })
    .include('[role=dialog]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  ok(
    axe.violations.length === 0,
    `n° 2 : boîte d’import sans violation axe (${axe.violations.map((v) => v.id).join(', ')})`,
  );
  ok(t.share_links.length === 1, 'n° 2 : rien n’est créé avant la confirmation');
  await dlg.getByRole('button', { name: 'Créer 2 liens' }).click();
  await dlg.getByText('2 liens créés.').waitFor();
  const camille = t.share_links.find((l) => l.name === 'Camille Exemple');
  const sami = t.share_links.find((l) => l.name === 'Sami Test');
  ok(
    t.share_links.length === 3 &&
      camille?.cohort === GROUP &&
      camille.variables.email === 'camille@structure.example' &&
      camille.variables.first_name === 'Camille' &&
      camille.variables.last_name === 'Exemple' &&
      sami?.cohort === 'Session du 19 novembre' &&
      sami.variables.email === 'sami@structure.example',
    'n° 2 : deux liens créés, nom, variables et groupe',
  );
  const [exp] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByRole('button', { name: 'Exporter les liens (CSV)' }).click(),
  ]);
  const lines = (await read(exp)).split('\r\n');
  ok(
    lines[0] === 'Nom;E-mail;Groupe;Lien du centre;Lien de la démo' &&
      lines.length === 3 &&
      lines.some((l) =>
        l.startsWith(
          `Camille Exemple;camille@structure.example;${GROUP};${PUBLIC}/#/c/ml-exemple?l=${camille.token};`,
        ),
      ),
    'n° 2 : export des liens créés, avec le lien du centre',
  );
  await dlg.getByRole('button', { name: 'Fermer' }).last().click();
  await dlg.waitFor({ state: 'detached' });
  ok(
    (await page.locator('table.sh-links tbody tr').count()) === 3,
    'n° 2 : la liste montre les liens importés',
  );
  // Export de tous les liens depuis l'onglet
  const [all] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter les liens (CSV)' }).click(),
  ]);
  ok(
    (await read(all)).split('\r\n').length === 4,
    'n° 2 : « Exporter les liens » de l’onglet : tous les liens',
  );

  // ===== n° 3 : groupe à la création d'un lien =====
  await page.getByRole('button', { name: 'Nouveau lien' }).click();
  await page.fill('#sh-ln', 'Noa Exemple');
  const opts = await page.locator('#sh-cohort-l option').evaluateAll((o) => o.map((x) => x.value));
  ok(
    opts.includes(GROUP) && opts.includes('Session du 5 novembre') && opts.includes('Session du 19 novembre'),
    'n° 3 : groupes existants proposés',
  );
  await page.fill('#sh-cohort', `  ${GROUP} `);
  await page.getByRole('button', { name: /Créer et copier le lien/ }).click();
  await page.getByText(/Le lien du centre .* est copié/).waitFor();
  ok(
    t.share_links.find((l) => l.name === 'Noa Exemple')?.cohort === GROUP,
    'n° 3 : groupe enregistré (espaces retirés)',
  );

  // ===== n° 3 : Apprenants, filtre et fiche =====
  const f = learnersFixture();
  const L = f.progress.learners;
  L[0].group = GROUP;
  L[0].linkId = 'sl-g1';
  L[1].group = GROUP;
  L[1].linkId = 'sl-g2';
  L[2].group = 'Session du 19 novembre';
  L[2].linkId = 'sl-g3';
  t.share_links.push(
    ...['sl-g1', 'sl-g2', 'sl-g3'].map((id, i) => ({
      id,
      demo_id: DEMO,
      workspace_id: ws,
      token: `jeton-g${i}-00001`,
      name: L[i].name,
      variables: {},
      cohort: L[i].group,
      is_active: true,
    })),
  );
  state.learners = f.progress;
  state.learnerDetail = f.detail;
  await page.goto(`${APP}/#/learners`);
  await page.waitForSelector('.l13-table');
  await page.getByRole('button', { name: /^Groupe\s*:/ }).click();
  await page.getByRole('menuitem', { name: GROUP }).click();
  await page.waitForTimeout(300);
  ok((await page.locator('.l13-table tbody tr').count()) === 2, 'n° 3 : filtre « Groupe » dans Apprenants');
  // Retour Lead UX : indicateurs calculés sur le groupe, groupe nommé sous le titre
  const kpiSum = (await page.locator('.kpis').first().locator('.fd-kpi__value').allTextContents())
    .slice(0, 3)
    .reduce((a, x) => a + Number(x), 0);
  ok(kpiSum <= 2, `Lead UX : indicateurs limités au groupe (${kpiSum} apprenants comptés)`);
  ok(
    (await page.locator('.l13-scope').textContent()) === `Groupe\u202f: ${GROUP}`,
    'Lead UX : groupe nommé sous le titre',
  );
  ok(page.url().includes('groupe='), 'n° 3 : filtre gardé dans l’adresse');
  await page.getByRole('button', { name: 'Exporter CSV' }).click();
  const ex = page.getByRole('dialog', { name: 'Exporter en CSV' });
  await ex.waitFor();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    ex.getByRole('button', { name: /^Exporter 2 lignes$/ }).click(),
  ]);
  const rows = (await read(dl)).split('\r\n');
  ok(
    rows[0].startsWith('Nom;E-mail;Structure;Groupe;') && rows.length === 3 && rows[1].includes(`;${GROUP};`),
    'n° 3 : export filtré par groupe, colonne « Groupe »',
  );
  // Fiche : changer le groupe
  await page.locator('.l13-table tbody tr').first().locator('button, a').first().click();
  const drawer = page.getByRole('dialog').filter({ has: page.locator('.l13-structure') });
  await drawer.waitFor();
  const field = drawer.getByLabel('Groupe', { exact: true });
  ok((await field.inputValue()) === GROUP, 'n° 3 : groupe affiché dans la fiche');
  await field.fill('Session du 26 novembre');
  await field.press('Enter');
  await drawer.getByText('Groupe enregistré.').waitFor();
  ok(
    t.share_links.find((l) => l.id === 'sl-g1')?.cohort === 'Session du 26 novembre',
    'n° 3 : groupe modifié depuis la fiche',
  );

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
