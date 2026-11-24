/**
 * Test e2e L38 paquet 4 (revue « parcours de formation », n° 6, 7, 10, 11 et 12). Données fictives.
 *  - n° 6 : entrée « Quiz » au bas du rail (« Ajouter un quiz » ou questions et seuil).
 *  - n° 7 : bloc « Formation » de Partager : ajout à une formation (formation, position), puis
 *    « Module n de … » ; lien vers le paquet SCORM.
 *  - n° 10 : voix off sous le texte de la bulle, « Étape suivante » après un enregistrement.
 *  - n° 11 : lecteur sous 640 px : zone du hotspot agrandie, « Voir tout l'écran ».
 *  - n° 12 : Apprenants : « Quiz non validé », tentatives restantes, « Accorder une tentative ».
 * Usage : node e2e/formation-outils.e2e.cjs
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { learnersFixture } = require('./learners-data.cjs');
const { pick } = require('./_select.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const newPage = async (viewport = { width: 1440, height: 900 }, extra = {}) => {
    const p = await (await b.newContext({ viewport, locale: 'fr-FR', ...extra })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };

  // ===== n° 6 et 10 : éditeur =====
  {
    const page = await newPage();
    const state = seed();
    const t = state.tables;
    const steps = t.steps.filter((s) => s.demo_id === DEMO).sort((a, b) => a.position - b.position);
    steps[0].voice_path = `${t.workspaces[0].id}/${DEMO}/voix-1.webm`;
    steps[0].voice_transcript = 'Cliquez sur Nouveau.';
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/edit`);
    const quiz = page.locator('.rail-quiz');
    await quiz.waitFor();
    ok(
      (await quiz.textContent()).includes('Ajouter un quiz') &&
        (await quiz.getAttribute('href')).endsWith(`/demos/${DEMO}/quiz`),
      'n° 6 : « Ajouter un quiz » au bas du rail, vers la page Quiz',
    );
    // n° 10 : bulle sélectionnée, voix off visible sous le texte de la bulle
    await page.locator('.canvas-hotspot').first().click();
    await page.locator('#hs-title').waitFor();
    const voice = page.locator('.voice-sec');
    ok((await voice.count()) === 1, 'n° 10 : section Voix off dans la vue Hotspot et bulle');
    const order = await page.evaluate(() => {
      const v = document.querySelector('.voice-sec');
      const body = document.getElementById('hs-body');
      return !!(v && body && body.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    ok(order, 'n° 10 : placée après le texte de la bulle');
    // EXT-02 §6.4 : voix en place = carte (durée, écoute, « Remplacer… »), « Supprimer » dans le menu ⋯
    const card = voice.locator('.vo-card');
    const more = card.getByRole('button', { name: 'Plus d’actions sur la voix' });
    ok(
      (await card.count()) === 1 &&
        /\d+:\d{2}/.test(await card.locator('.vo-card__txt').innerText()) &&
        (await card.getByRole('button', { name: /^Écouter/ }).count()) === 1 &&
        (await card.getByRole('button', { name: 'Remplacer…' }).count()) === 1 &&
        (await more.count()) === 1,
      'Lead UX §6.4 : carte de la voix (durée, Écouter, Remplacer…, menu ⋯)',
    );
    await more.click();
    ok(
      (await page.getByRole('menuitem', { name: 'Supprimer la voix off' }).count()) === 1,
      'Lead UX §6.4 : « Supprimer la voix off » dans le menu',
    );
    await page.keyboard.press('Escape');
    await voice.getByRole('button', { name: 'Étape suivante' }).click();
    await page.waitForTimeout(300);
    ok(
      /^Étape 2 · /.test(await page.locator('.stage-head .t-caption').first().innerText()),
      'n° 10 : « Étape suivante » ouvre l’étape 2',
    );
    ok((await page.locator('.voice-sec').count()) === 1, 'n° 10 : la voix off de l’étape 2 est à portée');
    await page.context().close();
  }
  {
    const page = await newPage();
    const state = seed();
    state.tables.quiz_questions.push(
      ...[0, 1].map((i) => ({
        id: `q${i}`,
        demo_id: DEMO,
        workspace_id: state.tables.workspaces[0].id,
        position: i,
        type: 'single',
        prompt: `Question ${i + 1}`,
        answers: [
          { id: 'a', text: 'Oui', correct: true },
          { id: 'b', text: 'Non', correct: false },
        ],
      })),
    );
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/edit`);
    await page.locator('.rail-quiz').waitFor();
    ok(
      (await page.locator('.rail-quiz').textContent()).replace(/ /g, ' ') ===
        'Quiz · 2 questions · seuil 70 %',
      'n° 6 : « Quiz · 2 questions · seuil 70 % »',
    );
    await page.context().close();
  }

  // ===== n° 7 : bloc « Formation » de Partager =====
  {
    const page = await newPage();
    const state = seed();
    const t = state.tables;
    const ws = t.workspaces[0].id;
    const other = t.demos.find((d) => d.id !== DEMO).id;
    t.paths = [{ id: 'p-1', workspace_id: ws, title: 'Logiciel métier', ordered: true }];
    t.path_modules = [{ path_id: 'p-1', demo_id: other, workspace_id: ws, position: 0, required: true }];
    await install(page, state);
    // §1 : les parcours de formation de la démo sont la première section de la fenêtre « Diffuser »
    await page.goto(`${APP}/#/demos/${DEMO}/distribute`);
    await page
      .locator('dialog.dif-dialog[open]')
      .getByRole('tab', { name: /^Parcours de formation/ })
      .click();
    const card = page.locator('.sh-training');
    await card.waitFor();
    ok(
      (
        await card
          .getByRole('link', { name: 'Paquet SCORM pour votre plateforme de formation' })
          .getAttribute('href')
      ).endsWith(`/demos/${DEMO}/distribute`),
      'n° 7 : lien vers le paquet SCORM (Diffuser)',
    );
    await pick(card.getByLabel('Position'), { label: 'Module 1' });
    await card.getByRole('button', { name: 'Ajouter à la formation' }).click();
    await card.getByText('Module 1 de « Logiciel métier ».').waitFor();
    const mods = t.path_modules.filter((m) => m.path_id === 'p-1').sort((a, b) => a.position - b.position);
    ok(
      mods.map((m) => m.demo_id).join() === [DEMO, other].join() && mods[1].position === 1,
      'n° 7 : ajoutée en module 1, le module suivant décalé',
    );
    await page.context().close();
  }

  // ===== n° 11 : lecteur sous 640 px =====
  const manifest = require('./player-maquette.cjs');
  for (const reduced of [false, true]) {
    const p = await newPage({ width: 390, height: 844 }, reduced ? { reducedMotion: 'reduce' } : {});
    await p.route('**/functions/v1/**', (r) =>
      r.fulfill({ contentType: 'application/json', headers: cors, body: '{}' }),
    );
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest }),
      }),
    );
    await p.route('**/assets/**', (r) =>
      r.fulfill({ contentType: 'image/png', body: fs.readFileSync(`${__dirname}/fixture.png`) }),
    );
    await p.goto(`${PLAYER}/#/d/${manifest.demoId}`);
    await p.locator('.p-img').waitFor();
    await p.waitForTimeout(800);
    const zoom = () =>
      p
        .locator('.p-zoom')
        .first()
        .evaluate((el) => ({ t: el.style.transform, instant: el.classList.contains('is-instant') }));
    const z = await zoom();
    ok(
      z.t === 'scale(2)',
      `n° 11${reduced ? ' (animations réduites)' : ''} : zone du hotspot agrandie ×2 (${z.t})`,
    );
    if (reduced) ok(z.instant, 'n° 11 : sans animation si l’utilisateur réduit les animations');
    const btn = p.getByRole('button', { name: 'Voir tout l’écran' });
    ok(await btn.isVisible(), 'n° 11 : bouton « Voir tout l’écran »');
    // MOB-01 M5 : capture 12 px sous l'en-tête ; le lien est sous la capture, à droite, sans la recouvrir
    const m5 = await p.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      const top = r('.p-top');
      const shot = document.querySelector('.p-win') ? r('.p-win') : r('.p-stage');
      const b = r('.p-autozoom');
      const wrap = r('.p-stage-wrap');
      return {
        gap: Math.round(shot.top - top.bottom),
        below: b.top >= shot.bottom,
        right: Math.round(wrap.right - b.right),
        size: getComputedStyle(document.querySelector('.p-autozoom')).fontSize,
      };
    });
    ok(
      m5.gap >= 10 && m5.gap <= 16 && m5.below && m5.right <= 20 && m5.size === '14px',
      `M5 : capture en haut (12 px), « Voir tout l’écran » en lien de 14 px sous la capture (${JSON.stringify(m5)})`,
    );
    await btn.click();
    ok((await zoom()).t === 'none', 'n° 11 : « Voir tout l’écran » montre la capture entière');
    ok(
      await p.getByRole('button', { name: 'Agrandir autour du point' }).isVisible(),
      'n° 11 : retour au cadrage',
    );
    await p.context().close();
  }
  {
    const p = await newPage({ width: 1280, height: 860 });
    await p.route('**/functions/v1/**', (r) =>
      r.fulfill({ contentType: 'application/json', headers: cors, body: '{}' }),
    );
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest }),
      }),
    );
    await p.route('**/assets/**', (r) =>
      r.fulfill({ contentType: 'image/png', body: fs.readFileSync(`${__dirname}/fixture.png`) }),
    );
    await p.goto(`${PLAYER}/#/d/${manifest.demoId}`);
    await p.locator('.p-img').waitFor();
    ok((await p.locator('.p-autozoom').count()) === 0, 'n° 11 : rien sur grand écran');
    await p.context().close();
  }

  // ===== n° 12 : Apprenants =====
  {
    const page = await newPage();
    const state = await install(page);
    const f = learnersFixture();
    const L = f.progress.learners;
    const quizMod = (o) => ({
      demoId: 'm-quiz',
      total: 6,
      seen: 6,
      completed: false,
      hasQuiz: true,
      best: 55,
      used: 1,
      max: 2,
      status: 'in_progress',
      lastActivity: new Date().toISOString(),
      ...o,
    });
    const setQuiz = (l, o) => {
      l.modules = [...l.modules.filter((m) => m.demoId !== 'm-quiz'), quizMod(o)];
    };
    setQuiz(L[0], {});
    setQuiz(L[1], { used: 2, status: 'failed' });
    state.learners = f.progress;
    state.learnerDetail = f.detail;
    const granted = [];
    await page.route('**/rest/v1/rpc/grant_quiz_attempt', (r) => {
      granted.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: '1' });
    });
    await page.goto(`${APP}/#/learners`);
    await page.waitForSelector('.l13-table');
    const row = (name) => page.locator('.l13-table tbody tr', { hasText: name });
    const r0 = row(L[0].name);
    ok(
      (await r0.locator('.st-badge').textContent()).includes('Quiz non validé') &&
        (await r0.locator('.l13-quizleft').textContent()) === '1 tentative restante',
      'n° 12 : « Quiz non validé », 1 tentative restante',
    );
    // Audit L50 X1 : même couleur de progression, validé ou non (le statut le dit en texte)
    ok(
      (await r0.locator('.lp .fd-bar__fill').evaluate((el) => getComputedStyle(el).backgroundColor)) ===
        (await page.evaluate(() => getComputedStyle(document.body).color)),
      'n° 12 : barre de progression en couleur de texte',
    );
    const r1 = row(L[1].name);
    ok(
      (await r1.locator('.l13-quizleft').textContent()).startsWith('Tentatives épuisées.'),
      'n° 12 : « Tentatives épuisées »',
    );
    await r1.getByRole('button', { name: 'Accorder une tentative' }).click();
    await page.waitForTimeout(400);
    ok(
      granted.some((g) => g.p_learner === L[1].id && g.p_demo === 'm-quiz'),
      'n° 12 : « Accorder une tentative » (grant_quiz_attempt)',
    );
    await page.getByRole('button', { name: /^Statut\s*:/ }).click();
    await page.getByRole('menuitem', { name: 'Quiz non validé' }).click();
    await page.waitForTimeout(300);
    const badges = await page.locator('.l13-table tbody tr .st-badge').allTextContents();
    const names = await page.locator('.l13-table tbody tr').allTextContents();
    ok(
      badges.length >= 2 &&
        badges.every((x) => x.includes('Quiz non validé')) &&
        [L[0].name, L[1].name].every((n) => names.some((x) => x.includes(n))),
      `n° 12 : filtre « Quiz non validé » (${badges.length} lignes)`,
    );
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
