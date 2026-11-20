/**
 * REV-02/03/04/06 : onboarding (usages, nom de l'espace, titre sans anneau de focus, aide de l'extension,
 * import de captures, étape 3 reprise de la prise en main) et import d'images (Nouvelle démo, une étape
 * par image dans l'ordre des fichiers ; outil « Remplacer l'image » de l'éditeur). Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/onboarding-import.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const shot = async (name) => {
    if (!SHOTS) return;
    for (const x of await page.locator('.toast-close').all()) await x.click().catch(() => {});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  const t = state.tables;
  await install(page, state);
  // Deux images de tailles différentes, nommées dans le désordre
  await page.goto(`${APP}/#/`);
  await page.waitForTimeout(300);
  const img = async (w, h) => page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  const files = [
    { name: 'ecran-10.png', mimeType: 'image/png', buffer: await img(400, 250) },
    { name: 'ecran-2.png', mimeType: 'image/png', buffer: await img(300, 200) },
  ];

  // ===== Étape 1 =====
  await page.goto(`${APP}/#/onboarding`);
  await page.waitForSelector('#ws-name');
  const body1 = await page.locator('.ob-card').innerText();
  ok(!/Deux questions/.test(body1), 'plus de promesse de modèles');
  ok(
    (await page.getByLabel('Nom de l’espace').count()) === 1 &&
      /En général, le nom de votre structure ou de votre service\./.test(body1),
    '« Nom de l’espace » et son aide',
  );
  for (const u of ['Former les équipes', 'Documenter une procédure', 'Annoncer un changement de version'])
    ok((await page.getByRole('radio', { name: new RegExp(u) }).count()) === 1, `usage « ${u} »`);
  await shot('rev-02-onboarding-1');
  await page.getByLabel('Nom de l’espace').fill('Service RH Acme');
  await page.keyboard.press('Enter');

  // ===== Étape 2 =====
  const h2 = page.getByRole('heading', { name: 'Installez l’extension de capture' });
  await h2.waitFor();
  await page.waitForTimeout(100);
  const ring = await h2.evaluate((el) => {
    const cs = getComputedStyle(el);
    return document.activeElement === el && `${cs.outlineStyle}|${cs.boxShadow}`;
  });
  ok(ring === 'none|none', `titre focalisé sans anneau de focus (${ring})`);
  const soon = await page.locator('.ob-ext-actions .badge').count();
  ok(soon === 0, 'plus de badge « Bientôt » sur l’extension ni l’import');
  ok(
    (await page.getByRole('button', { name: /Continuer sans l’extension/ }).count()) === 1,
    'bouton « Continuer sans l’extension »',
  );
  await shot('rev-03-onboarding-2');
  await page.getByRole('button', { name: 'Ajouter à Chrome' }).click();
  await page
    .locator('#help-drawer')
    .getByText(/extension/i)
    .first()
    .waitFor();
  ok(true, '« Ajouter à Chrome » ouvre l’article d’aide');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Continuer sans l’extension/ }).click();

  // ===== Étape 3 =====
  await page.getByRole('heading', { name: 'Votre première démo vous attend' }).waitFor();
  const card3 = page.locator('.ob-card');
  await card3.getByText('Personnaliser l’espace').waitFor();
  const body3 = await card3.innerText();
  ok(
    /Personnaliser l’espace/.test(body3) &&
      /Installer l’extension/.test(body3) &&
      /Capturer une première démo/.test(body3),
    'étapes reprises de la prise en main de l’espace',
  );
  ok(/Une étape par clic\./.test(body3) && !/5 à 10 clics/.test(body3), '« Une étape par clic. »');
  ok(
    (await card3.getByRole('button', { name: 'Aller à mes démos' }).count()) === 1,
    'bouton « Aller à mes démos »',
  );
  await shot('rev-04-onboarding-3');
  await card3.getByRole('button', { name: 'Démarrer' }).click();
  const nd = page.getByRole('dialog', { name: 'Nouvelle démo' });
  await nd.waitFor();
  ok(true, '« Démarrer » ouvre « Nouvelle démo » sur le tableau de bord');

  // ===== Nouvelle démo > Importer des images =====
  const imp = nd.getByRole('button', { name: /Importer des images/ });
  ok(
    (await imp.getAttribute('aria-disabled')) === null && !/Bientôt/.test(await imp.innerText()),
    'import actif',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await nd.screenshot({ path: `${SHOTS}/rev-06-nouvelle-demo${sfx}.png` });
  }
  const before = t.demos.length;
  await nd.locator('input[type=file]').setInputFiles(files);
  await page.waitForURL(/\/edit\?guide=1$/);
  ok(t.demos.length === before + 1, 'démo créée');
  const id = page.url().match(/demos\/([^/]+)\/edit/)[1];
  const steps = t.steps.filter((s) => s.demo_id === id).sort((a, b) => a.position - b.position);
  ok(
    steps.length === 2 && steps[0].image_width === 300 && steps[1].image_width === 400,
    'une étape par image, dans l’ordre des fichiers (ecran-2 puis ecran-10)',
  );
  ok(
    steps.every((s) => s.element_meta?.imported),
    'étapes marquées importées (bilan RGPD)',
  );
  await page.getByText(/2 images importées.: aucune détection automatique/).waitFor();
  const warn = page.locator('.toast.toast--warning');
  ok((await warn.count()) === 1, 'avertissement en variante avertissement');

  // ===== Onboarding > Importer des captures à la place =====
  await page.goto(`${APP}/#/onboarding`);
  await page.getByLabel('Nom de l’espace').fill('Agence Exemple');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Installez l’extension de capture' }).waitFor();
  const n = t.demos.length;
  await page.locator('.ob-ext-actions input[type=file]').setInputFiles(files.slice(1));
  await page.waitForURL(/\/edit\?guide=1$/);
  ok(t.demos.length === n + 1, 'onboarding : « Importer des captures à la place » crée une démo');

  // ===== Éditeur : « Remplacer l'image » =====
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  const rep = page.getByRole('button', { name: 'Remplacer l’image', exact: true });
  ok((await rep.getAttribute('aria-disabled')) === null && (await rep.isEnabled()), 'outil image actif');
  const sel = t.steps
    .filter((s) => s.demo_id === DEMO && s.kind === 'image')
    .sort((a, b) => a.position - b.position)[0];
  await page.locator('input[type=file][aria-label="Remplacer l’image"]').setInputFiles(files[0]);
  let changed = [];
  for (let i = 0; i < 40 && !changed.length; i++) {
    await page.waitForTimeout(150);
    changed = t.steps.filter((s) => s.demo_id === DEMO && s.element_meta?.imported);
  }
  ok(
    changed.length === 1 && changed[0].id === sel.id && changed[0].image_width === 400,
    'image de l’étape remplacée et marquée importée',
  );
  ok(
    (await page
      .locator('.toast.toast--warning')
      .filter({ hasText: /^Image importée/ })
      .count()) >= 1,
    'avertissement d’import après remplacement',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
