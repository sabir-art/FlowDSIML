/**
 * Test e2e publication → player (faux Supabase partagé entre l'app et le player).
 * Usage : app web sur :5173 et player sur :5174 (VITE_SUPABASE_ANON_KEY défini).
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const { PUBLIC_PLAYER } = require('./fake-supabase.cjs');
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
  // EDT-08 : le formulaire est placé dans le rail, avant l'étape 2
  ok((await app.locator('.rail-list .step--form').count()) === 1, 'formulaire affiché dans le rail');
  await app.locator('.rail-list .step:not(.step--form)').nth(1).click();
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
  ok(
    (await dlg.locator('.gdpr-restrict button').count()) === 1 &&
      /Protégez la démo par un mot de passe/.test(await dlg.locator('.gdpr-restrict').innerText()),
    'RP-2 (REV-09) : seul le mot de passe est proposé',
  );
  ok(
    await dlg
      .locator('.gdpr-why')
      .evaluate((el) => !!el.previousElementSibling?.classList.contains('dialog-actions')),
    'RP-3 : aide sous les boutons',
  );
  if (process.env.F1_SHOT) await dlg.screenshot({ path: process.env.F1_SHOT });
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
  const publicUrl = await app.inputValue('#sh-pub');
  ok(publicUrl === `${PUBLIC_PLAYER}/#/d/${DEMO}`, 'lien public affiché (adresse publique du lecteur)');
  await app.getByRole('tab', { name: 'Intégrer' }).click();
  ok((await app.textContent('.sh-code')).includes('<iframe'), 'snippet d’intégration affiché');
  if (SHOTS) await app.screenshot({ path: `${SHOTS}/share.png`, fullPage: true });

  // Lien personnalisé (onglet dédié, modale « Nouveau lien personnalisé »)
  await app.getByRole('tab', { name: 'Liens personnalisés' }).click();
  await app.getByRole('button', { name: 'Nouveau lien' }).click();
  await app.fill('#sh-ln', 'Globex — Marie');
  await app.fill('#sh-v-company', 'Globex');
  await app.getByRole('button', { name: 'Créer et copier le lien' }).click();
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
  // PLY-03 : le formulaire par défaut a une case de consentement (au nom du workspace)
  if (await player.locator('.p-form input[type=checkbox]').count())
    await player.check('.p-form input[type=checkbox]');
  await player.click('.p-form button[type=submit]');
  await player.waitForSelector('.p-form', { state: 'detached' });
  ok(
    state.tables.leads.some((l) => l.email === 'marie@globex.example'),
    'lead enregistré',
  );
  await player.keyboard.press('ArrowRight');
  await player.waitForSelector('.p-text-step');
  ok((await player.textContent('.p-text-step .p-step-h')) === 'Merci !', 'écran texte final');
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
  await p4.waitForSelector('.p-sys-card h1');
  ok(
    /plus disponible|no longer available/i.test(await p4.textContent('.p-sys-card h1')),
    'PLY-06 : écran dédié pour un lien expiré (carte dans le cadre du lecteur)',
  );
  if (SHOTS) await p4.screenshot({ path: `${SHOTS}/player-expired.png` });

  const p3 = await ctx.newPage();
  await install(p3, state);
  await p3.goto(`${PLAYER}/#/d/0b5c1f0e-0000-4000-8000-0000000000ff`);
  await p3.waitForSelector('.p-sys-card');
  ok(
    /n'existe pas|does not exist/.test(await p3.textContent('.p-sys-card')),
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

  // L11 : bucket privé → images signées par open-demo ; logo absolu (bucket public « branding ») conservé
  const key = `published/${DEMO}/latest.json`;
  const withLogo = JSON.parse(state.storage[key].data.toString());
  withLogo.theme = {
    ...withLogo.theme,
    logoUrl: 'https://api.tutoclick.example/storage/v1/object/public/branding/logo.png',
  };
  state.storage['branding/logo.png'] = {
    data: require('fs').readFileSync(`${__dirname}/fixture.png`),
    type: 'image/png',
  };
  state.storage[key] = { ...state.storage[key], data: Buffer.from(JSON.stringify(withLogo)) };
  const lg = await ctx.newPage();
  await install(lg, state);
  await lg.goto(publicUrl);
  await lg.waitForSelector('.p-ws img');
  await lg.waitForTimeout(500);
  ok(
    await lg.evaluate(() => {
      const logo = document.querySelector('.p-ws img');
      const shot = document.querySelector('.p-stage img');
      return !!logo?.naturalWidth && !!shot?.naturalWidth && shot.src.includes('/object/sign/published/');
    }),
    'L11 : logo du workspace affiché et capture servie par URL signée',
  );
  await lg.close();

  // L11 : protection par mot de passe (onglet Accès), vérifiée par open-demo
  await app.getByRole('tab', { name: 'Accès' }).click();
  await app.getByRole('radio', { name: /Avec un mot de passe/ }).check();
  await app.fill('#acc-pw', 'court');
  ok(
    await app.getByRole('button', { name: 'Enregistrer le mot de passe' }).isDisabled(),
    'L11 : 8 caractères minimum',
  );
  await app.fill('#acc-pw', 'parcours-2026');
  await app.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await app.waitForSelector('.toast');
  ok(state.tables.demo_access[0]?.mode === 'password', 'L11 : démo protégée par mot de passe');
  ok(
    (await app.locator('.l11-opt.is-soon input:disabled').count()) === 3,
    'L11 : invitation, domaine e-mail et jeton (A1-11) en Bientôt',
  );
  ok(/Avec un mot de passe/.test(await app.textContent('.l11-sum')), 'L11 : carte « Accès à la démo »');

  const g = await ctx.newPage();
  await install(g, state);
  await g.goto(publicUrl);
  await g.waitForSelector('.p-gate');
  ok((await g.locator('.p-stage').count()) === 0, 'L11-06 : rien de la démo avant le mot de passe');
  await g.fill('#p-gate-pw', 'mauvais');
  await g.click('.p-gate-submit');
  await g.waitForSelector('#p-gate-err');
  ok(
    (await g.getAttribute('#p-gate-pw', 'aria-invalid')) === 'true' &&
      /4 (essais|attempts)/.test(await g.textContent('.p-gate')),
    'L11-07 : erreur liée au champ, essais restants',
  );
  for (let i = 0; i < 4; i++) {
    await g.fill('#p-gate-pw', `faux-${i}`);
    await g.click('.p-gate-submit');
    await g.waitForTimeout(150);
  }
  await g.waitForSelector('#p-gate-pw:disabled');
  ok(
    /Réessayer dans|Try again in/.test(await g.textContent('.p-gate-submit')),
    'L11-08 : trop d’essais, compte à rebours',
  );
  const g2 = await ctx.newPage();
  await install(g2, state);
  state.tables.demo_access[0].lockedUntil = 0;
  await g2.goto(publicUrl);
  await g2.fill('#p-gate-pw', 'parcours-2026');
  await g2.click('.p-gate-submit');
  await g2.waitForSelector('.p-stage');
  ok(true, 'L11 : bon mot de passe, la démo s’ouvre');

  // L11-05 / L11-12 : expiration passée → écran « plus disponible » avec date et site du workspace
  await app.bringToFront();
  await app.getByRole('radio', { name: /Toute personne avec le lien/ }).check();
  await app.waitForTimeout(300);
  state.tables.workspaces[0].settings = {
    ...(state.tables.workspaces[0].settings || {}),
    websiteUrl: 'https://acme.example',
  };
  await app.getByLabel('Date d’expiration').check();
  await app.fill('#acc-exp-d', '2025-01-15');
  await app.waitForTimeout(400);
  ok(!!state.tables.demo_access[0].expires_at, 'L11-05 : date d’expiration enregistrée');
  const g3 = await ctx.newPage();
  await install(g3, state);
  await g3.goto(publicUrl);
  await g3.waitForSelector('.p-sys-card');
  ok(
    /15 (janvier|January) 2025/.test(await g3.textContent('.p-sys-card')) &&
      (await g3.locator('.p-sys-card a[href="https://acme.example"]').count()) === 1,
    'L11-12 : date d’expiration et lien vers le site du workspace',
  );

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
