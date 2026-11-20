/**
 * Test e2e L38 paquet 5 (revue « parcours de formation », n° 13 à 15). Données fictives.
 *  - n° 13 : « Nouvelle démo », Assistance IA désactivée : « Ouvrir le réglage » ne recouvre plus l'aide.
 *  - n° 14 : quiz réussi en 390 px : « Repasser le quiz » en lien sous « Terminer », espaces insécables.
 *  - n° 15 : lecteur en 390 px : le bouton d'action de l'en-tête tient dans l'écran (icône, nom lu).
 * Usage : node e2e/formation-finitions.e2e.cjs
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const png = fs.readFileSync(`${__dirname}/fixture.png`);
const DEMO = '0b5c1f0e-0000-4000-8000-0000000000e1';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const newPage = async (viewport) => {
    const p = await (await b.newContext({ viewport, locale: 'fr-FR' })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };
  const overlap = (a, c) =>
    a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;

  // ===== n° 13 =====
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 800, height: 900 },
  ]) {
    const page = await newPage(viewport);
    await install(page);
    await page.goto(`${APP}/#/`);
    await page.locator('.page-head__actions').getByRole('button', { name: 'Nouvelle démo' }).click();
    const nd = page.getByRole('dialog', { name: 'Nouvelle démo' });
    await nd.waitFor();
    const link = nd.getByRole('link', { name: 'Ouvrir le réglage' });
    await link.waitFor();
    const l = await link.boundingBox();
    const help = await nd.locator('.nd-help').boundingBox();
    const card = await nd.locator('.nd-ai > .nd-choice').boundingBox();
    ok(
      !overlap(l, help) && !overlap(l, card) && l.y >= card.y + card.height - 1,
      `n° 13 (${viewport.width} px) : « Ouvrir le réglage » sous la carte, sans recouvrir l’aide`,
    );
    await page.context().close();
  }

  // ===== n° 14 et 15 : lecteur en 390 px =====
  const manifest = {
    schemaVersion: 1,
    demoId: DEMO,
    versionId: '0b5c1f0e-0000-4000-8000-0000000000e2',
    workspaceId: 'w',
    title: 'Créer une fiche usager complète avec ses rendez-vous et ses documents',
    locale: 'fr',
    publishedAt: '2026-11-17T10:00:00Z',
    theme: {},
    cta: { label: 'Réserver une démo', url: 'https://www.acme.example/rdv' },
    steps: [{ id: 's1', kind: 'text', title: 'C’est parti', body: 'Vérifions vos acquis.' }],
    quiz: {
      threshold: 70,
      attempts: 3,
      feedback: 'end',
      shuffle: false,
      questions: [
        {
          id: 'q1',
          type: 'single',
          prompt: 'Où créer un rendez-vous ?',
          explanation: '',
          answers: [
            { id: 'a', label: 'Dans l’agenda', correct: true },
            { id: 'b', label: 'Dans les paramètres', correct: false },
          ],
        },
      ],
    },
  };
  const page = await newPage({ width: 390, height: 844 });
  await page.route('**/functions/v1/**', (r) =>
    r.fulfill({ contentType: 'application/json', headers: cors, body: '{}' }),
  );
  await page.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ status: 'ok', manifest }),
    }),
  );
  await page.route('**/assets/**', (r) => r.fulfill({ contentType: 'image/png', body: png }));
  await page.route('**/rest/v1/rpc/submit_quiz_attempt', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        score: 100,
        correct: 1,
        total: 1,
        passed: true,
        attemptsLeft: 2,
        questions: [{ questionId: 'q1', correct: true }],
      }),
    }),
  );
  await page.goto(`${PLAYER}/#/d/${DEMO}`);

  // n° 15 : en-tête
  const cta = page.locator('.p-top-cta');
  await cta.waitFor();
  const r = await cta.boundingBox();
  ok(
    r.x >= 0 && r.x + r.width <= 390,
    `n° 15 : bouton d’action dans l’écran (${Math.round(r.x + r.width)} / 390)`,
  );
  ok(
    (await page.getByRole('button', { name: 'Réserver une démo' }).count()) === 1,
    'n° 15 : nom accessible « Réserver une démo » gardé',
  );
  ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    'n° 15 : pas de défilement horizontal',
  );

  // n° 14 : quiz réussi
  await page.getByRole('button', { name: 'Passer au quiz' }).click();
  await page.getByLabel('Dans l’agenda').check();
  await page
    .getByRole('button', { name: /Valider ma réponse|Voir mon résultat/ })
    .first()
    .click();
  const seeResult = page.getByRole('button', { name: 'Voir mon résultat' });
  if (await seeResult.count()) await seeResult.click();
  await page.waitForSelector('.p-quiz-badge.is-pass');
  const acts = page.locator('.p-quiz-result .p-actions');
  const finish = acts.getByRole('button', { name: 'Terminer' });
  const retake = acts.getByRole('button', { name: 'Repasser le quiz' });
  ok(
    (await finish.getAttribute('class')).includes('p-btn-primary') &&
      (await retake.getAttribute('class')).includes('p-link'),
    'n° 14 : « Terminer » principal, « Repasser le quiz » en lien',
  );
  ok(
    (await finish.boundingBox()).y < (await retake.boundingBox()).y,
    'n° 14 : le lien vient sous « Terminer »',
  );
  const title = await page.locator('.p-quiz-result h2').textContent();
  ok(
    /« Créer une fiche/.test(title) && /documents »/.test(title),
    'n° 14 : espaces insécables dans les guillemets',
  );
  const line = await page.locator('.p-quiz-result').textContent();
  ok(/100 %/.test(line) && !/100 %/.test(line), 'n° 14 : espace insécable avant « % »');
  await page.context().close();

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
