/**
 * Test e2e L18-03 / 04 : médiathèque (vide, import par la fonction media, filtre, recherche, sélection,
 * « Utiliser ce fichier » pour le logo, usage et quota, suppression d'un fichier utilisé, SVG refusé,
 * accès depuis Paramètres › Marque). Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/media.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const N = ' ';
const nb = (x) => (x || '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const shot = async (name) => {
    await page.waitForTimeout(400);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
  const logo = path.join(dir, 'logo-acme.png');
  // L18-03 : vrai logo fictif (et non une capture du CRM)
  {
    const lp = await (await b.newContext({ viewport: { width: 240, height: 240 } })).newPage();
    await lp.setContent(
      '<body style="margin:0;display:grid;place-items:center;width:240px;height:240px;background:#fff;font:800 44px system-ui">' +
        '<div style="display:grid;place-items:center;gap:6px"><div style="width:96px;height:96px;border-radius:24px;background:#1f6f5c;display:grid;place-items:center;color:#fff;font-size:56px">A</div><span style="color:#1f6f5c">acme</span></div></body>',
    );
    await lp.screenshot({ path: logo });
    await lp.context().close();
  }
  const fond = path.join(dir, 'fond-accueil.png');
  fs.copyFileSync(path.join(__dirname, 'fixture.png'), fond);
  const svg = path.join(dir, 'pictogramme.svg');
  fs.writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  const state = seed();
  state.tables.media_files = [];
  state.mediaBaseUsed = 0;
  state.mediaFiles = { 'logo-acme.png': fs.readFileSync(logo), 'fond-accueil.png': fs.readFileSync(fond) };
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await openTool(page, 'design');
  // MEDIA-01 §18.3 : logo du panneau Design en forme étroite
  const block = page.locator('.logo-block');
  await block.scrollIntoViewIfNeeded();
  const demoRow = () => state.tables.demos.find((d) => d.id === DEMO);
  const pv = await block.locator('.logo-preview').boundingBox();
  ok(Math.round(pv.width) === 72 && Math.round(pv.height) === 72, 'logo : vignette carrée de 72 px');
  const imp = block.getByRole('button', { name: 'Importer…' });
  ok(
    Math.round((await imp.boundingBox()).height) === 32 &&
      /PNG, JPEG, WebP ou SVG, 2 Mo au plus\. Ou déposez le fichier sur ce bloc\./.test(
        await block.textContent(),
      ),
    'logo : « Importer… » de 32 px, formats et poids dans l’aide',
  );
  await block.locator('input[type=file]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('x'),
  });
  ok(
    (await block.getByRole('alert').textContent()) === 'Format non accepté : PNG, JPEG, WebP ou SVG.',
    'logo : format refusé, erreur dans le bloc',
  );
  await block.locator('input[type=file]').setInputFiles(logo);
  await block.locator('.logo-preview img').waitFor();
  // L'enregistrement de la démo est différé : on attend l'état réel
  const saved = async (test) => {
    const end = Date.now() + 8000;
    while (Date.now() < end && !test()) await new Promise((r) => setTimeout(r, 50));
    return test();
  };
  ok(
    await saved(() => /\/branding\/.+\/logo-/.test(demoRow().settings?.theme?.logoUrl || '')),
    'logo : importé dans le thème de la démo',
  );
  ok(
    (await block.getByRole('alert').count()) === 0 && (await block.getByText('logo-acme.png').count()) === 1,
    'logo : l’erreur disparaît, le nom du fichier s’affiche',
  );
  await block.getByRole('button', { name: 'Plus d’actions sur le logo' }).click();
  ok(
    (await page.getByRole('menuitem').allTextContents()).join('|') ===
      'Remplacer…|Choisir dans la médiathèque|Retirer',
    'logo : ⋯ avec « Remplacer… », « Choisir dans la médiathèque » et « Retirer »',
  );
  await page.getByRole('menuitem', { name: 'Retirer' }).click();
  await imp.waitFor();
  ok(await saved(() => !demoRow().settings?.theme?.logoUrl), 'logo : « Retirer » enlève le logo');
  // Dépôt sur tout le bloc : voile « Déposer le fichier ici »
  const dragOn = (type) =>
    page.evaluate((t) => {
      const el = document.querySelector('.logo-block');
      const dt = new DataTransfer();
      dt.items.add(new File(['x'], 'logo.png', { type: 'image/png' }));
      el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, type);
  await dragOn('dragenter');
  await block.locator('.fd-drop__veil').waitFor();
  const veil = await block.locator('.fd-drop__veil').textContent();
  await dragOn('dragleave');
  await block.locator('.fd-drop__veil').waitFor({ state: 'detached' });
  ok(/Déposer le fichier ici/.test(veil), 'logo : dépôt sur tout le bloc (voile)');
  // §3.3 : la fenêtre de sélection, la même partout (« Choisir dans la médiathèque »)
  const open = block.getByRole('button', { name: 'Choisir dans la médiathèque' });
  await open.click();
  const dlg = page.getByRole('dialog', { name: 'Choisir un logo' });
  await dlg.waitFor();
  const use = dlg.getByRole('button', { name: 'Utiliser ce logo' });
  const tile = (name) => dlg.getByRole('radio', { name, exact: true });
  const tiles = dlg.locator('.md-pick__card');

  // Vide
  ok(
    (await dlg.getByText('Importer un nouveau logo').first().isVisible()) &&
      (await dlg.getByText('Aucun fichier pour le moment. Importez-en un ci-dessus.').count()) === 1,
    'fenêtre de sélection vide : zone d’import en tête, « Aucun fichier pour le moment »',
  );
  ok(nb(await dlg.textContent()).includes('Logo de la démo «'), 'sous-titre : la destination du fichier');
  ok(
    (await use.getAttribute('aria-disabled')) === 'true',
    '« Utiliser ce logo » inactif tant que rien n’est choisi',
  );
  ok(
    (await dlg.getByRole('radio', { name: 'Logos' }).getAttribute('aria-checked')) === 'true' &&
      (await dlg.getByRole('radio', { name: 'Polices' }).getAttribute('aria-disabled')) === 'true',
    'filtres réglés sur Logos ; Polices désactivé (un logo ne reçoit pas une police)',
  );
  await shot('l18-04-media-vide');

  // Imports
  const importVia = async (file) => {
    const [ch] = await Promise.all([
      page.waitForEvent('filechooser'),
      dlg.getByRole('button', { name: /^Importer/ }).click(),
    ]);
    await ch.setFiles(file);
  };
  await importVia(logo);
  await tile('logo-acme.png').waitFor();
  ok(state.tables.media_files[0].kind === 'logo', 'import par la fonction media (catégorie demandée : logo)');
  ok(
    (await tile('logo-acme.png').isChecked()) && (await use.getAttribute('aria-disabled')) === null,
    'fichier importé choisi d’office, « Utiliser ce logo » disponible',
  );
  // L18-03 : une image de fond s'importe sous le filtre « Images » (classée image, pas logo)
  await dlg.getByRole('radio', { name: 'Images' }).click();
  await importVia(fond);
  await tile('fond-accueil.png').waitFor();
  ok(
    state.tables.media_files.find((x) => x.name === 'fond-accueil.png')?.kind === 'image' &&
      (await tiles.count()) === 1,
    'L18-03 : l’image importée sous « Images » est classée « Images »',
  );
  ok(
    /n’est pas vérifiée automatiquement/.test(await dlg.locator('.md-pick__unverified').textContent()) &&
      (await tiles.first().locator('.md-pick__warn').count()) === 1,
    'L18-03 : avertissement rattaché à l’image importée (carte et phrase)',
  );
  await shot('l18-03-media');

  // Filtre et recherche
  await dlg.getByRole('radio', { name: 'Tout' }).click();
  ok((await tiles.count()) === 2, 'filtre « Tout » : 2 fichiers');
  await dlg.getByRole('searchbox', { name: 'Rechercher' }).fill('fond');
  ok((await tiles.count()) === 1, 'recherche');
  await dlg.getByRole('searchbox').fill('');
  await tile('logo-acme.png').check();
  ok((await dlg.locator('.md-pick__unverified').count()) === 0, 'logo : pas d’avertissement (autre fichier)');
  ok(
    (await tiles
      .filter({ has: page.locator('input:checked') })
      .evaluate((el) => el.classList.contains('is-sel'))) === true,
    'carte choisie : contour de sélection',
  );
  state.mediaReject = 'SVG_REJECTED';
  await importVia(svg);
  await dlg.getByRole('alert').waitFor();
  ok((await dlg.getByRole('alert').textContent()).includes('éléments refusés'), 'SVG refusé : message');
  state.mediaReject = null;

  // Utiliser pour le logo
  await use.click();
  await dlg.waitFor({ state: 'detached' });
  ok(
    await saved(() =>
      (demoRow().settings?.theme?.logoUrl || '').includes('/storage/v1/object/public/media/'),
    ),
    'logo de la démo pris dans la médiathèque',
  );

  // ===== L48-B §5 : stockage presque plein, puis plein (page neuve) =====
  const qp = await ctx.newPage();
  qp.on('pageerror', (e) => errors.push(e.message));
  const qs = seed();
  qs.tables.media_files = [];
  qs.mediaBaseUsed = 524288000 - 2000;
  qs.mediaFiles = { 'logo-acme.png': fs.readFileSync(logo) };
  await install(qp, qs);
  await qp.goto(`${APP}/#/demos/${DEMO}/edit`);
  await qp.waitForSelector('.canvas-frame img');
  await openTool(qp, 'design');
  await qp.locator('.logo-block').getByRole('button', { name: 'Choisir dans la médiathèque' }).click();
  const qd = qp.getByRole('dialog', { name: 'Choisir un logo' });
  await qd.locator('.md-near').waitFor();
  ok(
    /Bientôt atteinte/.test(await qd.locator('.md-near').innerText()),
    'quota à 80 % : alerte « Bientôt atteinte »',
  );
  await qd.locator('input[type=file]').setInputFiles(logo);
  const full = qp.getByRole('dialog', { name: /Limite atteinte/ });
  await full.waitFor();
  ok(
    /Ajout de fichiers bloqué/.test(await full.innerText()) &&
      /Stockage\s?: .* sur\s500/.test(await full.innerText()) &&
      (await full.getByRole('link', { name: 'Voir l’utilisation' }).getAttribute('href')) ===
        '#/settings/usage',
    'quota atteint : dialogue « Limite atteinte », chiffres, « Voir l’utilisation »',
  );
  ok(!/\bplan\b|offre/i.test(await full.innerText()), 'aucun badge ni nom d’offre');

  // ===== §3.1 : logo du centre de formation pris dans la médiathèque (copie côté serveur) =====
  {
    const cp = await ctx.newPage();
    cp.on('pageerror', (e) => errors.push(e.message));
    const cs = seed();
    const file = (id, name, ext, mime) => ({
      id,
      workspace_id: 'ws-1',
      kind: 'logo',
      name,
      path: `ws-1/${id}.${ext}`,
      mime,
      size_bytes: 4000,
      created_at: '2026-11-01T09:00:00Z',
    });
    cs.tables.media_files = [
      file('m-webp', 'logo-centre.webp', 'webp', 'image/webp'),
      file('m-jpg', 'photo.jpg', 'jpg', 'image/jpeg'),
    ];
    await install(cp, cs);
    await cp.goto(`${APP}/#/center`);
    const group = cp.getByRole('group', { name: 'Logo' });
    await group.waitFor();
    ok(
      /Un logo choisi dans la médiathèque est copié ici\./.test(nb(await group.innerText())),
      'centre : l’aide dit qu’un logo de la médiathèque est copié',
    );
    const choose = async (name) => {
      await group.getByRole('button', { name: 'Choisir dans la médiathèque' }).click();
      const pick = cp.getByRole('dialog', { name: 'Choisir un logo' });
      await pick.waitFor();
      await pick.getByRole('radio', { name }).check();
      await pick.getByRole('button', { name: 'Utiliser ce logo' }).click();
      await pick.waitFor({ state: 'detached' });
    };
    // JPEG : refusé pour le centre, comme au téléversement direct
    await choose('photo.jpg');
    await cp.getByText('Ce fichier ne convient pas comme logo du centre', { exact: false }).waitFor();
    ok(!(cs.logoCopies || []).length, 'centre : un JPEG de la médiathèque est refusé, rien n’est copié');
    await choose('logo-centre.webp');
    await cp.getByText('Aucun logo', { exact: false }).waitFor({ state: 'detached' });
    const copied = (cs.logoCopies || [])[0];
    const draftLogo = () => (cs.tables.training_centers || [])[0]?.draft?.logoPath;
    for (let i = 0; i < 200 && draftLogo() !== copied?.to; i++)
      await cp.evaluate(() => new Promise(requestAnimationFrame));
    ok(
      !!copied &&
        copied.target === 'center' &&
        /^ws-1\/center-logo-[0-9a-z]{4,24}\.webp$/.test(copied.to) &&
        draftLogo() === copied.to,
      'centre : logo copié depuis la médiathèque, chemin enregistré dans le brouillon du centre',
    );
    await cp.close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
