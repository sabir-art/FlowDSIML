/** Test e2e analytics + leads (faux Supabase). */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO2 = '0b5c1f0e-0000-4000-8000-000000000002';

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  await page.goto(`${APP}/#/demos/${DEMO2}/analytics`);
  // L47 : indicateurs en onglets, graphique et tableau « Par source » pilotés par l'onglet actif
  await page.waitForSelector('.kpi-tab');
  const tabs = page.getByRole('tablist', { name: 'Indicateur affiché' }).getByRole('tab');
  // La navigation (?indicateur=) passe par une transition : on attend l'onglet sélectionné
  const selected = (i) =>
    page
      .waitForFunction(
        (n) => document.querySelectorAll('.kpi-tabs [role=tab]')[n]?.getAttribute('aria-selected') === 'true',
        i,
        { timeout: 3000 },
      )
      .then(
        () => true,
        () => false,
      );
  ok((await tabs.count()) === 5, 'démo : 5 indicateurs en onglets');
  ok((await tabs.first().locator('.kpi-tab__v').textContent()) === '120', 'onglet Vues : 120');
  ok((await tabs.first().getAttribute('aria-selected')) === 'true', 'Vues actif par défaut');
  ok(
    (await page.locator('[role=tablist] [tabindex="0"]').count()) === 1,
    'une seule carte dans l’ordre de tabulation',
  );
  await page.waitForSelector('.kpi-chart__svg');
  ok((await page.locator('.kpi-chart__t').textContent()) === 'Vues par jour', 'titre « Vues par jour »');
  ok(
    /Vues par jour sur 30 jours, comparé à la période précédente/.test(
      await page.locator('.kpi-chart__svg').getAttribute('aria-label'),
    ),
    'nom accessible du graphique',
  );
  ok((await page.locator('.kpi-chart__prev').count()) === 1, 'période précédente en pointillé');
  ok((await page.locator('.kpi-tbl tbody tr').count()) === 4, 'tableau « Par source » : 4 sources');
  ok((await page.locator('.funnel tbody tr').count()) >= 1, 'entonnoir par étape');
  ok((await page.locator('.fd-card--hero, .stat-tile').count()) === 0, 'plus de carte héro');
  ok(
    (await page.getByRole('group', { name: 'Mesure affichée' }).count()) === 0,
    'segmenté Vues / Visiteurs retiré',
  );
  await tabs.nth(1).click();
  await selected(1);
  ok(
    (await page.locator('.kpi-chart__t').textContent()) === 'Visiteurs par jour',
    'clic : « Visiteurs par jour »',
  );
  ok(/indicateur=visitors/.test(page.url()), 'adresse : ?indicateur=visitors');
  ok(
    (await page.locator('.kpi-tbl th[aria-sort="descending"]').textContent()).trim() === 'Visiteurs',
    'tableau trié par l’indicateur actif',
  );
  const panel = page.getByRole('tabpanel');
  ok(
    (await panel.getAttribute('aria-labelledby')) === (await tabs.nth(1).getAttribute('id')),
    'panneau relié à l’onglet actif',
  );
  // Clavier : flèches (activation immédiate), Fin, Début, boucle
  await tabs.nth(1).focus();
  await page.keyboard.press('ArrowRight');
  ok(await selected(2), 'Flèche droite : Taux de complétion');
  ok(
    (await page.locator('.kpi-chart__t').textContent()) === 'Taux de complétion par jour',
    'taux : courbe en %',
  );
  await page.keyboard.press('End');
  ok(await selected(4), 'Fin : dernier indicateur');
  await page.keyboard.press('ArrowRight');
  ok(await selected(0), 'le parcours boucle');
  await page.keyboard.press('End');
  await selected(4);
  await page.waitForTimeout(100);
  ok(
    (await page.evaluate(() => document.activeElement?.textContent)).startsWith(
      'Clics sur le bouton d’action',
    ),
    'focus suit l’onglet (« Clics sur le bouton d’action »)',
  );
  await page.reload();
  await page.waitForSelector('.kpi-tab');
  ok(await selected(4), 'rechargement : indicateur gardé');
  await page.waitForSelector('text=prospect@globex.example', { timeout: 3000 }).catch(() => null);
  ok((await page.locator('text=prospect@globex.example').count()) === 1, 'leads de la démo listés');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/analytics-demo.png`, fullPage: true });
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter en CSV' }).first().click(),
  ]);
  ok(dl.suggestedFilename().endsWith('.csv'), 'export CSV de l’entonnoir');

  // Analytics du workspace (ANA-01) : 6 KPI (L26-06 : visiteurs récurrents), période, filtre par démo, onglets
  await page.goto(`${APP}/#/analytics`);
  await page.waitForSelector('.mk .kpi-tab');
  ok((await page.locator('.kpi-tab').count()) === 6, 'analytics du workspace : 6 indicateurs en onglets');
  await page.waitForSelector('.kpi-chart__svg');
  ok((await page.locator('.kpi-chart__svg').count()) === 1, 'courbe de l’indicateur actif');
  const wsTabs = page.locator('.kpi-tabs [role=tab]');
  await wsTabs.nth(4).click();
  await selected(4);
  ok(/indicateur=leads/.test(page.url()), 'espace : ?indicateur=leads');
  ok((await page.locator('.kpi-chart__t').textContent()) === 'Leads par jour', 'espace : « Leads par jour »');
  const leadsCol = await page.locator('.kpi-tbl tbody tr td.on').allTextContents();
  ok(
    leadsCol.length >= 1 &&
      leadsCol.every(
        (v, i) => i === 0 || Number(v.replace(/\D/g, '')) <= Number(leadsCol[i - 1].replace(/\D/g, '')),
      ),
    `« Par démo » trié par leads (${leadsCol.join(', ')})`,
  );
  await wsTabs.nth(2).click();
  await selected(2);
  ok(
    (await page.locator('.kpi-chart__none').textContent()) ===
      'Pas encore de données jour par jour pour cet indicateur',
    'récurrents : pas de série jour par jour, aucune valeur inventée',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l47-espace.png`, fullPage: true });
  await wsTabs.nth(0).click();
  await selected(0);
  ok((await page.locator('.funnel-row[role=row]').count()) >= 2, 'parcours étape par étape');
  await page.getByRole('radio', { name: '7 j' }).click();
  await page.waitForTimeout(400);
  ok(
    state.calls.some(
      (c) =>
        c.path.endsWith('/workspace_analytics') &&
        Math.round((Date.parse(c.body.p_to) - Date.parse(c.body.p_from)) / 86400000) === 7,
    ),
    'changement de période (7 j)',
  );
  await page.getByRole('button', { name: /^Démo/ }).click();
  await page.getByRole('menuitem').nth(1).click();
  await page.waitForTimeout(400);
  ok(
    state.calls.some((c) => c.path.endsWith('/workspace_analytics') && c.body.p_demo),
    'filtre par démo',
  );
  await page.getByRole('tab', { name: 'Sessions' }).click();
  await page.waitForSelector('#an-panel-sessions table');
  ok(
    state.calls.some((c) => c.path.endsWith('/workspace_sessions')),
    'onglet Sessions',
  );
  await page.getByRole('tab', { name: /Leads/ }).click();
  await page.waitForSelector('#an-panel-leads');
  ok(true, 'onglet Leads');

  // Lecteur (viewer) : pas d'onglet Leads, pas d'email de lead dans les sessions (données personnelles)
  {
    const { seed } = require('./fake-supabase.cjs');
    const vs = seed();
    vs.tables.members[0].role = 'viewer';
    vs.role = 'viewer';
    const v = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await install(v, vs);
    await v.goto(`${APP}/#/analytics`);
    await v.waitForSelector('.kpi-tabs');
    ok((await v.locator('#an-tab-leads').count()) === 0, 'lecteur : pas d’onglet Leads');
    await v.getByRole('tab', { name: 'Sessions' }).click();
    await v.waitForSelector('#an-panel-sessions table');
    ok(
      !(await v.locator('#an-panel-sessions').textContent()).includes('@'),
      'lecteur : aucun email dans les sessions',
    );
    await v.close();
  }

  // ANA-10 : l'ancienne adresse #/leads ouvre Analytics sur l'onglet Leads
  await page.goto(`${APP}/#/leads`);
  await page.waitForURL(/analytics\?tab=leads/);
  await page.waitForSelector('#an-panel-leads >> text=prospect@globex.example');
  ok(
    (await page.locator('.fd-nav__item.active').textContent()).trim() === 'Leads',
    'ANA-10 : entrée « Leads » active, onglet Leads d’Analytics',
  );
  const [dl2] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter' }).click(),
  ]);
  const csv = require('fs').readFileSync(await dl2.path(), 'utf8');
  ok(csv.includes('prospect@globex.example') && csv.includes('Globex'), 'export CSV des leads');
  await page.getByRole('button', { name: 'Supprimer prospect@globex.example' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(500);
  ok(state.tables.leads.length === 0, 'suppression d’un lead (RGPD)');
  await page.waitForSelector('#an-panel-leads .empty');
  ok(
    /prospects/.test(await page.textContent('#an-panel-leads .empty')) &&
      (await page
        .locator('#an-panel-leads .empty a.btn-primary', { hasText: 'Ajouter un formulaire' })
        .count()) === 1,
    'ANA-09 : état vide avec « Ajouter un formulaire »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/leads.png` });
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
