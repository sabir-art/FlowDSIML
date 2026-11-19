/**
 * Test e2e L25-02 : recadrage non destructif d'une capture (éditeur et lecteur). Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/capture-recadrage.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const N = ' ';
const near = (a, b) => Math.abs(a - b) < 0.002;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (p, name) => {
    for (const x of await p.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await p.waitForTimeout(300);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };

  const state = seed();
  const [s1, s2] = state.tables.steps;
  s2.blurs = [];
  const h1 = { ...state.tables.hotspots[0] };
  // Un hotspot en haut à gauche de l'écran 2 (il sortira du cadre)
  state.tables.hotspots.push({
    ...h1,
    id: 'h2',
    step_id: 's2',
    x: 0.02,
    y: 0.03,
    w: 0.06,
    h: 0.05,
    title: 'Menu',
  });
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // ===== Ouverture : capture entière, voile, poignées, panneau =====
  await page.getByRole('button', { name: 'Recadrer la capture' }).click();
  await page.waitForSelector('.crop-frame');
  ok((await page.locator('.crop-h').count()) === 8, '8 poignées nommées');
  ok(
    (await page.locator('.crop-dims').textContent()) === `1${N}100 × 750`,
    'dimensions de la capture entière',
  );
  const panel = page.locator('.crop-panel');
  await panel.getByRole('radio', { name: '16:9' }).click();
  ok(
    (await page.locator('.crop-dims').textContent()) === `1${N}100 × 619 · 16:9`,
    `format 16:9 (${await page.locator('.crop-dims').textContent()})`,
  );
  const se = page.getByRole('button', { name: 'Poignée bas droite' });
  await se.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  ok(
    (await page.locator('.crop-dims').textContent()).startsWith(`1${N}090 × 613`),
    'clavier : Maj + flèche, 10 px (format gardé)',
  );
  await page.keyboard.press('ArrowUp');
  ok(
    (await page.locator('[aria-live="polite"]').filter({ hasText: 'Zone gardée' }).textContent()).includes(
      '×',
    ),
    'dimensions annoncées',
  );
  // Taille saisie, format libre
  await panel.getByRole('radio', { name: 'Libre' }).click();
  await panel.getByLabel('Largeur (px)').fill('880');
  await panel.getByLabel('Hauteur (px)').fill('495');
  ok((await page.locator('.crop-dims').textContent()) === '880 × 495 · 16:9', 'largeur et hauteur saisies');
  // Déplacer le cadre à la souris : il garde sa taille
  const box = await page.locator('.crop-box').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  ok((await page.locator('.crop-dims').textContent()) === '880 × 495 · 16:9', 'déplacement du cadre');
  await panel.getByRole('radio', { name: 'Toutes (2)' }).click();
  await panel.locator('.sec').scrollIntoViewIfNeeded();
  await shot(page, 'l25-02-recadrer');

  // ===== Recadrer : options.crop, hotspot qui suit, cadre recadré =====
  const before = { ...state.tables.hotspots.find((h) => h.id === 'h1') };
  await panel.getByRole('button', { name: 'Recadrer', exact: true }).click();
  await page.waitForTimeout(800);
  const c1 = s1.options?.crop;
  ok(!!c1 && near(c1.w, 0.8) && near(c1.h, 0.66), `zone gardée enregistrée (${JSON.stringify(c1)})`);
  ok(
    !!s2.options?.crop && near(s2.options.crop.x, c1.x),
    '« Toutes » : même zone sur l’écran 2 (même taille)',
  );
  ok(!!s1.image_path && s1.image_width === 1100, 'image d’origine conservée (non destructif)');
  const after = state.tables.hotspots.find((h) => h.id === 'h1');
  ok(
    near(after.x, (before.x - c1.x) / c1.w) && near(after.w, before.w / c1.w),
    'le hotspot suit le recadrage',
  );
  const fr = await page.locator('.canvas-frame').boundingBox();
  ok(Math.abs(fr.width / fr.height - 880 / 495) < 0.02, 'canevas au format recadré');
  ok(
    (await page.locator('[data-step-index="1"] [aria-label="Hotspot hors du cadre"]').count()) === 1,
    'liste des étapes : « Hotspot hors du cadre » sur l’écran 2',
  );
  await shot(page, 'l25-02-recadre');

  // ===== Réinitialiser : retour à la capture entière, hotspot à sa place =====
  await page.getByRole('button', { name: 'Recadrer la capture' }).click();
  await page.waitForSelector('.crop-frame');
  await panel.getByRole('button', { name: 'Réinitialiser' }).click();
  await panel.getByRole('button', { name: 'Recadrer', exact: true }).click();
  await page.waitForTimeout(800);
  const back = state.tables.hotspots.find((h) => h.id === 'h1');
  ok(
    !s1.options?.crop && near(back.x, before.x) && near(back.y, before.y),
    'réinitialisé : capture entière, hotspot revenu',
  );
  // Annuler ne change rien
  await page.getByRole('button', { name: 'Recadrer la capture' }).click();
  await panel.getByRole('radio', { name: '1:1' }).click();
  await panel.getByRole('button', { name: 'Annuler' }).click();
  ok(!s1.options?.crop && (await page.locator('.crop-frame').count()) === 0, 'annuler : rien ne change');

  // ===== Lecteur : capture recadrée =====
  const manifest = {
    schemaVersion: 1,
    demoId: DEMO,
    versionId: '0b5c1f0e-0000-4000-8000-0000000025c1',
    workspaceId: 'w',
    workspaceName: 'Acme',
    title: 'Créer une opportunité',
    locale: 'fr',
    publishedAt: '2026-11-19T10:00:00Z',
    theme: {},
    steps: [
      {
        id: 'p1',
        kind: 'image',
        title: 'Opportunités',
        image: { url: 'assets/a.png', width: 1100, height: 750 },
        options: { crop: c1 },
        hotspots: [{ ...after, id: 'h1', placement: 'auto', action: { type: 'next' } }],
      },
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
    r.fulfill({
      contentType: 'image/png',
      body: require('fs').readFileSync(require('path').join(__dirname, 'fixture.png')),
    }),
  );
  await pp.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
  await pp.goto(`${PLAYER}/#/d/${DEMO}`);
  await pp.waitForSelector('.p-beacon');
  const st = await pp.locator('.p-stage').boundingBox();
  ok(Math.abs(st.width / st.height - 880 / 495) < 0.02, 'lecteur : capture au format recadré');
  const img = await pp.locator('.p-img').boundingBox();
  ok(img.width > st.width * 1.2 && img.x < st.x, 'lecteur : image entière découpée par le cadre');
  await shot(pp, 'l25-02-lecteur');
  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
