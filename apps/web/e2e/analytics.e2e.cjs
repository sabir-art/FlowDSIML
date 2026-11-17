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
  ok((await page.locator('.chart-bar').count()) === 3, 'histogramme des vues par jour');
  ok((await page.locator('.funnel tbody tr').count()) >= 1, 'entonnoir par étape');
  await page.waitForSelector('text=prospect@globex.example', { timeout: 3000 }).catch(() => null);
  ok((await page.locator('text=prospect@globex.example').count()) === 1, 'leads de la démo listés');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/analytics-demo.png`, fullPage: true });
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter en CSV' }).first().click(),
  ]);
  ok(dl.suggestedFilename().endsWith('.csv'), 'export CSV de l’entonnoir');

  await page.goto(`${APP}/#/analytics`);
  await page.waitForSelector('.fd-table tbody tr');
  ok((await page.locator('.fd-table tbody tr').count()) === 2, 'analytics du workspace : une ligne par démo');
  await page.getByRole('button', { name: '7 jours' }).click();
  await page.waitForTimeout(300);
  ok(
    state.calls.some((c) => c.path.endsWith('/workspace_overview') && c.body.p_days === 7),
    'changement de période',
  );

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
