/** Test e2e F2 (éditeur) : onglet Quiz — questions, validation, réglages, publication bloquée, statistiques. */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');

(async () => {
  const b = await chromium.launch();
  const page = await (await themedContext(b, { viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  state.quizStats = { attempts: 0, visitors: 0, passRate: 0, avgScore: 0, questions: [] };
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  // Le lien Quiz est dans le menu « … » de la barre de l'éditeur (maquette EDT-01)
  await page.locator('.ed-bar').getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitem', { name: /Quiz/ }).click();
  await page.waitForSelector('.quiz-page');
  ok((await page.locator('h1').textContent()) === 'Quiz du module', 'page « Quiz du module »');

  // Ajouter une question : invalide tant qu'elle est vide
  await page.getByRole('button', { name: 'Ajouter une question' }).first().click();
  await page.waitForTimeout(1500);
  await page.waitForSelector('#qz-prompt');
  ok(state.tables.quiz_questions.length === 1, 'question créée');
  ok((await page.locator('.quiz-list__dot').count()) === 1, 'question incomplète signalée dans la liste');
  ok(
    (await page.locator('.field-error').first().textContent()) === 'La question est vide.',
    'erreur « La question est vide. »',
  );
  await page.fill('#qz-prompt', 'Où créer un rendez-vous ?');
  const answers = page.locator('.quiz-answer > .fd-input');
  await answers.nth(0).fill('Dans l’agenda');
  await answers.nth(1).fill('Dans les paramètres');
  await page.waitForTimeout(900);
  ok((await page.locator('.quiz-list__dot').count()) === 0, 'question complète');
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' &&
        c.path.endsWith('/quiz_questions') &&
        c.body?.prompt === 'Où créer un rendez-vous ?',
    ),
    'énoncé enregistré',
  );
  // Choix multiples puis retour en choix unique : la première bonne réponse est gardée
  await page.getByRole('button', { name: 'Choix multiples' }).click();
  await page
    .getByRole('checkbox', { name: /Bonne réponse/ })
    .nth(1)
    .check();
  await page.getByRole('button', { name: 'Choix unique' }).click();
  ok(
    (await page.getByRole('status').filter({ hasText: 'première bonne réponse' }).count()) === 1,
    'message : seule la première bonne réponse est gardée',
  );
  ok(
    (await page.locator('.quiz-answer.is-correct').count()) === 1,
    'une seule bonne réponse en choix unique',
  );
  // Étape liée
  await page.selectOption('#qz-step', { index: 1 });
  // Seuil et tentatives
  await page.locator('#qz-th').fill('80');
  await page.selectOption('#qz-att', '2');
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' &&
        c.path.endsWith('/demos') &&
        c.body?.settings?.quiz?.threshold === 80 &&
        c.body.settings.quiz.attempts === 2,
    ),
    'réglages du quiz enregistrés (seuil 80 %, 2 tentatives)',
  );
  ok(
    (await page.locator('.quiz-list__caption').first().textContent()).includes('lié à l’étape 1'),
    'liste : « lié à l’étape 1 »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f2-editeur${sfx}.png` });

  // « Tester le quiz » : aperçu ouvert directement sur le quiz
  await page.getByRole('button', { name: 'Tester le quiz' }).click();
  const pf = page.frameLocator('iframe.preview-frame');
  await pf.locator('.p-quiz-card').waitFor({ timeout: 10000 });
  ok(
    (await pf.locator('legend').textContent()) === 'Où créer un rendez-vous ?',
    'aperçu : le quiz s’ouvre directement',
  );
  await page.getByRole('button', { name: 'Fermer' }).click();

  // Seconde question incomplète → publication bloquée avec le numéro
  await page.getByRole('button', { name: 'Ajouter une question' }).first().click();
  await page.getByRole('button', { name: 'Vrai / Faux' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('link', { name: 'Retour à l’éditeur' }).click();
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('button', { name: 'Publier' }).click();
  ok(
    (await page.locator('.publish-error').textContent()).includes('La question 2 du quiz est incomplète'),
    'publication bloquée : question 2',
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
