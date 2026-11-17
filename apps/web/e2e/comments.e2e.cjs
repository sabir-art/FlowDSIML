/** Test e2e du panneau Commentaires de l'éditeur (faux Supabase). */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Panneau Commentaires replié par défaut depuis la conformité EDT-01 : on l'ouvre pour ces tests
  await ctx.addInitScript(() => {
    if (localStorage.getItem('fd.editor.comments.collapsed') === null)
      localStorage.setItem('fd.editor.comments.collapsed', '0');
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.cm');
  ok(
    (await page.locator('.cm-state').textContent()).includes('Aucun commentaire sur cette étape'),
    'état vide',
  );
  ok(
    (await page.locator('#cm-title').textContent()) === 'Commentaires · Étape 1',
    'titre « Commentaires · Étape n »',
  );

  // Entrée envoie, Maj+Entrée revient à la ligne
  const input = page.getByRole('textbox', { name: 'Ajouter un commentaire…' });
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
  ok((await page.locator('.cm-count').textContent()) === '1 ouvert', 'badge « n ouverts »');
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
  await page.getByRole('textbox', { name: 'Modifier votre commentaire' }).fill('Libellé validé');
  await page.getByRole('textbox', { name: 'Modifier votre commentaire' }).press('Control+Enter');
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

  // Poignée : flèches du clavier, repli mémorisé
  const handle = page.getByRole('separator', { name: 'Redimensionner le panneau Commentaires' });
  const h0 = await page.locator('.cm').evaluate((el) => el.getBoundingClientRect().height);
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const h1 = await page.locator('.cm').evaluate((el) => el.getBoundingClientRect().height);
  ok(h1 > h0, `poignée au clavier : panneau agrandi (${Math.round(h0)} → ${Math.round(h1)} px)`);
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 4 });
  await page.mouse.up();
  const h2 = await page.locator('.cm').evaluate((el) => el.getBoundingClientRect().height);
  ok(h2 > h1 + 40, 'poignée à la souris : glisser vers le haut agrandit');
  await page.getByRole('button', { name: 'Replier les commentaires' }).click();
  ok((await page.locator('.cm-list').count()) === 0, 'panneau replié');
  await page.reload();
  await page.waitForSelector('.cm');
  ok((await page.locator('.cm--collapsed').count()) === 1, 'état replié mémorisé');
  await page.getByRole('button', { name: /Afficher les commentaires/ }).click();
  const h3 = await page.locator('.cm').evaluate((el) => el.getBoundingClientRect().height);
  ok(Math.abs(h3 - h2) < 2, 'hauteur mémorisée');

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
  await m.getByRole('textbox', { name: 'Ajouter un commentaire…' }).fill('Réponse depuis le téléphone');
  await m.getByRole('button', { name: 'Envoyer le commentaire' }).click();
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
