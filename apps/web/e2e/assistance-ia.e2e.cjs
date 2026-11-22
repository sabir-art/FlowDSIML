/**
 * Test e2e L30-01, L30-02 et L30-09 : Paramètres › Assistance IA (désactivée, activation confirmée,
 * quota, fonctions), Rédiger dans le panneau de bulle (aperçu avant/après, Appliquer, Annuler,
 * Ignorer, variable disparue, Pour toutes les étapes), états désactivé et quota atteint (aucun envoi).
 * Données fictives (faux Supabase, aucun appel au fournisseur). Usage : SHOTS_DIR=… [THEME=dark] node e2e/assistance-ia.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

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
  const closeToasts = async () => {
    for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForTimeout(150);
  };
  const shot = async (name, keepToasts = false) => {
    if (!keepToasts) await closeToasts();
    await page.waitForTimeout(250);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.tables.hotspots.push({
    ...state.tables.hotspots[0],
    id: 'h2',
    step_id: 's2',
    title: 'Ouvrir le rapport',
    body: 'Le raport de  {{company}} est pret.',
    position: 0,
  });
  await install(page, state);
  const hs = (id) => state.tables.hotspots.find((h) => h.id === id);

  // ---- L30-09 désactivée : entrée estompée, aria-disabled, explication, rien n'est envoyé
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.locator('.canvas-hotspot').first().click();
  await page.waitForSelector('#hs-body');
  // L38-10 : la voix off (sous la bulle) a aussi son entrée IA ; « Rédiger » vient en premier
  const entry = page.locator('.ai-entry').first();
  await entry.waitFor();
  ok((await entry.getAttribute('aria-disabled')) === 'true', 'L30-09 : entrée désactivée (aria-disabled)');
  ok(
    /Assistance IA désactivée dans cet espace\. Un administrateur peut l’activer dans Paramètres > Assistance IA\./.test(
      (await page.locator('.ai-tip').first().textContent()) || '',
    ),
    'L30-09 : infobulle de la règle 4',
  );
  ok(
    // L38-10 : un lien pour « Rédiger », un pour la voix off sous la bulle
    (await page.getByRole('link', { name: 'Ouvrir le réglage' }).count()) >= 1,
    'Admin : lien vers le réglage',
  );
  await entry.click({ force: true });
  ok(!(state.aiCalls || []).length, 'Désactivée : aucune demande envoyée');
  await entry.hover();
  await shot('l30-09-desactive');

  // ---- L30-01 : réglage
  await page.goto(`${APP}/#/settings/ai`);
  await page.getByRole('heading', { name: 'Assistance IA', level: 1 }).waitFor();
  // L48-A §4 : Assistance IA est rangée dans le groupe « Contenu »
  const labels = await page
    .locator('.st-nav__grp', { hasText: 'Contenu' })
    .locator('.st-nav__item')
    .allTextContents();
  ok(labels.at(-1) === 'Assistance IA', 'L48-A : rubrique dans « Contenu », après Glossaire et Étiquettes');
  const sw = page.getByRole('switch', { name: 'Activer l’Assistance IA pour cet espace' });
  ok(!(await sw.isChecked()), 'L30-01 : désactivée par défaut');
  ok(
    /envoyés au fournisseur d’IA de TutoClick \(Anthropic\)/.test(
      await page.locator('.ai-notice').textContent(),
    ),
    'L30-01 : bandeau de confidentialité visible',
  );
  await shot('l30-01-desactive');
  await sw.click();
  const dlg = page.getByRole('dialog', { name: 'Activer l’Assistance IA ?' });
  await dlg.waitFor();
  const enable = dlg.getByRole('button', { name: 'Activer' });
  ok(await enable.isDisabled(), 'Modale : « Activer » inactif tant que la case n’est pas cochée');
  await dlg.getByLabel('J’ai lu ces informations.').check();
  await shot('l30-01-confirmation');
  await enable.click();
  await page.getByText('Assistance IA activée pour l’espace.').waitFor();
  ok(state.ai.enabled === true, 'Activation enregistrée (set_ai_settings)');
  await page.getByText(/Ce mois-ci\s?: 12 demandes sur 500/).waitFor();
  const bar = page.getByRole('progressbar').first();
  ok(
    (await bar.getAttribute('aria-valuenow')) === '12' && (await bar.getAttribute('aria-valuemax')) === '500',
    'Quota : barre avec valeurs ARIA',
  );
  ok(
    /Renouvellement le 1 décembre 2026/.test(await page.locator('.ai-quota').textContent()),
    'Quota : date de renouvellement',
  );
  ok(
    (await page.locator('.ai-features input:not([disabled])').count()) === 9,
    '9 fonctions cochables (dont voix et sous-titres)',
  );
  ok((await page.locator('.ai-features .is-soon').count()) === 1, 'Images générées en Bientôt');
  await page.getByLabel('Graphique').uncheck();
  await page.waitForTimeout(300);
  ok(state.ai.features.chart === false, 'Fonction décochée enregistrée');
  await page.getByLabel('Graphique').check();
  await shot('l30-01-active');

  // ---- L30-10 : voix et sous-titres, consentement séparé
  const audio = page.locator('fieldset.ai-audio');
  ok(
    !(await audio.getByRole('checkbox', { name: 'Voix de synthèse' }).isChecked()) &&
      !(await audio.getByRole('checkbox', { name: 'Sous-titres automatiques' }).isChecked()),
    'L30-10 : voix et sous-titres décochés par défaut',
  );
  ok(
    /La voix de synthèse envoie le texte à lire au fournisseur ElevenLabs/.test(await audio.textContent()),
    'L30-10 : bandeau propre à la sous-section',
  );
  await audio.getByRole('checkbox', { name: 'Voix de synthèse' }).click();
  const adlg = page.getByRole('dialog', { name: 'Activer la voix de synthèse ?' });
  await adlg.waitFor();
  ok(await adlg.getByRole('button', { name: 'Activer' }).isDisabled(), 'L30-10 : confirmation dédiée');
  await adlg.getByLabel('J’ai lu ces informations.').check();
  await shot('l30-10-reglage-confirmation');
  await adlg.getByRole('button', { name: 'Activer' }).click();
  await page.getByText('Voix de synthèse activée pour l’espace.').waitFor();
  ok(state.ai.features.voice === true, 'L30-10 : voix activée');
  ok(
    /Voix de synthèse\s?: 0\ss sur 5\smin ce mois-ci/.test(await audio.textContent()),
    'L30-10 : quota de la voix en secondes',
  );
  await shot('l30-10-reglage-active');
  await audio.getByRole('checkbox', { name: 'Voix de synthèse' }).uncheck();
  await page.waitForTimeout(300);
  ok(state.ai.features.voice === false, 'L30-10 : décocher enregistre directement');

  // ---- L30-02 : Rédiger
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.locator('.canvas-hotspot').first().click();
  await page.waitForSelector('#hs-body');
  const before = hs('h1').body;
  state.aiDelay = 600;
  await page.getByRole('button', { name: 'Assistance IA' }).click();
  await page.getByRole('menuitem', { name: 'Raccourcir' }).click();
  await page.getByText('Rédaction en cours…').waitFor();
  ok((await page.locator('.ai-preview').getAttribute('aria-busy')) === 'true', 'En cours : aria-busy');
  ok((await page.getByRole('button', { name: 'Arrêter' }).count()) === 1, 'En cours : bouton Arrêter');
  await shot('l30-02-en-cours');
  await page.getByRole('button', { name: 'Appliquer', exact: true }).waitFor();
  state.aiDelay = 0;
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'write' && call.input.action === 'shorten' && call.lang === 'fr',
    'Demande : action et langue de la démo',
  );
  ok(
    !('user_id' in call) && !/image|user_id|data:/.test(JSON.stringify(call)),
    'Demande : ni identifiant ni image envoyés',
  );
  ok(
    await page
      .locator('[role="status"]', { hasText: 'Proposition prête.' })
      .waitFor({ state: 'attached', timeout: 3000 })
      .then(() => true)
      .catch(() => false),
    'Annonce « Proposition prête. » (role="status")',
  );
  ok((await page.locator('.ai-before').textContent()).includes(before), 'Aperçu : avant barré');
  ok(
    (await page.getByText('Généré par IA, à vérifier').count()) === 1,
    'Mention « Généré par IA, à vérifier »',
  );
  ok(hs('h1').body === before, 'Rien n’est modifié avant « Appliquer »');
  await page.getByRole('button', { name: 'Autre proposition' }).scrollIntoViewIfNeeded();
  await shot('l30-02-apercu');
  await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
  await page.getByText('Texte appliqué.').waitFor();
  await page.waitForTimeout(900);
  ok(hs('h1').body === `${before} (proposition)`, 'Appliquer : texte écrit');
  ok((await page.locator('.ai-badge').count()) === 1, 'Repère « IA » sur le champ');
  ok(
    state.tables.steps.find((x) => x.id === 's1').options?.aiText === true,
    'Repère IA enregistré sur l’étape (bilan RGPD)',
  );
  await shot('l30-02-applique', true);
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
  await page.waitForTimeout(900);
  ok(hs('h1').body === before, 'Annuler (toast) : texte d’origine');
  ok(!state.tables.steps.find((x) => x.id === 's1').options?.aiText, 'Annuler : repère IA retiré');

  // Variable disparue, Ignorer
  state.aiReply = () => ({ text: 'Bienvenue : cliquez sur « + Nouvelle opportunité ».' });
  await page.getByRole('button', { name: 'Assistance IA' }).click();
  await page.getByRole('menuitem', { name: 'Reformuler plus simplement' }).click();
  await page.getByRole('button', { name: 'Appliquer', exact: true }).waitFor();
  ok(
    (await page.getByText('La variable {{company}} a disparu de la proposition.').count()) === 1,
    'Avertissement : variable disparue',
  );
  await shot('l30-02-variable');
  await page.getByRole('button', { name: 'Ignorer' }).click();
  ok(
    hs('h1').body === before && (await page.locator('.ai-preview').count()) === 0,
    'Ignorer : rien n’est modifié',
  );
  state.aiReply = null;

  // Erreur puis Réessayer
  state.aiFail = true;
  await page.getByRole('button', { name: 'Assistance IA' }).click();
  await page.getByRole('menuitem', { name: 'Corriger l’orthographe' }).click();
  await page.getByText('La proposition n’a pas pu être générée. Réessayez.').waitFor();
  state.aiFail = false;
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await page.getByRole('button', { name: 'Appliquer', exact: true }).waitFor();
  ok(true, 'Erreur : message puis Réessayer');
  await page.getByRole('button', { name: 'Ignorer' }).click();

  // Pour toutes les étapes
  await page.getByRole('button', { name: 'Assistance IA' }).click();
  await page.getByRole('menuitem', { name: 'Pour toutes les étapes' }).click();
  const all = page.getByRole('dialog', { name: 'Corriger l’orthographe de toutes les étapes' });
  await all.getByRole('button', { name: 'Appliquer tout' }).waitFor();
  ok((await all.locator('.ai-preview').count()) === 1, 'Toutes les étapes : seules les bulles modifiées');
  await shot('l30-02-toutes');
  await all.getByRole('button', { name: 'Appliquer tout' }).click();
  await page.waitForTimeout(900);
  ok(hs('h2').body === 'Le raport de {{company}} est pret.', 'Appliquer tout : bulle corrigée');
  await page.keyboard.press('Escape');

  // ---- L30-09 quota atteint : l'aperçu affiche le message, sans appel
  state.ai.workspaceQuotaReached = true;
  await page.goto(`${APP}/#/settings/ai`);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.locator('.canvas-hotspot').first().click();
  const n = state.aiCalls.length;
  await page.getByRole('button', { name: 'Assistance IA' }).click();
  await page.getByRole('menuitem', { name: 'Raccourcir' }).click();
  await page.getByRole('alert').filter({ hasText: 'Quota d’Assistance IA atteint pour ce mois.' }).waitFor();
  ok(
    /Il se renouvelle le 1 décembre 2026\./.test(await page.locator('.ai-preview').textContent()),
    'Quota : date',
  );
  ok(state.aiCalls.length === n, 'Quota atteint : aucune donnée envoyée');
  await shot('l30-09-quota');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
