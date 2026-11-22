/**
 * P1-1 (specs/editeur-densite-p1.md §2) : actions d'une étape dans la colonne Étapes de l'éditeur.
 *  - « Lire depuis ici » ouvre l'aperçu ; le menu « … » (aussi au clic droit) : Modifier, Copier, Coller
 *    après, Couper, Dupliquer, Monter, Descendre, Masquer (Bientôt), Supprimer, avec leurs raccourcis.
 *  - Presse-papiers de l'éditeur : copier puis coller insère l'étape après la cible, avec ses bulles.
 *  - Raccourcis de la liste (focus sur une vignette) : Ctrl D duplique, Suppr supprime.
 *  - Suppression sans confirmation, annulable depuis le toast.
 *  - Étape de fin : ni Copier, ni Couper, ni Dupliquer, ni Supprimer.
 * Données fictives (faux Supabase). Usage : app web (:5173) lancée, puis `node e2e/etapes-menu.e2e.cjs`.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const page = await (
    await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
  ).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  const t = state.tables;
  const demo = t.demos[0];
  await install(page, state);
  await page.goto(`${APP}/#/demos/${demo.id}/edit`);
  await page.locator('.ed-title:not(.ed-title--sk)').waitFor();
  const cards = page.locator('.rail-list .rail-li .step');
  const titles = () => page.locator('.rail-list .step .meta b').allInnerTexts();
  const count = (n) =>
    page.waitForFunction((k) => document.querySelectorAll('.rail-list .rail-li .step').length === k, n);
  const steps = () => t.steps.filter((s) => s.demo_id === demo.id);
  const before = await titles();
  const n0 = before.length;
  ok(n0 >= 3, `démo de départ : ${n0} étapes (${before.join(', ')})`);
  const openMenu = async (i) => {
    await page.locator('.rail-li').nth(i).hover();
    await page.getByRole('button', { name: `Actions de l’étape ${i + 1}` }).click();
    await page.getByRole('menu').waitFor();
  };

  // ===== Lire depuis ici =====
  await page.locator('.rail-li').nth(1).hover();
  await page.getByRole('button', { name: 'Lire depuis l’étape 2' }).click();
  await page.locator('dialog.preview-dialog[open]').waitFor();
  ok(true, '« Lire depuis l’étape 2 » ouvre l’aperçu');
  await page.keyboard.press('Escape');
  await page
    .locator('dialog.preview-dialog[open]')
    .waitFor({ state: 'detached' })
    .catch(() => {});
  if (await page.locator('dialog.preview-dialog[open]').count())
    await page.locator('dialog.preview-dialog[open]').evaluate((d) => d.close());

  // ===== Menu d'une étape =====
  await openMenu(0);
  const items = await page.getByRole('menuitem').allInnerTexts();
  const names = items.map((x) => x.split('\n')[0].trim());
  ok(
    [
      'Modifier',
      'Copier',
      'Coller après',
      'Couper',
      'Dupliquer',
      'Monter',
      'Descendre',
      'Masquer l’étape',
      'Supprimer',
    ].every((x) => names.includes(x)),
    `menu : ${names.join(', ')}`,
  );
  ok(
    /Ctrl C|⌘ C/.test(items.join(' ')) && /Ctrl D|⌘ D/.test(items.join(' ')) && /Suppr/.test(items.join(' ')),
    'raccourcis affichés dans le menu',
  );
  ok(
    (await page.getByRole('menuitem', { name: /Coller après/ }).getAttribute('aria-disabled')) === 'true' ||
      (await page.getByRole('menuitem', { name: /Coller après/ }).isDisabled()),
    '« Coller après » indisponible tant que rien n’est copié',
  );
  ok(
    /Bientôt/.test(await page.getByRole('menuitem', { name: /Masquer l’étape/ }).innerText()),
    '« Masquer l’étape » en « Bientôt »',
  );
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  ok(
    serious.length === 0,
    `axe, menu ouvert : ${serious.map((v) => v.id).join(', ') || '0 violation grave'}`,
  );

  // ===== Copier, puis coller après l'étape 2 =====
  const first0 = steps().sort((x, y) => x.position - y.position)[0];
  const ids0 = new Set(steps().map((s) => s.id));
  const spots0 = t.hotspots.filter((h) => h.step_id === first0.id).length;
  await page.getByRole('menuitem', { name: /^Copier/ }).click();
  await page.locator('[aria-live="assertive"]', { hasText: 'Étape 1 copiée' }).waitFor({ state: 'attached' });
  ok(true, 'annonce « Étape 1 copiée »');
  await openMenu(1);
  await page.getByRole('menuitem', { name: /Coller après/ }).click();
  await count(n0 + 1);
  const after = await titles();
  ok(after[2] === before[0], `collée en position 3 (${after.join(', ')})`);
  // L'étape collée est la seule dont l'identifiant est nouveau
  const pasted = steps().find((s) => !ids0.has(s.id));
  ok(
    !!pasted && t.hotspots.filter((h) => h.step_id === pasted.id).length === spots0,
    `bulles et hotspots copiés avec l’étape (${spots0})`,
  );
  ok(
    !!pasted && (!first0.image_path || pasted.image_path !== first0.image_path),
    'la capture est copiée : aucun fichier partagé entre les deux étapes',
  );

  // ===== Clic droit : le même menu =====
  await cards.nth(0).click({ button: 'right' });
  await page.getByRole('menu').waitFor();
  ok((await page.getByRole('menuitem', { name: /Dupliquer/ }).count()) === 1, 'clic droit : le même menu');
  await page.keyboard.press('Escape');
  await page.getByRole('menu').waitFor({ state: 'detached' });

  // ===== Raccourcis : Ctrl D duplique, Suppr supprime (annulable) =====
  await cards.nth(0).focus();
  await page.keyboard.press('Control+d');
  await count(n0 + 2);
  ok((await titles())[1] === before[0], 'Ctrl D : copie juste après');
  await cards.nth(1).focus();
  await page.keyboard.press('Delete');
  await count(n0 + 1);
  const toast = page.locator('.toast', { hasText: 'Étape supprimée' });
  await toast.waitFor();
  ok((await page.locator('dialog[open]').count()) === 0, 'Suppr : suppression sans confirmation');
  await toast.getByRole('button', { name: 'Annuler' }).click();
  await count(n0 + 2);
  ok((await titles())[1] === before[0], 'toast « Annuler » : l’étape revient à sa place');

  // ===== Alt + flèches : déplacement annoncé =====
  const order0 = await titles();
  await cards.nth(0).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForFunction(
    (first) => document.querySelectorAll('.rail-list .step .meta b')[1]?.textContent === first,
    order0[0],
  );
  await page
    .locator('[aria-live="assertive"]', { hasText: /Étape déplacée en position 2 sur \d+\./ })
    .waitFor({ state: 'attached' });
  ok(true, 'Alt ↓ : étape déplacée en position 2, annoncée');
  ok(
    await page.evaluate(() => document.activeElement?.getAttribute('data-step-index') === '1'),
    'le focus suit l’étape déplacée',
  );
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForFunction(
    (first) => document.querySelectorAll('.rail-list .step .meta b')[0]?.textContent === first,
    order0[0],
  );
  ok(true, 'Alt ↑ : l’étape revient en position 1');

  // ===== Étape de fin =====
  const last = (await cards.count()) - 1;
  await openMenu(last);
  const endNames = (await page.getByRole('menuitem').allInnerTexts()).map((x) => x.split('\n')[0].trim());
  ok(
    !['Copier', 'Couper', 'Dupliquer', 'Supprimer'].some((x) => endNames.includes(x)) &&
      endNames.includes('Modifier'),
    `étape de fin : ${endNames.join(', ')}`,
  );
  await page.keyboard.press('Escape');

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
