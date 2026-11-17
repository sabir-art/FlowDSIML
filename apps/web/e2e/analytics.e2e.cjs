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
  await page.waitForSelector('.stat-tile');
  ok((await page.locator('.stat-value').first().textContent()) === '120', 'KPI vues');
  ok((await page.locator('.chart-col').count()) === 3, 'histogramme des vues par jour');
  ok((await page.locator('.funnel tbody tr').count()) >= 1, 'entonnoir par étape');
  ok(
    (await page.locator('.chart-col__v').first().textContent()) === '30',
    'valeur écrite au-dessus de chaque barre',
  );
  ok((await page.locator('.donut circle').count()) === 4, 'donut : piste + 3 origines');
  ok((await page.locator('.stat-tile.fd-card--hero').count()) === 1, 'une seule carte KPI héro');
  await page.getByRole('button', { name: 'Visiteurs', exact: true }).click();
  ok((await page.locator('.chart-col__v').first().textContent()) === '24', 'bascule Vues / Visiteurs');
  await page.waitForSelector('text=prospect@globex.example', { timeout: 3000 }).catch(() => null);
  ok((await page.locator('text=prospect@globex.example').count()) === 1, 'leads de la démo listés');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/analytics-demo.png`, fullPage: true });
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter en CSV' }).first().click(),
  ]);
  ok(dl.suggestedFilename().endsWith('.csv'), 'export CSV de l’entonnoir');

  // Analytics du workspace (ANA-01) : 5 KPI, période, filtre par démo, onglets
  await page.goto(`${APP}/#/analytics`);
  await page.waitForSelector('.mk .kpis .kpi');
  ok((await page.locator('.kpis .kpi').count()) === 5, 'analytics du workspace : 5 KPI');
  ok((await page.locator('svg.chart').count()) === 1, 'courbe vues et complétions');
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
  await page.getByLabel('Démo', { exact: true }).selectOption({ index: 1 });
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
    await v.waitForSelector('.kpis');
    ok((await v.getByRole('tab', { name: /Leads/ }).count()) === 0, 'lecteur : pas d’onglet Leads');
    await v.getByRole('tab', { name: 'Sessions' }).click();
    await v.waitForSelector('#an-panel-sessions table');
    ok(
      !(await v.locator('#an-panel-sessions').textContent()).includes('@'),
      'lecteur : aucun email dans les sessions',
    );
    await v.close();
  }

  await page.goto(`${APP}/#/leads`);
  await page.waitForSelector('text=prospect@globex.example');
  const [dl2] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter en CSV' }).click(),
  ]);
  const csv = require('fs').readFileSync(await dl2.path(), 'utf8');
  ok(csv.includes('prospect@globex.example') && csv.includes('Globex'), 'export CSV des leads');
  await page.getByRole('button', { name: 'Supprimer prospect@globex.example' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(500);
  ok(state.tables.leads.length === 0, 'suppression d’un lead (RGPD)');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/leads.png` });
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
