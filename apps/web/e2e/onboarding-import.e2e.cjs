/**
 * L48-C : assistant de démarrage en 5 étapes (progression, prénom prérempli, espace créé à l'étape 2,
 * usages et reprise après rechargement, détection de l'extension, première capture) et import d'images (Nouvelle démo, une étape
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

  // ===== L48-C : assistant en 5 étapes =====
  await page.goto(`${APP}/#/onboarding`);
  const bar = page.getByRole('progressbar', { name: 'Progression' });
  await bar.waitFor();
  ok(
    (await bar.getAttribute('aria-valuetext')) === 'Étape 1 sur 5' &&
      (await bar.getAttribute('aria-valuemax')) === '5',
    'étape 1 sur 5 (progressbar)',
  );
  ok((await page.getByRole('button', { name: 'Retour' }).count()) === 0, 'pas de « Retour » à l’étape 1');
  // C4 : à l'ouverture, focus sur le titre, sans anneau (même hors clavier)
  const ring1 = await page.locator('h1.obx-h1').evaluate((el) => {
    const cs = getComputedStyle(el);
    return document.activeElement === el && `${cs.outlineStyle}|${cs.boxShadow}`;
  });
  ok(ring1 === 'none|none', `ouverture : titre focalisé sans anneau (${ring1})`);
  ok((await page.getByLabel('Prénom').inputValue()) === 'Alice', 'prénom prérempli depuis le profil');
  await page.getByLabel('Fonction (facultatif)').selectOption('trainer');
  ok(/Formateur ou formatrice/.test(await page.locator('.obx-preview').innerText()), 'aperçu : fonction');
  await shot('l48c-1-profil');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();

  // Étape 2 : espace (titre focalisé sans anneau)
  const h2 = page.getByRole('heading', { name: 'Nommez votre espace' });
  await h2.waitFor();
  await page.waitForTimeout(100);
  const ring = await h2.evaluate((el) => {
    const cs = getComputedStyle(el);
    return document.activeElement === el && `${cs.outlineStyle}|${cs.boxShadow}`;
  });
  ok(ring === 'none|none', `titre focalisé sans anneau de focus (${ring})`);
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  ok((await page.locator('#obx-name-err').count()) === 1, 'nom obligatoire : message sous le champ');
  await page.getByLabel('Nom de l’espace').fill('Service RH Acme');
  ok(
    /Service RH Acme/.test(await page.locator('.obx-preview').innerText()),
    'aperçu : nom dans la barre latérale',
  );
  await page.keyboard.press('Enter');

  // Étape 3 : usages (plusieurs réponses) ; rechargement : reprise à la même étape
  await page.getByRole('heading', { name: 'À quoi servira TutoClick ?' }).waitFor();
  ok(
    t.workspaces.some((w) => w.name === 'Service RH Acme'),
    'espace créé à la sortie de l’étape 2',
  );
  await page.getByRole('checkbox', { name: /Former les conseillers/ }).check();
  ok(
    (await page.locator('.obx-tpl').first().textContent()) === 'Accueil',
    'aperçu : « Accueil » en premier pour « Former les conseillers »',
  );
  await page.reload();
  await page.getByRole('heading', { name: 'À quoi servira TutoClick ?' }).waitFor();
  ok(
    (await page.getByRole('checkbox', { name: /Former les conseillers/ }).isChecked()) &&
      (await bar.getAttribute('aria-valuetext')) === 'Étape 3 sur 5',
    'rechargement : même étape, réponses gardées',
  );
  await shot('l48c-3-usage');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();

  // Étape 4 : extension, détection sans recharger
  await page.getByRole('heading', { name: 'Installez l’extension' }).waitFor();
  ok((await page.getByText('Extension détectée').count()) === 0, 'extension pas encore détectée');
  // §18.4 : « Bientôt disponible » sur la ligne du titre, 13 px, texte atténué, non gras
  const soon = await page.locator('h1.obx-h1 .obx-soon').evaluate((el) => {
    const cs = getComputedStyle(el);
    const muted = getComputedStyle(document.documentElement).getPropertyValue('--fd-color-text-muted').trim();
    const probe = document.createElement('span');
    probe.style.color = muted;
    document.body.append(probe);
    const ref = getComputedStyle(probe).color;
    probe.remove();
    return { txt: el.textContent, fs: cs.fontSize, fw: cs.fontWeight, muted: cs.color === ref };
  });
  ok(
    soon.txt === 'Bientôt disponible' && soon.fs === '13px' && soon.fw === '400' && soon.muted,
    `§18.4 : « Bientôt disponible » dans le titre, 13 px, atténué (${JSON.stringify(soon)})`,
  );
  // Retours UX 5fbb31d : nom accessible du titre avec une espace ; pas de navigateurs tant qu'on ne peut pas installer
  ok(
    (await page.getByRole('heading', { name: 'Installez l’extension Bientôt disponible' }).count()) === 1,
    'titre « Installez l’extension Bientôt disponible » (espace dans le nom accessible)',
  );
  ok(
    (await page.getByText('Chrome, Edge, Brave et Arc').count()) === 0,
    'état « Bientôt » : pas de liste de navigateurs',
  );
  t.profiles[0].extension_seen_at = new Date().toISOString();
  await page.getByText('Extension détectée').waitFor({ timeout: 4000 });
  ok(true, 'extension détectée en 2 s, sans recharger');
  ok(
    (await page.getByText('Chrome, Edge, Brave et Arc').count()) === 1,
    'extension détectée : navigateurs affichés',
  );
  ok(
    (await page.getByRole('button', { name: 'Ajouter à Chrome' }).count()) === 0 &&
      (await page.getByRole('link', { name: /Ajouter à Chrome/ }).count()) === 0,
    'C3 : extension détectée, « Ajouter à Chrome » masqué',
  );
  await shot('l48c-4-extension');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();

  // Étape 5 : première capture
  await page.getByRole('heading', { name: 'Lancez votre première capture' }).waitFor();
  ok((await page.locator('.obx-lines li').count()) === 3, 'trois lignes numérotées');
  await page.getByRole('button', { name: 'Ouvrir mon espace' }).click();
  await page.waitForURL(/#\/$/);
  ok(true, '« Ouvrir mon espace » mène à Démos');

  // Nouvelle démo > Modèles : « Accueil » en premier
  await page.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  const nd = page.getByRole('dialog', { name: 'Nouvelle démo' });
  await nd.waitFor();
  // L48-G : étape 1 (type de contenu), puis la source
  await nd.getByRole('button', { name: 'Continuer', exact: true }).click();

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

  // ===== Nouvelle démo > Modèles : catégorie de l'usage déclaré en premier =====
  // Sous charge (CI), ne pas quitter l'éditeur pendant qu'il se charge encore après l'import :
  // attendre l'état réel (image de l'étape affichée), puis que Démos ait lu ?new=1 (adresse nettoyée)
  await page.waitForSelector('.canvas-frame img');
  await page.goto(`${APP}/#/?new=1`);
  await page.waitForURL((u) => u.hash === '#/');
  const nd2 = page.getByRole('dialog', { name: 'Nouvelle démo' });
  await nd2.waitFor();
  await nd2.getByRole('button', { name: 'Continuer', exact: true }).click();
  await nd2
    .getByRole('button', { name: /Partir d’un modèle/ })
    .first()
    .click();
  const cats = page.getByRole('navigation', { name: 'Catégories de modèles' });
  await cats.waitFor();
  const names = (await cats.getByRole('button').allTextContents()).map((x) =>
    x.replace(/\s*\d+$/, '').trim(),
  );
  ok(
    names[1] === 'Accueil' && names.length === 6,
    `Modèles : « Accueil » en premier, aucune masquée (${names.join(', ')})`,
  );
  await page.keyboard.press('Escape');

  // ===== Onboarding > Importer des captures à la place =====
  await page.goto(`${APP}/#/onboarding`);
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByLabel('Nom de l’espace').fill('Agence Exemple');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'À quoi servira TutoClick ?' }).waitFor();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('heading', { name: 'Installez l’extension' }).waitFor();
  const n = t.demos.length;
  await page.locator('.obx-links input[type=file]').setInputFiles(files.slice(1));
  await page.waitForURL(/\/edit\?guide=1$/);
  ok(t.demos.length === n + 1, 'onboarding : « Importer des captures à la place » crée une démo');

  // ===== Éditeur : « Remplacer l'image » =====
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  // L48-E : outil « Image » du rail
  await page.locator('.ed-rail [data-tool="image"][aria-pressed="false"]').click();
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

  // ===== L48-C : 390 px (sans aperçu ni défilement horizontal), « Nouvel espace » =====
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/#/onboarding`);
  await page.getByRole('progressbar').waitFor();
  ok(
    (await page.locator('.obx-preview').count()) === 0 &&
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    '390 px : pas d’aperçu, pas de défilement horizontal',
  );
  await page.evaluate(() => sessionStorage.clear());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${APP}/#/onboarding?nouvel=1`);
  await page.getByRole('heading', { name: 'Nommez votre espace' }).waitFor();
  ok(
    (await page.getByRole('progressbar').count()) === 0,
    'Nouvel espace : une seule étape, sans progression',
  );
  await page.getByLabel('Nom de l’espace').fill('Globex formation');
  await page.getByRole('button', { name: 'Ouvrir mon espace' }).click();
  await page.waitForURL(/#\/$/);
  ok(
    t.workspaces.some((w) => w.name === 'Globex formation'),
    'Nouvel espace : espace créé, retour à Démos',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
