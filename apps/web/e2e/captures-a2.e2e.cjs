/**
 * Captures « après » (clair et sombre) : A2-01 modes de lecture et cadre, A2-02 étape pop-up remplie,
 * A2-03 checklist avec chapitres, A2-04 mode Sondage du quiz, F2-01 liste de questions (une
 * incomplète, une liée), F1-02 confirmation RGPD (cases non cochées puis cochées), L17-01 auteur et
 * date de la confirmation dans l'onglet Partager. Captures sans toast.
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/captures-a2.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const { pick } = require('./_select.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const CH = (n) => `0b5c1f0e-0000-4000-8000-0000000000a${n}`;
const QID = (n) => `0b5c1f0e-0000-4000-8000-0000000000b${n}`;

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
  /** Capture sans toast : on ferme les messages éphémères et on attend la fin des animations. */
  const shot = async (name, opts = {}) => {
    await page.evaluate(() =>
      document.querySelectorAll('.toast, .fd-toast, [data-toast]').forEach((el) => el.remove()),
    );
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png`, ...opts });
  };
  const state = seed();
  state.quizStats = { attempts: 0, visitors: 0, passRate: 0, avgScore: 0, questions: [] };
  const t = state.tables;
  const demo = t.demos.find((d) => d.id === DEMO);
  const ws = demo.workspace_id;
  const steps = t.steps.filter((s) => s.demo_id === DEMO);
  // A2-03 : deux chapitres
  t.chapters.push(
    { id: CH(1), demo_id: DEMO, workspace_id: ws, position: 0, title: 'Créer la fiche' },
    { id: CH(2), demo_id: DEMO, workspace_id: ws, position: 1, title: 'Planifier le rendez-vous' },
  );
  steps.forEach((s, i) => (s.chapter_id = i < 2 ? CH(1) : CH(2)));
  // F2-01 : cinq questions, dont une incomplète et une liée à une étape
  const now = new Date().toISOString();
  const q = (n, type, prompt, answers, extra = {}) => ({
    id: QID(n),
    demo_id: DEMO,
    workspace_id: ws,
    position: n - 1,
    type,
    prompt,
    answers,
    explanation: '',
    points: 1,
    step_id: null,
    created_at: now,
    updated_at: now,
    ...extra,
  });
  const A = (id, label, correct = false) => ({ id, label, correct });
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // A2-01 : modes de lecture (onglet Design), puis panneau défilé jusqu'au cadre
  await openTool(page, 'design');
  const spot = page.getByRole('button', { name: /Spotlight/ });
  await spot.scrollIntoViewIfNeeded();
  await spot.click();
  await page.waitForTimeout(600);
  ok((await page.locator('.canvas-spotlight').count()) >= 1, 'A2-01 : mode Spotlight appliqué au canevas');
  await shot('a2-01-modes');
  // L25-03 : la section « Cadre du navigateur » remplace la bascule d'A2-01
  const frame = page.getByRole('radiogroup', { name: 'Style' });
  await frame.scrollIntoViewIfNeeded();
  ok(
    (await frame.getByRole('radio').count()) === 4,
    'A2-01 / L25-03 : cadre Clair / Sombre / Minimal / Aucun',
  );
  await shot('a2-01-cadre');

  // A2-03 : checklist avec chapitres (onglet Réglages) et aperçu sur le canevas
  await openTool(page, 'settings');
  const cl = page.getByLabel('Afficher la checklist dans le player');
  await cl.scrollIntoViewIfNeeded();
  await cl.check();
  await page.waitForTimeout(800);
  ok(await cl.isChecked(), 'A2-03 : checklist activée');
  ok((await page.locator('.ck-prev').innerText()).includes('Planifier le rendez-vous'), 'A2-03 : chapitres');
  await shot('a2-03-checklist');

  // A2-02 : étape pop-up remplie (titre, texte, bouton)
  await openTool(page, 'step');
  await page.locator('.rail-foot').getByRole('button', { name: 'Ajouter une étape' }).click();
  await page.getByRole('menuitem', { name: 'Ajouter une pop-up' }).click();
  await page.waitForSelector('.canvas-popup');
  await page.getByLabel('Titre', { exact: true }).fill('Bienvenue dans l’agenda');
  await page
    .getByLabel('Texte', { exact: true })
    .fill('Vous allez planifier un premier rendez-vous en trois étapes.');
  await page.getByLabel('Bouton', { exact: true }).fill('Commencer');
  await pick(page.getByLabel('Chapitre', { exact: true }), { label: 'Créer la fiche' });
  await page.waitForTimeout(900);
  ok(
    (await page.locator('.canvas-popup').innerText()).includes('Commencer'),
    'A2-02 : pop-up remplie sur le canevas',
  );
  await shot('a2-02-popup');
  await shot('a2-02-popup-complet', { fullPage: true });

  // F1-02 : confirmation RGPD avant publication publique
  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const gdpr = page.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  ok(await gdpr.getByRole('button', { name: 'Publier en public' }).isDisabled(), 'F1-02 : bouton inactif');
  ok((await gdpr.locator('.gdpr-checks input').count()) === 2, 'F1-02 : deux cases regroupées');
  await shot('f1-02-rgpd');
  for (const c of await gdpr.locator('.gdpr-checks input').all()) await c.check();
  ok(await gdpr.getByRole('button', { name: 'Publier en public' }).isEnabled(), 'F1-02 : bouton actif');
  await shot('f1-02-rgpd-coche');
  await gdpr.getByRole('button', { name: 'Publier en public' }).click();
  await page.waitForTimeout(1500);
  ok(
    state.tables.demo_versions.some((v) => v.public_ack?.by),
    'L17-01 : confirmation enregistrée',
  );

  // L17-01 : auteur et date de la confirmation dans l'onglet Partager
  await page.goto(`${APP}/#/demos/${DEMO}/share`);
  const ack = page.locator('.sh-ack');
  await ack.waitFor();
  ok(/Confirmation RGPD/.test(await ack.innerText()), 'L17-01 : auteur et date affichés');
  await shot('l17-01-confirmation');

  // F2-01 : liste des questions ; A2-04 : mode Sondage (ajoutées après la publication : la
  // question incomplète bloquerait la publication)
  t.quiz_questions.push(
    q(
      1,
      'single',
      'Depuis quel menu créez-vous la fiche d’un nouvel usager accueilli à la Mission Locale ?',
      [A('a', 'Le menu Usagers', true), A('b', 'Le menu Paramètres')],
      { step_id: steps[0].id, explanation: 'Menu Usagers, bouton « Nouvelle fiche ».' },
    ),
    q(2, 'multiple', 'Quelles informations sont obligatoires ?', [
      A('a', 'La date de naissance', true),
      A('b', 'Le courriel', true),
      A('c', 'La photo'),
    ]),
    q(3, 'truefalse', 'Un rendez-vous peut être déplacé.', [A('true', 'Vrai', true), A('false', 'Faux')]),
    q(4, 'single', 'Qui reçoit la confirmation du rendez-vous ?', [A('a', 'L’usager'), A('b', '')]),
    q(5, 'single', 'Où retrouver les rendez-vous de la semaine ?', [
      A('a', 'Dans l’agenda', true),
      A('b', 'Dans le tableau de bord'),
    ]),
  );
  await page.goto(`${APP}/#/demos/${DEMO}/quiz`);
  await page.waitForSelector('.quiz-page');
  await page.locator('.quiz-list__item').first().click();
  await page.waitForTimeout(500);
  ok((await page.locator('.quiz-list__item').count()) === 5, 'F2-01 : cinq questions');
  ok((await page.locator('.quiz-list__dot').count()) === 1, 'F2-01 : une question incomplète');
  await shot('f2-01-editeur', { fullPage: true });
  await page.getByRole('button', { name: 'Sondage', exact: true }).click();
  await page.waitForTimeout(900);
  ok(
    (await page.getByRole('button', { name: 'Sondage', exact: true }).getAttribute('aria-pressed')) ===
      'true',
    'A2-04 : mode Sondage',
  );
  ok((await page.locator('#qz-att').count()) === 0, 'A2-04 : pas de tentatives en mode Sondage');
  await shot('a2-04-sondage', { fullPage: true });

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
