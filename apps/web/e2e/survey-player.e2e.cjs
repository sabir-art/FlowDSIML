/** Test e2e L19 (lecteur) : sondage avec note de 0 à 10 et réponse écrite (facultative, 500 caractères). */
const { chromium } = require('playwright');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');
const DEMO = '0b5c1f0e-0000-4000-8000-0000000000f4';
const manifest = {
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000f5',
  workspaceId: 'w',
  title: 'Prise en main',
  locale: 'fr',
  publishedAt: '2026-11-19T10:00:00Z',
  theme: {},
  steps: [{ id: 's1', kind: 'text', title: 'Merci', body: 'Votre avis compte.' }],
  quiz: {
    mode: 'survey',
    shuffle: false,
    feedback: 'end',
    questions: [
      { id: 'q1', type: 'nps', prompt: 'Recommanderiez-vous ce tutoriel à un collègue ?', answers: [] },
      { id: 'q2', type: 'text', prompt: 'Une suggestion ?', answers: [] },
    ],
  },
};

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const page = await (await themedContext(b, { viewport: { width: 1280, height: 860 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const submits = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await page.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', manifest }),
      headers: cors,
    }),
  );
  await page.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}', headers: cors }));
  await page.route('**/rest/v1/rpc/submit_quiz_attempt', (r) => {
    submits.push(JSON.parse(r.request().postData()).p_batch);
    return r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        score: 0,
        correct: 0,
        total: 2,
        passed: true,
        attemptsLeft: null,
        questions: [],
      }),
    });
  });
  await page.goto(`${PLAYER}/#/d/${DEMO}`);
  await page.waitForSelector('.p-player, .p-stage, main');
  await page.getByRole('button', { name: /Passer au (quiz|sondage)/ }).click();
  await page.waitForSelector('.p-quiz-card');
  const group = page.getByRole('group', { name: 'Recommanderiez-vous ce tutoriel à un collègue ?' });
  ok((await group.getByRole('radio').count()) === 11, 'note : 11 choix de 0 à 10');
  await page.getByRole('button', { name: /Question suivante|Valider/ }).click();
  ok((await page.getByRole('alert').count()) === 1, 'note obligatoire');
  await group.getByRole('radio', { name: '9' }).check();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l19-sondage-note${sfx}.png` });
  await page.getByRole('button', { name: /Question suivante|Valider/ }).click();
  const box = page.getByRole('textbox', { name: 'Une suggestion ?' });
  await box.waitFor();
  ok((await box.getAttribute('maxlength')) === '500', 'réponse écrite : 500 caractères au plus');
  await box.fill('Plus de captures sur le formulaire.');
  ok((await page.getByText('35 / 500 caractères').count()) === 1, 'compteur de caractères');
  await page.getByRole('button', { name: /Voir mon résultat/ }).click();
  await page.waitForSelector('.p-quiz-result');
  ok(submits.length === 1, 'réponses envoyées');
  const a = submits[0]?.answers ?? [];
  ok(a.find((x) => x.questionId === 'q1')?.value === 9, 'note envoyée (value)');
  ok(
    a.find((x) => x.questionId === 'q2')?.text === 'Plus de captures sur le formulaire.',
    'texte envoyé (text)',
  );
  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
