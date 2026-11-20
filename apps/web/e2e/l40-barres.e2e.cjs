/**
 * Recette L40 (spec docs/ux/specs/l40-barres-liste.md §7) : barres de liste de Démos, Apprenants et
 * Analytics. Données fictives.
 *  - 1 440 px : contrôles de 40 px, une seule ligne avec 0 et 2 filtres actifs (valeurs longues) ;
 *  - noms accessibles « Libellé : valeur », Réinitialiser, annonce du nombre de résultats ;
 *  - 1 024 et 390 px : aucun défilement horizontal ; sous 768 px, feuille « Filtres ».
 * Usage : node e2e/l40-barres.e2e.cjs [filtre…]
 */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const { seedPathTables, learnersFixture } = require('./learners-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const only = process.argv.slice(2);

/** Mesures d'une barre : hauteurs des contrôles visibles, nombre de lignes. */
const measure = (bar) =>
  bar.evaluate((el) => {
    const ctl = [...el.querySelectorAll('.fd-btn, .fd-segmented, .fd-input')].filter(
      (e) => e.offsetParent && !e.closest('.list-sheet'),
    );
    const tops = new Set(ctl.map((e) => Math.round(e.getBoundingClientRect().top)));
    return { heights: ctl.map((e) => Math.round(e.getBoundingClientRect().height)), lines: tops.size };
  });

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (route, width, seed) => {
    const page = await (await b.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR' })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const data = seedMaquette();
    if (seed) seed(data);
    await install(page, data);
    await page.goto(`${APP}${route}`);
    return page;
  };
  const noHScroll = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  // ===== Démos =====
  if (!only.length || only.includes('demos')) {
    const page = await open('/#/', 1440, (d) => {
      d.tables.folders = [
        {
          id: 'f-long',
          workspace_id: d.tables.workspaces[0].id,
          name: 'Onboarding des nouveaux conseillers',
          restricted: false,
        },
      ];
      d.tables.demos[0].folder_id = 'f-long';
    });
    const bar = page.locator('.demos-section .list-toolbar');
    await bar.waitFor();
    let m = await measure(bar);
    ok(
      m.heights.length >= 5 && m.heights.every((h) => h === 40),
      `Démos : contrôles de 40 px (${m.heights})`,
    );
    ok(m.lines === 1, 'Démos : une ligne sans filtre actif');
    ok(
      (await page.getByRole('group', { name: 'Filtres' }).count()) === 1 &&
        (await page.getByRole('group', { name: 'Tri et affichage' }).count()) === 1,
      'Démos : groupes « Filtres » et « Tri et affichage »',
    );
    ok(
      (await bar.getByRole('button', { name: 'Réinitialiser les filtres' }).count()) === 0,
      'Démos : pas de Réinitialiser sans filtre',
    );
    await page.getByRole('button', { name: /^Dossier\s*: Tous/ }).click();
    await page.getByRole('menuitem', { name: /^Onboarding des nouveaux conseillers/ }).click();
    await page.getByRole('button', { name: /^Publiées/ }).click();
    await page.waitForTimeout(300);
    const folderBtn = page.getByRole('button', { name: /^Dossier\s*: Onboarding des nouveaux conseillers$/ });
    ok(
      (await folderBtn.count()) === 1,
      'Démos : nom accessible « Dossier : Onboarding des nouveaux conseillers »',
    );
    ok((await folderBtn.getAttribute('class')).includes('fd-filter--active'), 'Démos : filtre Dossier actif');
    m = await measure(bar);
    ok(
      m.lines === 1 && m.heights.every((h) => h === 40),
      'Démos : une ligne avec 2 filtres actifs (valeur longue)',
    );
    const status = (await bar.locator('[role=status]').textContent()).trim();
    ok(/^\d+ démos?$/.test(status), `Démos : nombre de résultats annoncé (« ${status} »)`);
    await bar.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await page.waitForTimeout(200);
    ok(
      (await page.getByRole('button', { name: /^Dossier\s*: Tous/ }).count()) === 1 &&
        (await page.getByRole('button', { name: /^Toutes/ }).getAttribute('aria-pressed')) === 'true',
      'Démos : Réinitialiser remet Statut et Dossier',
    );
    await page.context().close();

    for (const w of [1024, 390]) {
      const p = await open('/#/', w);
      await p.locator('.demos-section .list-toolbar').waitFor();
      await p.waitForTimeout(300);
      ok(await noHScroll(p), `Démos ${w} px : pas de défilement horizontal`);
      if (w === 390) {
        ok(
          (await p.getByRole('button', { name: /^Dossier/ }).count()) === 0,
          'Démos 390 px : filtres dans la feuille',
        );
        ok(
          (await p.getByRole('button', { name: /^Tri\s*: Modifiées récemment/ }).isVisible()) &&
            (await p.locator('.fd-filter--sort').boundingBox()).width === 40,
          'Démos 390 px : tri en icône, nom accessible complet',
        );
        await p.getByRole('button', { name: /^Filtres/ }).click();
        const sheet = p.getByRole('dialog', { name: 'Filtres' });
        await sheet.waitFor();
        ok(
          (await sheet.getByRole('button', { name: /^Dossier/ }).count()) === 1,
          'Démos 390 px : feuille « Filtres »',
        );
        await p.keyboard.press('Escape');
        await p.waitForTimeout(200);
        ok(
          (await p.getByRole('dialog', { name: 'Filtres' }).count()) === 0,
          'Démos 390 px : Échap ferme la feuille',
        );
      }
      await p.context().close();
    }
  }

  // ===== Apprenants =====
  if (!only.length || only.includes('learners')) {
    const seed = (d) => {
      seedPathTables(d.tables, d.tables.workspaces[0].id);
      d.learners = learnersFixture().progress;
      d.learners.learners[0].group = 'Session du 12 novembre, antenne de Valence';
      d.learners.learners[1].group = 'Session du 12 novembre, antenne de Valence';
    };
    const page = await open('/#/learners', 1440, seed);
    const bar = page.locator('#l13-panel-liste .list-toolbar');
    await bar.waitFor();
    ok(
      (await page.locator('.l13-tabs').getAttribute('class')).split(' ').includes('tabs') &&
        (await page.getByRole('tab', { name: 'Par formation' }).count()) === 1,
      'Apprenants : vues en onglets soulignés au-dessus de la barre',
    );
    let m = await measure(bar);
    ok(
      m.heights.length >= 5 && m.heights.every((h) => h === 40),
      `Apprenants : contrôles de 40 px (${m.heights})`,
    );
    ok(m.lines === 1, 'Apprenants : une ligne sans filtre actif');
    ok((await bar.locator('.fchip').count()) === 0, 'Apprenants : plus de puces fchip');
    await page.getByRole('button', { name: /^Groupe\s*:/ }).click();
    await page.getByRole('menuitem', { name: 'Session du 12 novembre, antenne de Valence' }).click();
    await page.getByRole('button', { name: /^Statut\s*:/ }).click();
    await page.getByRole('menuitem', { name: 'En cours' }).click();
    await page.waitForTimeout(300);
    m = await measure(bar);
    ok(
      m.lines === 1 && m.heights.every((h) => h === 40),
      'Apprenants : une ligne avec 2 filtres actifs (valeur longue)',
    );
    const status = (await bar.locator('[role=status]').textContent()).trim();
    ok(/^\d+ apprenants?$/.test(status), `Apprenants : nombre de résultats annoncé (« ${status} »)`);
    await bar.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await page.waitForTimeout(300);
    ok(!/groupe=|statut=/.test(page.url()), 'Apprenants : Réinitialiser retire Groupe et Statut');
    await page.getByRole('tab', { name: 'Par formation' }).click();
    const fbar = page.locator('#l13-panel-formation .list-toolbar');
    await fbar.waitFor();
    m = await measure(fbar);
    ok(
      m.heights.every((h) => h === 40) && m.lines === 1,
      'Par formation : barre Formation, Structure, Groupe',
    );
    await page.context().close();
    for (const w of [1024, 390]) {
      const p = await open('/#/learners', w, seed);
      await p.locator('#l13-panel-liste .list-toolbar').waitFor();
      await p.waitForTimeout(300);
      ok(await noHScroll(p), `Apprenants ${w} px : pas de défilement horizontal`);
      if (w === 390) {
        const s = await p.locator('.fd-toolbar__search').boundingBox();
        ok(s.width >= 300, `Apprenants 390 px : recherche en pleine largeur (${Math.round(s.width)} px)`);
      }
      await p.context().close();
    }
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
