/**
 * Test e2e L30-07 : « Décrire le graphique » (graphique d'une capture HTML, jeu de données relié, aperçu,
 * Appliquer). Données fictives, aucun appel au fournisseur. Usage : SHOTS_DIR=… [THEME=dark] node e2e/graphique-ia.e2e.cjs
 * Page de capture reprise de editeur-donnees.e2e.cjs.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const S = ['0b5c1f0e-0000-4000-8000-0000000000e1', '0b5c1f0e-0000-4000-8000-0000000000e2'];
const page = (h1) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${h1}</title><style>
  body{margin:0;font:16px system-ui,sans-serif;color:#1c1917;background:#fafaf9}
  nav{display:flex;gap:18px;padding:14px 24px;background:#fff;border-bottom:1px solid #e7e5e4}
  main{padding:24px}.kpi{display:inline-block;margin:0 16px 16px 0;padding:16px 20px;border-radius:12px;background:#fff;border:1px solid #e7e5e4}
  .value{display:block;font-size:28px}
  .chart{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:16px 20px;width:420px}
  .chart h2{font-size:15px;margin:0 0 12px}.bars{display:flex;align-items:flex-end;gap:18px;height:150px}
  .bar-item{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px}
  .bar-item i{display:block;width:36px;border-radius:4px 4px 0 0}</style></head><body>
  <nav id="menu"><b>Acme Analytics</b><a href="https://app.acme.example/">Accueil</a><a href="https://app.acme.example/rapports">Rapports</a></nav>
  <main><h1>${h1}</h1>
  <div class="kpi"><span>Rapports publiés</span><b class="value">1 248</b></div><div class="kpi"><span>Vues cette semaine</span><b class="value">86</b></div><div class="kpi"><span>Nouveaux ce mois</span><b class="value">42</b></div>
  <section class="chart"><h2>Rapports par mois</h2><div class="bars">
    <div class="bar-item"><b>18</b><i style="height:54px;background:#2897D5"></i><span>juil.</span></div>
    <div class="bar-item"><b>22</b><i style="height:66px;background:#2897D5"></i><span>août</span></div>
    <div class="bar-item"><b>31</b><i style="height:93px;background:#2897D5"></i><span>sept.</span></div>
    <div class="bar-item"><b>40</b><i style="height:120px;background:#2897D5"></i><span>oct.</span></div>
  </div></section>
  <dl><dt>Équipe</dt><dd class="team">Antenne Nord</dd></dl>
  </main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const shot = async (name) => {
    for (const x of await p.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await p.waitForTimeout(400);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  state.htmlPages = {};
  const path = `${ws}/${DEMO}/${S[0]}.html`;
  state.htmlPages[path] = page('Tableau de bord');
  state.tables.steps.unshift({
    ...base,
    id: S[0],
    position: -1,
    kind: 'html',
    title: 'Tableau de bord',
    image_path: null,
    html_path: path,
    html_ops: [],
    html_meta: { title: 'Tableau de bord', url: 'https://app.acme.example/', viewport: { w: 1280, h: 720 } },
  });
  state.tables.steps.sort((a, b) => a.position - b.position);
  state.ai = {
    enabled: true,
    features: {
      write: true,
      translate: true,
      suggest: true,
      generate: true,
      dataset: true,
      chart: true,
      assistant: true,
    },
    used: 3,
    quota: 500,
    userToday: 0,
    userDailyRequests: 30,
    workspaceQuotaReached: false,
    userQuotaReached: false,
    renewsOn: '2026-12-01',
    canEdit: true,
    canManage: true,
  };
  state.aiReply = () => ({
    type: 'bar',
    title: 'Jeunes suivis par structure',
    labelColumn: 'structure',
    valueColumn: 'suivis',
    aggregate: 'sum',
  });
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const frame = p.frameLocator('.html-stage iframe');
  await frame.locator('h1').waitFor();
  await p.waitForTimeout(500);
  const op = () => state.tables.steps.find((s) => s.id === S[0]).html_ops.find((o) => o.op === 'chart');

  // Sans jeu de données relié
  await frame.getByText('août').click();
  await p.waitForTimeout(400);
  const panel = p.locator('.ch-fields');
  await panel.getByRole('button', { name: 'Décrire le graphique' }).click();
  ok(
    (await panel.getByText('Reliez d’abord un jeu de données, ou générez-en un.').count()) === 1,
    'Sans jeu de données : message et lien',
  );
  await panel.getByRole('button', { name: 'Fermer' }).click();

  // Avec un jeu de données fictif relié
  (state.tables.demo_datasets ||= []).push({
    id: 'ds1',
    demo_id: DEMO,
    workspace_id: ws,
    name: 'Données fictives',
    columns: ['structure', 'mois', 'suivis'],
    rows: [
      ['Nord', 'sept.', '12'],
      ['Nord', 'oct.', '18'],
      ['Sud', 'sept.', '9'],
      ['Sud', 'oct.', '11'],
      ['Est', 'oct.', '7'],
    ],
    bindings: [],
    row_mode: 'first',
    link_column: null,
  });
  await p.reload();
  await frame.locator('h1').waitFor();
  await p.waitForTimeout(500);
  await frame.getByText('août').click();
  await p.waitForTimeout(400);
  await panel.getByRole('button', { name: 'Décrire le graphique' }).click();
  await panel.getByLabel('Que doit montrer le graphique\u202f?').fill('Jeunes suivis par structure');
  await panel.getByRole('button', { name: 'Proposer le graphique' }).click();
  await panel.getByRole('button', { name: 'Appliquer' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'chart' && call.input.columns.join() === 'structure,mois,suivis',
    'Demande : colonnes du jeu de données',
  );
  ok(call.input.sample.length <= 5, 'Échantillon de 5 lignes au plus');
  ok(
    /Barres · libellés\s?: structure · valeurs\s?: suivis/.test(
      await panel.locator('.ai-chart').textContent(),
    ),
    'Aperçu : type et colonnes',
  );
  ok(
    (await panel.locator('.ai-chart-row').count()) === 3,
    'Aperçu : 3 structures (somme calculée localement)',
  );
  ok((await panel.getByText('Généré par IA, à vérifier').count()) === 1, 'Mention de la règle 2');
  ok(!op(), 'Rien n’est appliqué avant « Appliquer »');
  await shot('l30-07-apercu');
  await panel.getByRole('button', { name: 'Appliquer' }).click();
  await p.waitForTimeout(1200);
  const v = op()?.value;
  ok(
    v?.type === 'bar' && v.rows.map((r) => `${r.label}:${r.value}`).join('|') === 'Nord:30|Sud:20|Est:7',
    `Graphique appliqué (${v && v.rows.map((r) => r.value)})`,
  );
  ok(v?.title === 'Jeunes suivis par structure', 'Titre proposé');
  const vals = await panel
    .getByRole('textbox', { name: /^Valeur, ligne/ })
    .evaluateAll((e) => e.map((x) => x.value));
  ok(vals.join('|') === '30|20|7', 'Réglages du graphique modifiables après');
  ok(
    (await frame.locator('[data-fd-chart]').getAttribute('role')) === 'img',
    'Graphique redessiné avec description',
  );

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
