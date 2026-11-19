/**
 * Test e2e L17-02 (éditeur) : étape Avant / Après (ajout depuis le rail, outils masqués, publication
 * bloquée sans les deux captures, copie d'une étape avec ses flous, image importée, disposition,
 * libellés, notes) et réglage « Glossaire » d'une démo.
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/formation-editor.e2e.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
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
  const shot = async (name) => {
    for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  // Une zone floutée sur l'écran 1 : elle doit suivre la copie
  state.tables.steps[0].blurs = [{ x: 0.1, y: 0.1, w: 0.2, h: 0.1, style: 'blur' }];
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // Ajout depuis le rail
  await page.locator('.rail-foot').getByRole('button', { name: 'Ajouter une étape' }).click();
  await page.getByRole('menuitem', { name: 'Avant / Après' }).click();
  await page.waitForSelector('.ba-canvas');
  const ba = state.tables.steps.find((s) => s.kind === 'before_after');
  ok(!!ba && ba.options.beforeAfter.layout === 'side', 'Étape before_after créée (côte à côte par défaut)');
  ok((await page.locator('.floatbar').count()) === 0, 'Outils hotspot, flou et zoom masqués');
  ok((await page.locator('.ba-missing').count()) === 2, 'Deux captures à choisir sur le canevas');

  // Publication bloquée
  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const alert = page.locator('.publish-error');
  await alert.waitFor();
  const n =
    state.tables.steps
      .filter((s) => s.demo_id === DEMO)
      .sort((x, y) => x.position - y.position)
      .findIndex((s) => s.kind === 'before_after') + 1;
  ok(
    (await alert.textContent()).includes(`L’étape ${n} Avant / Après n’a pas ses deux captures.`),
    'Publication bloquée sans les deux captures',
  );

  // Message de publication effacé pour la suite (rechargement de l'éditeur)
  await page.reload();
  await page.waitForSelector('.canvas-frame img');
  await page.locator(`[data-step-index="${n - 1}"]`).click();
  await page.waitForSelector('.ba-canvas');

  // Capture « Avant » : copie de l'étape 1 (avec ses flous)
  const before = page.getByRole('group', { name: `Capture «${N}Avant${N}»` });
  await before.getByRole('button', { name: 'Choisir' }).click();
  await page.getByRole('menuitem', { name: 'Choisir une étape de la démo' }).click();
  const picker = page.getByRole('dialog', { name: `Capture «${N}Avant${N}»${N}: choisir une étape` });
  await picker.waitFor();
  await picker.getByRole('button', { name: /Étape 1/ }).click();
  await page.waitForFunction(() => !document.querySelector('.ba-pic.is-old .ba-missing'));
  ok(
    state.copies?.length === 1 && state.copies[0].from === state.tables.steps[0].image_path,
    'Capture copiée dans le stockage (indépendante de l’étape source)',
  );
  ok(
    ba.before_image_path && ba.before_image_path !== state.tables.steps[0].image_path,
    'Nouveau chemin pour « Avant »',
  );
  ok(ba.before_blurs.length === 1, 'Flous de l’étape source copiés');
  ok((await before.locator('.ba-slot-text b').textContent()) === 'Étape 1', 'Source « Étape 1 »');

  // Capture « Maintenant » : image importée
  const after = page.getByRole('group', { name: `Capture «${N}Maintenant${N}»` });
  await after.getByRole('button', { name: 'Choisir' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Importer une image' }).click(),
  ]);
  await chooser.setFiles(path.join(__dirname, 'fixture.png'));
  await page.waitForFunction(() => document.querySelectorAll('.ba-missing').length === 0);
  ok(
    ba.image_path && ba.options.beforeAfter.sources.after.kind === 'upload',
    'Image importée pour « Maintenant »',
  );
  ok((await after.locator('.ba-slot-text small').textContent()) === 'fixture.png', 'Nom de l’image importée');

  // Disposition, libellés, notes
  await page.getByRole('radio', { name: 'Curseur' }).click();
  await page.getByLabel('Après', { exact: true }).fill('Nouvel outil');
  await page.locator('#ba-n-before').fill('Rapports, puis Exporter, puis tableur.');
  await page.locator('#ba-n-after').fill('Bouton « Nouveau rapport » en haut à droite.');
  await page.waitForTimeout(900);
  ok(ba.options.beforeAfter.layout === 'slider', 'Disposition « Curseur » enregistrée');
  ok(ba.options.beforeAfter.labels.after === 'Nouvel outil', 'Libellé enregistré');
  ok(
    (await page.locator('.ba-note').textContent()).includes('Rapports, puis Exporter'),
    'Note sur le canevas',
  );
  await page.getByRole('radio', { name: 'Côte à côte' }).click();
  await page.waitForTimeout(600);
  await shot('l17-02-editeur');

  // Publication : capture « Avant » copiée et ses flous incrustés, manifeste sans flous ni sources
  state.tables.workspaces[0].public_links_enabled = true;
  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const gdpr = page.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  for (const c of await gdpr.getByRole('checkbox').all()) await c.check();
  await gdpr
    .getByRole('button', { name: /Publier/ })
    .last()
    .click();
  await page.waitForFunction(
    () => location.hash.includes('/share') || !!document.querySelector('.publish-error'),
  );
  const v = state.tables.demo_versions.at(-1);
  const pubBa = v?.manifest.steps.find((s) => s.kind === 'before_after')?.beforeAfter;
  ok(
    !!pubBa && pubBa.layout === 'side' && !('sources' in pubBa),
    'Publication : beforeAfter publié, sans les sources',
  );
  ok(
    !!state.storage[`published/${DEMO}/assets/${ba.id}-b.webp`],
    'Publication : capture « Avant » déposée dans les fichiers publiés',
  );
  const latest = JSON.parse(state.storage[`published/${DEMO}/latest.json`].data.toString());
  ok(
    latest.steps.find((s) => s.kind === 'before_after').beforeAfter.beforeBlurs.length === 0,
    'Publication : flous « Avant » incrustés (absents du manifeste publié)',
  );
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.ed-bar');

  // Réglage « Glossaire » de la démo (Réglages > Lecture)
  await page.getByRole('tab', { name: 'Réglages' }).click();
  const gl = page.getByLabel('Glossaire', { exact: true });
  await gl.scrollIntoViewIfNeeded();
  ok(await gl.isChecked(), 'Glossaire activé par défaut pour la démo');
  await gl.uncheck();
  await page.waitForTimeout(900);
  ok(
    state.tables.demos.find((d) => d.id === DEMO).settings.glossary === false,
    'Glossaire désactivé pour la démo',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
