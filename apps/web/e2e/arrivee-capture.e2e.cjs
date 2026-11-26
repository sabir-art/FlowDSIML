/**
 * L60 §3 : arrivée d'une capture dans l'éditeur. L'extension ouvre `#/demos/:id/edit?ready=n` :
 *  - toast « Démo prête : n étapes capturées » avec « Aperçu » (qui ouvre l'aperçu) ;
 *  - l'adresse perd « ready » (un rechargement ne rejoue pas le toast) ;
 *  - chaque étape porte l'étiquette verte « Nouvelle » jusqu'à sa première modification, y compris
 *    après un rechargement ;
 *  - L64 §3 : étapes rédigées par l'IA pendant la capture (options.aiText) : « Généré par IA, à vérifier »
 *    sous le titre et sous le texte de la bulle, retiré à la première saisie.
 * Faux Supabase, données fictives. Usage : node e2e/arrivee-capture.e2e.cjs (THEME=dark)
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: THEME });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  // L64 §3 : les deux étapes capturées ont été rédigées par l'IA ; une bulle sur l'étape 2
  for (const id of ['s1', 's2']) {
    const st = state.tables.steps.find((x) => x.id === id);
    st.options = { ...(st.options || {}), aiText: true };
  }
  const h1 = state.tables.hotspots.find((h) => h.id === 'h1');
  state.tables.hotspots.push({
    ...h1,
    id: 'h2',
    step_id: 's2',
    title: 'Filtrez',
    body: 'Cliquez sur « Filtrer ».',
  });
  const aiOf = (id) => !!state.tables.steps.find((x) => x.id === id).options?.aiText;
  // L'éditeur enregistre après un court délai : attendre l'état du faux serveur
  const until = async (f, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end && !f()) await new Promise((r) => setTimeout(r, 100));
    return f();
  };
  await install(page, state);
  const n = state.tables.steps.filter((s) => s.demo_id === DEMO).length;
  await page.goto(`${APP}/#/demos/${DEMO}/edit?ready=${n}`);
  const toast = page.locator('.toast', { hasText: 'Démo prête' });
  await toast.waitFor();
  ok(
    (await toast.innerText()).includes(`Démo prête : ${n} étapes capturées`) &&
      (await toast.getByRole('button', { name: 'Aperçu' }).count()) === 1,
    `toast « Démo prête : ${n} étapes capturées » avec « Aperçu »`,
  );
  ok(!/ready=/.test(page.url()), 'l’adresse perd « ready »');
  const badges = page.locator('.rail-li .rail-arrived');
  await page.waitForFunction((n) => document.querySelectorAll('.rail-li .rail-arrived').length === n, n);
  const look = await badges.first().evaluate((b) => ({
    text: b.textContent,
    color: getComputedStyle(b).color,
    bg: getComputedStyle(b).backgroundColor,
  }));
  ok(
    look.text === 'Nouvelle' && look.color !== look.bg,
    `chaque étape porte « Nouvelle » (${n}) (${JSON.stringify(look)})`,
  );
  // La liste anime ses lignes à l'arrivée (MOTION-01) : capture une fois l'animation finie
  await page.waitForTimeout(600);
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/arrivee-editeur${THEME === 'dark' ? '-sombre' : ''}.png` });
  await toast.getByRole('button', { name: 'Aperçu' }).click();
  await page.locator('dialog.preview-dialog[open]').waitFor();
  ok(true, '« Aperçu » ouvre l’aperçu de la démo');
  await page.keyboard.press('Escape');
  await page
    .locator('dialog.preview-dialog[open]')
    .waitFor({ state: 'detached' })
    .catch(() => undefined);

  // Première modification : l'étape 1 perd « Nouvelle », les autres la gardent
  await page.locator('[data-step-index="0"]').click();
  await openTool(page, 'step');
  const title = page.getByLabel('Titre de l’étape').or(page.getByLabel("Titre de l'étape")).first();
  const mention = page.locator('[data-tool-panel="step"] .st-ai-mention');
  await mention.waitFor();
  ok(
    (await mention.innerText()) === 'Généré par IA, à vérifier',
    'étape rédigée par l’IA : « Généré par IA, à vérifier » sous le titre',
  );
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/redaction-editeur${THEME === 'dark' ? '-sombre' : ''}.png` });
  await title.fill('Créer un projet (revu)');
  await mention.waitFor({ state: 'detached' });
  ok(
    (await until(() => !aiOf('s1'))) && aiOf('s2'),
    'modifier le titre retire la mention (étape 1 seulement)',
  );
  await page.waitForFunction((n) => document.querySelectorAll('.rail-li .rail-arrived').length === n - 1, n);
  ok(
    (await page.locator('.rail-li').first().locator('.rail-arrived').count()) === 0,
    'modifier une étape lui retire « Nouvelle »',
  );
  // Rechargement : les étiquettes restantes sont gardées, le toast ne revient pas
  await page.reload();
  await page.locator('.rail-li').first().waitFor();
  await page.waitForTimeout(800);
  ok(
    (await page.locator('.rail-li .rail-arrived').count()) === n - 1 &&
      (await page.locator('.toast', { hasText: 'Démo prête' }).count()) === 0,
    'après un rechargement : « Nouvelle » gardée sur les autres étapes, pas de nouveau toast',
  );

  // Bulle de l'étape 2 : mention sous le texte, retirée à la première saisie
  await page.locator('[data-step-index="1"]').click();
  await page.waitForSelector('.canvas-frame img');
  await page.locator('.canvas-hotspot').first().click();
  const hsMention = page.locator('.hs-ai-mention');
  await hsMention.waitFor();
  ok(
    (await hsMention.innerText()) === 'Généré par IA, à vérifier' &&
      (await page.locator('.ai-badge').count()) >= 1,
    'bulle rédigée par l’IA : repère « IA » et « Généré par IA, à vérifier » sous le texte',
  );
  await page.locator('#hs-body [contenteditable], #hs-body').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Merci.');
  await hsMention.waitFor({ state: 'detached' });
  ok(await until(() => !aiOf('s2')), 'modifier le texte de la bulle retire la mention');
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await browser.close();
})();
