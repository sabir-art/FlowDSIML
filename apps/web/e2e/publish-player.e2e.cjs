/**
 * Test e2e publication → player (faux Supabase partagé entre l'app et le player).
 * Usage : app web sur :5173 et player sur :5174 (VITE_SUPABASE_ANON_KEY défini).
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const state = seed();
  const errors = [];
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };

  const app = await ctx.newPage();
  app.on('pageerror', (e) => errors.push(`app: ${e.message}`));
  await install(app, state);

  // Formulaire de lead sur l'étape 2 + publication
  await app.goto(`${APP}/#/demos/${DEMO}/edit`);
  await app.waitForSelector('.canvas-frame img');
  await app.getByRole('tab', { name: 'Réglages' }).click();
  await app.getByRole('button', { name: 'Créer le formulaire' }).click();
  await app.waitForSelector('#f-title');
  await app.getByRole('tab', { name: 'Étape' }).click();
  await app.locator('.steplist-item').nth(1).click();
  await app.selectOption('#st-gate', { index: 1 });
  await app.waitForTimeout(900);
  app.on('dialog', (d) => {
    errors.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  await app.getByRole('button', { name: 'Publier' }).click();
  // F1 : avertissement RGPD (deux cases obligatoires)
  const dlg = app.locator('dialog.gdpr-dialog[open]');
  await dlg.waitFor();
  const pub = dlg.getByRole('button', { name: 'Publier en public' });
  ok(await pub.isDisabled(), 'RGPD : « Publier en public » bloqué tant que les cases ne sont pas cochées');
  ok((await dlg.textContent()).includes('zone floutée'), 'RGPD : bilan des zones floutées');
  if (process.env.SHOTS_DIR) await app.screenshot({ path: `${process.env.SHOTS_DIR}/f1-rgpd.png` });
  await dlg.getByLabel(/J’ai relu|J'ai relu/).check();
  ok(await pub.isDisabled(), 'RGPD : une seule case ne suffit pas');
  await dlg.getByLabel(/fictives ou floutées/).check();
  await pub.click();
  await app.waitForURL(/share\?published=1/, { timeout: 15000 });
  ok(true, 'publication terminée, redirection vers la page de partage');
  ok(state.lastAck?.reviewed && state.lastAck?.fictional, 'RGPD : confirmation envoyée à publish_demo');
  ok(!!state.storage[`published/${DEMO}/latest.json`], 'manifeste latest.json téléversé');
  ok(!!state.storage[`published/${DEMO}/assets/s2.webp`], 'image de l’étape floutée publiée');
  const blurred = state.storage[`published/${DEMO}/assets/s2.webp`];
  ok(blurred && blurred.type === 'image/webp', 'le flou est appliqué dans les pixels (WebP régénéré)');
  const manifest = JSON.parse(state.storage[`published/${DEMO}/latest.json`].data.toString());
  ok(
    manifest.steps.every((s) => s.blurs.length === 0),
    'le manifeste ne renvoie plus les zones à flouter',
  );
  const publicUrl = await app.inputValue('#pub-url');
  ok(publicUrl === `${PLAYER}/#/d/${DEMO}`, 'lien public affiché');
  ok((await app.inputValue('#embed')).includes('<iframe'), 'snippet d’intégration affiché');
  if (SHOTS) await app.screenshot({ path: `${SHOTS}/share.png`, fullPage: true });

  // Lien personnalisé
  await app.fill('#ln', 'Globex — Marie');
  await app.fill('#lv-company', 'Globex');
  await app.getByRole('button', { name: 'Créer le lien' }).click();
  await app.waitForTimeout(500);
  const link = state.tables.share_links[0];
  ok(link && link.variables.company === 'Globex', 'lien personnalisé créé avec variables');

  // Player : lien public avec variable d'URL
  const player = await ctx.newPage();
  player.on('pageerror', (e) => errors.push(`player: ${e.message}`));
  await install(player, state);
  await player.goto(`${publicUrl}?company=Acme`);
  await player.waitForSelector('.p-tip');
  ok(
    (await player.textContent('.p-tip')).includes('Bienvenue Acme'),
    'variable {{company}} remplacée depuis l’URL',
  );
  if (SHOTS) await player.screenshot({ path: `${SHOTS}/player-1.png` });
  await player.click('.p-beacon');
  await player.waitForSelector('.p-form');
  ok(true, 'formulaire de lead affiché avant l’étape 2');
  if (SHOTS) await player.screenshot({ path: `${SHOTS}/player-form.png` });
  await player.fill('.p-form input[type=email]', 'marie@globex.example');
  await player.click('.p-form button[type=submit]');
  await player.waitForSelector('.p-form', { state: 'detached' });
  ok(
    state.tables.leads.some((l) => l.email === 'marie@globex.example'),
    'lead enregistré',
  );
  await player.keyboard.press('ArrowRight');
  await player.waitForSelector('.p-text-step');
  ok((await player.textContent('.p-text-step h1')) === 'Merci !', 'écran texte final');
  if (SHOTS) await player.screenshot({ path: `${SHOTS}/player-end.png` });
  await player.evaluate(() => dispatchEvent(new Event('pagehide')));
  await player.waitForTimeout(2500);
  const types = state.events.map((e) => e.type);
  ok(
    ['demo_view', 'step_view', 'hotspot_click', 'form_submit', 'demo_complete'].every((x) =>
      types.includes(x),
    ),
    `événements envoyés (${[...new Set(types)].join(', ')})`,
  );

  // Lien personnalisé dans le player
  const p2 = await ctx.newPage();
  await install(p2, state);
  await p2.goto(`${PLAYER}/#/l/${link.token}`);
  await p2.waitForSelector('.p-tip');
  ok(
    (await p2.textContent('.p-tip')).includes('Bienvenue Globex'),
    'lien personnalisé : variables pré-remplies',
  );

  // Démo inexistante
  const p4 = await ctx.newPage();
  await install(p4, state);
  await p4.goto(`${PLAYER}/#/l/inconnu123`);
  await p4.waitForSelector('.p-center h1');
  ok(/expiré|expired/i.test(await p4.textContent('.p-center h1')), 'écran dédié pour un lien expiré');
  if (SHOTS) await p4.screenshot({ path: `${SHOTS}/player-expired.png` });

  const p3 = await ctx.newPage();
  await install(p3, state);
  await p3.goto(`${PLAYER}/#/d/0b5c1f0e-0000-4000-8000-0000000000ff`);
  await p3.waitForSelector('.p-center');
  ok(
    /n'existe pas|does not exist/.test(await p3.textContent('.p-center')),
    'message pour une démo introuvable',
  );

  // Version mobile
  const m = await ctx.newPage({});
  await m.setViewportSize({ width: 390, height: 720 });
  await install(m, state);
  await m.goto(publicUrl);
  await m.waitForSelector('.p-sheet');
  const box = await m.locator('.p-stage').boundingBox();
  ok(box.width <= 390, 'player responsive sur mobile');
  const sheet = await m.locator('.p-sheet').boundingBox();
  ok(sheet.y >= box.y + box.height, 'mobile : la feuille est sous l’image et ne masque pas la cible');
  const beacon = await m.locator('.p-beacon').first().boundingBox();
  ok(beacon.width >= 44 && beacon.height >= 44, 'cible tactile du hotspot ≥ 44 px');
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/player-mobile.png` });

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
