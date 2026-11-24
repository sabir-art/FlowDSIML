/**
 * Retours client du 24/11 §2 (docs/ux/specs/retours-client-2411.md) : « Afficher « Précédent » ».
 * L'option vaut pour l'étape, et le bouton n'existe qu'à partir de l'étape 2 :
 *  - étape 1 : interrupteur visible, désactivé (aria-disabled), avec la raison ;
 *  - étape 2 : aide sous le libellé, 16 px au-dessus de la ligne ; activée, le bouton est montré dans la
 *    bulle du canevas, dans l'aperçu et dans le manifeste publié ;
 *  - « Afficher sur toutes les étapes » : confirmation, « Option appliquée à n étapes. », Ctrl Z ;
 *  - « Appliquer le style » depuis l'étape 1 ne retire pas l'option des autres étapes.
 * Faux Supabase, données fictives. Usage : node e2e/bulle-precedent.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const SHOTS = process.env.SHOTS_DIR;
const N = ' ';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  // Trois étapes à bulle
  const base = state.tables.hotspots[0];
  state.tables.hotspots.push({ ...base, id: 'h2', step_id: 's2', title: 'Ouvrir le rapport', position: 0 });
  const s3 = state.tables.steps.find((s) => s.id === 's3');
  Object.assign(s3, { kind: 'image', image_path: state.tables.steps.find((s) => s.id === 's2').image_path });
  state.tables.hotspots.push({ ...base, id: 'h3', step_id: 's3', title: 'Exporter', position: 0 });
  await install(page, state);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const st = (id) => state.tables.steps.find((s) => s.id === id);
  // L'enregistrement est différé : on attend l'état côté faux serveur
  const saved = async (fn) => {
    for (const end = Date.now() + 8000; Date.now() < end;) {
      if (fn()) return true;
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    }
    return fn();
  };
  const openStep = async (i) => {
    await page.locator(`[data-step-index="${i}"]`).click();
    await page.locator('.canvas-hotspot').first().click();
    await page.waitForSelector('#hs-next');
    await page
      .locator(`.rail-list [data-step-index="${i}"][aria-current], [data-step-index="${i}"]`)
      .first()
      .waitFor();
  };
  const sw = page
    .getByRole('checkbox', { name: `Afficher «${N}Précédent${N}»` })
    .or(page.getByLabel('Afficher « Précédent »'));
  const help = page.locator('#hs-showprev-h');

  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // ===== Étape 1 =====
  await openStep(0);
  ok(
    (await sw.first().isVisible()) &&
      (await sw.first().getAttribute('aria-disabled')) === 'true' &&
      !(await sw.first().isChecked()),
    'étape 1 : interrupteur visible, désactivé, non coché',
  );
  ok(
    (await help.innerText()).replace(/\s+/g, ' ') ===
      'Pas d’étape avant celle-ci : le bouton apparaît à partir de l’étape 2.' &&
      (await sw.first().getAttribute('aria-describedby')) === 'hs-showprev-h',
    'étape 1 : la raison est écrite et reliée à l’interrupteur',
  );
  await sw.first().click({ force: true });
  ok(!(await sw.first().isChecked()) && !st('s1').options?.showPrev, 'étape 1 : un clic ne change rien');
  if (SHOTS) await page.locator('.ed-tool').screenshot({ path: `${SHOTS}/precedent-etape1.png` });

  // ===== Étape 2 =====
  await openStep(1);
  await page.waitForFunction(() =>
    document.querySelector('#hs-showprev-h')?.textContent.startsWith('Bouton'),
  );
  ok(
    (await sw.first().getAttribute('aria-disabled')) === null &&
      (await help.innerText()).replace(/\s+/g, ' ') ===
        'Bouton à gauche de « Suivant », dans la bulle de cette étape.',
    'étape 2 : interrupteur actif, aide « Bouton à gauche de « Suivant »… »',
  );
  const geo = await page.locator('.hs-showprev').evaluate((el) => ({
    pad: getComputedStyle(el).paddingTop,
    help: getComputedStyle(el.querySelector('.help')).fontSize,
  }));
  ok(
    geo.pad === '16px' && geo.help === '12px',
    `étape 2 : 16 px au-dessus de la ligne, aide en 12 px (${geo.pad}, ${geo.help})`,
  );
  ok(
    (await page.locator('.canvas-tip .p-actions .p-btn-ghost').count()) === 0,
    'étape 2 : pas de bouton avant d’activer',
  );
  await sw.first().check();
  await page.locator('.canvas-tip .p-actions .p-btn-ghost').waitFor();
  ok(
    (await page.locator('.canvas-tip .p-actions .p-btn-ghost').innerText()).trim() === 'Précédent',
    'étape 2 : activée, « Précédent » montré dans la bulle du canevas',
  );
  ok(await saved(() => st('s2').options?.showPrev === true), 'étape 2 : option enregistrée');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/precedent-etape2.png` });

  // ===== Afficher sur toutes les étapes =====
  await page.getByRole('button', { name: 'Afficher sur toutes les étapes' }).click();
  const dlg = page
    .getByRole('dialog', { name: `Afficher «${N}Précédent${N}» sur toutes les étapes` })
    .or(page.getByRole('dialog', { name: 'Afficher « Précédent » sur toutes les étapes' }));
  await dlg.waitFor();
  ok(
    /dans la bulle de 2 étapes, à partir de l’étape 2/.test((await dlg.innerText()).replace(/\s+/g, ' ')),
    'toutes les étapes : la confirmation annonce 2 étapes, à partir de l’étape 2',
  );
  if (SHOTS) {
    // Capture après la fin de l'ouverture de la fenêtre (retour UX : fenêtre saisie en plein fondu)
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          // Les animations sans fin (indicateurs) ne se terminent jamais : on ne les attend pas
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
    );
    await page.screenshot({ path: `${SHOTS}/precedent-toutes.png` });
  }
  await dlg.getByRole('button', { name: 'Appliquer à 2 étapes' }).click();
  await page.locator('.toast').filter({ hasText: 'Option appliquée' }).waitFor();
  ok(
    (await page.locator('.toast').filter({ hasText: 'Option appliquée' }).innerText())
      .replace(/\s+/g, ' ')
      .includes('Option appliquée à 2 étapes.'),
    'toutes les étapes : toast « Option appliquée à 2 étapes. »',
  );
  ok(
    (await saved(() => st('s3').options?.showPrev === true)) &&
      st('s2').options?.showPrev === true &&
      !st('s1').options?.showPrev,
    'toutes les étapes : étapes 2 et 3 activées, étape 1 inchangée',
  );
  await page.locator('.stage-head').click();
  await page.keyboard.press('Control+z');
  ok(await saved(() => !st('s3').options?.showPrev), 'toutes les étapes : Ctrl Z annule en une fois');
  await page.keyboard.press('Control+Shift+z');
  ok(await saved(() => st('s3').options?.showPrev === true), 'toutes les étapes : Ctrl Maj Z rétablit');

  // ===== « Appliquer le style » depuis l'étape 1 ne retire pas l'option =====
  await openStep(0);
  await page.getByRole('button', { name: 'Appliquer à toutes les étapes…' }).click();
  await page
    .locator('.modal')
    .getByRole('button', { name: /^Appliquer à 2 étapes/ })
    .click();
  await page.locator('.toast').filter({ hasText: 'Style appliqué' }).waitFor();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
  ok(
    await saved(() => st('s2').options?.showPrev === true && st('s3').options?.showPrev === true),
    'style appliqué depuis l’étape 1 : « Précédent » reste affiché sur les étapes 2 et 3',
  );

  // ===== Aperçu : le bouton est dans la bulle à l'étape 2 =====
  await page.getByRole('radio', { name: 'Aperçu' }).click();
  const pf = page.frameLocator('iframe.preview-frame');
  await pf.locator('.p-tip').first().waitFor({ timeout: 15000 });
  const start = (await pf.locator('.p-tip-count').first().innerText()).trim();
  if (start.startsWith('1 /')) {
    ok((await pf.locator('.p-tip-prev').count()) === 0, 'aperçu, étape 1 : pas de « Précédent »');
    await pf.locator('.p-tip .p-btn-primary').first().click();
  }
  await pf.locator('.p-tip-prev').waitFor({ timeout: 15000 });
  ok(
    /^2 \//.test((await pf.locator('.p-tip-count').first().innerText()).trim()) &&
      (await pf.locator('.p-tip-prev').innerText()).trim() === 'Précédent',
    'aperçu, étape 2 : « Précédent » à gauche de « Suivant »',
  );
  const order = await pf.locator('.p-tip .p-actions').evaluate((el) => {
    const prev = el.querySelector('.p-tip-prev').getBoundingClientRect();
    const next = el.querySelector('.p-btn-primary').getBoundingClientRect();
    return prev.right <= next.left;
  });
  ok(order, 'aperçu : « Précédent » est bien à gauche de « Suivant »');
  await pf.locator('.p-tip-prev').click();
  await pf.locator('.p-tip-count').filter({ hasText: /^1 \// }).waitFor();
  ok(true, 'aperçu : « Précédent » ramène à l’étape 1');

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
