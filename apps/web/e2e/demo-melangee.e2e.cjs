/**
 * EXT-02 §8 « Mélange » : une démo de captures qui contient une étape HTML (ajoutée par « Capturer de
 * nouvelles étapes ») s'édite et se lit : l'éditeur ouvre chaque étape selon son type, et le lecteur rejoue
 * chaque étape selon son type (capture, page HTML en iframe sandbox, capture). La publication (manifeste,
 * page HTML copiée) est vérifiée sur la vraie fonction par supabase/tests/publication_melangee.test.sql.
 * Faux Supabase pour l'éditeur, manifeste fictif pour le lecteur.
 * Usage : app web et lecteur lancés (APP_URL, PLAYER_URL) ; node e2e/demo-melangee.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const HTML_STEP = '0b5c1f0e-0000-4000-8000-0000000000f1';

const htmlPage = `<!doctype html><html><head><meta charset="utf-8"><title>Rapports</title><style>
  body{margin:0;font:16px system-ui,sans-serif;color:#1c1917;background:#fafaf9}main{padding:24px}</style></head>
  <body><main><h1>Rapports</h1><p class="resp">Camille Fictive</p><a id="suite" href="https://app.acme.example/suite">Suite</a></main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR' });
  const state = seed();
  const errors = [];
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  // Démo de captures : Écran 1, [étape HTML], Écran 2, Merci !
  const steps = state.tables.steps.filter((s) => s.demo_id === DEMO).sort((a, b) => a.position - b.position);
  const ws = state.tables.workspaces[0].id;
  const path = `${ws}/${DEMO}/${HTML_STEP}.html`;
  state.htmlPages = { [path]: htmlPage };
  for (const s of steps.slice(1)) s.position += 1;
  state.tables.steps.push({
    ...steps[0],
    id: HTML_STEP,
    position: 1,
    kind: 'html',
    title: 'Rapports',
    image_path: null,
    blurs: [],
    html_path: path,
    html_ops: [],
    html_meta: { title: 'Rapports', url: 'https://app.acme.example/rapports', viewport: { w: 1280, h: 720 } },
  });
  state.tables.steps.sort((a, b) => a.position - b.position);

  const app = await ctx.newPage();
  app.on('pageerror', (e) => {
    // Script du harnais injecté aussi dans la page sandbox : sans objet
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(`app: ${e.message}`);
  });
  await install(app, state);
  await app.goto(`${APP}/#/demos/${DEMO}/edit`);
  await app.locator('.rail-list .step').first().waitFor();
  const titles = await app.locator('.rail-list .step .meta b').allInnerTexts();
  ok(
    titles.join(' | ') === 'Écran 1 | Rapports | Écran 2 | Merci !',
    `éditeur : captures et étape HTML dans la même démo (${titles.join(' | ')})`,
  );
  // L'étape HTML s'ouvre dans l'éditeur (page en iframe sandbox), les captures gardent leur canevas
  await app.locator('.rail-list .step').nth(1).click();
  await app.frameLocator('.html-stage iframe').locator('h1').waitFor();
  ok(
    (await app.locator('.html-stage iframe').getAttribute('sandbox')) === 'allow-scripts',
    'éditeur : étape HTML rendue en iframe sandbox',
  );
  await app.locator('.rail-list .step').nth(0).click();
  await app.waitForSelector('.canvas-frame img');
  ok(true, 'éditeur : retour à une étape capture, canevas image');

  // ===== Lecteur : manifeste publié d'une démo mélangée (capture, page HTML, capture) =====
  // La publication elle-même (chaque étape garde son type, page HTML copiée) est vérifiée sur la vraie
  // fonction publish_demo par supabase/tests/publication_melangee.test.sql.
  const base = require('./player-ux.manifest.cjs');
  const [first, last] = base.steps;
  const manifest = {
    ...base,
    steps: [
      { ...first, zoom: null },
      {
        id: HTML_STEP,
        kind: 'html',
        title: 'Rapports',
        hotspots: [],
        blurs: [],
        html: {
          url: 'assets/rapports.html',
          title: 'Rapports',
          viewport: { w: 1280, h: 720 },
          ops: [],
          links: [],
        },
      },
      { ...last, zoom: null, image: { ...last.image, url: 'assets/b.webp' } },
    ],
  };
  const png = require('fs').readFileSync(require('path').join(__dirname, 'fixture.png'));
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  const player = await ctx.newPage();
  player.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(`player: ${e.message}`);
  });
  await player.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ status: 'ok', manifest }),
    }),
  );
  await player.route('**/assets/*.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
  await player.route('**/assets/*.html', (r) =>
    r.fulfill({ contentType: 'text/html', headers: cors, body: htmlPage }),
  );
  await player.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
  await player.goto(`${PLAYER}/#/d/${manifest.demoId}`);
  await player.waitForSelector('.p-stage .p-img');
  ok((await player.locator('.p-html-frame').count()) === 0, 'lecteur, étape 1 : capture d’écran');
  const next = async () => {
    const btn = player.getByRole('button', { name: /^(Suivant|Continuer)$/ }).last();
    if (await btn.count()) await btn.click();
    else await player.keyboard.press('ArrowRight');
  };
  await next();
  await player.frameLocator('.p-html-frame iframe').locator('h1').waitFor({ timeout: 15000 });
  ok(
    (await player.frameLocator('.p-html-frame iframe').locator('h1').innerText()) === 'Rapports' &&
      (await player.locator('.p-html-frame iframe').getAttribute('sandbox')) !== null,
    'lecteur, étape 2 : page HTML rejouée en iframe sandbox',
  );
  ok((await player.locator('.p-stage .p-img').count()) === 0, 'lecteur, étape 2 : plus de capture à l’écran');
  await next();
  await player.waitForSelector('.p-stage .p-img', { timeout: 15000 });
  ok(
    (await player.locator('.p-html-frame').count()) === 0 &&
      (await player.locator('.p-stage .p-img').getAttribute('src')).includes('b.webp'),
    'lecteur, étape 3 : retour à une capture d’écran',
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
