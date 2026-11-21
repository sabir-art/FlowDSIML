/** Test e2e F2 (player) : quiz après la dernière étape, correction, revoir l'étape, résultat, tentatives. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));
const DEMO = '0b5c1f0e-0000-4000-8000-0000000000f2';
const img = { url: 'assets/a.webp', width: 1100, height: 750 };
const N = ' ';
const manifest = {
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000f3',
  workspaceId: 'w',
  title: 'Créer un rendez-vous',
  locale: 'fr',
  publishedAt: '2026-11-17T10:00:00Z',
  theme: {},
  steps: [
    {
      id: 's1',
      kind: 'image',
      image: img,
      hotspots: [
        {
          id: 'h1',
          x: 0.2,
          y: 0.3,
          w: 0.2,
          h: 0.1,
          title: 'Ouvrez l’agenda',
          placement: 'auto',
          action: { type: 'next' },
        },
      ],
    },
    { id: 's2', kind: 'text', title: `C’est fini${N}!`, body: 'Vérifions vos acquis.' },
  ],
  quiz: {
    threshold: 70,
    attempts: 3,
    feedback: 'each',
    shuffle: false,
    questions: [
      {
        id: 'q1',
        type: 'single',
        prompt: 'Où créer un rendez-vous ?',
        stepId: 's1',
        explanation: 'Depuis l’agenda, bouton « Nouveau ».',
        answers: [
          { id: 'a', label: 'Dans l’agenda', correct: true },
          { id: 'b', label: 'Dans les paramètres', correct: false },
        ],
      },
      {
        id: 'q2',
        type: 'multiple',
        prompt: 'Quelles informations sont obligatoires ?',
        explanation: 'La date et le motif.',
        answers: [
          { id: 'a', label: 'La date', correct: true },
          { id: 'b', label: 'Le motif', correct: true },
          { id: 'c', label: 'La couleur', correct: false },
        ],
      },
      {
        id: 'q3',
        type: 'truefalse',
        prompt: 'Un rendez-vous peut être déplacé.',
        explanation: '',
        answers: [
          { id: 'true', label: 'Vrai', correct: true },
          { id: 'false', label: 'Faux', correct: false },
        ],
      },
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
  // MOB-01 : QUIZ_W=390 rejoue le parcours en mobile (390 × 844)
  const W = Number(process.env.QUIZ_W || 1280);
  const page = await (
    await themedContext(b, { viewport: W <= 480 ? { width: W, height: 844 } : { width: W, height: 860 } })
  ).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const submits = [];
  const events = [];
  let used = 0;
  await page.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', manifest: manifest }),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    }),
  );
  await page.route('**/assets/a.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
  await page.route('**/functions/v1/track', (r) => {
    try {
      events.push(...(JSON.parse(r.request().postData() || '{}').events ?? []));
    } catch {}
    return r.fulfill({ status: 200, body: '{}' });
  });
  await page.route('**/rest/v1/rpc/submit_quiz_attempt', (r) => {
    const batch = JSON.parse(r.request().postData()).p_batch;
    submits.push(batch);
    used++;
    // Score « serveur » simulé : même règle (tout ou rien)
    const good = { q1: ['a'], q2: ['a', 'b'], q3: ['true'] };
    const qs = manifest.quiz.questions.map((q) => {
      const g = batch.answers.find((a) => a.questionId === q.id)?.answerIds ?? [];
      const okq = g.length === good[q.id].length && g.every((x) => good[q.id].includes(x));
      return { questionId: q.id, correct: okq };
    });
    const correct = qs.filter((q) => q.correct).length;
    const score = Math.round((100 * correct) / 3);
    return r.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        score,
        correct,
        total: 3,
        passed: score >= 70,
        attemptsLeft: 3 - used,
        questions: qs,
      }),
    });
  });
  await page.goto(`${PLAYER}/#/d/${DEMO}`);
  await page.waitForSelector('.p-stage');
  await page.locator('.p-controls [aria-label="Étape suivante"]').click();
  await page.getByRole('button', { name: 'Passer au quiz' }).click();
  await page.waitForSelector('.p-quiz-card');
  // F2-03 : la question en cours compte dans la barre (1 sur 3 : environ 33 %)
  ok(
    Math.abs(
      (await page.locator('.p-quiz-progress > div').evaluate((el) => el.getBoundingClientRect().width)) /
        (await page.locator('.p-quiz-progress').evaluate((el) => el.getBoundingClientRect().width)) -
        1 / 3,
    ) < 0.02,
    'barre de progression : environ 33 % sur la question 1',
  );
  ok(
    (await page.locator('legend').textContent()) === 'Où créer un rendez-vous ?',
    'énoncé = legend du fieldset',
  );
  ok(
    (await page.locator('.p-quiz-count').textContent()) === 'Question 1 sur 3',
    'progression « Question 1 sur 3 »',
  );

  // Sans réponse : message en role=alert et focus sur la première option
  await page.getByRole('button', { name: 'Valider ma réponse' }).click();
  ok(
    (await page.getByRole('alert').textContent()).includes('Choisissez une réponse'),
    'sans réponse : message en alerte',
  );
  ok(
    await page
      .locator('.p-quiz-option input')
      .first()
      .evaluate((el) => el === document.activeElement),
    'focus sur la première option',
  );

  // F2-02 : réponse cochée au clavier, focus visible
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  ok(await page.getByLabel('Dans les paramètres').isChecked(), 'réponse cochée au clavier');
  // MOB-01 M6 : un seul indicateur. Au clavier, le trait intérieur de 2 px (FIELD-01, sans outline) ;
  // après un clic, le seul contour de 2 px
  const rings = () =>
    page.evaluate(() => {
      const o = document.querySelector('.p-quiz-option.is-selected');
      const cs = getComputedStyle(o);
      return {
        outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
        ring: /inset/.test(cs.boxShadow),
        input: getComputedStyle(o.querySelector('input')).boxShadow,
        border: cs.borderTopWidth,
      };
    });
  const kb = await rings();
  ok(
    !kb.outline && kb.ring && kb.input === 'none' && kb.border === '2px',
    `M6 : au clavier, un seul anneau (${JSON.stringify(kb)})`,
  );
  await page.locator('.p-quiz-option', { hasText: 'Dans les paramètres' }).click();
  const ms = await rings();
  ok(
    !ms.outline && !ms.ring && ms.input === 'none' && ms.border === '2px',
    `M6 : après un clic, un seul contour de 2 px (${JSON.stringify(ms)})`,
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f2-question${sfx}.png` });
  // Mauvaise réponse : correction par texte et icône, explication, revoir l'étape
  await page.getByLabel('Dans les paramètres').check();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.p-quiz-status');
  ok(
    (await page.locator('.p-quiz-status h3').textContent()) === "Ce n'est pas la bonne réponse.",
    'correction : réponse fausse',
  );
  ok(
    (await page.locator('.is-bad .p-quiz-mark').textContent()) === 'Votre réponse',
    'marque « Votre réponse »',
  );
  ok(
    (await page.locator('.is-good .p-quiz-mark').textContent()) === 'Bonne réponse',
    'marque « Bonne réponse »',
  );
  ok(await page.locator('.p-quiz-option input').first().isDisabled(), 'options désactivées après correction');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f2-correction${sfx}.png` });
  await page.getByRole('button', { name: "Revoir l'étape 1 du module" }).click();
  await page.waitForSelector('.p-review-bar');
  ok(
    (await page.locator('.p-quiz-wrap').isHidden()) && (await page.locator('.p-stage').count()) === 1,
    'revoir l’étape 1',
  );
  await page.getByRole('button', { name: 'Revenir au quiz' }).click();
  ok(
    (await page.locator('.p-quiz-status h3').textContent()).includes('pas la bonne'),
    'retour au quiz sur la même question',
  );
  await page.getByRole('button', { name: 'Question suivante' }).click();

  // Choix multiples incomplet
  await page.getByLabel('La date').check();
  await page.getByRole('button', { name: 'Valider ma réponse' }).click();
  ok((await page.locator('.p-quiz-status h3').textContent()) === 'Réponse incomplète.', 'réponse incomplète');
  ok(
    (await page.locator('.p-quiz-mark', { hasText: 'Bonne réponse non cochée' }).count()) === 1,
    'bonne réponse non cochée signalée',
  );
  await page.getByRole('button', { name: 'Question suivante' }).click();
  ok((await page.locator('.p-quiz-options.is-tf .p-quiz-option').count()) === 2, 'vrai / faux côte à côte');
  await page.getByLabel('Vrai').check();
  await page.getByRole('button', { name: 'Valider ma réponse' }).click();
  await page.getByRole('button', { name: 'Voir mon résultat' }).click();
  await page.waitForSelector('.p-quiz-result');
  // MOB-01 M7 (delta L42) : pas de badge, une ligne, actions dans une barre collée en bas de la carte
  ok((await page.locator('.p-quiz-pass, .p-quiz-badge').count()) === 0, 'échec : pas de badge');
  const bar = page.locator('.p-quiz-bar');
  const retry = bar.getByRole('button', { name: 'Réessayer le quiz' });
  ok(
    (await bar.locator('button').first().textContent()).includes('Réessayer le quiz') &&
      (await retry.getAttribute('class')).includes('p-btn-primary') &&
      (await bar.getByRole('button', { name: 'Revoir le module' }).getAttribute('class')).includes('p-link'),
    'échec : « Réessayer le quiz » en principal, puis « Revoir le module » en lien',
  );
  const vis = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.p-quiz-bar button')]
      .find((x) => /Réessayer/.test(x.textContent))
      .getBoundingClientRect();
    const ctrl = document.querySelector('.p-controls')?.getBoundingClientRect();
    return {
      bottom: Math.round(r.bottom),
      top: Math.round(r.top),
      ctrlTop: ctrl ? Math.round(ctrl.top) : null,
      h: innerHeight,
    };
  });
  ok(
    vis.top >= 0 && vis.bottom <= (vis.ctrlTop ?? vis.h) && vis.bottom <= vis.h,
    `M7 : « Réessayer le quiz » visible sans défiler, au-dessus de la barre du lecteur (${W} px, ${JSON.stringify(vis)})`,
  );
  // L42 : anneau redessiné (encoche du seuil dans la piste, seuil en texte, plus de trait noir)
  ok((await page.locator('.p-ring__threshold').count()) === 0, 'L42 : plus de trait du seuil');
  ok(
    (await page.locator('.p-ring__threshold-text').textContent()) === 'Seuil de validation : 70\u202f%',
    'L42 : seuil écrit sous l’anneau',
  );
  ok(
    /Votre score :\s*33\s*%/.test(await page.locator('.p-ring__score').textContent()),
    'L42 : « Votre score : 33 % » au centre',
  );
  ok(
    !!(await page.locator('.p-ring__track').getAttribute('stroke-dasharray')) &&
      (await page.locator('.p-ring__arc').evaluate((el) => getComputedStyle(el).stroke)) ===
        'rgb(91, 102, 117)',
    'L42 : encoche dans la piste, arc ardoise sous le seuil',
  );
  ok(
    await page.locator('.p-quiz-result h2').evaluate((el) => el === document.activeElement),
    'focus sur le titre du résultat',
  );
  ok(
    (await page.getByRole('status').first().textContent()) ===
      '1 bonne réponse sur 3 · il vous reste 2 tentatives',
    'M7 : une ligne « 1 bonne réponse sur 3 · il vous reste 2 tentatives »',
  );
  ok(
    submits.length === 1 && submits[0].answers.length === 3 && !!submits[0].visitorId,
    'tentative envoyée au serveur',
  );
  await page.waitForTimeout(700); // fin du tracé de l'arc (600 ms)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f2-resultat-echec${sfx}.png` });

  // Seconde tentative réussie
  await page.getByRole('button', { name: 'Réessayer le quiz' }).click();
  for (const [label, n] of [
    ['Dans l’agenda', 1],
    ['La date', 2],
    ['Vrai', 3],
  ]) {
    await page.getByLabel(label).check();
    if (n === 2) await page.getByLabel('Le motif').check();
    await page.getByRole('button', { name: 'Valider ma réponse' }).click();
    // F2-03 : bonne réponse (correction affichée)
    if (n === 1 && SHOTS) {
      await page.waitForSelector('.p-quiz-status');
      await page.screenshot({ path: `${SHOTS}/f2-bonne-reponse${sfx}.png` });
    }
    await page.getByRole('button', { name: n === 3 ? 'Voir mon résultat' : 'Question suivante' }).click();
  }
  await page.waitForSelector('.p-quiz-pass');
  ok(
    (await page.locator('.p-quiz-pass').textContent()) === 'Module validé' &&
      (await page.locator('.p-quiz-pass').evaluate((el) => {
        const c = getComputedStyle(el);
        return (
          c.fontSize === '14px' &&
          c.fontWeight === '600' &&
          !!el.querySelector('svg') &&
          c.backgroundColor === 'rgba(0, 0, 0, 0)'
        );
      })),
    'M8 : réussite en texte 14 px 600 avec l’icône, sans pastille',
  );
  ok((await page.locator('.p-quiz-result h2').textContent()).includes('Bravo'), 'titre de réussite');
  // F2-05 : tentatives restantes après réussite : « Repasser le quiz »
  ok(
    (await page.getByRole('button', { name: 'Repasser le quiz' }).count()) === 1,
    'réussite : « Repasser le quiz » (tentative restante)',
  );
  await page.waitForTimeout(700);
  ok(
    await page
      .locator('.p-ring.is-pass .p-ring__arc')
      .evaluate((el) => Math.abs(parseFloat(getComputedStyle(el).strokeDasharray) - 2 * Math.PI * 74) < 1),
    'L42 : 100 % : cercle plein, couleur principale',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f2-resultat-reussite${sfx}.png` });
  await page.waitForTimeout(2600);
  ok(
    events.filter((e) => e.type === 'demo_complete').length === 1,
    'module terminé à la réussite du quiz (une fois)',
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
