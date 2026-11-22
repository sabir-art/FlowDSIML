/**
 * Recette L48-A §2 et §3 (spec docs/ux/specs/l48a-navigation.md) : colonne Dossiers et barre de liste
 * de Démos. Données fictives.
 *  - sélection dans l'adresse, aria-current, titre et fil d'Ariane ; compteurs selon le statut ;
 *  - sous-dossiers (retrait de 24 px, chevron au-delà d'un niveau) ; Mes démos ; Archivées ;
 *  - glisser-déposer avec « Annuler » ; repli gardé après rechargement ; à 1 023 px, filtre Dossier ;
 *  - « Créé par », tri « Date de création », tri en icône quand la colonne est ouverte.
 * Usage : node e2e/l48a-dossiers.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const seed = () => {
  const d = seedMaquette();
  const t = d.tables;
  t.folders.push(
    {
      id: 'f-4',
      workspace_id: t.folders[0].workspace_id,
      name: 'Procédures',
      parent_id: 'f-3',
      restricted: false,
    },
    { id: 'f-5', workspace_id: t.folders[0].workspace_id, name: 'Paie', parent_id: 'f-4', restricted: false },
  );
  t.demos[3].status = 'archived';
  t.demos[4].created_by = 'u-3';
  t.demos[5].folder_id = 'f-4';
  return d;
};

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const data = seed();
  const state = await install(page, data);
  const t = state.tables;
  await page.goto(`${APP}/#/`);
  const col = page.getByRole('navigation', { name: 'Dossiers' });
  await col.waitFor();
  const cards = () => page.locator('.demo-card:not(.demo-new)').count();
  // Nombre de cartes attendu après un changement de vue (le rendu peut suivre l'URL sous charge)
  const cardsAre = async (n) => {
    for (let i = 0; i < 50 && (await cards()) !== n; i++) await page.waitForTimeout(100);
    return (await cards()) === n;
  };
  const countOf = async (name) =>
    Number(
      await col
        .getByRole('link', { name: new RegExp(`^${name}`) })
        .locator('.fcol__count')
        .textContent(),
    );
  const live = t.demos.filter((d) => d.status !== 'archived');

  // ===== Entrées =====
  ok(
    (await col.getByRole('link', { name: /^Toutes les démos/ }).getAttribute('aria-current')) === 'true',
    'Toutes les démos sélectionnée par défaut',
  );
  ok((await countOf('Toutes les démos')) === live.length, `Toutes : ${live.length} démos non archivées`);
  ok(
    (await col.locator('.fcol__section').textContent()) === 'Dossiers de l’espace',
    'section « Dossiers de l’espace »',
  );
  await col.getByRole('link', { name: /^Onboarding/ }).click();
  await page.waitForURL(/dossier=f-3/);
  await page.waitForTimeout(200);
  ok(
    (await col.getByRole('link', { name: /^Onboarding/ }).getAttribute('aria-current')) === 'true' &&
      (await page.getByRole('heading', { level: 1 }).textContent()) === 'Onboarding',
    'dossier choisi : ?dossier=, aria-current, titre',
  );
  ok(
    (await page.getByRole('navigation', { name: 'Fil d’Ariane' }).innerText()).replace(/\s+/g, ' ').trim() ===
      'Démos Onboarding',
    'fil d’Ariane « Démos > Onboarding »',
  );
  ok(await cardsAre(live.filter((d) => d.folder_id === 'f-3').length), 'cartes du dossier seulement');

  // Compteurs selon le statut
  await page.getByRole('button', { name: /^Publiées/ }).click();
  await page.waitForTimeout(200);
  ok(
    (await countOf('Site web')) ===
      live.filter((d) => d.folder_id === 'f-2' && d.status === 'published').length,
    'compteurs : suivent le filtre Publiées',
  );
  await page.getByRole('button', { name: /^Toutes ·/ }).click();

  // Sous-dossiers
  const sub = col.locator('.fcol__row', { hasText: 'Procédures' });
  const subPad = await sub.evaluate((el) => getComputedStyle(el).paddingLeft);
  ok(subPad === '24px', `sous-dossier en retrait de 24 px (${subPad})`);
  ok((await col.getByRole('link', { name: /^Paie/ }).count()) === 0, 'deuxième niveau replié');
  const chev = col.getByRole('button', { name: 'Déplier Procédures' });
  ok((await chev.getAttribute('aria-expanded')) === 'false', 'chevron : aria-expanded');
  await chev.click();
  ok((await col.getByRole('link', { name: /^Paie/ }).count()) === 1, 'chevron : déplie le niveau suivant');

  // Mes démos et Archivées
  await col.getByRole('link', { name: /^Mes démos/ }).click();
  await page.waitForURL(/vue=mes-demos/);
  await page.waitForTimeout(200);
  ok(await cardsAre(live.filter((d) => d.created_by === 'u-alice').length), 'Mes démos : ?vue=mes-demos');
  await col.getByRole('link', { name: /^Archivées/ }).click();
  await page.waitForURL(/vue=archivees/);
  await page.waitForTimeout(200);
  ok((await cardsAre(1)) && (await countOf('Archivées')) === 1, 'Archivées : ?vue=archivees');
  await col.getByRole('link', { name: /^Toutes les démos/ }).click();
  await page.waitForTimeout(200);

  // ===== Glisser-déposer avec « Annuler » =====
  const demo = t.demos[0];
  const before = demo.folder_id;
  // La liste « Toutes les démos » doit être rendue avant le glisser (pas d'attente fixe : instable sous charge)
  await page.locator('.demo-card[draggable="true"]', { hasText: demo.title }).first().waitFor();
  // Événements de glisser du navigateur (dragTo de Playwright ne démarre pas le glisser natif ici)
  await page.evaluate(
    ([title, target]) => {
      const card = [...document.querySelectorAll('.demo-card[draggable="true"]')].find((x) =>
        x.textContent.includes(title),
      );
      const row = [...document.querySelectorAll('.fcol__row')].find((x) => x.textContent.includes(target));
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      row.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      row.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    [demo.title, 'Sales'],
  );
  await page.getByText('Démo déplacée vers « Sales — Outbound »').waitFor();
  ok(t.demos[0].folder_id === 'f-1', 'glisser-déposer : démo rangée dans le dossier');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.waitForTimeout(500);
  ok(t.demos[0].folder_id === before, '« Annuler » remet la démo dans son dossier');

  // ===== Menu d'un dossier =====
  await col.locator('.fcol__row', { hasText: 'Site web' }).hover();
  await col.getByRole('button', { name: 'Actions du dossier Site web' }).click();
  const items = (await page.getByRole('menuitem').allTextContents()).map((s) => s.trim());
  ok(
    ['Renommer', 'Nouveau sous-dossier', 'Supprimer'].every((x) => items.some((i) => i.startsWith(x))),
    `menu du dossier : ${items.join(', ')}`,
  );
  await page.getByRole('menuitem', { name: 'Nouveau sous-dossier' }).click();
  await page.fill('dialog[open] input', 'Tutoriels');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  ok(
    t.folders.some((f) => f.name === 'Tutoriels' && f.parent_id === 'f-2'),
    'nouveau sous-dossier créé sous « Site web »',
  );

  // ===== Barre de liste =====
  const sort = page.locator('.fd-filter--sort');
  ok(
    (await sort.boundingBox()).width === 36 &&
      (await page.getByRole('button', { name: /^Tri\s*: Modifiées récemment/ }).count()) === 1,
    'colonne ouverte : tri en icône de 36 px (lot 2), nom complet',
  );
  await sort.click();
  const sorts = (await page.getByRole('menuitem').allTextContents()).map((s) => s.trim());
  ok(sorts[0] === 'Modifiées récemment' && sorts[1] === 'Date de création', 'tri « Date de création » en 2e');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Créé par\s*: Tous/ }).click();
  await page.getByRole('menuitem', { name: 'Moi' }).click();
  await page.waitForTimeout(200);
  ok(await cardsAre(live.filter((d) => d.created_by === 'u-alice').length), '« Créé par : Moi »');
  const axe = await new AxeBuilder({ page }).exclude('.demo-cover').analyze();
  const bad = axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  ok(bad.length === 0, `axe : Démos avec colonne (${bad.map((v) => v.id).join(', ')})`);

  // ===== Repli gardé =====
  // Retours client 21/11 §7 : repliée, la colonne devient un rail au même endroit, bouton à la même place
  const sw = page.locator('.fcol__switch');
  const swOpen = await sw.boundingBox();
  await col.getByRole('button', { name: 'Masquer les dossiers' }).click();
  await page.reload();
  await page.locator('.demos-section .list-toolbar').waitFor();
  const swRail = await sw.boundingBox();
  ok(
    (await page.locator('.fcol--rail').count()) === 1 &&
      (await page.locator('.fcol--rail').evaluate((e) => e.getBoundingClientRect().width)) === 48,
    'repli gardé après rechargement : rail de 48 px',
  );
  ok(
    Math.round(swOpen.x) === Math.round(swRail.x) && Math.round(swOpen.y) === Math.round(swRail.y),
    `bascule à la même position repliée et dépliée (${Math.round(swRail.x)}, ${Math.round(swRail.y)})`,
  );
  ok(
    (await page.getByRole('button', { name: 'Dossiers', exact: true }).count()) === 0,
    'plus de bouton « Dossiers » près des filtres',
  );
  await page.getByRole('button', { name: 'Afficher les dossiers' }).click();
  await col.locator('.fcol__head').waitFor();
  ok(true, '« Afficher les dossiers » rouvre la colonne');
  await ctx.close();

  // ===== 1 023 px : filtre Dossier =====
  const p2 = await (
    await b.newContext({ viewport: { width: 1023, height: 900 }, locale: 'fr-FR' })
  ).newPage();
  await install(p2, seed());
  await p2.goto(`${APP}/#/`);
  await p2.locator('.demos-section .list-toolbar').waitFor();
  ok(
    (await p2.getByRole('navigation', { name: 'Dossiers' }).count()) === 0 &&
      (await p2.getByRole('button', { name: /^Dossier\s*:/ }).count()) === 0 &&
      (await p2.getByRole('button', { name: 'Dossiers', exact: true }).count()) === 1,
    '1 023 px : pas de colonne ni de filtre Dossier, bascule « Dossiers » dans la barre mobile (lot 2)',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
