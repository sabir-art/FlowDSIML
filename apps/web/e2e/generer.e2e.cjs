/**
 * Test e2e L30-05 (et L30-09 sur la carte) : Nouvelle démo > « Générer avec l'IA » (désactivée par
 * défaut, plan texte, quiz, aperçu modifiable, Créer la démo en brouillon, étapes « À capturer »,
 * toast, ligne du bilan RGPD tant qu'un repère IA reste). Données fictives, aucun appel au fournisseur.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/generer.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const { pick, optionsOf } = require('./_select.cjs');
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
  // L48-G : étape 1 (type de contenu), puis la source
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const nd = page.getByRole('dialog', { name: 'Nouvelle démo' });
  await nd.waitFor();
  const card = nd.getByRole('button', { name: /Générer avec l’IA/ });
  await card.waitFor();
  await page.waitForTimeout(300);
  ok((await card.getAttribute('aria-disabled')) === 'true', 'Carte désactivée (aria-disabled)');
  ok(
    /Assistance IA désactivée dans cet espace/.test(await nd.locator('#nd-ai-why').textContent()) &&
      (await card.getAttribute('aria-describedby')) === 'nd-ai-why',
    'Raison de la règle 4 reliée à la carte (lot 2 : texte, plus d’infobulle)',
  );
  await card.hover();
  await shot('l30-09-carte');
  await page.keyboard.press('Escape');

  // Activation
  state.ai.enabled = true;
  await page.goto(`${APP}/#/demos`);
  await page.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  // L48-G : étape 1 (type de contenu), puis la source
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
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

  // ===== L30-05 : source « Capture HTML » =====
  const ws = state.tables.workspaces[0].id;
  const srcDemo = state.tables.demos[0];
  const PATH = `${ws}/${srcDemo.id}/0b5c1f0e-0000-4000-8000-0000000000c9.html`;
  state.htmlPages = {
    [PATH]:
      '<!doctype html><html><head><title>Usagers</title><script>alert(1)</script></head><body>' +
      '<nav id="menu"><a href="/">Accueil</a><a href="/usagers">Usagers</a></nav><h1>Liste des usagers</h1>' +
      '<p class="perso">Camille Fictive</p><button id="ajouter">Ajouter</button><button>Exporter</button></body></html>',
  };
  state.tables.steps.push({
    ...state.tables.steps.find((s) => s.demo_id === srcDemo.id),
    id: '0b5c1f0e-0000-4000-8000-0000000000c8',
    demo_id: srcDemo.id,
    position: 99,
    kind: 'html',
    title: 'Liste des usagers',
    image_path: null,
    html_path: PATH,
    html_ops: [{ id: 'b1', sel: 'p.perso', op: 'blur', scope: 'step' }],
    html_meta: {
      title: 'Usagers',
      url: 'https://logiciel.acme.example/usagers',
      viewport: { w: 1280, h: 720 },
    },
  });
  state.aiReply = () => ({
    title: 'Ajouter un usager',
    chapters: [
      {
        title: '',
        steps: [
          { title: 'Ouvrir la liste', text: 'La liste des usagers s’affiche.', target: null },
          { title: 'Cliquer sur Ajouter', text: 'Cliquez sur Ajouter.', target: 3 },
        ],
      },
    ],
    quiz: [],
  });
  await page.goto(`${APP}/#/demos`);
  await page.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await nd.waitFor();
  await card.click();
  await dlg.waitFor();
  await dlg.getByRole('tab', { name: 'Capture HTML' }).click();
  ok(
    (await dlg.getByRole('tab', { name: 'Capture HTML' }).getAttribute('aria-selected')) === 'true' &&
      !(await dlg.getByRole('tab', { name: 'Capture HTML' }).innerText()).includes('Bientôt'),
    'onglet « Capture HTML » actif, sans « Bientôt »',
  );
  const captured = dlg.getByLabel('Page capturée');
  await captured.waitFor();
  ok(
    (await optionsOf(captured)).some((o) => o.endsWith('› Liste des usagers')),
    'page proposée : « Démo › Page »',
  );
  ok(
    (await dlg.locator('#ai-gen-html-help').innerText()).includes('Seul le texte de la page part vers l’IA'),
    'mention : texte seul, sans zones floutées',
  );
  await pick(captured, {
    label: (await optionsOf(captured)).find((o) => o.endsWith('› Liste des usagers')),
  });
  await shot('l30-05-html');
  await dlg.getByRole('button', { name: 'Proposer les étapes' }).click();
  await dlg.getByRole('button', { name: 'Créer la démo' }).waitFor();
  const hc = state.aiCalls.at(-1);
  ok(
    hc.task === 'generate' &&
      !hc.input.plan &&
      /Liste des usagers/.test(hc.input.page.text) &&
      !/Camille|alert/.test(JSON.stringify(hc.input)) &&
      !/<|#ajouter|nth-of-type/.test(JSON.stringify(hc.input)),
    'demande : texte de la page après floutage, sans HTML, script ni sélecteur',
  );
  ok(
    JSON.stringify(hc.input.page.elements) ===
      JSON.stringify([
        { i: 0, label: 'Accueil' },
        { i: 1, label: 'Usagers' },
        { i: 2, label: 'Ajouter' },
        { i: 3, label: 'Exporter' },
      ]),
    'éléments cliquables numérotés',
  );
  await dlg.getByRole('button', { name: 'Créer la démo' }).click();
  // Le toast de la première création peut être encore affiché : on attend l'éditeur de la nouvelle démo
  await page.waitForURL((u) => /\/demos\/[^/]+\/edit/.test(u.hash) && !u.hash.includes(demo.id));
  const hd = state.tables.demos.at(-1);
  const hs = state.tables.steps.filter((s) => s.demo_id === hd.id).sort((a, b) => a.position - b.position);
  const hh = state.tables.hotspots.filter((h) => h.demo_id === hd.id);
  ok(
    hs.length === 2 && hs.every((s) => s.kind === 'html' && s.html_path === PATH && !s.to_capture),
    'étapes HTML sur la page capturée (aucune « À capturer »)',
  );
  ok(
    hs.every(
      (s) =>
        JSON.stringify(s.html_ops) ===
        JSON.stringify([{ id: 'b1', sel: 'p.perso', op: 'blur', scope: 'step' }]),
    ),
    'flous de la page source conservés',
  );
  const onAjout = hh.find((h) => h.step_id === hs[1].id);
  ok(
    onAjout?.sel === 'body > button:nth-of-type(2)',
    `bulle posée sur l’élément visé, n° 3 « Exporter » (${onAjout?.sel})`,
  );
  ok(!hh.find((h) => h.step_id === hs[0].id).sel, 'sans élément visé : bulle sans sélecteur');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
