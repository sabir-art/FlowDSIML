/**
 * Test e2e L19 : analytics avancées (Temps réel, Sondages et tests, Segments, Alertes) sur la page
 * Analytics du workspace. Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/analytics-avance.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const { pick, optionsOf } = require('./_select.cjs');
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

  // ===== §5 (retours du 24/11, 2e série) : temps réel de l'espace =====
  await page.goto(`${APP}/#/analytics?tab=live`);
  const liveP = page.locator('#an-panel-live');
  await liveP.getByRole('heading', { name: 'Sur les démos maintenant' }).waitFor();
  ok(
    (await page.locator('.an-more.is-active').innerText()).includes('Temps réel'),
    'onglet Temps réel ouvert depuis l’URL (« Plus » prend son nom, L48-D)',
  );
  ok(
    (await liveP.locator('.lv-kpi dt').allTextContents()).join('|') ===
      'Visiteurs en ce moment|Vues · 30 dernières minutes|Fins de démo aujourd’hui|Leads aujourd’hui' &&
      (await liveP.locator('.lv-kpi dd').first().textContent()) === '7',
    'quatre indicateurs compacts, visiteurs en ce moment',
  );
  // La page n'a plus sa barre de filtres sur cet onglet : le temps réel a la sienne
  ok(
    (await page.locator('.an-toolbar').count()) === 0 &&
      (await page.getByRole('radiogroup', { name: 'Période' }).count()) === 0,
    'temps réel : ni filtre Source ni période (le direct n’en dépend pas)',
  );
  {
    const css = await liveP.evaluate((el) => {
      const probe = (v) => {
        const s = document.createElement('span');
        s.style.color = `var(${v})`;
        document.body.append(s);
        const c = getComputedStyle(s).color;
        s.remove();
        return c;
      };
      const bg = (q) => [...el.querySelectorAll(q)].map((x) => getComputedStyle(x).backgroundColor);
      return {
        primary: probe('--fd-color-primary'),
        tiles: [...new Set(bg('.lv-kpi'))],
        bars: [...new Set(bg('.lv-prog__bar > i'))],
      };
    });
    ok(css.tiles.length === 1, `temps réel : tuiles sans aplat (${css.tiles.join(', ')})`);
    ok(
      css.bars.length === 1 && css.bars[0] === css.primary,
      `temps réel : progression dans la couleur de la marque (${css.bars.join(', ')})`,
    );
  }
  // Tableau à colonnes fixes : Visiteur · Démo · Progression · Depuis
  ok(
    (await liveP.locator('.lv-table thead th:not(.lv-c-av)').allInnerTexts())
      .map((x) => x.trim())
      .filter(Boolean)
      .join('|') === 'Visiteur|Démo|Progression|Depuis' &&
      (await liveP.locator('.lv-table').evaluate((el) => getComputedStyle(el).tableLayout)) === 'fixed',
    'tableau à colonnes fixes : Visiteur, Démo, Progression, Depuis',
  );
  const rowsH = await liveP
    .locator('.lv-table tbody tr')
    .evaluateAll((l) => l.map((r) => Math.round(r.getBoundingClientRect().height)));
  ok(rowsH.length === 3 && rowsH.every((h) => h >= 48 && h <= 50), `lignes de 48 px (${rowsH.join(', ')})`);
  ok((await liveP.getByText('Léa Martin').count()) === 1, 'identité renvoyée par la base (éditeur)');
  ok(
    (await liveP.locator('.lv-av').getByText('LM', { exact: true }).count()) === 1,
    'apprenant : deux initiales',
  );
  ok(
    (await liveP.locator('.lv-who__t').allTextContents()).slice(1).join('|') ===
      'Visiteur · Belgique|Visiteur anonyme',
    'anonymes : « Visiteur · pays » (lieu approximatif), « Visiteur anonyme » sans pays',
  );
  // Colonne Démo : pastille du type puis le nom, sur une seule ligne
  const demoCell = await liveP
    .locator('.lv-demo')
    .first()
    .evaluate((el) => ({
      first: el.firstElementChild?.className ?? '',
      nowrap: getComputedStyle(el).whiteSpace,
      title: el.querySelector('.lv-demo__t')?.getAttribute('title'),
      text: el.querySelector('.lv-demo__t')?.textContent,
    }));
  ok(
    /ct-badge/.test(demoCell.first) &&
      demoCell.nowrap === 'nowrap' &&
      !!demoCell.title &&
      demoCell.title === demoCell.text,
    `colonne Démo : pastille du type puis nom, sur une ligne, nom complet en infobulle (${JSON.stringify(demoCell)})`,
  );
  ok(
    (await liveP.getByRole('img', { name: '4 étapes vues sur 6' }).count()) === 1 &&
      (await liveP.locator('.lv-prog__t').first().textContent()) === 'Étape 4/6',
    'progression : barre nommée et « Étape n/N »',
  );
  ok((await liveP.getByText(/4 autres visiteurs anonymes/).count()) === 1, 'visiteurs restants');
  ok((await liveP.locator('table[aria-live="off"]').count()) === 1, 'tableau en aria-live off');
  ok(
    (await liveP.locator('[role=status][aria-live=polite]').count()) === 1,
    'changements annoncés par un résumé poli, pas ligne par ligne',
  );
  // Pause : bouton icône de 32 px à bascule ; l'indicateur passe de « En direct » à « En pause »
  const pause = liveP.getByRole('button', { name: 'Mettre en pause l’actualisation' });
  const pb = await pause.boundingBox();
  ok(
    pb.width === 32 && pb.height === 32 && (await pause.getAttribute('aria-pressed')) === 'false',
    'pause : bouton icône de 32 px (aria-pressed)',
  );
  ok(
    /^En direct · actualisé (à l’instant|il y a ([5-9]|\d{2,}) s)$/.test(
      (await liveP.locator('.lv-state').innerText()).trim(),
    ),
    `indicateur « En direct · actualisé à l’instant » sous 5 s, puis « il y a n s » (${await liveP.locator('.lv-state').innerText()})`,
  );
  await pause.click();
  ok(
    (await pause.getAttribute('aria-pressed')) === 'true' &&
      (await liveP.locator('.lv-state').innerText()).trim() === 'En pause',
    'pause à bascule : « En pause »',
  );
  await pause.click();
  ok(
    state.calls.some((c) => c.path.endsWith('/live_space') && c.body.p_workspace),
    'live_space interrogée',
  );
  // Filtre Démo : combobox avec recherche et listbox groupée
  await liveP.getByRole('button', { name: 'Démo : Toutes les démos' }).click();
  const combo = liveP.getByRole('combobox', { name: 'Rechercher une démo' });
  await combo.waitFor();
  const list = liveP.getByRole('listbox', { name: 'Démo' });
  ok(
    (await list.getByRole('option').first().innerText()).replace(/\s+/g, ' ').trim() ===
      'Toutes les démos 7 en direct' &&
      (await list.getByRole('group', { name: 'En direct' }).getByRole('option').count()) === 1 &&
      (await list.locator('.lv-dot').count()) >= 1,
    'filtre : « Toutes les démos », groupe « En direct » avec le nombre de visiteurs, pastille du type',
  );
  ok(
    (await combo.getAttribute('aria-controls')) === (await list.getAttribute('id')) &&
      !!(await combo.getAttribute('aria-activedescendant')),
    'filtre : combobox reliée à sa liste, option active annoncée',
  );
  await combo.fill('zzz');
  ok((await list.getByText('Aucune démo ne correspond').count()) === 1, 'filtre : recherche sans résultat');
  await combo.fill('');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.lv-pop'));
  ok(
    state.calls.some((c) => c.path.endsWith('/live_space') && c.body.p_demo),
    'filtre : la démo choisie au clavier filtre le direct',
  );
  await liveP.locator('.lv-filter__btn').click();
  await page.keyboard.press('Escape');
  ok(
    (await page.locator('.lv-pop').count()) === 0 &&
      (await page.evaluate(() => document.activeElement?.classList.contains('lv-filter__btn'))),
    'filtre : Échap ferme la liste, le focus revient au bouton',
  );
  ok(
    (await liveP.getByRole('button', { name: 'Exporter en CSV' }).count()) === 1,
    'export : bouton icône nommé',
  );

  // ===== temps réel vide =====
  state.live = live(0);
  await page.goto(`${APP}/#/analytics?tab=live`);
  await page.reload();
  await liveP.getByRole('heading', { name: 'Personne sur les démos en ce moment' }).waitFor();
  ok((await liveP.locator('.lv-kpi dd').first().textContent()) === '0', 'vide : indicateur à 0');
  ok(
    (await liveP.locator('.lv-kpi dd').nth(2).textContent()) === '2',
    'vide : fins de démo du jour conservées',
  );
  ok(
    (await liveP.getByText('Rien dans la dernière heure.').count()) === 1,
    'vide : fil d’activité sans ligne',
  );

  // ===== L19-03 : sondages et tests =====
  await page.locator('.an-more').click();
  await page.getByRole('menuitem', { name: 'Sondages et tests' }).click();
  await pick(page.getByLabel('Démo analysée'), DEMO);
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
  // Les réponses se chargent après l'ouverture du tiroir : on attend le texte, pas un délai
  const written = await drawer
    .getByText('Plus de captures sur le formulaire, merci.')
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok(
    written && (await drawer.getByText('Plus de captures sur le formulaire, merci.').count()) === 1,
    'réponses écrites (éditeur)',
  );
  await drawer.getByRole('button', { name: 'Fermer' }).click();

  // ===== L19-04 : segments =====
  await page.locator('.an-more').click();
  await page.getByRole('menuitem', { name: 'Segments' }).click();
  await page.getByRole('heading', { name: 'Nouveau segment' }).waitFor();
  await page.getByRole('button', { name: 'Ajouter un filtre' }).click();
  const fd = page.getByRole('dialog', { name: 'Ajouter un filtre' });
  await pick(fd.getByLabel('Valeur de la condition 1'), 'mobile');
  await fd.getByRole('button', { name: 'Appliquer' }).click();
  await page.getByRole('button', { name: 'Retirer le filtre Type d’appareil' }).waitFor();
  ok(/"device","is","mobile"/.test(decodeURIComponent(page.url())), 'filtre gardé dans l’URL');
  await page.getByRole('button', { name: 'Enregistrer comme segment' }).click();
  await page.getByLabel('Nom du segment').fill('Conseillers sur mobile');
  await page.getByRole('button', { name: 'Ajouter une condition' }).click();
  ok((await page.locator('fieldset.cond').count()) === 2, 'constructeur prérempli + une condition');
  ok(
    (await optionsOf(page.getByLabel('Critère de la condition 2'), { disabled: true })).some((x) =>
      /Ville · Bientôt/.test(x),
    ),
    'critères à venir : affichés désactivés avec « Bientôt »',
  );
  await pick(page.getByLabel('Critère de la condition 2'), 'completed');
  await pick(page.getByLabel('Valeur de la condition 2'), 'false');
  await page.getByText('200 visiteurs correspondent').waitFor({ timeout: 3000 });
  ok(true, 'compteur en direct (ET)');
  await page.getByRole('radio', { name: 'Au moins une (OU)' }).click();
  await page.getByText('766 visiteurs correspondent').waitFor({ timeout: 3000 });
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
  await page.locator('.an-more').click();
  await page.getByRole('menuitem', { name: 'Alertes' }).click();
  await page.getByText(/Aucune alerte/).waitFor();
  await page.getByRole('button', { name: 'Nouvelle alerte' }).click();
  const dlg = page.getByRole('dialog', { name: 'Nouvelle alerte' });
  await pick(dlg.getByLabel('Quand'), 'completion_below');
  ok((await dlg.getByLabel('Seuil (%)').count()) === 1, 'seuil en % pour la complétion');
  ok((await dlg.getByText('hooks.acme.example').count()) === 1, 'webhook abonné : domaine affiché');
  ok(await dlg.getByRole('checkbox', { name: /E-mail/ }).isDisabled(), 'e-mail « Bientôt »');
  ok(await dlg.getByRole('checkbox', { name: /Slack/ }).isDisabled(), 'Slack « Bientôt »');
  ok(
    (await dlg.locator('.is-soon .badge').count()) === 0 &&
      (await dlg.locator('.is-soon .soon-text').count()) === 2,
    '§17.4 : « Bientôt » en texte gris, sans pastille',
  );
  await pick(dlg.getByLabel('Démo'), DEMO);
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
  // Modifier
  await page.getByRole('button', { name: 'Nouveau lead' }).click();
  await pick(page.getByRole('dialog', { name: 'Modifier l’alerte' }).getByLabel('Quand'), 'cta');
  await page
    .getByRole('dialog', { name: 'Modifier l’alerte' })
    .getByRole('button', { name: 'Enregistrer' })
    .click();
  // Le libellé choisi est déjà dans la fenêtre : on attend sa fermeture, puis la ligne mise à jour
  await page.getByRole('dialog', { name: 'Modifier l’alerte' }).waitFor({ state: 'detached' });
  await page.getByText('Clic sur le bouton d’action', { exact: true }).waitFor();
  ok(state.tables.alerts[1].trigger === 'cta', 'alerte modifiée');

  // ===== ALERT-01 : canal « E-mail » des alertes (envoi d'e-mails configuré, clé factice) =====
  {
    state.brevoKey = 'cle-factice';
    // Après « Ne plus recevoir ces e-mails » : l'app le dit une fois, puis l'oublie
    (state.tables.notification_settings ||= []).push({
      user_id: state.user.id,
      email: false,
      alert_email_cleared_at: '2026-11-25T08:00:00Z',
    });
    const pm = await ctx.newPage();
    pm.on('pageerror', (e) => errors.push(e.message));
    await install(pm, state);
    await pm.goto(`${APP}/#/analytics`);
    await pm.locator('.an-more').click();
    await pm.getByRole('menuitem', { name: 'Alertes' }).click();
    await pm.getByText('E-mail désactivé sur vos alertes').waitFor();
    ok(true, 'après une désinscription : toast « E-mail désactivé sur vos alertes »');
    await pm.waitForFunction(() => true);
    await pm.getByRole('button', { name: 'Nouvelle alerte' }).click();
    const d2 = pm.getByRole('dialog', { name: 'Nouvelle alerte' });
    const mailBox = d2.getByRole('checkbox', { name: 'E-mail' });
    const appBox = d2.getByRole('checkbox', { name: /^Dans l’app/ });
    await mailBox.waitFor();
    ok(
      (await mailBox.isEnabled()) &&
        (await d2.getByText('Envoyé à votre adresse, en moins de 15 minutes.').count()) === 1,
      'envoi configuré : case « E-mail » active, avec son aide',
    );
    ok(
      (await d2.locator('.is-soon .soon-text').count()) === 1 &&
        (await d2.getByRole('checkbox', { name: /Slack/ }).isDisabled()),
      'Slack reste « Bientôt »',
    );
    await appBox.uncheck();
    await mailBox.check();
    ok(
      (await appBox.isChecked()) &&
        (await appBox.isDisabled()) &&
        (await d2.locator('label[data-tip="Toujours affichée dans l’app"]').count()) === 1,
      '« E-mail » cochée : « Dans l’app » cochée et verrouillée, infobulle « Toujours affichée dans l’app »',
    );
    const before = state.tables.alerts.length;
    await d2.getByRole('button', { name: 'Créer l’alerte' }).click();
    await d2.waitFor({ state: 'detached' });
    const made = state.tables.alerts[before];
    ok(
      !!made && made.channels.join() === 'app,email',
      `alerte créée avec « Dans l’app » et « E-mail » (${made?.channels.join()})`,
    );
    await pm
      .getByText(/dans l’app et e-mail/)
      .first()
      .waitFor();
    ok(true, 'liste : canaux « dans l’app et e-mail »');
    ok(
      state.tables.notification_settings.find((x) => x.user_id === state.user.id).alert_email_cleared_at ===
        null,
      'message de désinscription acquitté (il ne revient pas)',
    );
    // L'alerte d'une autre personne : la case montre son état, sans pouvoir le changer
    made.created_by = '0b5c1f0e-0000-4000-8000-0000000000ff';
    await pm.reload();
    await pm.locator('.an-more').click();
    await pm.getByRole('menuitem', { name: 'Alertes' }).click();
    await pm
      .getByRole('button', { name: /Nouveau lead/ })
      .last()
      .click();
    const d3 = pm.getByRole('dialog', { name: 'Modifier l’alerte' });
    ok(
      (await d3.getByRole('checkbox', { name: 'E-mail' }).isDisabled()) &&
        (await d3.getByRole('checkbox', { name: 'E-mail' }).isChecked()) &&
        (await d3.getByText(/Envoyé à la personne qui a créé l’alerte/).count()) === 1,
      'alerte d’une autre personne : « E-mail » visible, non modifiable, avec l’explication',
    );
    await pm.close();
    state.brevoKey = null;
  }

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
    await page.getByRole('heading', { name: 'Sur les démos maintenant' }).waitFor();
    await page.locator('.lv-table').waitFor();
    await shot('l19-01-temps-reel');
    state.live = live(0);
    await page.reload();
    await page.getByRole('heading', { name: 'Personne sur les démos en ce moment' }).waitFor();
    await shot('l19-02-temps-reel-vide');
    await page.locator('.an-more').click();
    await page.getByRole('menuitem', { name: 'Sondages et tests' }).click();
    await pick(page.getByLabel('Démo analysée'), DEMO);
    await page.getByRole('heading', { name: 'Test A/B · étape 3' }).waitFor();
    ok(
      (await page.getByText('Les filtres ne s’appliquent pas encore à cet onglet.').count()) === 1,
      'L19-03 : mention des filtres',
    );
    await shot('l19-03-sondages-tests');
    await page.locator('.an-more').click();
    await page.getByRole('menuitem', { name: 'Segments' }).click();
    await page.getByRole('heading', { name: 'Nouveau segment' }).waitFor();
    await page.getByRole('button', { name: 'Ajouter une condition' }).click();
    await pick(page.getByLabel('Critère de la condition 1'), 'device');
    await pick(page.getByLabel('Valeur de la condition 1'), 'mobile');
    await page.waitForTimeout(600);
    ok((await page.locator('.l19-saved li, .l19-saved tr').count()) >= 3, 'L19-04 : 3 segments enregistrés');
    await shot('l19-04-segments');
    // L19-04 (reprise UX) : sélecteur de critère ouvert, critères à venir désactivés avec « Bientôt ».
    // Le critère est un Select maison (COMP-01) : sa liste s'ouvre vraiment pour la capture.
    await page.getByRole('button', { name: 'Ajouter un filtre' }).click();
    const fdc = page.getByRole('dialog', { name: 'Ajouter un filtre' });
    const crit = fdc.getByLabel('Critère de la condition 1');
    ok(
      (await optionsOf(crit, { disabled: true })).length > 0 &&
        (await optionsOf(crit, { disabled: true })).every((x) => /Bientôt/.test(x)),
      'L19-04 : critères indisponibles désactivés, badge « Bientôt »',
    );
    {
      await crit.click();
      const list = page.locator('.fd-sel-pop [role="listbox"]');
      await list.waitFor();
      await shot('l19-04-criteres');
      await page.keyboard.press('Escape');
      await list.waitFor({ state: 'detached' });
    }
    await fdc
      .getByRole('button', { name: /Annuler|Fermer/ })
      .first()
      .click();
    await page.locator('.an-more').click();
    await page.getByRole('menuitem', { name: 'Alertes' }).click();
    await page.getByText('Clic sur le bouton d’action', { exact: true }).waitFor();
    ok(
      /dans l’app et webhook/.test(await page.locator('main').textContent()),
      'L19-05 : « dans l’app et webhook » en minuscule',
    );
    await shot('l19-05-alertes');
    await page.getByRole('button', { name: 'Nouvelle alerte' }).click();
    const nd = page.getByRole('dialog', { name: 'Nouvelle alerte' });
    await pick(nd.getByLabel('Quand'), 'completion_below');
    await pick(nd.getByLabel('Démo'), DEMO);
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
  await p2.locator('.lv-table').waitFor();
  ok(
    (await p2.locator('.lv-who__t').getByText('Apprenant identifié', { exact: true }).count()) === 1 &&
      (await p2.getByText('Léa Martin').count()) === 0,
    'lecteur : « Apprenant identifié », sans nom',
  );
  await p2.goto(`${APP}/#/analytics?tab=alerts`);
  await p2.getByText(`Taux de complétion sous 50${N}%`).waitFor();
  ok((await p2.getByRole('button', { name: 'Nouvelle alerte' }).count()) === 0, 'lecteur : pas de création');
  ok(await p2.getByRole('switch').first().isDisabled(), 'lecteur : interrupteurs désactivés');
  await p2.locator('.an-more').click();
  await p2.getByRole('menuitem', { name: 'Sondages et tests' }).click();
  await pick(p2.getByLabel('Démo analysée'), DEMO);
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
