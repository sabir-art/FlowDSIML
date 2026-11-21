/**
 * Test e2e L25-03 : cadre du navigateur (onglet Design, canevas, lecteur). Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/capture-cadre.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const shot = async (p, name) => {
    for (const x of await p.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await p.waitForTimeout(400);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  const demo = state.tables.demos.find((d) => d.id === DEMO);
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');

  // Par défaut : clair, barre d'adresse avec l'adresse de la capture (non publiée, en gris)
  ok((await page.locator('.browser--light').count()) === 1, 'cadre clair par défaut');
  ok(
    (await page.locator('.browser .url.is-capture').textContent()) === 'app.example.com/',
    'adresse de la capture en gris (montrée seulement dans l’éditeur)',
  );
  await openTool(page, 'design');
  const sec = page.locator('.fr-fields');
  await sec.scrollIntoViewIfNeeded();
  ok(
    (await sec.getByRole('radio').allTextContents()).join('|') === 'Clair|Sombre|Minimal|Aucun',
    'style : Clair, Sombre, Minimal, Aucun',
  );
  await sec.getByRole('radio', { name: 'Sombre' }).click();
  await sec.getByLabel('Adresse affichée').fill('app.acme.example/opportunites');
  await sec.getByRole('checkbox', { name: 'Onglets' }).check();
  await sec.getByLabel('Titre de l’onglet').fill('Opportunités · Acme');
  await page.waitForTimeout(800);
  ok((await page.locator('.browser--dark.has-tabs').count()) === 1, 'canevas : cadre sombre avec onglet');
  ok(
    (await page.locator('.browser-tab.is-active').textContent()) === 'Opportunités · Acme' &&
      (await page.locator('.browser-row--url .url:not(.is-capture)').textContent()) ===
        'app.acme.example/opportunites',
    'canevas : titre de l’onglet et adresse saisie',
  );
  const fr = demo.settings.theme.frame;
  ok(
    fr.style === 'dark' &&
      fr.address === 'app.acme.example/opportunites' &&
      fr.tabs === true &&
      fr.windowButtons === true,
    'réglages enregistrés dans le thème de la démo',
  );
  ok(
    (await page.locator('#fr-address-h').textContent()).includes('Seule une adresse saisie ici est publiée'),
    'aide : l’adresse de la capture n’est pas publiée',
  );
  await shot(page, 'l25-03-cadre');
  await sec.getByRole('checkbox', { name: 'Boutons de fenêtre' }).uncheck();
  await page.waitForTimeout(400);
  ok((await page.locator('.browser i').count()) === 0, 'boutons de fenêtre masqués');
  await sec.getByRole('radio', { name: 'Minimal' }).click();
  await page.waitForTimeout(400);
  ok(
    (await page.locator('.browser--minimal').count()) === 1 &&
      (await page.locator('.browser-tab').count()) === 0,
    'minimal : adresse seule',
  );
  await sec.getByRole('radio', { name: 'Aucun' }).click();
  await page.waitForTimeout(400);
  ok((await page.locator('.browser').count()) === 0, 'aucun cadre');
  ok(await sec.getByLabel('Adresse affichée').isDisabled(), 'aucun cadre : réglages inactifs');

  // Démo mobile : « Cadre du téléphone »
  demo.device = 'mobile';
  await page.reload();
  await page.waitForSelector('.canvas-frame img');
  await openTool(page, 'design');
  ok(
    (
      await page.getByRole('radiogroup', { name: 'Cadre du téléphone' }).getByRole('radio').allTextContents()
    ).join('|') === 'Afficher|Masquer',
    'démo mobile : « Cadre du téléphone »',
  );
  demo.device = 'desktop';

  // ===== Lecteur =====
  const manifest = (frame, device = 'desktop') => ({
    schemaVersion: 1,
    demoId: DEMO,
    versionId: '0b5c1f0e-0000-4000-8000-0000000025d1',
    workspaceId: 'w',
    workspaceName: 'Acme',
    title: 'Créer une opportunité',
    locale: 'fr',
    publishedAt: '2026-11-19T10:00:00Z',
    device,
    viewport: device === 'mobile' ? { w: 390, h: 844 } : null,
    theme: frame ? { frame } : {},
    steps: [
      {
        id: 'p1',
        kind: 'image',
        title: 'Opportunités',
        image: { url: 'assets/a.png', width: 1100, height: 750 },
        hotspots: [
          {
            id: 'h1',
            x: 0.243,
            y: 0.352,
            w: 0.208,
            h: 0.07,
            title: 'Créez une opportunité',
            body: 'Cliquez sur « + Nouvelle opportunité ».',
            placement: 'auto',
            action: { type: 'next' },
          },
        ],
      },
    ],
  });
  const open = async (m) => {
    const pp = await (await themedContext(b, { viewport: { width: 1280, height: 860 } })).newPage();
    pp.on('pageerror', (e) => errors.push(e.message));
    await pp.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest: m }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await pp.route('**/assets/*.png', (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await pp.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    await pp.goto(`${PLAYER}/#/d/${DEMO}`);
    await pp.waitForSelector('.p-stage');
    return pp;
  };
  const dark = {
    style: 'dark',
    addressBar: true,
    address: 'app.acme.example/opportunites',
    tabs: true,
    tabTitle: 'Opportunités · Acme',
    windowButtons: true,
    phone: true,
  };
  {
    const pp = await open(manifest(dark));
    ok(
      (await pp.locator('.p-win--dark .p-tab.is-active').textContent()) === 'Opportunités · Acme' &&
        (await pp.locator('.p-addr').textContent()) === 'app.acme.example/opportunites',
      'lecteur : cadre sombre, onglet et adresse saisie',
    );
    ok(
      (await pp.locator('.p-addr a, .p-chrome a').count()) === 0,
      'lecteur : l’adresse n’est jamais un lien',
    );
    const win = await pp.locator('.p-win').boundingBox();
    const st = await pp.locator('.p-win > .p-stage').boundingBox();
    ok(Math.abs(win.width - st.width) < 1 && st.y >= win.y + 60, 'lecteur : barres au-dessus de la capture');
    await shot(pp, 'l25-03-lecteur');
    await pp.context().close();
  }
  {
    const pp = await open(manifest({ ...dark, style: 'light', tabs: false, address: '' }));
    ok(
      (await pp.locator('.p-win--light .p-tabs--addr').count()) === 1 &&
        (await pp.locator('.p-addr').textContent()) === '',
      'lecteur : sans adresse saisie, aucune adresse publiée',
    );
    await pp.context().close();
  }
  {
    const pp = await open(manifest({ ...dark, style: 'none' }));
    ok((await pp.locator('.p-win').count()) === 0, 'lecteur : aucun cadre');
    await pp.context().close();
  }
  {
    const pp = await open(manifest(null));
    ok((await pp.locator('.p-win').count()) === 0, 'manifeste d’avant L25 : pas de cadre');
    await pp.context().close();
  }
  {
    const pp = await open(manifest({ ...dark, phone: false }, 'mobile'));
    ok((await pp.locator('.p-root.is-framed').count()) === 0, 'démo mobile : cadre du téléphone masqué');
    await pp.context().close();
  }
  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
