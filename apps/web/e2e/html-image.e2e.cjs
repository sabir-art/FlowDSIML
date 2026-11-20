/**
 * L28 051 : « Remplacer l'image » d'une image capturée dans une étape HTML (médiathèque de l'espace),
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

  // Élément qui n'est pas une image : action désactivée
  await frame.locator('h1').click();
  await more().click();
  ok(
    await p.getByRole('menuitem', { name: 'Remplacer l’image' }).isDisabled(),
    'élément non image : « Remplacer l’image » désactivé',
  );
  ok(
    (await p.getByRole('menuitem', { name: 'Remplacer l’image' }).locator('.badge').count()) === 0,
    'plus de badge « Bientôt »',
  );
  await p.keyboard.press('Escape');

  // Image : médiathèque, choix du fichier
  await frame.locator('img.logo').click();
  await more().click();
  await p.getByRole('menuitem', { name: 'Remplacer l’image' }).click();
  const lib = p.getByRole('dialog').filter({ hasText: 'logo-acme-2026.png' });
  await lib.waitFor();
  ok(true, 'médiathèque de l’espace ouverte');
  await lib.getByRole('button', { name: 'logo-acme-2026.png' }).click();
  await lib.getByRole('button', { name: 'Utiliser ce fichier' }).click();
  await p.getByText(/Image importée.: aucune détection automatique/).waitFor();
  for (let i = 0; i < 40 && !ops().some((o) => o.op === 'image'); i++) await p.waitForTimeout(100);
  ok(
    ops().some((o) => o.op === 'image' && o.sel && o.value === `${ws}/logo-acme-2026.png`),
    'opération « image » enregistrée (chemin de la médiathèque)',
  );
  await p.waitForTimeout(500);
  const src = await frame.locator('img.logo').getAttribute('src');
  ok(
    /\/storage\/v1\/object\/public\/media\/.*logo-acme-2026\.png$/.test(src || ''),
    'aperçu : nouvelle image dans la page',
  );
  if (SHOTS) {
    await p.mouse.move(0, 0);
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
    'bilan RGPD : « 1 image importée non vérifiée »',
  );
  await gdpr.getByRole('button', { name: 'Annuler' }).click();

  // Retour à l'image d'origine
  await frame.locator('img.logo').click();
  await more().click();
  await p.getByRole('menuitem', { name: 'Revenir à l’image d’origine' }).click();
  await p.waitForTimeout(1300);
  ok(!ops().some((o) => o.op === 'image'), 'retour à l’image d’origine : opération retirée');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
