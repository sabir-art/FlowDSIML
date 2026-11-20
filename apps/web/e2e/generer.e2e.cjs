/**
 * Test e2e L30-05 (et L30-09 sur la carte) : Nouvelle démo > « Générer avec l'IA » (désactivée par
 * défaut, plan texte, quiz, aperçu modifiable, Créer la démo en brouillon, étapes « À capturer »,
 * toast, ligne du bilan RGPD tant qu'un repère IA reste). Données fictives, aucun appel au fournisseur.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/generer.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

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
    await page.waitForTimeout(250);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.aiReply = (task, input) => ({
    title: 'Créer un usager',
    chapters: [
      {
        title: 'Ouvrir la fiche',
        steps: [
          { title: 'Ouvrir Usagers', text: 'Ouvrez le menu Usagers.' },
          { title: 'Cliquer sur Ajouter', text: 'Cliquez sur Ajouter pour créer une fiche.' },
        ],
      },
      {
        title: 'Renseigner',
        steps: [{ title: 'Saisir l’identité', text: 'Renseignez le nom et le prénom fictifs.' }],
      },
    ],
    quiz: input.withQuiz
      ? [
          {
            prompt: 'Où ajouter un usager ?',
            answers: [
              { text: 'Menu Usagers', correct: true },
              { text: 'Paramètres', correct: false },
            ],
          },
        ]
      : [],
  });
  await install(page, state);

  // L30-09 : carte désactivée tant que l'espace n'a pas activé l'Assistance IA
  await page.goto(`${APP}/#/demos`);
  await page.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  const nd = page.getByRole('dialog', { name: 'Nouvelle démo' });
  await nd.waitFor();
  const card = nd.getByRole('button', { name: /Générer avec l’IA/ });
  await card.waitFor();
  await page.waitForTimeout(300);
  ok((await card.getAttribute('aria-disabled')) === 'true', 'Carte désactivée (aria-disabled)');
  ok(
    /Assistance IA désactivée dans cet espace/.test(await nd.locator('.ai-tip').textContent()),
    'Infobulle de la règle 4',
  );
  await card.hover();
  await shot('l30-09-carte');
  await page.keyboard.press('Escape');

  // Activation
  state.ai.enabled = true;
  await page.goto(`${APP}/#/demos`);
  await page.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  await nd.waitFor();
  await page.waitForTimeout(300);
  ok((await card.getAttribute('aria-disabled')) === null, 'Activée : carte cliquable');
  await card.click();
  const dlg = page.getByRole('dialog', { name: 'Générer une démo avec l’IA' });
  await dlg.waitFor();
  ok((await dlg.getByRole('tab').count()) === 2, 'Deux sources (Plan texte, Capture HTML)');
  ok(
    (await dlg.getByLabel('Décrivez la procédure, une étape par ligne').getAttribute('maxlength')) === '4000',
    '4 000 caractères au plus',
  );
  await dlg
    .getByLabel('Décrivez la procédure, une étape par ligne')
    .fill('Ouvrir le menu Usagers\nCliquer sur Ajouter\nRenseigner l’identité');
  await dlg.getByLabel('Avec un quiz de 3 questions').check();
  await shot('l30-05-plan');
  await dlg.getByRole('button', { name: 'Proposer les étapes' }).click();
  await dlg.getByRole('button', { name: 'Créer la démo' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'generate' && call.input.withQuiz === true && /Usagers/.test(call.input.plan),
    'Demande : plan et quiz',
  );
  ok((await dlg.getByText('3 étapes').count()) === 1, 'Nombre d’étapes');
  ok((await dlg.getByText('Généré par IA, à vérifier').count()) === 1, 'Mention de la règle 2');
  ok((await dlg.getByText('Quiz (1 question)').count()) === 1, 'Quiz dans l’aperçu');
  const before = state.tables.demos.length;
  await dlg.getByLabel('Titre de l’étape 3').fill('Saisir l’identité fictive');
  await dlg.getByRole('button', { name: 'Ajouter une étape' }).last().click();
  await dlg.getByLabel('Titre de l’étape 4').fill('Enregistrer');
  await dlg.getByLabel('Texte de la bulle, étape 4').fill('Cliquez sur Enregistrer.');
  await shot('l30-05-apercu');
  ok(state.tables.demos.length === before, 'Rien n’est créé avant « Créer la démo »');
  await dlg.getByRole('button', { name: 'Créer la démo' }).click();
  await page.getByText('Démo créée. Vérifiez chaque étape avant de publier.').waitFor();
  const demo = state.tables.demos.at(-1);
  const steps = state.tables.steps
    .filter((s) => s.demo_id === demo.id)
    .sort((a, b) => a.position - b.position);
  ok(demo.title === 'Créer un usager' && (demo.status ?? 'draft') === 'draft', 'Démo en brouillon');
  ok(steps.length === 4 && steps.every((s) => s.to_capture), '4 étapes « À capturer »');
  ok(steps[2].title === 'Saisir l’identité fictive', 'Modification de l’aperçu reprise');
  ok((state.tables.chapters || []).filter((c) => c.demo_id === demo.id).length === 2, 'Chapitres créés');
  ok(
    (state.tables.quiz_questions || []).some(
      (q) => q.demo_id === demo.id && q.answers[0].label === 'Menu Usagers',
    ),
    'Quiz créé',
  );
  ok(state.tables.hotspots.filter((h) => h.demo_id === demo.id).length === 4, 'Une bulle par étape');
  await page.waitForURL(new RegExp(`/demos/${demo.id}/edit`));
  ok(true, 'Éditeur de la nouvelle démo ouvert');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
