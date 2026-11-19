/**
 * Test e2e L25-04/05 : animations de l'étape (saisie, défilement) dans l'éditeur et le lecteur.
 * Données fictives (.example). Usage : SHOTS_DIR=… [THEME=dark] node e2e/capture-animations.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const N = ' ';
const W = 1100;
const VH = 750;
const TOP = 600;

// Page fictive haute (2 200 px) : liste des rapports, puis le formulaire « Nouveau rapport » plus bas
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:${W}px;font:15px/1.4 system-ui,sans-serif;color:#1c1917;background:#f5f5f4}
header{height:72px;display:flex;align-items:center;padding:0 32px;background:#1f2a44;color:#fff;font-weight:700;font-size:18px}
main{padding:24px 32px}.row{height:64px;display:flex;align-items:center;padding:0 16px;margin-bottom:12px;border-radius:10px;background:#fff;border:1px solid #e7e5e4}
form{margin-top:40px;padding:24px;border-radius:14px;background:#fff;border:1px solid #e7e5e4}label{display:block;font-weight:600;margin-bottom:6px}
#nom{width:420px;height:44px;border:1px solid #a8a29e;border-radius:8px;padding:0 12px;font:inherit}
#ok{margin-top:16px;border:0;border-radius:10px;padding:12px 18px;background:#4f46e5;color:#fff;font:600 15px system-ui}
</style></head><body><header>Acme Analytics · Rapports</header><main>
${Array.from({ length: 9 }, (_, i) => `<div class="row">Rapport ${i + 1} · Équipe ${['Nord', 'Sud', 'Est'][i % 3]}</div>`).join('')}
<form><h2>Nouveau rapport</h2><label for="nom">Nom du rapport</label><input id="nom"><br><button id="ok" type="button">Créer le rapport</button></form>
<div style="height:1000px"></div></main></body></html>`;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  // Captures générées : page entière, viewport au défilement de 600 px, boîtes du champ et du bouton
  const gen = await (await b.newContext({ viewport: { width: W, height: VH } })).newPage();
  await gen.setContent(PAGE);
  const full = await gen.screenshot({ fullPage: true });
  const fullH = await gen.evaluate(() => document.documentElement.scrollHeight);
  await gen.evaluate((y) => scrollTo(0, y), TOP);
  const view = await gen.screenshot();
  const box = async (sel) => {
    const r = await gen.locator(sel).boundingBox();
    return { left: r.x, top: r.y, width: r.width, height: r.height };
  };
  const nom = await box('#nom');
  const okBtn = await box('#ok');
  await gen.context().close();
  const rel = (r) => ({ x: r.left / W, y: r.top / VH, w: r.width / W, h: r.height / VH });

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
  const ws = s1.workspace_id;
  Object.assign(s1, {
    title: 'Nommer le rapport',
    page_url: 'https://app.acme-analytics.example/reports',
    image_width: W,
    image_height: VH,
    element_meta: { tag: 'input', label: 'Nom du rapport', element: nom, viewport: { width: W, height: VH } },
    options: {
      fullPage: { path: `${ws}/${DEMO}/s1-page.png`, width: W, height: fullH, top: TOP, viewportHeight: VH },
    },
  });
  state.tables.hotspots[0] = {
    ...state.tables.hotspots[0],
    ...rel(okBtn),
    title: 'Créez le rapport',
    body: 'Cliquez sur « Créer le rapport ».',
  };
  await install(page, state);
  await page.route(/\/storage\/v1\/object\/sign\/captures\/.*s1-page\.png/, (r) =>
    r.fulfill({ contentType: 'image/png', body: full }),
  );
  await page.route(/\/storage\/v1\/object\/sign\/captures\/.*s1\.png/, (r) =>
    r.fulfill({ contentType: 'image/png', body: view }),
  );
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  const sec = page.locator('.cap-anim');
  await sec.scrollIntoViewIfNeeded();
  const radio = (name) => sec.getByRole('radio', { name, exact: true });
  ok((await radio('Aucune').getAttribute('aria-checked')) === 'true', 'aucune animation par défaut');
  ok(!(await radio('Défilement').isDisabled()), 'défilement proposé (capture pleine page présente)');

  // ===== L25-04 : saisie =====
  await radio('Saisie').click();
  await page.waitForTimeout(500);
  ok(
    (await sec.textContent()).includes('Champ « Nom du rapport », repéré à la capture'),
    'champ repéré à la capture',
  );
  const typed = sec.getByLabel('Texte saisi');
  await typed.fill('lea.martin@acme.example');
  ok(
    (await sec.getByRole('alert').textContent()).includes('une adresse e-mail'),
    'donnée personnelle signalée dans le texte saisi',
  );
  await typed.fill('Rapport mensuel de {{company}}');
  ok((await sec.getByRole('alert').count()) === 0, 'variable : pas d’alerte');
  await radio('Lente').click();
  await page.waitForTimeout(700);
  const a1 = s1.options.animation;
  ok(
    a1?.type === 'typing' &&
      a1.text === 'Rapport mensuel de {{company}}' &&
      a1.speed === 'slow' &&
      a1.fieldLabel === 'Nom du rapport',
    'saisie enregistrée (texte, vitesse, champ)',
  );
  ok(s1.options.fullPage?.path?.endsWith('s1-page.png'), 'la capture pleine page est conservée');
  ok(
    (await page.locator('.cap-field-mark .cap-chip').textContent()).startsWith('Saisie animée'),
    'canevas : repère du champ',
  );
  await sec.getByRole('button', { name: 'Prévisualiser l’animation' }).click();
  await page.waitForSelector('.cap-field-mark.is-playing');
  ok(true, 'aperçu de la saisie sur le canevas');
  await page.waitForSelector('.cap-field-mark:not(.is-playing)', { timeout: 6000 });
  await shot(page, 'l25-04-saisie');
  // Choisir un autre champ : clic sur le canevas
  await sec.getByRole('button', { name: 'Choisir un autre champ' }).click();
  const fr = await page.locator('.canvas-frame').boundingBox();
  await page.mouse.click(fr.x + fr.width * 0.5, fr.y + fr.height * 0.3);
  await page.waitForTimeout(600);
  ok(
    s1.options.animation.field.x !== a1.field.x &&
      (await sec.textContent()).includes('Champ choisi sur le canevas'),
    'autre champ choisi sur le canevas',
  );

  // ===== L25-05 : défilement =====
  await radio('Défilement').click();
  await page.waitForTimeout(600);
  const a2 = s1.options.animation;
  ok(
    a2?.type === 'scroll' && a2.direction === 'down' && a2.distance === TOP && a2.duration === 1.2,
    `défilement par défaut : vers le bas, ${TOP} px, 1,2 s`,
  );
  ok(
    (await page.locator('.cap-scroll-mark .cap-chip').textContent()) === `Défilement · ${TOP}${N}px`,
    'canevas : flèche et distance',
  );
  ok(
    (await sec.getByLabel('Distance (px)').inputValue()) === String(TOP),
    'distance calculée depuis la page entière',
  );
  await sec.getByRole('radio', { name: '2 s', exact: true }).click();
  await page.waitForTimeout(500);
  await sec.getByRole('button', { name: 'Prévisualiser l’animation' }).click();
  await page.waitForSelector('.cap-scroll img');
  ok(true, 'aperçu du défilement sur le canevas');
  await page.waitForSelector('.cap-scroll', { state: 'detached', timeout: 6000 });
  await shot(page, 'l25-05-defilement');

  // Étape sans capture pleine page : défilement désactivé
  await page.locator('[data-step-index="1"]').click();
  await page.locator('.cap-anim').scrollIntoViewIfNeeded();
  ok(
    (await page.locator('.cap-anim').getByRole('radio', { name: 'Défilement' }).isDisabled()) &&
      (await page.locator('#cap-anim-recap').textContent()) ===
        'Recapturez l’étape pour animer le défilement.',
    'sans capture pleine page : défilement désactivé, avec l’aide',
  );

  // ===== Lecteur =====
  const manifest = (anim, reduced) => ({
    schemaVersion: 1,
    demoId: DEMO,
    versionId: `0b5c1f0e-0000-4000-8000-0000000025b${reduced ? 2 : 1}`,
    workspaceId: 'w',
    workspaceName: 'Acme',
    title: 'Créer un rapport',
    locale: 'fr',
    publishedAt: '2026-11-19T10:00:00Z',
    theme: {},
    variables: [{ key: 'company', label: 'Entreprise', default: 'Acme' }],
    steps: [
      {
        id: 'p1',
        kind: 'image',
        title: 'Nommer le rapport',
        image: { url: 'assets/view.png', width: W, height: VH },
        options: {
          animation: anim,
          fullPage: { url: 'assets/page.png', width: W, height: fullH, top: TOP, viewportHeight: VH },
        },
        hotspots: [
          {
            id: 'h1',
            ...rel(okBtn),
            title: 'Créez le rapport',
            body: 'Cliquez sur « Créer le rapport ».',
            placement: 'auto',
            action: { type: 'next' },
          },
        ],
      },
      { id: 'p2', kind: 'text', title: 'Fin', body: 'Le rapport est créé.' },
    ],
  });
  const open = async (anim, reduced = false) => {
    const pp = await (
      await themedContext(b, {
        viewport: { width: 1280, height: 860 },
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      })
    ).newPage();
    pp.on('pageerror', (e) => errors.push(e.message));
    await pp.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest: manifest(anim, reduced) }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await pp.route('**/assets/*.png', (r) =>
      r.fulfill({ contentType: 'image/png', body: r.request().url().includes('page') ? full : view }),
    );
    await pp.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    await pp.goto(`${PLAYER}/#/d/${DEMO}`);
    await pp.waitForSelector('.p-stage');
    return pp;
  };
  const typing = {
    type: 'typing',
    text: 'Rapport mensuel de {{company}}',
    field: rel(nom),
    fieldLabel: 'Nom du rapport',
    speed: 'normal',
  };
  {
    const pp = await open(typing);
    await pp.waitForSelector('.p-type.is-typing');
    ok((await pp.locator('.p-beacon').count()) === 0, 'lecteur : la bulle attend la fin de la saisie');
    ok(
      (await pp.locator('.p-stage .sr-only').textContent()) === 'Rapport mensuel de Acme',
      'lecteur : texte final pour les lecteurs d’écran (variable remplacée)',
    );
    await pp.waitForSelector('.p-beacon', { timeout: 6000 });
    ok(
      (await pp.locator('.p-type').textContent()) === 'Rapport mensuel de Acme',
      'lecteur : texte saisi en entier, puis la bulle',
    );
    await shot(pp, 'l25-04-lecteur');
    await pp.context().close();
  }
  {
    const pp = await open(typing, true);
    ok(
      (await pp.locator('.p-beacon').count()) === 1 &&
        (await pp.locator('.p-type').textContent()) === 'Rapport mensuel de Acme',
      'animations réduites : texte final et bulle tout de suite',
    );
    await pp.context().close();
  }
  {
    const pp = await open({ type: 'scroll', direction: 'down', distance: TOP, duration: 0.6 });
    await pp.waitForSelector('.p-scroll img');
    ok((await pp.locator('.p-beacon').count()) === 0, 'lecteur : la page défile avant la bulle');
    await pp.waitForSelector('.p-beacon', { timeout: 5000 });
    ok(
      (await pp.locator('.p-scroll').count()) === 0,
      'lecteur : arrivée sur la capture de l’étape, puis la bulle',
    );
    await pp.context().close();
  }
  {
    const pp = await open({ type: 'scroll', direction: 'down', distance: TOP, duration: 2 }, true);
    ok(
      (await pp.locator('.p-scroll').count()) === 0 && (await pp.locator('.p-beacon').count()) === 1,
      'animations réduites : saut direct à l’arrivée',
    );
    await pp.context().close();
  }
  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
