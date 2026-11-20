/**
 * L26-04 / L26-05 : « Partir d'un modèle » (catégories, grille au clavier, aperçu, modèles de l'espace),
 * étapes « À capturer », publication bloquée, « Enregistrer comme modèle ». Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/modeles.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  // Modèle de l'espace (fictif)
  state.tables.demo_templates.push({
    id: 'tpl-espace',
    workspace_id: 'ws-1',
    builtin_key: null,
    name: 'Procédure DSI',
    description: 'Structure commune des procédures publiées par la DSI.',
    category: 'procedure',
    icon: 'layout-template',
    structure: {
      chapters: [
        {
          title: 'Préparer',
          steps: [
            { type: 'popup', title: 'Contexte' },
            { type: 'bulle', title: 'Ouvrir le portail' },
            { type: 'bulle', title: 'Choisir le service' },
          ],
        },
        {
          title: 'Demander',
          steps: [
            { type: 'saisie', title: 'Décrire la demande' },
            { type: 'bulle', title: 'Joindre un fichier' },
            { type: 'bulle', title: 'Envoyer' },
            { type: 'fin', title: 'Écran de fin' },
          ],
        },
      ],
      quiz: [],
    },
    with_captures: false,
    created_by: 'u-alice',
    created_at: '2026-11-01T09:00:00Z',
    updated_at: '2026-11-01T09:00:00Z',
  });
  await install(page, state);

  // ===== L26-04 : bibliothèque =====
  await page.goto(`${BASE}/#/`);
  await page.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  // L48-G : étape 1 (type de contenu), puis la source
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const nd = page.getByRole('dialog', { name: 'Nouvelle démo' });
  await nd.waitFor();
  await nd.getByRole('button', { name: /Partir d’un modèle/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Partir d’un modèle' });
  await dlg.waitFor();
  const grid = dlg.getByRole('radiogroup', { name: 'Modèles' });
  await grid.getByRole('radio').first().waitFor();
  ok((await grid.getByRole('radio').count()) === 7, 'Tous : 6 modèles livrés et 1 de l’espace');
  const cats = dlg.getByRole('navigation', { name: 'Catégories de modèles' });
  ok(sp(await cats.getByRole('button', { name: /^Tous/ }).innerText()).endsWith('7'), 'catégorie Tous : 7');
  ok(
    (await cats.getByRole('button', { name: /^Tous/ }).getAttribute('aria-pressed')) === 'true',
    'catégories en aria-pressed',
  );
  const first = grid.getByRole('radio', { name: /Prise en main d’un logiciel|Prise en main d'un logiciel/ });
  ok((await first.getAttribute('aria-checked')) === 'true', 'premier modèle choisi');
  ok(
    /3 chapitres · 8 étapes · quiz de 3 questions/.test(sp(await first.innerText())),
    'carte (REV-08) : « 3 chapitres · 8 étapes · quiz de 3 questions »',
  );
  const prev = dlg.getByRole('complementary', { name: 'Aperçu du modèle' });
  ok(/Remplir le formulaire · saisie animée/.test(sp(await prev.innerText())), 'aperçu : type des étapes');
  ok(
    (await prev.locator('li').count()) === 8 &&
      /Puis un quiz de 3 questions, dans l’onglet Quiz de l’éditeur\./.test(sp(await prev.innerText())),
    'aperçu (REV-08) : 8 étapes numérotées, puis le quiz de 3 questions',
  );
  ok(
    /Les 6 étapes à capturer sont marquées « À capturer »/.test(sp(await prev.innerText())),
    'aperçu : alerte',
  );
  ok(
    /Les textes utilisent vos variables \({{first_name}}\)/.test(sp(await dlg.innerText())),
    'pied : variables et style',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${SHOTS}/l26-04-modeles${sfx}.png` });
    await dlg.screenshot({ path: `${SHOTS}/rev-08-modele${sfx}.png` });
  }
  // Clavier : flèches dans la grille
  await first.focus();
  await page.keyboard.press('ArrowRight');
  const second = grid.getByRole('radio').nth(1);
  ok(
    (await second.getAttribute('aria-checked')) === 'true' &&
      (await second.evaluate((e) => e === document.activeElement)),
    'flèche droite : modèle suivant, focus suivi',
  );
  // Catégorie
  await cats.getByRole('button', { name: /^Réglementaire/ }).click();
  ok((await grid.getByRole('radio').count()) === 1, 'Réglementaire : 1 modèle');
  ok(/seuil 70 %/.test(sp(await grid.getByRole('radio').first().innerText())), 'carte : seuil 70 %');
  await cats.getByRole('button', { name: /^Modèles de l’espace/ }).click();
  const mine = grid.getByRole('radio', { name: /Procédure DSI/ });
  ok(/Modèle de l’espace · 2 chapitres · 7 étapes/.test(sp(await mine.innerText())), 'modèle de l’espace');
  // Renommer depuis le menu ⋯
  await dlg.getByRole('button', { name: 'Actions du modèle Procédure DSI' }).click();
  await dlg.getByRole('menuitem', { name: 'Renommer' }).click();
  await dlg.getByLabel('Nom du modèle').fill('Procédure DSI 2026');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await grid.getByRole('radio', { name: /Procédure DSI 2026/ }).waitFor();
  ok(
    state.tables.demo_templates.find((x) => x.id === 'tpl-espace').name === 'Procédure DSI 2026',
    'renommer',
  );
  // Utiliser « Prise en main » avec Entrée
  await cats.getByRole('button', { name: /^Tous/ }).click();
  await first.click();
  await first.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/#\/demos\/demo-.*\/edit/);
  ok(true, 'Entrée : démo créée, éditeur ouvert');
  const id = state.lastTemplateDemo;
  const steps = () => state.tables.steps.filter((s) => s.demo_id === id);
  ok(
    steps().length === 8 && steps().filter((s) => s.to_capture).length === 6,
    'brouillon : 8 étapes, 6 à capturer',
  );
  ok(
    state.tables.quiz_questions.filter((q) => q.demo_id === id).length === 3,
    'brouillon (REV-08) : quiz de 3 questions',
  );
  const railQuiz = page.getByRole('link', { name: 'Quiz · 3 questions' });
  await railQuiz.waitFor();
  ok(
    (await railQuiz.getAttribute('href')).endsWith(`/demos/${id}/quiz`),
    'REV-08 : « Quiz · 3 questions » dans le rail, vers la page Quiz',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    const rail = await page.locator('.rail-quiz').boundingBox();
    await page.screenshot({
      path: `${SHOTS}/rev-08-rail-quiz${sfx}.png`,
      clip: { x: 0, y: Math.max(0, rail.y - 420), width: 420, height: 500 },
    });
  }

  // ===== Étape « À capturer » =====
  const frame = page.locator('.canvas-tocapture');
  await frame.waitFor();
  ok(/Se connecter/.test(await frame.innerText()), 'cadre : titre de l’étape');
  ok(/Étape à capturer 1 sur 6/.test(sp(await frame.innerText())), 'cadre : 1 sur 6');
  ok(
    (await frame.getByRole('button', { name: 'Importer une image' }).count()) === 1,
    'bouton « Importer une image »',
  );
  ok((await page.locator('.th-tocapture').count()) === 6, 'rail : 6 vignettes « À capturer »');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${SHOTS}/l26-04-a-capturer${sfx}.png` });
  }
  // Publication bloquée
  await page
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const alert = page.locator('.publish-error');
  await alert.waitFor();
  ok(
    /6 étapes restent à capturer/.test(sp(await alert.innerText())),
    'publication : « 6 étapes restent à capturer »',
  );
  const box = await alert.boundingBox();
  const vw = page.viewportSize().width;
  const btnBox = await page.locator('.publish-wrap > button').first().boundingBox();
  ok(
    box.x >= 0 && box.x + box.width <= vw && box.y >= btnBox.y + btnBox.height,
    'REV-09 : message sous le bouton Publier, entier dans la fenêtre',
  );
  const goBtn = alert.getByRole('button', { name: 'Aller à l’étape 1' });
  ok((await goBtn.count()) === 1, 'REV-09 : « Aller à l’étape 1 »');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `${SHOTS}/rev-09-publier-bloque${sfx}.png`,
      clip: {
        x: Math.max(0, box.x - 360),
        y: 0,
        width: Math.min(vw, box.width + 380),
        height: box.y + box.height + 24,
      },
    });
  }

  // Capture importée
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 200 } });
  await frame
    .locator('input[type=file]')
    .setInputFiles({ name: 'ecran.png', mimeType: 'image/png', buffer: png });
  await page.locator('.th-tocapture').nth(4).waitFor();
  await page.waitForTimeout(300);
  ok(steps().filter((s) => s.to_capture).length === 5, 'image importée : 5 étapes à capturer');

  // ===== L26-05 : Enregistrer comme modèle =====
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitem', { name: 'Enregistrer comme modèle' }).click();
  const sv = page.getByRole('dialog', { name: 'Enregistrer comme modèle' });
  await sv.waitFor();
  ok((await sv.getByLabel('Nom du modèle').getAttribute('maxlength')) === '60', 'nom : 60 caractères');
  ok(
    (await sv.getByRole('radio', { name: /Sans les captures/ }).isChecked()) === true,
    '« Sans les captures » par défaut',
  );
  await sv.getByLabel('Nom du modèle').fill('Prise en main maison');
  await sv.getByLabel(/Description/).fill('Notre façon de présenter un outil.');
  await sv.getByLabel('Catégorie').selectOption('logiciel');
  // Bilan RGPD : avec les captures, confirmation obligatoire
  await sv.getByRole('radio', { name: /Avec les captures/ }).check();
  ok(
    await sv.getByRole('button', { name: 'Enregistrer le modèle' }).isDisabled(),
    'avec les captures : bilan RGPD obligatoire',
  );
  await sv.getByRole('radio', { name: /Sans les captures/ }).check();
  if (SHOTS) {
    await page.mouse.move(0, 0);
    // Capture sans le toast « Démo créée depuis le modèle »
    await page
      .locator('.toast')
      .first()
      .waitFor({ state: 'detached', timeout: 8000 })
      .catch(() => undefined);
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((e) => e.remove()));
    await page.screenshot({ path: `${SHOTS}/l26-05-enregistrer${sfx}.png` });
  }
  await sv.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await page.getByText('Modèle enregistré').waitFor();
  const a = state.lastTemplateArgs;
  ok(
    a && a.p_name === 'Prise en main maison' && a.p_category === 'logiciel' && a.p_with_captures === false,
    'modèle enregistré (sans les captures)',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
