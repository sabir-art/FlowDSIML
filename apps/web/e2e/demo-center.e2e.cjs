/**
 * Test e2e A8 (L20-03) : Demo Center. Page publique (lecteur) : bouton « Nous contacter », héros,
 * recherche, filtres par étiquette, sections, cartes sans durée, aucune progression, mention
 * d'accessibilité « non conforme ». Réglages (app) : type de centre, héros, bouton.
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/demo-center.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedCenterTables } = require('./center-data.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const D = (n) => `0b5c1f0e-0000-4000-8000-0000000001d${n}`;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const fixture = (center = {}) => ({
  status: 'ok',
  title: '',
  workspace: 'Acme',
  center: {
    title: '',
    intro: '',
    brand: '#A3195B',
    accent: '#95C11F',
    style: 'workspace',
    logoPath: null,
    help: '',
    a11y: 'non_evalue',
    a11yUrl: '',
    privacyUrl: 'https://www.acme.example/confidentialite',
    indexable: false,
    workspace: 'Acme',
    kind: 'demo',
    heroTitle: '',
    heroSubtitle: '',
    cta: { label: 'Nous contacter', url: 'https://www.acme.example/contact' },
    ...center,
  },
  visitor: null,
  paths: [],
  demos: [
    {
      demoId: D(1),
      title: 'Créer une fiche usager',
      kind: 'guided',
      steps: 6,
      section: 'Logiciel métier',
      tags: [{ name: 'Usagers', color: 'blue' }],
      cover: null,
    },
    {
      demoId: D(2),
      title: 'Planifier un rendez-vous',
      kind: 'guided',
      steps: 1,
      section: 'Logiciel métier',
      tags: [{ name: 'Agenda', color: 'orange' }],
      cover: null,
    },
    {
      demoId: D(3),
      title: 'Explorer librement',
      kind: 'sandbox',
      steps: 5,
      section: 'Logiciel métier',
      tags: [{ name: 'Sandbox', color: 'plum' }],
      cover: null,
    },
    {
      demoId: D(4),
      title: 'Statistiques mensuelles',
      kind: 'guided',
      steps: 4,
      section: null,
      tags: [{ name: 'Nouveautés', color: 'green' }],
      cover: null,
    },
  ],
});

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  async function hub(viewport, center) {
    const p = await (await themedContext(b, { viewport, locale: 'fr-FR' })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/functions/v1/open-center', (r) =>
      r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({
            contentType: 'application/json',
            headers: cors,
            body: JSON.stringify(fixture(center)),
          }),
    );
    await p.goto(`${PLAYER}/#/c/demos-acme`);
    await p.locator('h1').waitFor();
    return p;
  }

  // ===== Page publique =====
  const p = await hub({ width: 1440, height: 900 });
  ok((await p.locator('h1').innerText()) === 'Découvrez nos outils', 'héros : titre par défaut');
  ok(
    (await p.getByText('Des démos interactives, sans inscription.').count()) === 1,
    'héros : sous-titre par défaut',
  );
  const cta = p.getByRole('link', { name: 'Nous contacter' });
  ok(
    (await cta.getAttribute('href')) === 'https://www.acme.example/contact',
    'bouton « Nous contacter » (lien)',
  );
  ok((await p.locator('header').innerText()).includes('Acme'), 'nom du centre : celui du workspace');
  ok((await p.getByText('Démo guidée · 6 étapes').count()) === 1, 'carte : « Démo guidée · n étapes »');
  ok((await p.getByText('Démo guidée · 1 étape').count()) === 1, 'carte : singulier');
  ok((await p.getByText('Sandbox · 5 pages').count()) === 1, 'carte : « Sandbox · n pages »');
  ok(!/\d\s?min\b|minute/.test(await p.locator('main').innerText()), 'aucune durée affichée');
  ok(
    (await p.getByRole('complementary', { name: 'Ma progression' }).count()) === 0 &&
      (await p.getByText('Retrouvez votre progression').count()) === 0,
    'pas de progression ni de compte',
  );
  ok((await p.getByRole('heading', { name: /Logiciel métier/ }).count()) === 1, 'section par dossier');
  ok(
    (await p.getByRole('heading', { name: /Autres démos/ }).count()) === 1,
    'démos sans dossier : « Autres démos »',
  );
  ok(
    (await p.locator('.ctr-foot').innerText()).includes('Accessibilité : non conforme'),
    'accessibilité « non conforme » par défaut',
  );
  ok((await p.locator('a.fc').first().getAttribute('href')) === `#/d/${D(1)}`, 'carte : lien vers la démo');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l20-03-demo-center${sfx}.png`, fullPage: true });
  // Filtres par étiquette et recherche
  await p
    .getByRole('group', { name: 'Filtrer par catégorie' })
    .getByRole('button', { name: /Sandbox/ })
    .click();
  await p.waitForTimeout(200);
  ok((await p.locator('a.fc').count()) === 1, 'filtre par étiquette');
  await p
    .getByRole('group', { name: 'Filtrer par catégorie' })
    .getByRole('button', { name: /Toutes/ })
    .click();
  await p.getByRole('searchbox', { name: 'Rechercher une démo' }).fill('rendez');
  await p.waitForTimeout(500);
  ok((await p.locator('a.fc').count()) === 1 && (await p.getByText('1 démo').count()) >= 1, 'recherche');
  // Héros personnalisé, mobile
  const m = await hub(
    { width: 390, height: 844 },
    { heroTitle: 'Démos d’Acme', heroSubtitle: 'Choisissez un outil.' },
  );
  ok((await m.locator('h1').innerText()) === 'Démos d’Acme', 'héros : titre réglé');
  ok(
    await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    '390 px : sans défilement horizontal',
  );
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/l20-03-demo-center-mobile${sfx}.png`, fullPage: true });

  // ===== Réglages =====
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  a.on('pageerror', (e) => errors.push(e.message));
  const s = seed();
  seedCenterTables(s);
  await install(a, s);
  await a.goto(`${APP}/#/center`);
  const kinds = a.getByRole('radiogroup', { name: 'Type de centre' });
  await kinds.waitFor();
  ok(
    (await a.getByRole('heading', { name: /Formations visibles|Formations/ }).count()) >= 1,
    'centre de formation : formations visibles',
  );
  await kinds.getByRole('radio', { name: /Catalogue de démos/ }).check();
  await a.waitForTimeout(1300);
  const row = () => s.tables.training_centers[0];
  ok(row().draft.kind === 'demo', 'type de centre enregistré');
  ok((await a.locator('#c-vis').count()) === 0, 'Catalogue de démos : formations masquées');
  ok(
    (await a.getByLabel('Titre du héros', { exact: true }).getAttribute('placeholder')) ===
      'Découvrez nos outils',
    'héros : valeur par défaut proposée',
  );
  await a.getByLabel('Lien', { exact: true }).fill('http://acme.example');
  await a.getByLabel('Lien', { exact: true }).blur();
  ok((await a.getByRole('alert').filter({ hasText: 'lien https' }).count()) === 1, 'lien non https refusé');
  await a.getByLabel('Lien', { exact: true }).fill('https://www.acme.example/contact');
  await a.getByLabel('Lien', { exact: true }).blur();
  await a.waitForTimeout(1300);
  ok(
    row().draft.cta?.url === 'https://www.acme.example/contact' && row().draft.cta.label === 'Nous contacter',
    'bouton enregistré',
  );
  ok(
    (await a.getByText('Formulaire de lead à la place du lien').count()) === 1,
    'formulaire de lead : « Bientôt »',
  );
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/l20-03-reglages${sfx}.png`, fullPage: true });
  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
