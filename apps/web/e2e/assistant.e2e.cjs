/**
 * Test e2e L30-08 : Assistant de l'éditeur (bouton de la barre, contexte « Démo · Étape », suggestions
 * de départ, Entrée envoie / Maj+Entrée va à la ligne, journal role=log avec auteurs, carte d'aperçu
 * Appliquer / Ignorer, réponse explicative sans bouton, mention IA, conversation effacée à la fermeture).
 * Données fictives, aucun appel au fournisseur. Usage : SHOTS_DIR=… [THEME=dark] node e2e/assistant.e2e.cjs
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
  const shot = async (name) => {
    for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForTimeout(250);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
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
  state.aiReply = (task, input) =>
    /clair/.test(input.messages.at(-1).text)
      ? {
          text: 'Je propose une bulle plus directe.',
          changes: [{ id: 'h:h1:body', text: 'Cliquez sur « + Nouvelle opportunité ».' }],
        }
      : { text: 'La démo compte 3 étapes : deux captures et une étape de fin.', changes: [] };
  await install(page, state);
  const hs = (id) => state.tables.hotspots.find((h) => h.id === id);

  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('button', { name: 'Assistant' }).click();
  const panel = page.getByRole('dialog', { name: 'Assistant' });
  await panel.waitFor();
  ok(
    /Démo\s?: Démo CRM · Étape 1/.test(await panel.locator('.ai-as-context').textContent()),
    'Contexte « Démo : titre · Étape n »',
  );
  ok(
    (await panel.getByRole('log').getAttribute('aria-live')) === 'polite',
    'Journal role=log, aria-live polite',
  );
  ok((await panel.locator('.ai-as-starters button').count()) === 3, 'Trois suggestions de départ');
  ok(
    (await panel.getByText('La conversation est effacée à la fermeture.').count()) === 1,
    'Mention de l’effacement',
  );
  ok(
    await panel
      .getByLabel('Demandez une modification ou une explication')
      .evaluate((e) => e === document.activeElement),
    'Focus dans le champ',
  );
  await shot('l30-08-vide');
  await panel.getByRole('button', { name: 'Rendre l’étape plus claire' }).click();
  await panel.getByRole('button', { name: 'Appliquer' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'assistant' && call.input.step === 1 && call.input.items.some((i) => i.id === 'h:h1:body'),
    'Demande : textes de la démo et étape',
  );
  ok(
    !/image_path|png|comment|lead/i.test(JSON.stringify(call.input)),
    'Ni image, ni commentaire, ni lead envoyés',
  );
  ok(
    (await panel.locator('.ai-as-author').allTextContents()).join('|') === 'Vous|Assistant',
    'Auteurs « Vous » et « Assistant »',
  );
  ok((await panel.getByText('Généré par IA, à vérifier').count()) === 1, 'Mention de la règle 2');
  ok(hs('h1').body !== 'Cliquez sur « + Nouvelle opportunité ».', 'Rien n’est modifié sans « Appliquer »');
  await shot('l30-08-proposition');
  await panel.getByRole('button', { name: 'Appliquer' }).click();
  await page.waitForTimeout(900);
  ok(hs('h1').body === 'Cliquez sur « + Nouvelle opportunité ».', 'Appliquer : bulle modifiée');
  // Question explicative, Maj+Entrée puis Entrée
  const field = panel.getByLabel('Demandez une modification ou une explication');
  await field.fill('Combien d’étapes');
  await field.press('Shift+Enter');
  ok((await field.inputValue()).includes('\n'), 'Maj+Entrée : retour à la ligne');
  await field.type('?');
  await field.press('Enter');
  await panel.getByText('La démo compte 3 étapes').waitFor();
  ok(
    (await panel.locator('.ai-as-msg').last().getByRole('button').count()) === 0,
    'Réponse explicative sans bouton',
  );
  ok(await field.evaluate((e) => e === document.activeElement), 'Focus gardé dans le champ après l’envoi');
  ok(state.aiCalls.at(-1).input.messages.length === 3, 'Historique de la session envoyé');
  await page.keyboard.press('Escape');
  ok((await panel.count()) === 0, 'Échap ferme le panneau');
  await page.getByRole('button', { name: 'Assistant' }).click();
  await panel.waitFor();
  ok((await panel.locator('.ai-as-msg').count()) === 0, 'Conversation effacée à la fermeture');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
