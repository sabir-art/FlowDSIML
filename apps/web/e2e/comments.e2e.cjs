/** Test e2e du panneau Commentaires de l'éditeur (faux Supabase). */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { openComments } = require('./editor-rail.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  // Retours client 21/11 §1 : panneau Commentaires sous le canevas
  await openComments(page);
  await page.waitForSelector('.cm');
  ok((await page.locator('.cm').textContent()).includes('Aucun commentaire sur cette étape'), 'état vide');
  ok(
    (await page.locator('#cm-title').textContent()) === 'Commentaires · Étape 1',
    'titre « Commentaires · Étape n »',
  );

  // Entrée envoie, Maj+Entrée revient à la ligne
  const input = page.getByRole('textbox', { name: 'Nouveau commentaire' });
  await input.fill('Revoir le libellé');
  await input.press('Shift+Enter');
  await input.type('du bouton https://exemple.test/doc');
  ok((await input.inputValue()).includes('\n'), 'Maj+Entrée : retour à la ligne');
  await input.press('Enter');
  await page.waitForSelector('.cm-item');
  ok(state.tables.step_comments?.length === 1, 'commentaire enregistré');
  ok(
    state.tables.step_comments[0].body === 'Revoir le libellé\ndu bouton https://exemple.test/doc',
    'texte multiligne conservé',
  );
  ok(
    (await page.locator('.cm-body a').getAttribute('href')) === 'https://exemple.test/doc',
    'liens cliquables (texte brut, sans Markdown)',
  );
  ok((await page.locator('.cm-meta').textContent()).includes('(vous)'), 'mention « (vous) » pour l’auteur');
  ok((await input.inputValue()) === '', 'champ vidé après envoi');
  ok(
    (await page.locator('.rail-comments').first().textContent()).includes('1'),
    'badge sur la vignette du rail',
  );
  // Retours client 21/11 §1 : badge du panneau (seul indicateur), lu (son propre commentaire)
  ok(
    (await page.locator('.cm-dock__badge').textContent()) === '1' &&
      !(await page.locator('.cm-dock__badge').evaluate((el) => el.classList.contains('is-unread'))) &&
      (await page.locator('.cm-dock__toggle').getAttribute('aria-label')) === 'Commentaires, 1 ouvert',
    'badge « 1 », nom accessible « Commentaires, 1 ouvert »',
  );
  ok(
    (await page.locator('.rail-list .step').first().textContent()).includes('1 commentaire ouvert'),
    'nombre de commentaires dans le nom accessible de l’étape',
  );

  // Modifier son commentaire
  await page.getByRole('button', { name: 'Actions sur votre commentaire' }).click();
  ok(
    await page.locator('[role=menu]').evaluate((el) => el.parentElement?.id === 'fd-portal'),
    'menu ⋯ du commentaire en portail (§15.7)',
  );
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
  await page.getByRole('textbox', { name: 'Modifier le commentaire' }).fill('Libellé validé');
  await page.getByRole('textbox', { name: 'Modifier le commentaire' }).press('Enter');
  await page.waitForTimeout(300);
  ok(state.tables.step_comments[0].body === 'Libellé validé', 'modification de son commentaire');

  // Résoudre → masqué, filtre « Afficher les résolus »
  await page.getByRole('button', { name: 'Résoudre' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('.cm-item').count()) === 0, 'commentaire résolu masqué par défaut');
  ok((await page.locator('.cm-state').textContent()).includes('Tout est résolu'), 'état « Tout est résolu »');
  ok((await page.locator('.rail-comments').count()) === 0, 'badge retiré quand tout est résolu');
  await page.getByRole('button', { name: 'Les afficher' }).click();
  ok(
    (await page.locator('.cm-item--resolved').count()) === 1,
    '« Les afficher » active le filtre des résolus',
  );
  ok((await page.locator('.cm-resolved-by').count()) === 1, 'mention « Résolu par »');
  await page.getByRole('button', { name: 'Rouvrir' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('.cm-item--resolved').count()) === 0, 'commentaire rouvert');

  // Commentaires par étape
  await page.locator('.rail-list .step').nth(1).click();
  await page.waitForTimeout(200);
  ok((await page.locator('.cm-item').count()) === 0, 'les commentaires sont propres à chaque étape');
  await page.locator('.rail-list .step').first().click();

  // L48-E : l'ancien panneau du bas (poignée, repli) est remplacé par l'outil « Commentaires » du rail

  // Supprimer (modale de confirmation)
  await page.getByRole('button', { name: 'Actions sur votre commentaire' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  ok(
    (await page.locator('dialog[open]').textContent()).includes('supprimé pour toute'),
    'modale de suppression',
  );
  await page.locator('dialog[open]').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(300);
  ok(state.tables.step_comments.length === 0, 'suppression confirmée');

  // Écran étroit : lecture et réponse aux commentaires
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await install(m, state);
  await m.goto(`${APP}/#/demos/${DEMO}/edit`);
  await m.waitForSelector('.cm--mobile');
  ok((await m.locator('.cm-handle').count()) === 0, 'mobile : pas de poignée');
  await m.getByRole('textbox', { name: 'Nouveau commentaire' }).fill('Réponse depuis le téléphone');
  await m.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await m.waitForTimeout(300);
  ok(state.tables.step_comments.length === 1, 'mobile : réponse envoyée');
  await m.selectOption('.editor-narrow__steps', '1');
  ok((await m.locator('#cm-title').textContent()) === 'Commentaires · Étape 2', 'mobile : sélecteur d’étape');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
