/**
 * Conformité aux maquettes (règle D13) : pour chaque écran, capture la maquette d'origine et l'app
 * dans le même état (mêmes données, 1440×900, clair et sombre), puis produit une image côte à côte
 * « Maquette | App » dans docs/tech/conformite/<écran>-<thème>.png.
 * Usage : app web lancée (APP_URL), puis `node e2e/conformite.cjs [écran…]`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const { learnersFixture, resumeFixture, seedPathTables } = require('./learners-data.cjs');
const { centerFixture, seedCenterTables } = require('./center-data.cjs');
const { seedExport } = require('./export-data.cjs');
const { execFileSync } = require('child_process');
const os = require('os');

const APP = process.env.APP_URL || 'http://localhost:5173';
const MAQ = path.resolve(__dirname, '../../../docs/ux/maquettes');
const OUT = path.resolve(__dirname, '../../../docs/tech/conformite');
const VIEW = { width: 1440, height: 900 };

/** Écrans : maquette (fichier + préparation) et route de l'app. */
// Choix du client par écran (outil de suivi « Conformité TutoClick ») : maquette d'origine
// (docs/ux/maquettes/*.html) ou refonte (docs/ux/maquettes/refonte/*.html).
/** L12-07 : étiquettes fictives posées sur les premières démos du jeu de données. */
function seedTags(d) {
  const ws = d.tables.workspaces[0].id;
  const names = [
    ['Logiciel métier', 'blue'],
    ['Conseillers', 'green'],
    ['Agenda', 'orange'],
    ['Jeunes', 'raspberry'],
    ['Module 1', 'plum'],
  ];
  d.tables.tags = names.map(([name, color], i) => ({ id: `tg-${i}`, workspace_id: ws, name, color }));
  const demos = d.tables.demos.filter((x) => x.workspace_id === ws);
  const pick = [
    [0, 1],
    [2, 3],
    [0, 4],
  ];
  d.tables.demo_tags = demos
    .slice(0, 3)
    .flatMap((x, i) => pick[i].map((k) => ({ demo_id: x.id, tag_id: `tg-${k}`, workspace_id: ws })));
}

/** L13 : apprenants fictifs (domaines *.example). */
function seedLearners(d) {
  const f = learnersFixture();
  d.learners = f.progress;
  d.learnerDetail = f.detail;
}

const SCREENS = {
  'CAD-01': { maquette: 'refonte/dashboard.html', route: '/#/' },
  'DSH-01': { maquette: 'refonte/dashboard.html', route: '/#/' },
  'PLN-01': { maquette: 'reference/plans.html', route: '/#/settings/plans' },
  'ANA-01': { maquette: 'reference/analytics.html', route: '/#/analytics' },
  'PRM-01': { maquette: 'reference/parametres.html', route: '/#/settings/members' },
  'EDT-01': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    // État de la maquette : hotspot de l'étape sélectionné (panneau Étape › bulle)
    async prepare(p) {
      await p.locator('.canvas-frame [data-canvas-item]').first().click();
      await p.waitForTimeout(300);
      await p.mouse.move(0, 0);
    },
  },
  'EDT-08': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#rail .step[data-i="5"]').click();
      await p.waitForTimeout(200);
    },
    // EDT-08 : le formulaire se place dans le rail (avant l'étape 2) et s'édite dans l'onglet Étape
    async prepare(p) {
      await p.locator('.ed-rail [data-tool="settings"][aria-pressed="false"]').click();
      await p.getByRole('button', { name: 'Créer le formulaire' }).click();
      await p.waitForSelector('#f-title');
      await p
        .locator('#f-desc')
        .fill('Laissez vos coordonnées, nous vous envoyons l’accès au parcours avancé.');
      await p.waitForTimeout(500);
      await p.mouse.move(0, 0);
    },
  },
  'EDT-09': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#rail .step[data-i="7"]').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.rail-list .step').nth(2).click();
      await p.waitForTimeout(400);
      // Bouton principal activé, pour valider la section « Bouton principal (CTA) » (L48-E : outil du rail)
      await p.locator('.ed-rail [data-tool="cta"][aria-pressed="false"]').click();
      await p.locator('#st-cta-on').check();
      await p.locator('#st-cta-l').fill('Réserver une démo');
      await p.locator('#st-cta-u').fill('https://agenda.example.com/demo');
      await p.waitForTimeout(400);
    },
  },
  'EDT-10': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#tb-design').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.ed-rail [data-tool="design"][aria-pressed="false"]').click();
      await p.waitForTimeout(400);
    },
  },
  'EDT-11': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('#tb-settings').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.ed-rail [data-tool="settings"][aria-pressed="false"]').click();
      await p.waitForTimeout(400);
    },
  },
  'PLY-01': {
    maquette: 'refonte/player.html?view=etape',
    player: true,
  },
  'PLY-01-formulaire': {
    maquette: 'refonte/player.html?view=formulaire',
    player: true,
    async prepare(p) {
      for (let i = 0; i < 2; i++) {
        await p.locator('.p-tip .p-btn-primary, .p-sheet .p-btn-primary').click();
        await p.waitForTimeout(500);
      }
    },
  },
  'PLY-01-fin': {
    maquette: 'refonte/player.html?view=fin',
    player: true,
    async prepare(p) {
      for (let i = 0; i < 6; i++) {
        await p.locator('.p-tip .p-btn-primary, .p-sheet .p-btn-primary').click();
        await p.waitForTimeout(400);
        if (await p.locator('.p-form').count()) {
          await p.locator('.p-form input[type=email]').fill('lea@example.com');
          await p.locator('.p-form input[type=checkbox]').check();
          await p.locator('.p-form button[type=submit]').click();
          await p.waitForTimeout(500);
        }
      }
    },
  },
  'PLY-01-mobile': {
    maquette: 'refonte/player.html?view=etape',
    player: true,
    view: { width: 390, height: 844 },
  },
  'PLY-01-mobile-formulaire': {
    maquette: 'refonte/player.html?view=formulaire',
    player: true,
    view: { width: 390, height: 844 },
    prepare: (p) => SCREENS['PLY-01-formulaire'].prepare(p),
  },
  'PLY-01-mobile-fin': {
    maquette: 'refonte/player.html?view=fin',
    player: true,
    view: { width: 390, height: 844 },
    prepare: (p) => SCREENS['PLY-01-fin'].prepare(p),
  },
  'CAD-02': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async maquettePrep(p) {
      await p.locator('.ws-switch').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.ws-switch').click();
      await p.waitForTimeout(300);
    },
  },
  'CAD-07': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    view: { width: 390, height: 844 },
  },
  'CAD-08': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async maquettePrep(p) {
      await p.evaluate(() => document.querySelector('[data-toast="Lien copié"]').click());
      await p.waitForTimeout(400);
    },
    async prepare(p) {
      await p.locator('.demo-card .menu-trigger, [aria-label^="Actions"]').first().click();
      await p.getByRole('menuitem', { name: 'Dupliquer' }).click();
      await p.waitForSelector('.toast');
      await p.waitForTimeout(300);
    },
  },
  'DSH-02': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async maquettePrep(p) {
      await p.locator('#viewseg [data-value="list"]').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.getByRole('radio', { name: 'Liste' }).click();
      await p.locator('.demos-section').scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
    },
  },
  'DSH-03': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    // Bandeau visible tant qu'une étape manque : ici, aucune capture par l'extension
    seed(d) {
      for (const st of d.tables?.steps ?? []) st.page_url = null;
    },
  },
  'DSH-04': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async prepare(p) {
      await p.getByRole('button', { name: /^Tri\s*: Modifiées récemment/ }).click();
      await p.waitForTimeout(300);
    },
  },
  'DSH-05': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async maquettePrep(p) {
      await p.locator('[data-menu="card-menu"]').first().click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.demo-card .menu-trigger').first().click();
      await p.waitForTimeout(300);
    },
  },
  'DSH-06': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async maquettePrep(p) {
      await p.evaluate(() => (document.getElementById('m-new').hidden = false));
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
      await p.waitForTimeout(400);
    },
  },
  'DSH-08': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async maquettePrep(p) {
      await p.evaluate(() => (document.getElementById('m-del').hidden = false));
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.demo-card .menu-trigger').first().click();
      await p.getByRole('menuitem', { name: 'Supprimer' }).click();
      await p.waitForTimeout(400);
    },
  },
  'DSH-09': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async maquettePrep(p) {
      await p.locator('.empty').scrollIntoViewIfNeeded();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.getByRole('button', { name: /Dossiers/ }).click();
      await p.getByRole('menuitem', { name: 'Nouveau dossier' }).click();
      await p.locator('dialog[open] input').fill('Archives 2025');
      await p.locator('dialog[open] button[type=submit]').click();
      await p.waitForTimeout(500);
      await p.getByRole('button', { name: /Dossiers/ }).click();
      await p.getByRole('menuitem', { name: /Archives 2025/ }).click();
      await p.waitForTimeout(400);
      await p.locator('.empty-folder').scrollIntoViewIfNeeded();
    },
  },
  'DSH-10': {
    maquette: 'reference/dashboard.html',
    route: '/#/',
    async prepare(p) {
      await p.locator('.demo-grid').scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
    },
  },
  'EDT-02': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('[data-menu="more-menu"]').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.ed-bar').getByRole('button', { name: 'Plus d’options' }).click();
      await p.waitForTimeout(300);
    },
  },
  'EDT-03': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('.rail-head [data-menu="add-menu"]').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.rail-foot').getByRole('button', { name: 'Ajouter une étape' }).click();
      await p.waitForTimeout(300);
    },
  },
  'EDT-04': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.locator('.rail-li').nth(1).hover();
      await p.waitForTimeout(200);
    },
  },
  'EDT-05': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      // L48-E : le flou s'ouvre dans sa fenêtre (outil « Flou » du rail)
      await p.locator('.ed-rail [data-tool="blur"]').click();
      await p.locator('#blurm-title').waitFor();
      await p.waitForTimeout(200);
      await p.mouse.move(0, 0);
    },
  },
  'EDT-07': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async maquettePrep(p) {
      await p.locator('.blurbox').first().click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.rail-list .step').nth(1).click();
      await p.waitForTimeout(400);
      await p.locator('.canvas-blur').first().click();
      await p.waitForTimeout(300);
      await p.mouse.move(0, 0);
    },
  },
  'EDT-12': {
    maquette: 'refonte/player.html?view=etape',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.getByRole('radio', { name: 'Aperçu' }).click();
      await p.waitForTimeout(1200);
    },
  },
  'EDT-13': {
    maquette: 'reference/editeur.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    view: { width: 390, height: 844 },
  },
  'PLY-06': {
    maquette: 'refonte/player.html#expired',
    player: true,
    playerPath: '/l/lien-expire',
  },
  // L12 : gains rapides de l'éditeur
  'L12-01': {
    maquette: 'reference/editeur-gains.html?etat=masque',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.locator('.stage-head').click();
      await p.keyboard.press('b');
      const box = await p.locator('.canvas-frame').boundingBox();
      await p.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.3);
      await p.mouse.down();
      await p.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.4, { steps: 5 });
      await p.mouse.up();
      await p.waitForSelector('.blur-panel');
      await p.getByRole('radio', { name: 'Aplat' }).click();
      await p.waitForTimeout(400);
    },
  },
  'L12-02': {
    maquette: 'reference/editeur-gains.html?etat=zoom',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.locator('#zoom-on').check();
      await p.waitForSelector('.canvas-zoom');
      await p
        .locator('.zoom-center')
        .click()
        .catch(() => {});
      await p.locator('#zoom-on').scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
    },
  },
  'L12-03': {
    maquette: 'reference/editeur-gains.html?etat=style',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.locator('.canvas-frame [data-canvas-item]').first().click();
      await p.getByRole('button', { name: 'Appliquer à toutes les étapes…' }).click();
      await p.waitForSelector('.modal');
      await p.waitForTimeout(300);
    },
  },
  'L12-04': {
    maquette: 'reference/editeur-gains.html?etat=recherche',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.locator('.stage-head').click();
      await p.keyboard.press('Control+f');
      await p.fill('#find-q', 'Cliquez');
      await p.waitForTimeout(400);
    },
  },
  'L12-05': {
    maquette: 'reference/editeur-gains.html?etat=boutons',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.locator('.canvas-frame [data-canvas-item]').first().click();
      await p.fill('#hs-prev', 'Retour');
      await p.fill('#hs-next', 'J’ai compris');
      await p.locator('#hs-next').scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
    },
  },
  'L12-06': {
    maquette: 'reference/editeur-gains.html?etat=raccourcis',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit',
    async prepare(p) {
      await p.locator('.stage-head').click();
      await p.keyboard.press('?');
      await p.waitForSelector('.kb-modal');
      // Capture une fois l'animation d'ouverture terminée
      await p.waitForTimeout(800);
    },
  },
  'L12-07': {
    maquette: 'refonte/l12-etiquettes.html?etat=cartes',
    route: '/#/',
    seed: seedTags,
  },
  'L12-07-filtre': {
    maquette: 'refonte/l12-etiquettes.html?etat=filtre',
    route: '/#/',
    seed: seedTags,
    async prepare(p) {
      await p.getByRole('button', { name: /^Étiquettes/ }).click();
      await p.locator('.tg-pop').getByRole('checkbox').first().check();
      await p.waitForTimeout(300);
    },
  },
  'L12-07-reglages': {
    maquette: 'reference/editeur-gains.html?etat=etiquettes',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit?tab=settings',
    seed: seedTags,
    async prepare(p) {
      await p.waitForSelector('.tg-field');
    },
  },
  // L13 : suivi des apprenants
  'L13-01': {
    maquette: 'refonte/l13-suivi.html?view=liste',
    route: '/#/learners?statut=stale',
    seed: seedLearners,
  },
  'L13-02': {
    maquette: 'refonte/l13-suivi.html?view=fiche',
    route: '/#/learners?statut=stale',
    seed: seedLearners,
    async prepare(p) {
      await p.getByRole('button', { name: 'Léa Exemple', exact: true }).click();
      await p.waitForTimeout(500);
    },
  },
  'L13-03': {
    maquette: 'refonte/l13-suivi.html?view=formation',
    route: '/#/learners?tab=formation',
    seed: seedLearners,
  },
  'L13-04': {
    maquette: 'refonte/l13-suivi.html?view=export',
    route: '/#/learners?statut=stale',
    seed: seedLearners,
    async prepare(p) {
      await p.getByRole('checkbox', { name: 'Sélectionner Léa Exemple' }).check();
      await p.getByRole('checkbox', { name: 'Sélectionner Hugo Test' }).check();
      await p.getByRole('button', { name: 'Exporter CSV' }).click();
      await p.waitForTimeout(400);
    },
  },
  'L13-05': {
    maquette: 'refonte/l13-suivi.html?view=rgpd',
    route: '/#/learners?statut=stale',
    seed: seedLearners,
    async prepare(p) {
      await p.getByRole('button', { name: 'Léa Exemple', exact: true }).click();
      await p.getByRole('button', { name: 'Supprimer ses données' }).click();
      await p.waitForTimeout(400);
    },
  },
  'L13-06': {
    maquette: 'refonte/f3-suivi.html?view=resume',
    player: true,
    playerPath: '/l/jeton-exemple',
    rpc: (m) => ({
      resolve_share_link: { demoId: m.demoId, linkId: 'link-1', variables: { first_name: 'Alex' } },
      learner_resume: resumeFixture(m.demoId),
    }),
  },
  'L13-07': {
    maquette: 'refonte/l13-suivi.html?view=gerer',
    route: '/#/learners?statut=stale',
    seed(d) {
      seedLearners(d);
      seedPathTables(d.tables, d.tables.workspaces[0].id);
    },
    async prepare(p) {
      await p.getByRole('button', { name: 'Gérer les formations' }).click();
      await p.waitForSelector('.gm-mods li');
      await p.waitForTimeout(300);
    },
  },
  'L13-07-structures': {
    maquette: 'refonte/l13-suivi.html?view=gerer-structures',
    route: '/#/learners?statut=stale',
    seed(d) {
      seedLearners(d);
      seedPathTables(d.tables, d.tables.workspaces[0].id);
    },
    async prepare(p) {
      await p.getByRole('button', { name: 'Gérer les formations' }).click();
      await p.getByRole('tab', { name: 'Structures' }).click();
      await p.waitForSelector('.gm-st');
      await p.waitForTimeout(300);
    },
  },
  // L14 : centre de formation (page publique dans le lecteur, réglages dans l'app)
  'L14-01': {
    maquette: 'refonte/l14-centre.html?view=accueil',
    player: true,
    playerPath: '/c/ml-exemple',
    waitFor: '.ctr',
    center: () => centerFixture(),
  },
  'L14-02': {
    maquette: 'refonte/l14-centre.html?view=anonyme',
    player: true,
    playerPath: '/c/ml-exemple',
    waitFor: '.ctr',
    center: () => centerFixture({ identified: false }),
  },
  'L14-03': {
    maquette: 'refonte/l14-centre.html?view=filtre',
    player: true,
    playerPath: '/c/ml-exemple?q=agenda&tag=Bureautique',
    waitFor: '.ctr',
    center: () => centerFixture(),
  },
  'L14-04': {
    maquette: 'refonte/l14-centre.html?view=sans-resultat',
    player: true,
    playerPath: "/c/ml-exemple?q=badge%20d'acc%C3%A8s",
    waitFor: '.ctr',
    center: () => centerFixture(),
  },
  'L14-05': {
    maquette: 'refonte/l14-centre.html?view=formation',
    player: true,
    playerPath: '/c/ml-exemple/f/00000000-0000-4000-8000-0000000000f3',
    waitFor: '.ctr',
    center: () => centerFixture({ statsStarted: true }),
  },
  'L14-06': {
    maquette: 'refonte/l14-centre.html?view=terminee',
    player: true,
    playerPath: '/c/ml-exemple/f/00000000-0000-4000-8000-0000000000f2?l=jeton-alex-0001',
    waitFor: '.ctr',
    center: () => centerFixture(),
  },
  'L14-07': {
    maquette: 'refonte/l14-centre.html?view=vide',
    player: true,
    playerPath: '/c/ml-exemple',
    waitFor: '.ctr',
    center: () => centerFixture({ empty: true }),
  },
  'L14-08': {
    maquette: 'refonte/l14-centre.html?view=reglages',
    route: '/#/center',
    seed: (d) => seedCenterTables(d),
  },
  'L14-09': {
    maquette: 'refonte/l14-centre.html?view=reglages-vide',
    route: '/#/center',
    seed: (d) => seedCenterTables(d, { empty: true }),
  },
  // L15 : exports (modale depuis le menu « … » de la démo, version publiée)
  'L15-01': {
    maquette: 'refonte/l15-exports.html?view=pdf',
    route: '/#/',
    seed: (d) => seedExport(d),
    prepare: (p) => openExport(p, 1),
  },
  'L15-02': {
    maquette: 'refonte/l15-exports.html?view=gif',
    route: '/#/',
    seed: (d) => seedExport(d),
    async prepare(p) {
      await openExport(p, 0);
      await p.getByRole('radio', { name: /GIF animé/ }).click();
      await p.waitForTimeout(1500);
      await p.getByRole('button', { name: 'Pause' }).click();
    },
  },
  'L15-03': {
    maquette: 'refonte/l15-exports.html?view=en-cours',
    route: '/#/',
    seed: (d) => seedExport(d),
    async prepare(p) {
      await openExport(p, 0);
      // La capture de l'étape 5 tarde : l'export reste sur « Préparation des captures »
      await p.route('**/storage/v1/object/sign/**/st-5.webp*', () => undefined);
      await p.getByRole('button', { name: 'Exporter en PDF' }).click();
      await p.waitForTimeout(1200);
    },
  },
  'L15-04': {
    maquette: 'refonte/l15-exports.html?view=termine',
    route: '/#/',
    seed: (d) => seedExport(d),
    async prepare(p) {
      await openExport(p, 0);
      await Promise.all([
        p.waitForEvent('download'),
        p.getByRole('button', { name: 'Exporter en PDF' }).click(),
      ]);
      await p.waitForTimeout(400);
    },
  },
  'L15-05': {
    maquette: 'refonte/l15-exports.html?view=erreur',
    route: '/#/',
    seed: (d) => seedExport(d),
    async prepare(p) {
      await openExport(p, 0);
      await p.route('**/storage/v1/object/sign/**/st-5.webp*', (r) => r.fulfill({ status: 404, body: 'x' }));
      await p.getByRole('button', { name: 'Exporter en PDF' }).click();
      await p.waitForSelector('dialog[role="alertdialog"]');
    },
  },
  'L15-06': {
    maquette: 'refonte/l15-exports.html?view=gabarit',
    route: '/#/',
    seed: (d) => seedExport(d),
    render: (b) => pdfDesk(b, 'demo'),
  },
  'L15-07': {
    maquette: 'refonte/l15-exports.html?view=attestation',
    route: '/#/',
    render: (b) => pdfDesk(b, 'certificate'),
  },
  // L11 : partage sécurisé (onglet Accès, écrans visiteur)
  'L11-01': {
    maquette: 'reference/partage-securise.html?etat=mdp',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/share?tab=access',
    seed(d) {
      d.tables.demo_access = [
        {
          demo_id: '0b5c1f0e-0000-4000-8000-000000000001',
          mode: 'password',
          password: 'parcours-2026',
          ask_email: false,
          expires_at: null,
          password_changed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    },
    async prepare(p) {
      await p.waitForSelector('#acc-pw');
    },
  },
  'L11-05': {
    maquette: 'reference/partage-securise.html?etat=expiration',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/share?tab=access',
    seed(d) {
      d.tables.demo_access = [
        {
          demo_id: '0b5c1f0e-0000-4000-8000-000000000001',
          mode: 'link',
          ask_email: false,
          expires_at: '2026-11-30T17:00:00.000Z',
          password_changed_at: null,
          updated_at: new Date().toISOString(),
        },
      ];
    },
    async prepare(p) {
      await p.waitForSelector('#acc-exp-d');
    },
  },
  'L11-06': {
    maquette: 'refonte/l11-acces-visiteur.html?view=mdp',
    player: true,
    gate: { status: 'password_required', title: 'Créer une fiche usager', workspace: 'DSI Missions Locales' },
  },
  'L11-07': {
    maquette: 'refonte/l11-acces-visiteur.html?view=mdp-err',
    player: true,
    gate: {
      status: 'password_wrong',
      remaining: 3,
      title: 'Créer une fiche usager',
      workspace: 'DSI Missions Locales',
    },
  },
  'L11-08': {
    maquette: 'refonte/l11-acces-visiteur.html?view=mdp-bloque',
    player: true,
    gate: {
      status: 'locked',
      retryIn: 48,
      title: 'Créer une fiche usager',
      workspace: 'DSI Missions Locales',
    },
  },
  'L11-12': {
    maquette: 'refonte/l11-acces-visiteur.html?view=expire',
    player: true,
    gate: {
      status: 'expired',
      expiredAt: '2026-11-30T17:00:00.000Z',
      title: 'Créer une fiche usager',
      workspace: 'DSI Missions Locales',
      website: 'https://www.dsi-ml.example',
    },
  },
  // Lot 2 Lead UX : Plans, Analytics (leads), Paramètres
  'PLN-04': { maquette: 'reference/plans.html', route: '/#/settings/plans' },
  'PLN-05': {
    maquette: 'reference/plans.html',
    route: '/#/settings/plans',
    async maquettePrep(p) {
      await p.evaluate(() =>
        [...document.querySelectorAll('h2')]
          .find((h) => /Factures/.test(h.textContent))
          .scrollIntoView({ block: 'center' }),
      );
    },
    async prepare(p) {
      await p.locator('.pl-invoices').scrollIntoViewIfNeeded();
      await p.evaluate(() => document.querySelector('.pl-invoices').scrollIntoView({ block: 'center' }));
    },
  },
  'PLN-08': {
    maquette: 'reference/plans.html',
    route: '/#/settings/plans',
    async maquettePrep(p) {
      await p.evaluate(() => document.getElementById('m-up').removeAttribute('hidden'));
    },
    async prepare(p) {
      await p.getByRole('button', { name: 'Parlons Enterprise' }).click();
      await p.waitForSelector('.modal');
    },
  },
  'ANA-09': {
    maquette: 'reference/analytics.html',
    route: '/#/analytics?tab=leads',
    seed(d) {
      d.tables.leads = [];
    },
    async maquettePrep(p) {
      await p.locator('#vt3').click();
      await p.evaluate(() =>
        [...document.querySelectorAll('#v-leads .empty')].pop().scrollIntoView({ block: 'center' }),
      );
    },
    async prepare(p) {
      await p.waitForSelector('#an-panel-leads .empty');
    },
  },
  'ANA-10': {
    maquette: 'reference/analytics.html',
    route: '/#/leads',
    async maquettePrep(p) {
      await p.locator('#vt3').click();
    },
    async prepare(p) {
      await p.waitForSelector('#an-panel-leads table');
    },
  },
  'PRM-03': {
    maquette: 'reference/parametres.html',
    route: '/#/settings/members',
    async maquettePrep(p) {
      await p.locator('[data-menu="mem-menu"]').first().click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.locator('.table [aria-label^="Actions pour"]').first().click();
      await p.waitForTimeout(300);
    },
  },
  'PRM-05': {
    maquette: 'reference/parametres.html',
    route: '/#/settings/members',
    async maquettePrep(p) {
      await p.evaluate(() => document.getElementById('m-remove').removeAttribute('hidden'));
    },
    async prepare(p) {
      await p.locator('.table [aria-label^="Actions pour"]').first().click();
      await p.getByRole('menuitem', { name: 'Retirer du workspace' }).click();
      await p.waitForSelector('dialog[open] .dialog-body');
      await p.waitForTimeout(200);
    },
  },
  'PRM-06': {
    maquette: 'reference/parametres.html',
    route: '/#/settings/workspace',
    async maquettePrep(p) {
      await p.locator('#st-gen').click();
      await p.evaluate(() => document.getElementById('m-delws').removeAttribute('hidden'));
    },
    async prepare(p) {
      await p.getByRole('button', { name: 'Supprimer le workspace' }).click();
      await p.waitForSelector('dialog[open] .dialog-require');
      await p.waitForTimeout(200);
    },
  },
  'PRM-07': {
    maquette: 'reference/parametres.html',
    route: '/#/settings/brand',
    async maquettePrep(p) {
      await p.locator('#st-brand').click();
    },
  },
  'PRM-08': {
    maquette: 'reference/parametres.html',
    route: '/#/settings/variables',
    async maquettePrep(p) {
      await p.locator('#st-var').click();
    },
  },
  'PRM-09': {
    maquette: 'reference/parametres.html',
    route: '/#/settings/profile',
    async maquettePrep(p) {
      await p.locator('#st-me').click();
    },
  },
  'PRM-11': {
    maquette: 'reference/parametres.html',
    route: '/#/settings/workspace',
    async maquettePrep(p) {
      await p.locator('#st-gen').click();
    },
  },
  'PRT-01': {
    maquette: 'reference/partage.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/share',
  },
  'PRT-02': {
    maquette: 'reference/partage.html',
    route: '/#/demos/0b5c1f0e-0000-4000-8000-000000000001/share',
    async maquettePrep(p) {
      await p.locator('#tab-embed').click();
      await p.waitForTimeout(200);
    },
    async prepare(p) {
      await p.getByRole('tab', { name: 'Intégrer' }).click();
      await p.waitForTimeout(300);
    },
  },
  'CNX-01': {
    maquette: 'reference/connexion.html',
    route: '/#/login',
    signedOut: true,
    // État de la maquette : identifiants saisis, refusés (message sous le mot de passe)
    async prepare(p) {
      await p.fill('#email', 'camille@acme.example');
      await p.fill('#password', 'motdepasse');
      await p.click('button[type=submit]');
      await p.waitForSelector('#login-error');
      await p.fill('#password', 'motdepasse');
      await p.locator('#password').blur();
    },
  },
  'INS-01': {
    maquette: 'reference/inscription.html',
    route: '/#/signup',
    signedOut: true,
    // État de la maquette : mot de passe saisi (robustesse « bonne »), autres champs vides
    async prepare(p) {
      await p.fill('#password', 'Demo-2026!');
      await p.locator('#password').blur();
    },
  },
  'ONB-01': {
    maquette: 'reference/onboarding.html',
    route: '/#/onboarding',
    // État de la maquette : étape 1, nom de l'espace saisi, « Site web » choisi
    async prepare(p) {
      await p.fill('#ws-name', 'Acme Analytics');
      await p.locator('#ws-name').blur();
    },
  },
  'ONB-02': {
    maquette: 'reference/onboarding.html',
    maquettePrep: (p) => p.click('#p1 [data-next="2"]'),
    route: '/#/onboarding',
    async prepare(p) {
      await p.fill('#ws-name', 'Acme Analytics');
      await p.click('button[type=submit]');
      await p.waitForSelector('#ob-h2');
      await p.mouse.move(0, 0);
    },
  },
  'ONB-03': {
    maquette: 'reference/onboarding.html',
    maquettePrep: async (p) => {
      await p.click('#p1 [data-next="2"]');
      await p.click('#p2 [data-next="3"]');
      await p.mouse.move(0, 0);
    },
    route: '/#/onboarding',
    async prepare(p) {
      await p.fill('#ws-name', 'Acme Analytics');
      await p.click('button[type=submit]');
      await p.waitForSelector('#ob-h2');
      await p.getByRole('button', { name: 'J’ai installé l’extension' }).click();
      await p.waitForTimeout(600);
      await p.mouse.move(0, 0);
    },
  },
};

async function shotMaquette(b, file, theme, prep, view = VIEW) {
  const p = await b.newPage({ viewport: view });
  await p.goto(`file://${MAQ}/${file}${file.includes('?') ? '&' : '?'}theme=${theme}`);
  await p.evaluate((th) => {
    document.documentElement.dataset.theme = th;
    document.querySelector('.mock-nav')?.remove();
    // bascule clair / sombre des maquettes de refonte
    document.querySelector('[data-theme-set]')?.parentElement?.remove();
  }, theme);
  await p.waitForTimeout(500);
  if (prep) await prep(p);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';

/** Lecteur (PLY-01) : manifeste de la maquette servi à la place du stockage. */
async function shotPlayer(b, s, theme) {
  const manifest = require('./player-maquette.cjs');
  const p = await b.newPage({ viewport: s.view || VIEW, colorScheme: theme, locale: 'fr-FR' });
  await p.route('**/functions/v1/**', (r) =>
    r.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } }),
  );
  // L11 : réponse d'open-demo propre à l'état (mot de passe, lien expiré…), sinon la démo s'ouvre
  await p.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(s.gate ?? { status: 'ok', manifest }),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    }),
  );
  await p.route('**/assets/a.webp', (r) =>
    r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'fixture.png')) }),
  );
  await p.route('**/rest/v1/rpc/**', (r) => {
    const fn = new URL(r.request().url()).pathname.split('/').pop();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    // L13-06 : réponses propres à l'état (lien personnalisé, reprise) ; PLY-06 : un lien expiré ne se résout pas
    const rpc = s.rpc?.(manifest)?.[fn];
    return r.fulfill({
      contentType: 'application/json',
      body: rpc !== undefined ? JSON.stringify(rpc) : s.playerPath ? 'null' : '"ok"',
      headers: cors,
    });
  });
  // L14 : centre de formation (réponse d'open-center propre à l'état)
  if (s.center)
    await p.route('**/functions/v1/open-center', (r) =>
      r.request().method() === 'OPTIONS'
        ? r.fulfill({
            status: 204,
            headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
          })
        : r.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(s.center()),
            headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
          }),
    );
  await p.goto(`${PLAYER}/#${s.playerPath ?? `/d/${manifest.demoId}`}`);
  await p.waitForSelector(s.waitFor ?? (s.playerPath || s.gate ? '.p-sys-card' : '.p-stage'));
  await p.waitForTimeout(900);
  if (s.prepare) await s.prepare(p);
  await p.mouse.move(0, 0);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

/** L15 : ouvre la modale d'export de la première démo, puis va à la page `page` de l'aperçu. */
async function openExport(p, page) {
  await p
    .getByRole('button', { name: /Actions.*Créer une fiche usager/ })
    .first()
    .click();
  await p.getByRole('menuitem', { name: 'Exporter (PDF, GIF)' }).click();
  await p.waitForFunction(() =>
    /\d+ pages/.test(document.querySelector('.x15-foot .fd-help')?.textContent || ''),
  );
  for (let i = 0; i < page; i++) await p.getByRole('button', { name: 'Page suivante' }).click();
  await p.waitForTimeout(500);
}

/** PDF téléchargé → pages PNG (pdftoppm), posées sur un fond ardoise comme la maquette. */
function pdfPages(buf, pages, dpi = 60) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'l15-'));
  fs.writeFileSync(path.join(dir, 'f.pdf'), buf);
  return pages.map((n) => {
    execFileSync('pdftoppm', [
      '-r',
      String(dpi),
      '-png',
      '-f',
      String(n),
      '-l',
      String(n),
      '-singlefile',
      path.join(dir, 'f.pdf'),
      path.join(dir, `p${n}`),
    ]);
    return fs.readFileSync(path.join(dir, `p${n}.png`));
  });
}

async function pdfDesk(b, kind) {
  const shots = [];
  if (kind === 'demo') {
    const p = await b.newPage({ viewport: VIEW, acceptDownloads: true, locale: 'fr-FR' });
    const data = seedMaquette();
    seedExport(data);
    await install(p, data);
    await p.goto(`${APP}/#/`);
    await p.waitForTimeout(1500);
    await openExport(p, 0);
    const grab = async () => {
      const [dl] = await Promise.all([
        p.waitForEvent('download'),
        p.getByRole('button', { name: 'Exporter en PDF' }).click(),
      ]);
      const buf = fs.readFileSync(await dl.path());
      await p.getByRole('button', { name: 'Exporter dans un autre format' }).click();
      return buf;
    };
    const one = await grab();
    shots.push(
      ...pdfPages(one, [1, 4]).map((img, i) => [img, i ? 'Une étape par page' : 'Couverture et sommaire']),
    );
    await p.getByRole('radio', { name: 'Deux étapes par page' }).click();
    shots.push([pdfPages(await grab(), [2])[0], 'Deux étapes par page']);
    await p.getByRole('radio', { name: 'Une étape par page' }).click();
    await p.getByRole('switch', { name: /Captures d'écran/ }).click();
    shots.push([pdfPages(await grab(), [2])[0], 'Sans captures']);
    await p.close();
  } else {
    const p = await b.newPage({ viewport: VIEW, acceptDownloads: true, locale: 'fr-FR' });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    await p.route('**/functions/v1/open-center', (r) =>
      r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(centerFixture()),
            headers: cors,
          }),
    );
    await p.route('**/rest/v1/rpc/issue_certificate', (r) =>
      r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({
            contentType: 'application/json',
            headers: cors,
            body: JSON.stringify({
              certificateId: '000042',
              issuedAt: '2026-11-12T10:00:00Z',
              learner: 'Alex Martin',
              path: 'Agenda partagé',
              workspace: 'Mission Locale Exemple',
              validatedAt: '2026-11-04T11:00:00Z',
              modules: [
                { title: 'Partager un agenda', best: null },
                { title: 'Planifier un rendez-vous', best: 85 },
              ],
            }),
          }),
    );
    const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
    await p.goto(`${PLAYER}/#/c/ml-exemple/f/00000000-0000-4000-8000-0000000000f2?l=jeton-alex-0001`);
    await p.waitForSelector('.fp-done button');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.fp-done button').click()]);
    shots.push([
      pdfPages(fs.readFileSync(await dl.path()), [1], 90)[0],
      'Attestation de suivi (A4, une page)',
    ]);
    await p.close();
  }
  const p = await b.newPage({ viewport: VIEW });
  const img = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  await p.setContent(`<!doctype html><html><body style="margin:0;background:#5B6670;font:600 13px system-ui;color:#fff">
    <div style="display:flex;gap:20px;justify-content:center;align-items:flex-start;padding:72px 16px 16px">
    ${shots
      .map(
        ([buf, label]) =>
          `<figure style="margin:0;text-align:center"><img src="${img(buf)}" style="height:${kind === 'demo' ? 440 : 760}px;box-shadow:0 8px 24px rgba(0,0,0,.3);display:block"><figcaption style="margin-top:10px">${label}</figcaption></figure>`,
      )
      .join('')}
    </div></body></html>`);
  await p.waitForTimeout(300);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

async function shotApp(b, s, theme) {
  if (s.render) return s.render(b, theme);
  if (s.player) return shotPlayer(b, s, theme);
  const p = await b.newPage({ viewport: s.view || VIEW });
  await p.addInitScript((th) => {
    try {
      localStorage.setItem('fd.theme', th);
    } catch {}
  }, theme);
  const data = seedMaquette();
  if (s.seed) s.seed(data);
  await install(p, { ...data, signedOut: Boolean(s.signedOut) });
  await p.goto(`${APP}${s.route}`);
  await p.waitForTimeout(1800);
  if (s.prepare) await s.prepare(p);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

async function sideBySide(b, left, right, label, view = VIEW) {
  const p = await b.newPage({ viewport: { width: view.width * 2 + 48, height: view.height + 64 } });
  const img = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  await p.setContent(`<!doctype html><html><body style="margin:0;font:600 18px system-ui;background:#888">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px">
      <div><div style="color:#fff;margin:0 0 8px">Maquette · ${label}</div><img src="${img(left)}" style="width:100%;display:block"></div>
      <div><div style="color:#fff;margin:0 0 8px">App · ${label}</div><img src="${img(right)}" style="width:100%;display:block"></div>
    </div></body></html>`);
  const buf = await p.screenshot({ fullPage: true });
  await p.close();
  return buf;
}

(async () => {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const [name, s] of Object.entries(SCREENS)) {
    if (only.length && !only.includes(name)) continue;
    for (const theme of ['light', 'dark']) {
      const left = await shotMaquette(b, s.maquette, theme, s.maquettePrep, s.view);
      const right = await shotApp(b, s, theme);
      // Capture de l'app seule (téléversée dans l'outil de suivi « Conformité TutoClick »)
      fs.writeFileSync(path.join(OUT, `${name}-app-${theme === 'light' ? 'clair' : 'sombre'}.png`), right);
      fs.writeFileSync(
        path.join(OUT, `${name}-${theme === 'light' ? 'clair' : 'sombre'}.png`),
        await sideBySide(b, left, right, `${name} (${theme === 'light' ? 'clair' : 'sombre'})`, s.view),
      );
      console.log(`ok - ${name} (${theme})`);
    }
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
