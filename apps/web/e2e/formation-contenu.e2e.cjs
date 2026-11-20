/**
 * Test e2e L38 paquet 3 (revue « parcours de formation », n° 5, 8 et 9). Données fictives.
 *  - n° 8 : après « Importer des images », l'éditeur s'ouvre sur l'étape 1, outil Hotspot actif, avec
 *    une aide ; une fois la bulle écrite, « Étape suivante sans bulle » ; « Ajouter un hotspot » dans
 *    le panneau Étape.
 *  - n° 9 : la bulle est posée sans titre (« Cliquez ici » en placeholder) ; l'étape reprend le titre
 *    de la bulle.
 *  - n° 5 : la modale Publier signale ce qui reste « À compléter », avec « Voir », sans bloquer.
 * Usage : node e2e/formation-contenu.e2e.cjs
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const page = await (
    await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
  ).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  const t = state.tables;
  await install(page, state);
  await page.goto(`${APP}/#/`);
  await page.locator('.page-head__actions').getByRole('button', { name: 'Nouvelle démo' }).click();
  // L48-G : étape 1 (type de contenu), puis la source
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const nd = page.getByRole('dialog', { name: 'Nouvelle démo' });
  await nd.waitFor();
  const png = fs.readFileSync(`${__dirname}/fixture.png`);
  await nd
    .locator('input[type=file]')
    .setInputFiles([1, 2, 3].map((n) => ({ name: `ecran-${n}.png`, mimeType: 'image/png', buffer: png })));

  // ===== n° 8 : guidage après l'import =====
  await page.waitForURL(/\/edit\?guide=1$/);
  const id = page.url().match(/demos\/([^/?]+)\/edit/)[1];
  const placing = async () => (await page.locator('.stage .canvas-frame.tool-hotspot').count()) === 1;
  await page.locator('.stage .canvas-frame').waitFor();
  await page.waitForTimeout(300);
  ok(await placing(), 'n° 8 : mode « placer un point » actif à l’ouverture');
  const guide = page.locator('.guide-bar');
  ok(
    (await guide.textContent()).includes('Cliquez sur l’écran à l’endroit où l’apprenant doit cliquer'),
    'n° 8 : aide « Cliquez sur l’écran… »',
  );
  const frame = await page.locator('.stage .canvas-frame').boundingBox();
  await page.mouse.click(frame.x + frame.width * 0.5, frame.y + frame.height * 0.4);
  await page.locator('#hs-title').waitFor();

  // ===== n° 9 : bulle sans titre, placeholder =====
  const steps = () => t.steps.filter((s) => s.demo_id === id).sort((a, b) => a.position - b.position);
  const h = t.hotspots.find((x) => x.step_id === steps()[0].id);
  ok(h && h.title === '', 'n° 9 : bulle posée sans titre enregistré');
  ok(
    (await page.locator('#hs-title').innerText()).trim() === '' &&
      (await page.locator('#hs-title').getAttribute('data-placeholder')) === 'Cliquez ici',
    'n° 9 : « Cliquez ici » en placeholder',
  );
  ok((await guide.textContent()).includes('Écrivez la consigne'), 'n° 8 : aide « Écrivez la consigne… »');
  await page.fill('#hs-title', 'Ouvrez l’agenda');
  await page.waitForTimeout(900);
  ok(steps()[0].title === 'Ouvrez l’agenda', 'n° 9 : l’étape reprend le titre de la bulle');
  await page.fill('#hs-title', 'Ouvrez l’agenda partagé');
  await page.waitForTimeout(900);
  ok(steps()[0].title === 'Ouvrez l’agenda partagé', 'n° 9 : le titre suit tant qu’il n’a pas été saisi');
  // Retour Lead UX : une phrase accompagne « Étape suivante sans bulle »
  const said = (await guide.locator('.grow').textContent()).replace(/\s/g, ' ');
  ok(
    /^Bulle de l’étape 1 prête\. Il reste \d+ étapes? sans bulle\.$/.test(said),
    `Lead UX : barre d’aide « ${said} »`,
  );

  // Suite du guidage
  const next = guide.getByRole('button', { name: 'Étape suivante sans bulle' });
  await next.click();
  await page.waitForTimeout(300);
  ok(
    /^Étape 2 · /.test(await page.locator('.stage-head .t-caption').first().innerText()) && (await placing()),
    'n° 8 : « Étape suivante sans bulle » ouvre l’étape 2, mode « placer un point » actif',
  );
  await page.keyboard.press('Escape');
  ok(!(await placing()), 'Échap : mode « placer un point » quitté');
  const add = page.getByRole('button', { name: 'Ajouter un hotspot' }).first();
  await add.click();
  ok(await placing(), 'n° 8 : « Ajouter un hotspot » active le mode « placer un point »');
  const axe = await new AxeBuilder({ page })
    .include('.guide-bar')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  ok(
    axe.violations.length === 0,
    `n° 8 : aide sans violation axe (${axe.violations.map((v) => v.id).join(', ')})`,
  );

  // ===== n° 5 : « À compléter » dans la modale Publier =====
  await page.getByRole('button', { name: 'Publier' }).click();
  const dlg = page.locator('dialog.gdpr-dialog[open]');
  await dlg.waitFor();
  const todo = dlg.locator('.publish-todo');
  const items = await todo.locator('li > span').allTextContents();
  ok(
    items.some((x) => x.startsWith('Le titre de la démo est celui par défaut')) &&
      items.includes('Étape 2 : sans titre, aucune bulle.') &&
      items.includes('Étape 3 : sans titre, aucune bulle.') &&
      items.length === 3 &&
      !items.some((x) => x.startsWith('Étape 1')),
    `n° 5 : « À compléter » liste titre, étapes sans titre et sans bulle (${items.join(' | ')})`,
  );
  const axe2 = await new AxeBuilder({ page })
    .include('dialog.gdpr-dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  ok(
    axe2.violations.length === 0,
    `n° 5 : modale sans violation axe (${axe2.violations.map((v) => v.id).join(', ')})`,
  );
  // Retour Lead UX : « Renommer » ferme la modale et met le focus sur le titre de la démo
  await todo.getByRole('button', { name: 'Renommer' }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => undefined);
  await page.waitForTimeout(200);
  ok(
    (await page.locator('dialog.gdpr-dialog[open]').count()) === 0 &&
      (await page.evaluate(() => document.activeElement?.classList.contains('ed-title'))),
    'Lead UX : « Renommer » ferme la modale, focus sur le titre de la démo',
  );
  await page.getByRole('button', { name: 'Publier' }).click();
  await dlg.waitFor();
  await todo.getByRole('button', { name: 'Voir l’étape 3' }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => undefined);
  ok((await page.locator('dialog.gdpr-dialog[open]').count()) === 0, 'n° 5 : « Voir » ferme la modale');
  ok(
    /^Étape 3 · /.test(await page.locator('.stage-head .t-caption').first().innerText()),
    'n° 5 : « Voir » ouvre l’étape concernée',
  );
  // Non bloquant : la publication reste possible
  await page.getByRole('button', { name: 'Publier' }).click();
  await dlg.waitFor();
  await dlg.getByLabel(/J’ai relu|J'ai relu/).check();
  await dlg.getByLabel(/fictives ou floutées/).check();
  await dlg.getByRole('button', { name: 'Publier en public' }).click();
  await page.waitForURL(/share\?published=1/, { timeout: 15000 });
  ok(true, 'n° 5 : avertissement non bloquant, la démo se publie');

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
