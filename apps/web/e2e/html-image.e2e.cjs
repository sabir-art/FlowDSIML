/**
 * L28 051 : «\u202fRemplacer l'image\u202f» d'une image capturée dans une étape HTML (médiathèque de l'espace),
 * aperçu dans l'éditeur, retour à l'image d'origine, image comptée au bilan RGPD comme importée.
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/html-image.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const SID = '0b5c1f0e-0000-4000-8000-0000000000e1';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');
const PIX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Accueil</title><style>
  body{margin:0;font:16px system-ui,sans-serif;color:#1c1917;background:#fafaf9}
  header{display:flex;align-items:center;gap:12px;padding:14px 24px;background:#fff;border-bottom:1px solid #e7e5e4}
  .logo{width:120px;height:40px;background:#e7e5e4}main{padding:24px}</style></head><body>
  <header><img class="logo" alt="Logo" src="${PIX}"><b>Acme Intranet</b></header>
  <main><h1>Accueil</h1><p>Bienvenue sur l’intranet fictif.</p></main></body></html>`;

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const t = state.tables;
  const base = t.steps.find((s) => s.demo_id === DEMO);
  const ws = t.workspaces[0].id;
  const path = `${ws}/${DEMO}/${SID}.html`;
  state.htmlPages = { [path]: PAGE };
  t.steps.unshift({
    ...base,
    id: SID,
    position: -1,
    kind: 'html',
    title: 'Accueil',
    image_path: null,
    html_path: path,
    html_ops: [],
    html_meta: { title: 'Accueil', url: 'https://intranet.acme.example/', viewport: { w: 1280, h: 720 } },
  });
  t.media_files = [
    {
      id: 'mf-1',
      workspace_id: ws,
      path: `${ws}/logo-acme-2026.png`,
      name: 'logo-acme-2026.png',
      kind: 'image',
      mime: 'image/png',
      size_bytes: 2048,
      width: 240,
      height: 80,
      created_by: null,
      created_at: '2026-11-19T10:00:00Z',
    },
  ];
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const frame = p.frameLocator('.html-stage iframe');
  await frame.locator('h1').waitFor();
  await p.waitForTimeout(400);
  const ops = () => t.steps.find((s) => s.id === SID).html_ops;
  const more = () =>
    p
      .getByRole('toolbar', { name: 'Actions sur l’élément sélectionné' })
      .getByRole('button', { name: /Plus/ });

  const bar = () => p.getByRole('toolbar', { name: 'Actions sur l’élément sélectionné' });

  // Élément qui n'est pas une image : pas d'action d'image, pas de section «\u202fImage\u202f»
  await frame.locator('h1').click();
  await bar().waitFor();
  ok(
    (await bar().getByRole('button', { name: 'Remplacer l’image', exact: true }).count()) === 0 &&
      (await bar().getByRole('button', { name: 'Modifier le texte', exact: true }).count()) === 1 &&
      (await p.getByRole('group', { name: 'Image' }).count()) === 0,
    'élément non image : «\u202fModifier le texte\u202f», aucune action d’image',
  );

  // Image : la barre propose «\u202fRemplacer l'image\u202f» à la place de «\u202fModifier le texte\u202f»
  await frame.locator('img.logo').click();
  await p.getByRole('group', { name: 'Image' }).waitFor();
  ok(
    (await bar().getByRole('button', { name: 'Remplacer l’image', exact: true }).count()) === 1 &&
      (await bar().getByRole('button', { name: 'Modifier le texte', exact: true }).count()) === 0,
    'image : «\u202fRemplacer l’image\u202f» dans la barre, à la place de «\u202fModifier le texte\u202f»',
  );
  ok(
    (await p.locator('#html-text').count()) === 0,
    'image : pas de champ «\u202fTexte\u202f» dans le panneau',
  );
  ok(
    await p.getByRole('radio', { name: 'Ajuster' }).isDisabled(),
    'Ajuster / Remplir inactifs tant que l’image n’est pas remplacée',
  );
  await bar().getByRole('button', { name: 'Remplacer l’image', exact: true }).click();
  const lib = p.getByRole('dialog').filter({ hasText: 'logo-acme-2026.png' });
  await lib.waitFor();
  ok(true, 'médiathèque de l’espace ouverte');
  // Fenêtre de sélection (retours-2411 §3.3) : cartes à choix unique, puis « Utiliser… »
  await lib.getByRole('radio', { name: 'logo-acme-2026.png', exact: true }).click({ force: true });
  await lib.getByRole('button', { name: /^Utiliser/ }).click();
  await p.getByText('Image remplacée.', { exact: true }).waitFor();
  await p.getByText(/Image importée.: aucune détection automatique/).waitFor();
  ok(true, 'toasts «\u202fImage remplacée.\u202f» (avec Annuler) et avertissement d’import');
  for (let i = 0; i < 40 && !ops().some((o) => o.op === 'image'); i++) await p.waitForTimeout(100);
  ok(
    ops().some((o) => o.op === 'image' && o.sel && o.value === `${ws}/logo-acme-2026.png`),
    'opération «\u202fimage\u202f» enregistrée (chemin de la médiathèque)',
  );
  await p.waitForTimeout(500);
  const src = await frame.locator('img.logo').getAttribute('src');
  ok(
    /\/storage\/v1\/object\/public\/media\/.*logo-acme-2026\.png$/.test(src || ''),
    'aperçu : nouvelle image dans la page',
  );
  ok(
    (await frame.locator('img.logo').evaluate((e) => getComputedStyle(e).objectFit)) === 'contain',
    'Ajuster par défaut (contain)',
  );
  await p.getByRole('radio', { name: 'Remplir' }).click();
  for (let i = 0; i < 40 && !ops().some((o) => o.op === 'image' && o.fit === 'cover'); i++)
    await p.waitForTimeout(100);
  await p.waitForTimeout(400);
  ok(
    ops().some((o) => o.op === 'image' && o.fit === 'cover') &&
      (await frame.locator('img.logo').evaluate((e) => getComputedStyle(e).objectFit)) === 'cover',
    'Remplir : cover enregistré et appliqué',
  );
  if (SHOTS) {
    await p.mouse.move(0, 0);
    await p.waitForTimeout(8500);
    await p.screenshot({ path: `${SHOTS}/l28-05-image-html${sfx}.png` });
  }

  // Bilan RGPD : image importée non vérifiée
  await p
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const gdpr = p.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  ok(
    /1 image importée non vérifiée/.test(sp(await gdpr.innerText())),
    'bilan RGPD : «\u202f1 image importée non vérifiée\u202f»',
  );
  await gdpr.getByRole('button', { name: 'Annuler' }).click();

  // Retour à l'image d'origine (panneau), puis «\u202fMasquer l'image\u202f»
  await frame.locator('img.logo').click();
  await p.getByRole('button', { name: 'Revenir à l’image d’origine' }).click();
  for (let i = 0; i < 40 && ops().some((o) => o.op === 'image'); i++) await p.waitForTimeout(100);
  ok(!ops().some((o) => o.op === 'image'), 'retour à l’image d’origine : opération retirée');
  await p.getByRole('button', { name: 'Masquer l’image' }).click();
  for (let i = 0; i < 40 && !ops().some((o) => o.op === 'mask'); i++) await p.waitForTimeout(100);
  await p.waitForTimeout(400);
  const masked = await frame.locator('img.logo').evaluate((e) => ({
    src: e.getAttribute('src') || '',
    w: e.getBoundingClientRect().width,
  }));
  ok(
    ops().some((o) => o.op === 'mask') && /^data:image\/gif/.test(masked.src) && masked.w > 0,
    '«\u202fMasquer l’image\u202f» : aplat à la même taille, image d’origine retirée',
  );
  ok(
    (await p.getByRole('button', { name: 'Masquer l’image' }).getAttribute('aria-pressed')) === 'true',
    'bouton «\u202fMasquer l’image\u202f» enfoncé',
  );
  if (SHOTS) {
    await p.mouse.move(0, 0);
    await p.locator('.html-image-sec').screenshot({ path: `${SHOTS}/l28-05-panneau${sfx}.png` });
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
