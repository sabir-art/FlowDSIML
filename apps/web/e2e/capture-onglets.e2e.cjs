/**
 * Test e2e L25-06 : étape capturée dans un autre onglet (éditeur : barre du navigateur, panneau,
 * liste des étapes ; lecteur : barre d'onglets et annonce). Données fictives (.example).
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/capture-onglets.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const { pick, optionsOf } = require('./_select.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const N = ' ';

// Captures fictives générées (1100 × 750) : la liste des rapports, puis l'aide ouverte dans un 2e onglet
const css = `*{box-sizing:border-box}body{margin:0;width:1100px;height:750px;font:14px/1.4 system-ui,sans-serif;color:#1c1917;background:#f5f5f4}
  header{height:72px;display:flex;align-items:center;gap:18px;padding:0 32px;background:#1f2a44;color:#fff}
  header b{font-size:18px}nav{display:flex;gap:16px;opacity:.9}main{padding:28px 32px}h1{margin:0 0 18px;font-size:24px}
  .row{display:flex;gap:12px;padding:14px 16px;margin-bottom:10px;border-radius:10px;background:#fff;border:1px solid #e7e5e4}
  .row span{margin-left:auto;color:#57534e}button{border:0;border-radius:10px;padding:10px 16px;font:600 14px system-ui;background:#4f46e5;color:#fff}`;
const RAPPORTS = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<header><b>Acme Analytics</b><nav><span>Tableau de bord</span><span>Rapports</span></nav></header>
<main><h1>Rapports</h1><div class="row">Rapport mensuel d’octobre<span>Équipe Nord</span></div>
<div class="row">Activité des structures<span>Équipe Sud</span></div><div class="row">Rendez-vous de la semaine<span>Équipe Est</span></div>
<button>? Aide</button></main></body></html>`;
const AIDE = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<header style="background:#0f5132"><b>Centre d’aide</b><nav><span>Articles</span><span>Contact</span></nav></header>
<main><h1>Créer un rapport</h1><p>Un rapport regroupe les indicateurs d’une période.</p>
<div class="row">1. Ouvrez « Rapports »</div><div class="row">2. Cliquez sur « Nouveau rapport »</div>
<button>Lire l’article</button></main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const gen = await (await b.newContext({ viewport: { width: 1100, height: 750 } })).newPage();
  // Boutons des captures, en coordonnées relatives (hotspots du lecteur posés dessus)
  const rel = async () => {
    const r = await gen.locator('button').boundingBox();
    return { x: r.x / 1100, y: r.y / 750, w: r.width / 1100, h: r.height / 750 };
  };
  await gen.setContent(RAPPORTS);
  const pngRapports = await gen.screenshot();
  const btnAide = await rel();
  await gen.setContent(AIDE);
  const pngAide = await gen.screenshot();
  const btnArticle = await rel();
  await gen.context().close();

  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const settle = (p) =>
    p.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
  const shot = async (p, name) => {
    for (const x of await p.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await settle(p);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };

  const state = seed();
  const [s1, s2] = state.tables.steps;
  Object.assign(s1, {
    title: 'Ouvrir les rapports',
    page_url: 'https://app.acme-analytics.example/reports',
    options: { tab: { n: 1, title: 'Rapports · Acme Analytics' } },
  });
  Object.assign(s2, {
    title: 'Lire l’aide',
    blurs: [],
    page_url: 'https://aide.acme-analytics.example/rapports',
    options: { tab: { n: 2, title: 'Aide · Acme Analytics' } },
  });
  await install(page, state);
  // Captures servies selon l'étape (les autres restent la capture fictive par défaut)
  await page.route(/\/storage\/v1\/object\/sign\/captures\/.*s2\.png/, (r) =>
    r.fulfill({ contentType: 'image/png', body: pngAide }),
  );
  await page.route(/\/storage\/v1\/object\/sign\/captures\/.*s1\.png/, (r) =>
    r.fulfill({ contentType: 'image/png', body: pngRapports }),
  );
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // Étape 1 : onglet 1 seul
  ok((await page.locator('.browser-tab').count()) === 1, 'étape 1 : un onglet dans la barre');
  ok((await page.locator('[data-step-index="0"] .rail-tab').count()) === 0, 'étape 1 : pas de puce');
  ok(
    (await page.locator('[data-step-index="1"] .rail-tab').textContent()) === 'Onglet 2',
    'liste des étapes : puce « Onglet 2 » sur l’étape qui change d’onglet',
  );

  // Étape 2 : deux onglets, celui de l'étape actif ; panneau « Onglet de la capture »
  await page.locator('[data-step-index="1"]').click();
  await page.waitForSelector('.browser.has-tabs');
  const tabs = await page.locator('.browser-tab').allTextContents();
  ok(tabs.join('|') === 'Rapports · Acme Analytics|Aide · Acme Analytics', `onglets : ${tabs.join(' | ')}`);
  ok(
    (await page.locator('.browser-tab.is-active').textContent()) === 'Aide · Acme Analytics',
    'onglet de l’étape actif',
  );
  ok(
    (await page.locator('.browser-row--url .url').textContent()) === 'aide.acme-analytics.example/rapports',
    'adresse de la capture sous les onglets',
  );
  // L48-E : l'onglet de la capture est dans l'outil « Image » du rail
  await openTool(page, 'image');
  const sel = page.getByLabel('Onglet', { exact: true });
  ok(
    (await optionsOf(sel)).join('|') ===
      'Onglet 2 · Aide · Acme Analytics|Onglet 1 · Rapports · Acme Analytics',
    'select des onglets (celui de l’étape en premier)',
  );
  ok(
    (await page.locator('#cap-tab-h').textContent()) ===
      `Capturée dans un deuxième onglet${N}: la barre du navigateur montre le passage d’un onglet à l’autre.`,
    'aide de l’onglet 2',
  );
  const sw = page.getByRole('checkbox', { name: 'Afficher les onglets dans le cadre' });
  ok(await sw.isChecked(), 'onglets affichés par défaut');
  await page.locator('.cap-tab').scrollIntoViewIfNeeded();
  await shot(page, 'l25-06-onglets');

  await sw.uncheck();
  await page.waitForTimeout(700);
  ok(
    (await page.locator('.browser-tab').count()) === 0 && s2.options.showTabs === false,
    'onglets masqués (options.showTabs enregistré)',
  );
  ok(s2.options.tab?.n === 2, 'l’onglet de l’étape est conservé');
  await sw.check();
  await page.waitForTimeout(500);
  await pick(sel, '1');
  await page.waitForTimeout(700);
  ok(
    s2.options.tab?.n === 1 && (await page.locator('[data-step-index="1"] .rail-tab').count()) === 0,
    'étape rattachée à l’onglet 1 : plus de puce',
  );
  await pick(sel, '2');
  await page.waitForTimeout(500);

  // ===== Lecteur : barre d'onglets, passage animé et annonce =====
  const manifest = {
    schemaVersion: 1,
    demoId: DEMO,
    versionId: '0b5c1f0e-0000-4000-8000-0000000025a1',
    workspaceId: 'w',
    workspaceName: 'Acme',
    title: 'Créer un rapport',
    locale: 'fr',
    publishedAt: '2026-11-19T10:00:00Z',
    theme: {},
    steps: [
      {
        id: 'p1',
        kind: 'image',
        title: 'Ouvrir les rapports',
        image: { url: 'assets/rapports.png', width: 1100, height: 750 },
        options: { tab: { n: 1, title: 'Rapports · Acme Analytics' } },
        hotspots: [
          {
            id: 'h1',
            ...btnAide,
            title: 'Ouvrez l’aide',
            body: 'Elle s’ouvre dans un nouvel onglet.',
            placement: 'auto',
            action: { type: 'next' },
          },
        ],
      },
      {
        id: 'p2',
        kind: 'image',
        title: 'Lire l’aide',
        image: { url: 'assets/aide.png', width: 1100, height: 750 },
        options: { tab: { n: 2, title: 'Aide · Acme Analytics' } },
        hotspots: [
          {
            id: 'h2',
            ...btnArticle,
            title: 'Lisez l’article',
            body: 'Il détaille chaque étape.',
            placement: 'auto',
            action: { type: 'next' },
          },
        ],
      },
      { id: 'p3', kind: 'text', title: 'Fin', body: 'Vous savez où trouver l’aide.' },
    ],
  };
  const pp = await (await themedContext(b, { viewport: { width: 1280, height: 860 } })).newPage();
  pp.on('pageerror', (e) => errors.push(e.message));
  await pp.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', manifest }),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    }),
  );
  await pp.route('**/assets/*.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: r.request().url().includes('aide') ? pngAide : pngRapports }),
  );
  await pp.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
  await pp.goto(`${PLAYER}/#/d/${DEMO}`);
  await pp.waitForSelector('.p-win');
  ok((await pp.locator('.p-tab').count()) === 1, 'lecteur : un onglet à l’étape 1');
  await pp
    .locator('.p-tip')
    .getByRole('button', { name: /Suivant/ })
    .click();
  await pp.waitForSelector('.p-win.is-switch');
  ok(
    (await pp.locator('.p-tab').allTextContents()).join('|') ===
      'Rapports · Acme Analytics|Aide · Acme Analytics' &&
      (await pp.locator('.p-tab.is-active').textContent()) === 'Aide · Acme Analytics',
    'lecteur : deux onglets, celui de l’étape actif',
  );
  ok(
    (await pp.locator('.p-root > p[aria-live]').textContent()).startsWith(
      `Nouvel onglet${N}: Aide · Acme Analytics.`,
    ),
    'lecteur : annonce « Nouvel onglet »',
  );
  {
    const win = await pp.locator('.p-win').boundingBox();
    const st = await pp.locator('.p-win > .p-stage').boundingBox();
    ok(
      Math.abs(win.width - st.width) < 1 && st.y > win.y + 30,
      'lecteur : barre d’onglets au-dessus de la capture',
    );
  }
  await shot(pp, 'l25-06-lecteur');
  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
