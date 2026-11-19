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
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const N = ' ';

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
  await page.getByRole('tab', { name: 'Design' }).click();
  const open = page.getByRole('button', { name: 'Choisir dans la médiathèque' });
  await open.scrollIntoViewIfNeeded();
  await open.click();
  const dlg = page.getByRole('dialog', { name: 'Médiathèque' });
  await dlg.waitFor();

  // L18-04 : vide
  ok(
    (await dlg.getByText('Importer votre premier fichier').count()) === 1,
    'L18-04 : vide, une grande case d’import',
  );
  ok(
    (await dlg.getByRole('button', { name: 'Utiliser ce fichier' }).getAttribute('aria-disabled')) === 'true',
    'L18-04 : « Utiliser ce fichier » inactif',
  );
  ok(
    (await dlg.getByRole('searchbox', { name: 'Rechercher un fichier' }).isDisabled()) &&
      (await dlg.getByRole('radio', { name: 'Logos' }).isDisabled()),
    'L18-04 : recherche et filtre présents, inactifs',
  );
  ok(/0\s?Mo sur 500/.test(await dlg.textContent()), 'L18-04 : quota réel (0 Mo)');
  await shot('l18-04-media-vide');

  // Imports
  const importVia = async (file, label) => {
    const [ch] = await Promise.all([
      page.waitForEvent('filechooser'),
      dlg.getByRole('button', { name: label }).click(),
    ]);
    await ch.setFiles(file);
  };
  await importVia(logo, /Importer votre premier fichier/);
  await dlg.getByRole('button', { name: 'logo-acme.png' }).waitFor();
  ok(state.tables.media_files[0].kind === 'logo', 'import par la fonction media (usage « logo »)');
  ok(
    (await dlg.getByRole('button', { name: 'logo-acme.png' }).getAttribute('aria-pressed')) === 'true',
    'fichier importé sélectionné',
  );
  await importVia(fond, /^Importer/);
  await dlg.getByRole('button', { name: 'fond-accueil.png' }).waitFor();
  ok(
    /n’est pas vérifiée automatiquement/.test(await dlg.locator('.md-warn').textContent()),
    'L18-03 : avertissement à l’import d’une image',
  );

  // Filtre et recherche
  await dlg.getByRole('radio', { name: 'Tout' }).click();
  ok((await dlg.locator('.md-tile').count()) === 2, 'filtre « Tout » : 2 fichiers');
  await dlg.getByRole('searchbox', { name: 'Rechercher un fichier' }).fill('fond');
  ok((await dlg.locator('.md-tile').count()) === 1, 'recherche');
  await dlg.getByRole('searchbox').fill('');
  await dlg.getByRole('button', { name: 'logo-acme.png' }).click();
  ok((await dlg.locator('.md-foot').textContent()).includes(`sur 500${N}Mo`), 'pied : quota sur 500 Mo');
  await shot('l18-03-media');
  state.mediaReject = 'SVG_REJECTED';
  await importVia(svg, /^Importer/);
  await dlg.getByRole('alert').waitFor();
  ok((await dlg.getByRole('alert').textContent()).includes('éléments refusés'), 'SVG refusé : message');
  state.mediaReject = null;

  // Utiliser pour le logo
  await dlg.getByRole('button', { name: 'Utiliser ce fichier' }).click();
  await page.waitForTimeout(900);
  const theme = state.tables.demos.find((d) => d.id === DEMO).settings.theme || {};
  ok(
    (theme.logoUrl || '').includes('/storage/v1/object/public/media/'),
    'logo de la démo pris dans la médiathèque',
  );

  // Suppression d'un fichier utilisé (depuis Paramètres › Marque)
  await page.goto(`${APP}/#/settings/brand`);
  await page.getByRole('button', { name: 'Médiathèque' }).click();
  const lib = page.getByRole('dialog', { name: 'Médiathèque' });
  await lib.getByRole('button', { name: 'logo-acme.png' }).click();
  ok((await lib.locator('.md-foot').textContent()).includes('Utilisé dans 1 démo'), 'usage : 1 démo');
  ok(
    (await lib.getByRole('button', { name: 'Utiliser ce fichier' }).count()) === 0,
    'consultation : pas de « Utiliser »',
  );
  await lib.getByRole('button', { name: 'Supprimer' }).click();
  const conf = page.getByRole('dialog', { name: `Supprimer «${N}logo-acme.png${N}»${N}?` });
  await conf.waitFor();
  ok(
    (await conf.textContent()).includes('Ce fichier est utilisé dans 1 démo. Cet emplacement restera vide.'),
    'suppression : avertissement d’usage',
  );
  await conf.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(500);
  ok(
    state.mediaDeleted?.length === 1 && state.tables.media_files.length === 1,
    'fichier et ligne supprimés (fonction media)',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
