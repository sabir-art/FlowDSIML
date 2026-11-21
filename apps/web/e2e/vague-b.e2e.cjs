/**
 * Test e2e VB-01 à VB-03 : fonctions de la vague B en « Bientôt disponible » (jamais actives, jamais
 * « V2 ») : Sécurité (SSO), cartes e-mailing et enrichissement des Intégrations, entrées
 * « Assistance IA » de l'éditeur. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/vague-b.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  await install(page, state);
  const full = async (name) => {
    if (!SHOTS) return;
    await page.mouse.move(1430, 890);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1440, height: Math.max(900, h) });
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
  };
  const noV2 = async (where) =>
    ok(!/\bV2\b/.test(await page.locator('main, .mk').first().innerText()), `${where} : jamais « V2 »`);

  // ===== L48-A : « Fonctions à venir » supprimée, chaque fonction à sa place =====
  await page.goto(`${APP}/#/settings/soon`);
  await page.waitForURL(/settings\/workspace/);
  ok(true, '/settings/soon redirige vers Général');
  await page.goto(`${APP}/#/settings/ai`);
  await page.getByRole('heading', { level: 1, name: 'Assistance IA' }).waitFor();
  await noV2('Assistance IA');
  // L48-F : lignes « Bientôt » de la liste des intégrations
  await page.goto(`${APP}/#/settings/integrations`);
  await page.locator('.int-list').first().waitFor();
  const enrich = page.locator('.int-list > li', { hasText: 'Enrichissement des visiteurs' });
  ok(
    (await enrich.count()) === 1 && /Bientôt/.test(await enrich.locator('.int-soon').innerText()),
    'Intégrations : enrichissement des visiteurs « Bientôt »',
  );
  // Intégrations : ligne e-mailing avec l'alternative
  const mail = page.locator('.int-list > li', { hasText: 'Outils d' });
  ok(
    (await mail.count()) === 1 && (await mail.innerText()).includes('En attendant, un webhook'),
    'Intégrations : ligne e-mailing « En attendant, un webhook… »',
  );
  if (SHOTS)
    await page.locator('.int-card-list').screenshot({ path: `${SHOTS}/vb-02-integrations${sfx}.png` });
  await mail.getByRole('link', { name: 'Utiliser un webhook' }).click();
  await page.waitForURL(/settings\/integrations\/webhooks/);
  ok(true, 'lien vers les webhooks');
  await page.goBack();

  // ===== VB-03 : Sécurité =====
  await page.getByRole('link', { name: 'Sécurité' }).click();
  await page.getByRole('heading', { level: 1, name: 'Sécurité' }).waitFor();
  ok((await page.getByRole('heading', { name: 'Connexion unique (SSO / SAML)' }).count()) === 1, 'carte SSO');
  ok(
    await page.getByLabel('URL des métadonnées du fournisseur').isDisabled(),
    'champ des métadonnées désactivé',
  );
  ok(
    await page
      .getByLabel('URL des métadonnées du fournisseur')
      .evaluate(
        (el) =>
          getComputedStyle(el).borderStyle === 'dashed' && getComputedStyle(el).cursor === 'not-allowed',
      ),
    'champ des métadonnées : aspect désactivé',
  );
  ok(
    /lien d’invitation et domaines autorisés/.test(await page.locator('.soon-why').innerText()),
    'encadré « En attendant : lien d’invitation et domaines autorisés »',
  );
  ok(
    (await page.locator('.soon-why').getByRole('link', { name: 'Inviter des membres' }).count()) === 1,
    'lien vers Membres',
  );
  await noV2('Sécurité');
  await full('vb-03-securite');

  // ===== VB-01 : éditeur =====
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  // L30 en ligne : plus d'entrée « Assistance IA – Bientôt » dans le menu ⋯ ; aucun « Bientôt » IA périmé
  ok(
    (await page.getByRole('menuitem', { name: /Assistance IA/ }).count()) === 0,
    'menu ⋯ : plus d’entrée « Assistance IA – Bientôt »',
  );
  const writer = page.getByRole('menuitem', { name: /Rédiger les textes/ });
  ok(!/Bientôt|V2/.test(await writer.innerText()), 'L30-02 : « Rédiger les textes » n’est plus en Bientôt');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/vb-01-menu${sfx}.png` });
  await page.keyboard.press('Escape');
  await page.locator('.canvas-hotspot').first().click();
  await page.waitForSelector('#hs-title');
  // L30-02 : l'entrée « Bientôt » est remplacée par l'Assistance IA (désactivée par défaut)
  const entry = page.locator('[data-tool-panel] .ai-entry').first();
  ok(
    (await entry.innerText()).includes('Assistance IA') &&
      (await entry.getAttribute('aria-disabled')) === 'true',
    'panneau de la bulle : entrée « Assistance IA » désactivée tant que l’espace ne l’a pas activée',
  );
  ok(
    !/\bV2\b/.test(await page.locator('.sp-panel, .hs-panel, aside').last().innerText()),
    'panneau : jamais « V2 »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/vb-01-bulle${sfx}.png` });

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  ok(
    state.calls.every((c) => !/openai|anthropic|mistral|hubspot|salesforce/i.test(c.path)),
    'aucun appel à un tiers',
  );
  await b.close();
})();
