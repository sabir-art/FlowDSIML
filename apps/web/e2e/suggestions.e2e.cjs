/**
 * Test e2e L30-04 : Suggestions (bouton à côté de l'aide, vérifications locales en tête « Vérification »,
 * Analyser la démo, propositions groupées par étape, Appliquer avec Annuler, Ignorer, liste vide,
 * jamais recalculée sans action). Données fictives, aucun appel au fournisseur.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/suggestions.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { fromMore } = require('./editor-rail.cjs');
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
  const shot = async (name) => {
    for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForTimeout(250);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  state.tables.hotspots[0].body = `${'Cliquez ici pour ouvrir le formulaire de création. '.repeat(6)}`.trim();
  state.ai = {
    enabled: true,
    features: {
      write: true,
      translate: true,
      suggest: true,
      generate: true,
      dataset: true,
      chart: true,
      assistant: true,
    },
    used: 3,
    quota: 500,
    userToday: 0,
    userDailyRequests: 30,
    workspaceQuotaReached: false,
    userQuotaReached: false,
    renewsOn: '2026-12-01',
    canEdit: true,
    canManage: true,
  };
  state.aiReply = (task, input) => ({
    suggestions: [
      {
        id: 'h:h1:body',
        type: 'length',
        message: 'Le texte répète la même consigne.',
        proposal: 'Cliquez sur « + Nouvelle opportunité » pour ouvrir le formulaire.',
      },
      {
        id: 's:s2:title',
        type: 'consistency',
        message: 'Les titres d’étapes ne suivent pas le même modèle.',
        proposal: 'Ouvrir le rapport',
      },
      { id: 'inconnu', type: 'clarity', message: 'Ignorée', proposal: 'x' },
    ].filter((s) => input.items.some((i) => i.id === s.id)),
  });
  // Recette 277f878 §1 : deux titres techniques laissés par la capture, signalés chacun avec son champ
  state.tables.steps.find((x) => x.id === 's3').title = 'div:has(> #search-input) > button.btn-primary';
  state.tables.hotspots.find((h) => h.id === 'h1').title = 'Generate speechText to SpeechOpen';
  await install(page, state);
  const hs = (id) => state.tables.hotspots.find((h) => h.id === id);
  const st = (id) => state.tables.steps.find((s) => s.id === id);

  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  // L48-E §6 : « Suggestions » est dans le menu « Plus d’options » de la barre
  await fromMore(page, 'Suggestions');
  const panel = page.getByRole('dialog', { name: 'Suggestions' });
  await panel.waitFor();
  const checks = panel.locator('.ai-sg-badge.is-local');
  ok(
    (await checks.count()) >= 2,
    `Vérifications locales (texte alternatif, longueur) : ${await checks.count()}`,
  );
  ok((await checks.first().textContent()) === 'Vérification', 'Libellé « Vérification », sans mention IA');
  ok((await panel.getByText('Généré par IA, à vérifier').count()) === 0, 'Pas de mention IA avant l’analyse');
  ok(!(state.aiCalls || []).length, 'Rien n’est envoyé à l’ouverture');
  {
    const txt = await panel.innerText();
    ok(
      txt.includes('Titre de la bulle : «\u202fGenerate speechText to S…\u202f»') &&
        txt.includes('Titre de l’étape : «\u202fdiv:has(> #search-input)…\u202f»'),
      'Titres techniques : chaque signalement cite son champ et le début du texte',
    );
  }
  await shot('l30-04-verifications');
  await panel.getByRole('button', { name: 'Analyser la démo' }).click();
  await panel.getByRole('button', { name: 'Analyser à nouveau' }).waitFor();
  await panel.locator('.ai-sg-badge:not(.is-local)').first().waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'suggest' && call.items === undefined && call.input.items.length >= 3,
    'Demande : titres et textes',
  );
  ok(!/image|alt_text|data:/.test(JSON.stringify(call)), 'Aucune image envoyée');
  ok(
    (await panel.locator('.ai-sg-badge:not(.is-local)').count()) === 2,
    'Deux propositions (id inconnu écarté)',
  );
  ok((await panel.getByText('Généré par IA, à vérifier').count()) === 1, 'Mention de la règle 2 en tête');
  ok((await panel.getByRole('heading', { level: 3, name: 'Étape 1' }).count()) === 1, 'Groupées par étape');
  ok(
    (await panel.getByText('Cohérence').count()) === 1 && (await panel.getByText('Longueur').count()) >= 1,
    'Types libellés',
  );
  await shot('l30-04-suggestions');
  const n = state.aiCalls.length;
  const item = panel.locator('li', { hasText: 'Les titres d’étapes' });
  await item.getByRole('button', { name: 'Appliquer' }).click();
  await page.getByText('Texte appliqué.').waitFor();
  await page.waitForTimeout(900);
  ok(st('s2').title === 'Ouvrir le rapport', 'Appliquer : titre d’étape modifié');
  ok(
    (await panel.locator('li', { hasText: 'Les titres d’étapes' }).count()) === 0,
    'Suggestion appliquée retirée',
  );
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
  await page.waitForTimeout(900);
  ok(st('s2').title !== 'Ouvrir le rapport', 'Annuler : titre d’origine');
  const body = hs('h1').body;
  await panel.locator('li', { hasText: 'répète' }).getByRole('button', { name: 'Ignorer' }).click();
  ok(hs('h1').body === body, 'Ignorer : rien n’est modifié');
  ok(state.aiCalls.length === n, 'Jamais recalculée sans action');
  // Vérification locale : ouvrir l'étape
  await panel
    .locator('li', { hasText: 'texte alternatif' })
    .first()
    .getByRole('button', { name: 'Ouvrir l’étape' })
    .click();
  ok((await page.locator('#st-alt').count()) === 1, 'Vérification : l’étape s’ouvre sur le champ concerné');
  // Liste vide
  while ((await panel.locator('li').count()) > 0)
    await panel.locator('li').first().getByRole('button', { name: 'Ignorer' }).click();
  state.aiReply = () => ({ suggestions: [] });
  await panel.getByRole('button', { name: 'Analyser à nouveau' }).click();
  await panel.getByText('Aucune suggestion pour cette démo.').waitFor();
  ok(true, 'Liste vide : « Aucune suggestion pour cette démo. »');
  await page.keyboard.press('Escape');
  ok((await panel.count()) === 0, 'Échap ferme le panneau');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
