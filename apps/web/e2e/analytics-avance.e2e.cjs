/**
 * Test e2e L19 : analytics avancées (Temps réel, Sondages et tests, Segments, Alertes) sur la page
 * Analytics du workspace. Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/analytics-avance.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000002';
const N = ' ';

const live = (n) => ({
  kpis: { live: n ? 7 : 0, views30: n ? 23 : 0, ctaToday: n ? 14 : 2, leadsToday: n ? 3 : 0 },
  stepsTotal: 6,
  more: n ? 4 : 0,
  visitors: n
    ? [
        {
          key: 'k1',
          lastAt: new Date().toISOString(),
          since: new Date(Date.now() - 120000).toISOString(),
          stepIndex: 3,
          stepTitle: 'Choisir un modèle',
          device: 'desktop',
          country: 'FR',
          lastType: 'step_view',
          identity: 'Léa Martin',
          learner: true,
          structure: 'Équipe Nord',
        },
        {
          key: 'k2',
          lastAt: new Date().toISOString(),
          since: new Date(Date.now() - 40000).toISOString(),
          stepIndex: 1,
          stepTitle: 'Bienvenue',
          device: 'mobile',
          country: 'BE',
          lastType: 'step_view',
          identity: null,
        },
        {
          key: 'k3',
          lastAt: new Date().toISOString(),
          since: new Date(Date.now() - 240000).toISOString(),
          stepIndex: 5,
          stepTitle: 'Écran de fin',
          device: 'desktop',
          country: null,
          lastType: 'demo_complete',
          identity: null,
        },
      ]
    : [],
});

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
    if (!SHOTS) return;
    // Captures sans toast
    for (const x of await page.locator('.toast .toast-close').all()) await x.click().catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.toast')).catch(() => {});
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.live = live(1);
  state.surveys = {
    [DEMO]: [
      {
        id: 'q1',
        type: 'nps',
        prompt: 'Recommanderiez-vous ce tutoriel à un collègue ?',
        responses: 96,
        nps: { histogram: [2, 1, 1, 2, 2, 4, 5, 9, 21, 31, 18], score: 42 },
        choices: null,
      },
      { id: 'q2', type: 'text', prompt: 'Une suggestion ?', responses: 31, nps: null, choices: null },
    ],
  };
  state.choices = {
    [DEMO]: [
      {
        stepId: 'd2-s2',
        choices: [
          { label: 'Conseiller', visitors: 62, completed: 44 },
          { label: 'Chargé d’accueil', visitors: 27, completed: 17 },
          { label: 'Encadrant', visitors: 11, completed: 9 },
        ],
      },
    ],
  };
  state.surveyTexts = [
    { at: new Date().toISOString(), text: 'Plus de captures sur le formulaire, merci.', learner: null },
  ];
  state.tables.ab_tests = [
    {
      id: 'ab1',
      workspace_id: 'ws-1',
      demo_id: DEMO,
      step_id: 'd2-s3',
      status: 'running',
      goal: 'completion',
      label_b: 'Texte court',
      started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      ended_at: null,
      split_b: 50,
      variant_b: {},
      history: [],
    },
  ];
  state.tables.steps.push(
    { id: 'd2-s2', demo_id: DEMO, workspace_id: 'ws-1', position: 1, title: 'Vous êtes…', kind: 'text' },
    {
      id: 'd2-s3',
      demo_id: DEMO,
      workspace_id: 'ws-1',
      position: 2,
      title: 'Nouveau rapport',
      kind: 'image',
    },
  );
  state.abResults = { A: { visitors: 206, reached: 119 }, B: { visitors: 206, reached: 142 } };
  state.tables.paths = [{ id: 'p1', workspace_id: 'ws-1', title: 'Accueil des conseillers', goal: 80 }];
  state.tables.webhooks = [
    {
      id: 'w1',
      workspace_id: 'ws-1',
      url: 'https://hooks.acme.example/tc',
      name: '',
      events: ['alert.triggered'],
      state: 'active',
      failures: 0,
      secret_hint: '3f9a',
    },
  ];
  await install(page, state);

  // ===== L19-01 : temps réel =====
  await page.goto(`${APP}/#/analytics?tab=live`);
  await page.getByRole('heading', { name: 'Visiteurs actifs' }).waitFor();
  ok(
    (await page.getByRole('tab', { name: /Temps réel/ }).getAttribute('aria-selected')) === 'true',
    'onglet Temps réel ouvert depuis l’URL',
  );
  ok((await page.locator('.kpis .kpi').count()) === 4, '4 KPI');
  ok((await page.locator('.l19-hero .value').textContent()) === '7', 'visiteurs en ce moment');
  ok((await page.getByText('Léa Martin').count()) === 1, 'identité renvoyée par la base (éditeur)');
  ok(
    (await page.getByText('Apprenant · Équipe Nord').count()) === 1,
    'apprenant : sous-ligne avec la structure',
  );
  ok(
    (await page.locator('.avatar').getByText('LM', { exact: true }).count()) === 1,
    'apprenant : deux initiales',
  );
  ok(
    (await page.locator('tbody b').getByText('Visiteur anonyme', { exact: true }).count()) === 2,
    'anonymes : « Visiteur anonyme »',
  );
  ok(
    /^Démo CRM · actualisé toutes les 10 s$/.test(
      (await page.locator('.l19-livehead p').textContent()).replace(/\s+/g, ' ').trim(),
    ),
    'en-tête : démo nommée, sans « · » orphelin',
  );
  ok((await page.getByRole('img', { name: '4 étapes vues sur 6' }).count()) === 1, 'mini-progression nommée');
  ok((await page.getByText(/4 autres visiteurs anonymes/).count()) === 1, 'visiteurs restants');
  ok((await page.locator('table[aria-live="off"]').count()) === 1, 'tableau en aria-live off');
  const pause = page.getByRole('button', { name: 'Mettre en pause' });
  await pause.click();
  ok(
    (await page.getByRole('button', { name: 'Reprendre' }).getAttribute('aria-pressed')) === 'true',
    'pause à bascule',
  );
  await page.getByRole('button', { name: 'Reprendre' }).click();
  ok(
    state.calls.some((c) => c.path.endsWith('/live_demo') && c.body.p_demo),
    'live_demo interrogée',
  );

  // ===== L19-02 : temps réel vide =====
  state.live = live(0);
  await page.reload();
  await page.getByRole('heading', { name: 'Personne sur la démo en ce moment' }).waitFor();
  ok((await page.locator('.l19-hero .value').textContent()) === '0', 'vide : KPI à 0');
  ok(
    (await page.locator('.kpis .kpi .value').nth(2).textContent()) === '2',
    'vide : clics du jour conservés',
  );

  // ===== L19-03 : sondages et tests =====
  await page.getByRole('tab', { name: 'Sondages et tests' }).click();
  await page.getByLabel('Démo analysée').selectOption(DEMO);
  await page.getByRole('heading', { name: 'Test A/B · étape 3' }).waitFor();
  ok(new URL(page.url().replace('#/', '')).searchParams.get('tab') === 'tests', 'onglet gardé dans l’URL');
  ok((await page.getByText('B mène de 11 points sur 412 visiteurs.').count()) === 1, 'A/B : phrase prudente');
  ok((await page.locator('.vc.best').count()) === 1, 'A/B : meilleure variante bordée');
  ok((await page.getByText('+42').count()) === 1, 'recommandation : score');
  ok(
    (await page.getByRole('img', { name: /Répartition des notes de 0 à 10/ }).count()) === 1,
    'histogramme nommé',
  );
  ok(
    (await page.getByText(`Complétion après le choix${N}: Conseiller`).count()) === 1,
    'menu de choix : complétion après le choix',
  );
  await page.getByRole('button', { name: 'Voir les 31 réponses écrites' }).click();
  const drawer = page.getByRole('dialog', { name: 'Réponses écrites' });
  await drawer.waitFor();
  ok(
    (await drawer.getByText('Plus de captures sur le formulaire, merci.').count()) === 1,
    'réponses écrites (éditeur)',
  );
  await drawer.getByRole('button', { name: 'Fermer' }).click();

  // ===== L19-04 : segments =====
  await page.getByRole('tab', { name: 'Segments' }).click();
  await page.getByRole('heading', { name: 'Nouveau segment' }).waitFor();
  await page.getByRole('button', { name: 'Ajouter un filtre' }).click();
  const fd = page.getByRole('dialog', { name: 'Ajouter un filtre' });
  await fd.getByLabel('Valeur de la condition 1').selectOption('mobile');
  await fd.getByRole('button', { name: 'Appliquer' }).click();
  await page.getByRole('button', { name: 'Retirer le filtre Type d’appareil' }).waitFor();
  ok(/"device","is","mobile"/.test(decodeURIComponent(page.url())), 'filtre gardé dans l’URL');
  await page.getByRole('button', { name: 'Enregistrer comme segment' }).click();
  await page.getByLabel('Nom du segment').fill('Conseillers sur mobile');
  await page.getByRole('button', { name: 'Ajouter une condition' }).click();
  ok((await page.locator('fieldset.cond').count()) === 2, 'constructeur prérempli + une condition');
  ok(
    (await page.getByLabel('Critère de la condition 2').locator('option[disabled]').allTextContents()).some(
      (x) => /Ville · Bientôt/.test(x),
    ),
    'critères à venir : affichés désactivés avec « Bientôt »',
  );
  await page.getByLabel('Critère de la condition 2').selectOption('completed');
  await page.getByLabel('Valeur de la condition 2').selectOption('false');
  await page.getByText('111 visiteurs correspondent').waitFor({ timeout: 3000 });
  ok(true, 'compteur en direct (ET)');
  await page.getByRole('radio', { name: 'Au moins une (OU)' }).click();
  await page.getByText('800 visiteurs correspondent').waitFor({ timeout: 3000 });
  ok((await page.locator('.cond .cn').nth(1).textContent()) === 'ou', 'connecteur « ou »');
  await page.getByRole('button', { name: 'Enregistrer le segment' }).click();
  await page.getByRole('button', { name: 'Conseillers sur mobile' }).first().waitFor();
  ok(state.tables.segments.length === 1 && state.tables.segments[0].match === 'any', 'segment enregistré');
  // Nom en double refusé
  await page.getByLabel('Nom du segment').fill('conseillers sur mobile');
  await page.getByRole('button', { name: 'Enregistrer le segment' }).click();
  ok(
    await page
      .getByText('Un segment porte déjà ce nom.')
      .waitFor({ timeout: 3000 })
      .then(
        () => true,
        () => false,
      ),
    'nom en double refusé',
  );
  // Dupliquer, renommer, supprimer
  await page.getByRole('button', { name: 'Actions pour Conseillers sur mobile' }).click();
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click();
  await page.waitForTimeout(400);
  ok(state.tables.segments.length === 2, 'segment dupliqué');
  await page.getByRole('button', { name: /Actions pour .*copie/ }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  await page
    .getByRole('dialog', { name: /Supprimer le segment/ })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await page.waitForTimeout(400);
  ok(state.tables.segments.length === 1, 'segment supprimé');
  // Appliquer un segment enregistré : Vue d'ensemble filtrée
  await page
    .locator('.l19-saved')
    .getByRole('button', { name: 'Conseillers sur mobile', exact: true })
    .click();
  await page.getByText(`Segment${N}:`).waitFor();
  await page.waitForTimeout(400);
  ok(
    state.lastSegment && state.lastSegment.id === state.tables.segments[0].id,
    'analytics filtrées par le segment',
  );
  state.segmentVisitors = 3;
  await page.getByRole('tab', { name: 'Sessions' }).click();
  await page
    .getByText(/Moins de 5 visiteurs/)
    .first()
    .waitFor();
  ok(state.lastSessionsSegment?.id === state.tables.segments[0].id, 'sessions : segment transmis');
  ok((await page.locator('.table tbody tr').count()) === 1, 'moins de 5 visiteurs : aucune ligne');
  state.segmentVisitors = null;
  await page.getByRole('button', { name: 'Retirer le filtre Conseillers sur mobile' }).click();

  // ===== L19-05 / 06 : alertes =====
  await page.getByRole('tab', { name: /Alertes/ }).click();
  await page.getByText(/Aucune alerte/).waitFor();
  await page.getByRole('button', { name: 'Nouvelle alerte' }).click();
  const dlg = page.getByRole('dialog', { name: 'Nouvelle alerte' });
  await dlg.getByLabel('Quand').selectOption('completion_below');
  ok((await dlg.getByLabel('Seuil (%)').count()) === 1, 'seuil en % pour la complétion');
  ok((await dlg.getByText('hooks.acme.example').count()) === 1, 'webhook abonné : domaine affiché');
  ok(await dlg.getByRole('checkbox', { name: /E-mail/ }).isDisabled(), 'e-mail « Bientôt »');
  ok(await dlg.getByRole('checkbox', { name: /Slack/ }).isDisabled(), 'Slack « Bientôt »');
  await dlg.getByLabel('Démo').selectOption(DEMO);
  await dlg.getByRole('checkbox', { name: /Webhook/ }).check();
  await dlg.getByRole('radio', { name: 'Résumé quotidien (9 h)' }).click();
  await dlg.getByLabel('Seuil (%)').fill('0');
  await dlg.getByRole('button', { name: 'Créer l’alerte' }).click();
  ok((await dlg.getByText('Indiquez un seuil entre 1 et 100.').count()) === 1, 'seuil hors bornes refusé');
  await dlg.getByLabel('Seuil (%)').fill('50');
  await dlg.getByRole('button', { name: 'Créer l’alerte' }).click();
  await page.getByText(`Taux de complétion sous 50${N}%`).waitFor();
  const al = state.tables.alerts[0];
  ok(al.trigger === 'completion_below' && al.threshold === 50 && al.demo_id === DEMO, 'alerte créée');
  ok(al.channels.join() === 'app,webhook' && al.frequency === 'daily', 'canaux et fréquence');
  // Une 2e alerte, mise en pause
  await page.getByRole('button', { name: 'Nouvelle alerte' }).click();
  await dlg.getByRole('button', { name: 'Créer l’alerte' }).click();
  await page.getByText('Nouveau lead', { exact: true }).waitFor();
  await page.getByRole('switch', { name: 'Activer l’alerte Nouveau lead' }).uncheck();
  await page.waitForTimeout(400);
  ok(state.tables.alerts[1].active === false, 'alerte mise en pause');
  ok((await page.getByText('En pause').count()) === 1, 'badge « En pause »');
  ok(
    (await page.getByRole('tab', { name: /Alertes/ }).textContent()).includes('1'),
    'compteur des alertes actives',
  );
  // Modifier
  await page.getByRole('button', { name: 'Nouveau lead' }).click();
  await page.getByRole('dialog', { name: 'Modifier l’alerte' }).getByLabel('Quand').selectOption('cta');
  await page
    .getByRole('dialog', { name: 'Modifier l’alerte' })
    .getByRole('button', { name: 'Enregistrer' })
    .click();
  await page.getByText('Clic sur le bouton d’action', { exact: true }).waitFor();
  ok(state.tables.alerts[1].trigger === 'cta', 'alerte modifiée');

  // ===== Captures du lot, même état de données (1 alerte active, segments enregistrés), sans toast =====
  if (SHOTS) {
    state.tables.segments.push(
      {
        ...state.tables.segments[0],
        id: 'seg-desk',
        name: 'Visiteurs sur ordinateur',
        conditions: [{ field: 'device', op: 'is', value: 'desktop' }],
        match: 'all',
      },
      {
        ...state.tables.segments[0],
        id: 'seg-leads',
        name: 'Leads de la semaine',
        conditions: [{ field: 'lead', op: 'is', value: true }],
        match: 'all',
      },
    );
    state.live = live(1);
    await page.goto(`${APP}/#/analytics?tab=live`);
    await page.getByRole('heading', { name: 'Visiteurs actifs' }).waitFor();
    await shot('l19-01-temps-reel');
    state.live = live(0);
    await page.reload();
    await page.getByRole('heading', { name: 'Personne sur la démo en ce moment' }).waitFor();
    await shot('l19-02-temps-reel-vide');
    await page.getByRole('tab', { name: 'Sondages et tests' }).click();
    await page.getByLabel('Démo analysée').selectOption(DEMO);
    await page.getByRole('heading', { name: 'Test A/B · étape 3' }).waitFor();
    ok(
      (await page.getByText('Les filtres ne s’appliquent pas encore à cet onglet.').count()) === 1,
      'L19-03 : mention des filtres',
    );
    await shot('l19-03-sondages-tests');
    await page.getByRole('tab', { name: 'Segments' }).click();
    await page.getByRole('heading', { name: 'Nouveau segment' }).waitFor();
    await page.getByRole('button', { name: 'Ajouter une condition' }).click();
    await page.getByLabel('Critère de la condition 1').selectOption('device');
    await page.getByLabel('Valeur de la condition 1').selectOption('mobile');
    await page.waitForTimeout(600);
    ok((await page.locator('.l19-saved li, .l19-saved tr').count()) >= 3, 'L19-04 : 3 segments enregistrés');
    await shot('l19-04-segments');
    await page.getByRole('tab', { name: /Alertes/ }).click();
    await page.getByText('Clic sur le bouton d’action', { exact: true }).waitFor();
    ok(
      /dans l’app et webhook/.test(await page.locator('main').textContent()),
      'L19-05 : « dans l’app et webhook » en minuscule',
    );
    await shot('l19-05-alertes');
    await page.getByRole('button', { name: 'Nouvelle alerte' }).click();
    const nd = page.getByRole('dialog', { name: 'Nouvelle alerte' });
    await nd.getByLabel('Quand').selectOption('completion_below');
    await nd.getByLabel('Démo').selectOption(DEMO);
    await nd.getByRole('checkbox', { name: /Webhook/ }).check();
    await nd.getByRole('radio', { name: 'Résumé quotidien (9 h)' }).click();
    await shot('l19-06-nouvelle-alerte');
    await nd.getByRole('button', { name: 'Annuler' }).click();
  }

  // Lecteur : lecture seule
  const vs = seed();
  vs.tables.members[0].role = 'viewer';
  vs.role = 'viewer';
  vs.tables.alerts = state.tables.alerts;
  vs.surveys = state.surveys;
  // L19-01 : sans droit au suivi nominatif, la base renvoie learner sans identité ni structure
  vs.live = live(1);
  vs.live.visitors[0] = { ...vs.live.visitors[0], identity: null, structure: null };
  const p2 = await ctx.newPage();
  await install(p2, vs);
  await p2.goto(`${APP}/#/analytics?tab=live`);
  await p2.getByRole('heading', { name: 'Visiteurs actifs' }).waitFor();
  ok(
    (await p2.locator('tbody b').getByText('Apprenant identifié', { exact: true }).count()) === 1 &&
      (await p2.getByText('Léa Martin').count()) === 0,
    'lecteur : « Apprenant identifié », sans nom',
  );
  await p2.goto(`${APP}/#/analytics?tab=alerts`);
  await p2.getByText(`Taux de complétion sous 50${N}%`).waitFor();
  ok((await p2.getByRole('button', { name: 'Nouvelle alerte' }).count()) === 0, 'lecteur : pas de création');
  ok(await p2.getByRole('switch').first().isDisabled(), 'lecteur : interrupteurs désactivés');
  await p2.getByRole('tab', { name: 'Sondages et tests' }).click();
  await p2.getByLabel('Démo analysée').selectOption(DEMO);
  await p2.getByText('Les réponses écrites sont lisibles par les éditeurs.').waitFor();
  ok(
    (await p2.getByRole('button', { name: /réponses écrites/ }).count()) === 0,
    'lecteur : réponses écrites masquées',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
