/**
 * Recette L48-D (spec docs/ux/specs/l48d-analytics.md §7). Données fictives.
 *  - 4 onglets et « Plus » (qui prend le nom de l'onglet ouvert), 4 indicateurs (3 pour un lecteur) ;
 *  - menu Démo avec recherche au-delà de 10 démos ; widgets et leurs états vides ; onglet Démos trié ;
 *  - 390 px sans défilement horizontal ; axe sur la vue d'ensemble et l'onglet Démos.
 * Usage : node e2e/l48d-analytics.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (data, path = '/analytics', width = 1440) => {
    const ctx = await b.newContext({
      viewport: { width, height: 900 },
      locale: 'fr-FR',
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, data);
    await page.goto(`${APP}/#${path}`);
    return page;
  };
  const axe = async (page, label) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${label} : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  };
  // 12 démos publiées (recherche du menu Démo), dont deux « Fiche … »
  const many = () => {
    const s = seed();
    const base = s.tables.demos[1];
    const titles = [
      'Fiche client',
      'Fiche produit',
      'Créer un devis',
      'Exporter',
      'Importer',
      'Facturer',
      'Relancer',
      'Planifier',
      'Valider',
      'Archiver',
    ];
    titles.forEach((title, i) =>
      s.tables.demos.push({
        ...base,
        id: `0b5c1f0e-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
        title,
      }),
    );
    // A8 : « Planifier » est un Sandbox avec guide (ligne « Guide : x % terminé · y % ignoré »)
    s.tables.demos.find((d) => d.title === 'Planifier').kind = 'sandbox';
    // L48-G : « Exporter » est une démo HTML (type dans le menu Démo)
    const exp = '0b5c1f0e-0000-4000-8000-000000000103';
    for (const position of [0, 1])
      s.tables.steps.push({
        ...s.tables.steps[0],
        id: `0b5c1f0e-0000-4000-8000-00000000020${position}`,
        demo_id: exp,
        position,
        kind: 'html',
      });
    return s;
  };

  // ===== Propriétaire : onglets, indicateurs, « Plus » =====
  const p = await open(many());
  await p.waitForSelector('.an-w');
  const tabs = p.locator('.an-tabs2 [role=tab]');
  ok(
    JSON.stringify(await tabs.allTextContents()) ===
      JSON.stringify(['Vue d’ensemble', 'Démos', 'Sessions', 'Leads']),
    '4 onglets au premier niveau',
  );
  ok((await p.locator('.an-more').innerText()).trim() === 'Plus', 'entrée « Plus »');
  ok((await p.locator('.kpi-tab').count()) === 4, '4 indicateurs');
  ok((await p.locator('.an-tabs2 .badge').count()) === 0, 'aucun compteur dans les onglets');
  await p.locator('.an-more').click();
  const items = await p.getByRole('menuitem').allTextContents();
  ok(
    ['Temps réel', 'Sondages et tests', 'Segments', 'Alertes', 'Mesure des visites'].every((x) =>
      items.some((i) => i.includes(x)),
    ),
    'menu « Plus » : onglets avancés et « Mesure des visites »',
  );
  ok(
    (await p.getByRole('menuitem', { name: /Dates/ }).getAttribute('aria-disabled')) === 'true',
    '« Dates » reste « Bientôt »',
  );
  await p.getByRole('menuitem', { name: 'Segments' }).click();
  await p.waitForURL(/tab=segments/);
  ok(
    (await p.locator('.an-more.is-active').innerText()).trim() === 'Segments',
    '« Plus » prend le nom « Segments »',
  );
  ok((await p.locator('.an-tabs2 [aria-selected=true]').count()) === 0, 'aucun onglet principal actif');
  await p.goto(`${APP}/#/analytics?indicateur=cta`);
  await p.waitForSelector('.kpi-tab');
  ok(
    (await p.locator('.kpi-tab').first().getAttribute('aria-selected')) === 'true',
    '?indicateur=cta : Vues actif',
  );
  ok(
    (await p.getByRole('button', { name: 'Mesure des visites' }).count()) === 0,
    'plus de bouton dans l’en-tête',
  );

  // ===== Menu Démo : recherche =====
  await p.getByRole('button', { name: /^Démo/ }).click();
  const search = p
    .getByRole('searchbox', { name: 'Rechercher une démo' })
    .or(p.getByRole('textbox', { name: 'Rechercher une démo' }));
  await search.waitFor();
  ok(await search.evaluate((el) => el === document.activeElement), 'recherche : focus à l’ouverture');
  const badge = (name) =>
    p.getByRole('menuitem', { name: new RegExp(`^${name}`) }).locator('.ct-badge > span[aria-hidden]');
  ok(
    (await badge('Exporter').innerText()) === 'HTML guidée' &&
      (await badge('Importer').innerText()) === 'Captures' &&
      (await p.getByRole('menu').locator('.ct-badge--tone').count()) >= 2,
    'L48-G : type de contenu de chaque démo dans le menu, en pastille colorée (HTML guidée, Captures)',
  );
  await search.fill('fiche');
  const shown = await p.getByRole('menuitem').allTextContents();
  ok(
    shown.length === 3 &&
      shown[0].includes('Toutes les démos') &&
      shown.slice(1).every((x) => /Fiche/.test(x)),
    `« fiche » filtre la liste (${shown.join(' | ')})`,
  );
  await search.fill('zzz');
  ok((await p.getByText('Aucune démo ne correspond').count()) === 1, '« zzz » : aucune démo ne correspond');
  await p.keyboard.press('Escape');

  // ===== Widgets =====
  const w = (name) => p.locator('section.an-w', { has: p.getByRole('heading', { name }) });
  ok((await p.locator('section.an-w').count()) === 4, '4 widgets');
  ok((await w('Appareils et navigateurs').innerText()).includes('Ordinateur'), 'appareils : Ordinateur');
  ok(
    (await w('Appareils et navigateurs')
      .getByRole('button', { name: /Plus d'actions|Plus d’actions/ })
      .count()) === 0,
    'pas de menu sur Appareils',
  );
  ok(
    (await w(/Étape par étape/).innerText()).includes('Bouton de fin'),
    'étape par étape : pied « Bouton de fin »',
  );
  await w('Sources').getByRole('button', { name: "Plus d'actions pour Sources" }).click();
  const [dl] = await Promise.all([
    p.waitForEvent('download'),
    p.getByRole('menuitem', { name: 'Exporter en CSV' }).click(),
  ]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(
    /Intégration/.test(csv) && !/Lien public|embed/.test(csv) && csv.trim().split('\n').length === 5,
    'Sources › Exporter en CSV : 4 lignes',
  );
  await axe(p, 'vue d’ensemble');

  // ===== Onglet Démos =====
  await tabs.nth(1).click();
  await p.waitForSelector('.an-demos__t tbody tr');
  const head = (n) => p.locator('.an-demos__t thead th', { hasText: n });
  ok((await head('Vues').getAttribute('aria-sort')) === 'descending', 'tri par défaut : Vues décroissant');
  await head('Complétion').getByRole('button').click();
  ok((await head('Complétion').getAttribute('aria-sort')) === 'descending', 'Complétion : décroissant');
  ok(
    (await head('Complétion').evaluate((el) => getComputedStyle(el).fontWeight)) === '600',
    'en-tête trié en gras',
  );
  await head('Complétion').getByRole('button').click();
  ok((await head('Complétion').getAttribute('aria-sort')) === 'ascending', 'second clic : croissant');
  ok((await p.locator('.an-demos__t tbody tr').count()) === 12, '12 démos');
  ok(
    (await p
      .locator('.an-demos__t tbody tr', { hasText: 'Planifier' })
      .locator('.an-demos__guide')
      .innerText()) === 'Guide : 60\u00a0% terminé · 25\u00a0% ignoré',
    'recette 10 : ligne du guide sous le Sandbox',
  );
  ok((await p.locator('.an-demos__guide').count()) === 1, 'ligne du guide : Sandbox seulement');
  await axe(p, 'onglet Démos');
  await p.locator('.an-demos__t tbody tr').first().locator('td.num').first().click();
  await p.waitForURL(/\/demos\/[^/]+\/analytics/);
  ok(true, 'clic sur une ligne : analytics de la démo');
  await p.context().close();

  // ===== Espace sans visites : états vides =====
  const e = seed();
  e.tables.demos.forEach((d) => (d.status = 'draft'));
  const pe = await open(e);
  await pe.waitForSelector('.an-w__empty');
  const empties = pe.locator('.an-w__empty');
  const heights = await pe
    .locator('section.an-w')
    .evaluateAll((els) => els.map((x) => x.getBoundingClientRect().height));
  ok(
    (await empties.count()) >= 3 && heights.every((h) => h >= 220),
    `états vides à 220 px au moins (${heights.join(', ')})`,
  );
  await pe.getByRole('button', { name: 'Élargir à 90 jours' }).first().click();
  await pe.waitForTimeout(300);
  ok(
    (await pe.getByRole('radio', { name: '90 j' }).getAttribute('aria-checked')) === 'true',
    '« Élargir à 90 jours »',
  );
  await pe.context().close();

  // ===== Lecteur : 3 onglets, 3 indicateurs =====
  const v = seed();
  v.tables.members[0].role = 'viewer';
  v.role = 'viewer';
  const pv = await open(v);
  await pv.waitForSelector('.kpi-tab');
  ok((await pv.locator('.an-tabs2 [role=tab]').count()) === 3, 'lecteur : 3 onglets');
  ok((await pv.locator('.kpi-tab').count()) === 3, 'lecteur : 3 indicateurs');
  await pv.context().close();

  // ===== 390 px =====
  const pm = await open(many(), '/analytics?tab=demos', 390);
  await pm.waitForSelector('.an-demos__t tbody tr');
  ok(
    await pm.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    '390 px : pas de défilement horizontal de la page',
  );
  ok(await pm.getByRole('button', { name: /Trier par/ }).isVisible(), '390 px : menu « Trier par »');
  // Audit UX du 25/11 : les onglets défilent ; un fondu de 24 px au bord droit tant qu'il en reste
  const row = pm.locator('.an-tabrow');
  const fade = () =>
    row.evaluate((el) => ({
      more: el.hasAttribute('data-more'),
      mask: getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage,
      scrolls: el.scrollWidth > el.clientWidth + 1,
    }));
  const f0 = await fade();
  ok(
    !f0.scrolls || (f0.more && /linear-gradient/.test(f0.mask)),
    `390 px : onglets qui défilent, fondu au bord droit (${JSON.stringify(f0)})`,
  );
  if (f0.scrolls) {
    await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await pm.waitForFunction(() => !document.querySelector('.an-tabrow').hasAttribute('data-more'));
    ok((await fade()).mask === 'none', '390 px : en bout de défilement, plus de fondu');
  }
  ok(
    !(await pm.locator('.an-demos__t thead th', { hasText: 'Visiteurs' }).isVisible()),
    '390 px : colonnes non triées masquées',
  );
  await pm.context().close();

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})();
