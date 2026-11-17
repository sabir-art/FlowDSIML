/** Test e2e du panneau Commentaires de l'éditeur (faux Supabase). */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
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
  await page.waitForSelector('.comments');
  ok((await page.locator('.comments__empty').count()) === 1, 'état vide sur une étape sans commentaire');

  // Entrée envoie, Maj+Entrée revient à la ligne
  const input = page.getByRole('textbox', { name: 'Ajouter un commentaire…' });
  await input.fill('Revoir le libellé');
  await input.press('Shift+Enter');
  await input.type('du **bouton**');
  ok((await input.inputValue()).includes('\n'), 'Maj+Entrée : retour à la ligne');
  await input.press('Enter');
  await page.waitForSelector('.comment');
  ok(state.tables.step_comments?.length === 1, 'commentaire enregistré');
  ok(state.tables.step_comments[0].body === 'Revoir le libellé\ndu **bouton**', 'texte multiligne conservé');
  ok((await page.locator('.comment__body strong').textContent()) === 'bouton', 'texte riche restreint rendu');
  ok((await input.inputValue()) === '', 'champ vidé après envoi');
  ok(
    (await page.locator('.steplist-comments').first().textContent()).includes('1'),
    'badge sur la vignette du rail',
  );
  ok((await page.locator('.comments__count').textContent()) === '1', 'compteur de commentaires ouverts');

  // Modifier son commentaire
  await page.getByRole('button', { name: 'Modifier le commentaire' }).click();
  await page.getByRole('textbox', { name: 'Modifier le commentaire' }).fill('Libellé validé');
  await page.getByRole('textbox', { name: 'Modifier le commentaire' }).press('Enter');
  await page.waitForTimeout(300);
  ok(state.tables.step_comments[0].body === 'Libellé validé', 'modification de son commentaire');

  // Résoudre → masqué, filtre « Afficher les résolus »
  await page.getByRole('button', { name: 'Résoudre' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('.comment').count()) === 0, 'commentaire résolu masqué par défaut');
  ok((await page.locator('.steplist-comments').count()) === 0, 'badge retiré quand tout est résolu');
  await page.getByText('Afficher les résolus (1)').click();
  ok((await page.locator('.comment--resolved').count()) === 1, 'filtre « Afficher les résolus »');
  await page.getByRole('button', { name: 'Rouvrir' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('.comment--resolved').count()) === 0, 'commentaire rouvert');

  // Commentaires par étape
  await page.locator('.steplist-item').nth(1).click();
  await page.waitForTimeout(200);
  ok((await page.locator('.comment').count()) === 0, 'les commentaires sont propres à chaque étape');
  await page.locator('.steplist-item').first().click();

  // Poignée : flèches du clavier, repli mémorisé
  const handle = page.getByRole('separator', { name: 'Redimensionner le panneau des commentaires' });
  const h0 = await page.locator('.comments').evaluate((el) => el.getBoundingClientRect().height);
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const h1 = await page.locator('.comments').evaluate((el) => el.getBoundingClientRect().height);
  ok(h1 > h0, `poignée au clavier : panneau agrandi (${Math.round(h0)} → ${Math.round(h1)} px)`);
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 4 });
  await page.mouse.up();
  const h2 = await page.locator('.comments').evaluate((el) => el.getBoundingClientRect().height);
  ok(h2 > h1 + 40, 'poignée à la souris : glisser vers le haut agrandit');
  await page.getByRole('button', { name: 'Replier' }).click();
  ok((await page.locator('#comments-body').count()) === 0, 'panneau replié');
  await page.reload();
  await page.waitForSelector('.comments');
  ok((await page.locator('.comments--collapsed').count()) === 1, 'état replié mémorisé');
  await page.getByRole('button', { name: 'Déplier' }).click();
  const h3 = await page.locator('.comments').evaluate((el) => el.getBoundingClientRect().height);
  ok(Math.abs(h3 - h2) < 2, 'hauteur mémorisée');

  // Supprimer (modale de confirmation)
  await page.getByRole('button', { name: 'Supprimer le commentaire' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(300);
  ok(state.tables.step_comments.length === 0, 'suppression confirmée');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
