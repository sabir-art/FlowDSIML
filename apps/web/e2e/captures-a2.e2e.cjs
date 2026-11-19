/**
 * Captures « après » (clair et sombre) des écrans déjà réalisés : A2-01 modes de lecture, A2-02 étape
 * pop-up, A2-03 checklist, A2-04 mode Sondage du quiz, F1-02 confirmation RGPD à la publication.
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/captures-a2.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

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
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.quizStats = { attempts: 0, visitors: 0, passRate: 0, avgScore: 0, questions: [] };
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // A2-01 : modes de lecture (onglet Design)
  await page.getByRole('tab', { name: 'Design' }).click();
  const spot = page.getByRole('button', { name: /Spotlight/ });
  await spot.scrollIntoViewIfNeeded();
  await spot.click();
  await page.waitForTimeout(600);
  ok((await page.locator('.canvas-spotlight').count()) >= 1, 'A2-01 : mode Spotlight appliqué au canevas');
  await shot('a2-01-modes');

  // A2-03 : checklist (onglet Réglages)
  await page.getByRole('tab', { name: 'Réglages' }).click();
  const cl = page.getByLabel('Afficher la checklist dans le player');
  await cl.scrollIntoViewIfNeeded();
  await cl.check();
  await page.waitForTimeout(600);
  ok(await cl.isChecked(), 'A2-03 : checklist activée');
  await shot('a2-03-checklist');

  // A2-02 : étape pop-up (ajout depuis le rail)
  await page.getByRole('tab', { name: 'Étape' }).click();
  await page.locator('.rail-foot').getByRole('button', { name: 'Ajouter une étape' }).click();
  await page.getByRole('menuitem', { name: 'Ajouter une pop-up' }).click();
  await page.waitForSelector('.canvas-popup');
  ok((await page.locator('.canvas-popup').count()) === 1, 'A2-02 : étape pop-up sur le canevas');
  await shot('a2-02-popup');

  // F1-02 : confirmation RGPD avant publication publique
  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const gdpr = page.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  ok((await gdpr.locator('h2').count()) === 1, 'F1-02 : modale RGPD ouverte');
  await shot('f1-02-rgpd');
  await gdpr
    .getByRole('button', { name: /Annuler/ })
    .first()
    .click();

  // A2-04 : mode Sondage du quiz
  await page.locator('.ed-bar').getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitem', { name: /Quiz/ }).click();
  await page.waitForSelector('.quiz-page');
  await page.getByRole('button', { name: 'Ajouter une question' }).first().click();
  await page.waitForSelector('#qz-prompt');
  await page.fill('#qz-prompt', 'Ce tutoriel vous a-t-il été utile ?');
  const answers = page.locator('.quiz-answer > .fd-input');
  await answers.nth(0).fill('Oui, tout à fait');
  await answers.nth(1).fill('En partie');
  await page.getByRole('button', { name: 'Sondage', exact: true }).click();
  await page.waitForTimeout(900);
  ok(
    (await page.getByRole('button', { name: 'Sondage', exact: true }).getAttribute('aria-pressed')) ===
      'true',
    'A2-04 : mode Sondage',
  );
  await shot('a2-04-sondage');

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
