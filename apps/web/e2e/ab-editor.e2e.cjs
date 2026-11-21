/**
 * Test e2e L18-01 / 02 (éditeur) : test A/B. Création de la variante B (texte copié), sélecteur A / B
 * au-dessus du canevas, cartes et phrase de résultat prudente, objectif, répartition, texte de B,
 * un seul test par démo, « Garder B et terminer », « Arrêter le test » avec confirmation.
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/ab-editor.e2e.cjs
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
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const shot = async (name) => {
    for (const x of await page.locator('.mk-toasts button[aria-label]').all())
      await x.click().catch(() => {});
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.tables.ab_tests = [];
  state.abResults = {
    completion: { A: { visitors: 206, reached: 82 }, B: { visitors: 206, reached: 105 } },
    cta: { A: { visitors: 206, reached: 60 }, B: { visitors: 206, reached: 40 } },
    lead: { A: { visitors: 20, reached: 1 }, B: { visitors: 30, reached: 2 } },
  };
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  // L48-E : le test A/B est dans l'outil « Étape » du rail
  const panel = page.locator('[data-tool-panel="step"]');
  if ((await panel.count()) === 0) await page.locator('[data-tool="step"]').first().click();
  const create = panel.getByRole('button', { name: 'Créer une variante B' });
  await create.scrollIntoViewIfNeeded();
  await shot('l18-01-ab-creer');

  // L18-01 : création
  await create.click();
  await panel.getByText('B mène de 11 points sur 412 visiteurs.').waitFor();
  const test = state.tables.ab_tests[0];
  const h = state.tables.hotspots.find((x) => x.id === test.hotspot_id);
  ok(
    test.variant_b.title === h.title && test.variant_b.body === h.body,
    'variante B : titre et texte copiés',
  );
  ok(
    (await panel.getByRole('status').filter({ hasText: 'mène' }).textContent()).includes(
      'Résultat fiable à partir d’environ 1\u00a0000 visiteurs.',
    ),
    'phrase prudente et seuil de fiabilité',
  );
  ok((await panel.locator('.ab-card--lead-B').count()) === 1, 'carte de B en tête (bordure)');
  ok((await page.locator('.ab-pill--B').first().textContent()) === 'B', 'pastille avec la lettre');

  // Sélecteur du canevas et texte de B
  const sw = page.getByRole('radiogroup', { name: 'Test A/B' });
  ok(
    (await sw.getByRole('radio', { name: /Variante B/ }).getAttribute('aria-checked')) === 'true',
    'canevas : variante B affichée',
  );
  await panel.getByLabel('Titre', { exact: true }).fill('Créez votre rapport en un clic');
  await page.waitForTimeout(1000);
  ok(
    test.variant_b.title === 'Créez votre rapport en un clic' && test.history.length >= 1,
    `texte de B enregistré et horodaté (${JSON.stringify(test.variant_b)} ${test.history.length})`,
  );
  ok(
    (await page.locator('.canvas-frame').textContent()).includes('Créez votre rapport en un clic'),
    'canevas : texte de B',
  );
  await sw.getByRole('radio', { name: /Variante A/ }).click();
  ok(
    !(await page.locator('.canvas-frame').textContent()).includes('Créez votre rapport en un clic'),
    'canevas : retour à A',
  );
  await sw.getByRole('radio', { name: /Variante B/ }).click();

  // Objectif et répartition
  await panel.getByLabel('Objectif').selectOption('cta');
  await panel.getByText('A mène de 10 points sur 412 visiteurs.').waitFor();
  ok(test.goal === 'cta', 'objectif changé sans redémarrer');
  ok(
    (await panel.getByRole('button', { name: 'Garder A et terminer' }).count()) === 1,
    'A mène : « Garder A et terminer »',
  );
  await panel.getByLabel('Objectif').selectOption('lead');
  await panel.getByText('Pas encore assez de visiteurs pour comparer.').waitFor();
  ok((await panel.locator('.ab-card--lead').count()) === 0, 'sous 50 visiteurs : aucun meneur');
  await panel.getByLabel('Objectif').selectOption('completion');
  // L18-02 : capture avec la section entière (cartes, champs de B, actions), répartition 50/50
  // cohérente avec 206 visiteurs de chaque côté
  ok(
    (await panel
      .locator('.ab-sec .fd-status')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 12,
    'état « En cours » en texte (L50 X4), à la taille standard',
  );
  await panel
    .locator('.ab-sec .sec-title')
    .first()
    .evaluate((el) => {
      let p = el.parentElement;
      while (p && p.scrollHeight <= p.clientHeight) p = p.parentElement;
      if (p) p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top - 8;
    });
  await page.waitForTimeout(300);
  ok(
    await panel
      .getByRole('button', { name: 'Arrêter le test' })
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    'capture : actions de la section visibles',
  );
  await shot('l18-02-ab');
  const split = panel.getByLabel('Répartition');
  await split.focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  ok(
    test.split_b === 60 && (await split.getAttribute('aria-valuetext')) === `A 40${N}%, B 60${N}%`,
    'répartition par pas de 10',
  );

  // Un seul test par démo
  await page.locator('[data-step-index="1"]').click();
  await page.waitForTimeout(300);
  const other = panel.getByRole('button', { name: 'Créer une variante B' });
  if (await other.count()) {
    ok(await other.isDisabled(), 'autre étape : bouton désactivé');
    ok(
      (await panel.getByText('Un test est déjà en cours à l’étape 1.').count()) === 1,
      'aide « Un test est déjà en cours à l’étape 1 »',
    );
  }
  await page.locator('[data-step-index="0"]').click();

  // Garder B
  await panel.getByRole('button', { name: 'Garder B et terminer' }).click();
  await page.waitForTimeout(600);
  ok(
    test.status === 'ended' && test.kept === 'B' && h.title === 'Créez votre rapport en un clic',
    'B remplace A, test archivé',
  );
  ok((await page.getByRole('radiogroup', { name: 'Test A/B' }).count()) === 0, 'sélecteur retiré');

  // Arrêter
  await panel.getByRole('button', { name: 'Créer une variante B' }).click();
  await panel.getByRole('button', { name: 'Arrêter le test' }).waitFor();
  await panel.getByRole('button', { name: 'Arrêter le test' }).click();
  const conf = page.getByRole('dialog', { name: `Arrêter le test${N}?` });
  await conf.waitFor();
  ok((await conf.textContent()).includes('Les visiteurs verront à nouveau la variante A.'), 'confirmation');
  await conf.getByRole('button', { name: 'Arrêter le test' }).click();
  await page.waitForTimeout(500);
  ok(state.tables.ab_tests[1].status === 'stopped', 'test arrêté');

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
