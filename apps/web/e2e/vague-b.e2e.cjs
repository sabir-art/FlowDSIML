/**
 * Test e2e VB-01 à VB-03 : fonctions de la vague B en « Bientôt disponible » (jamais actives, jamais
 * « V2 ») : page « Fonctions à venir », Sécurité (SSO), carte e-mailing des Intégrations, entrées
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

  // ===== VB-01 : Fonctions à venir, onglet Assistance IA =====
  await page.goto(`${APP}/#/settings/soon`);
  await page.getByRole('heading', { level: 2, name: 'Fonctions à venir' }).waitFor();
  ok(
    (await page.getByRole('tab', { name: 'Assistance IA' }).getAttribute('aria-selected')) === 'true',
    'onglet Assistance IA par défaut',
  );
  ok(
    (await page.getByText("Aucune donnée n'est envoyée à un service d'IA", { exact: false }).count()) === 1,
    'bandeau « Aucune donnée n’est envoyée à un service d’IA »',
  );
  ok((await page.locator('.soon-card').count()) === 4, 'quatre cartes IA');
  ok(
    (await page.locator('.soon-badge', { hasText: 'Bientôt disponible' }).count()) === 4,
    'badge sur chaque carte',
  );
  ok(
    (await page.locator('.soon-card button').count()) === 4 &&
      (await page.locator('.soon-card button:not([disabled])').count()) === 0,
    'contrôles désactivés',
  );
  ok(
    await page
      .locator('.soon-card')
      .first()
      .evaluate((el) => getComputedStyle(el).borderStyle === 'dashed'),
    'bordure pointillée',
  );
  ok(
    !(await page.locator('.soon-page').innerText()).match(/Essayer|liste d.attente|Nouveau/i),
    'ni « Essayer », ni liste d’attente, ni « Nouveau »',
  );
  await noV2('Fonctions à venir');
  await full('vb-01-ia');

  // Onglets au clavier
  await page.getByRole('tab', { name: 'Assistance IA' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('#soon-tab-crm[aria-selected="true"]', { timeout: 3000 }).catch(() => {});
  ok(
    (await page.getByRole('tab', { name: 'CRM et e-mailing' }).getAttribute('aria-selected')) === 'true',
    'onglets au clavier (→)',
  );

  // ===== VB-02 : CRM et e-mailing =====
  ok((await page.locator('.soon-card').count()) === 3, 'trois cartes CRM, e-mailing, enrichissement');
  ok(
    (await page.getByRole('heading', { name: "Outils d'e-mailing" }).count()) === 1,
    'carte « Outils d’e-mailing »',
  );
  await full('vb-02-crm');
  await page.getByRole('link', { name: 'Utiliser les webhooks' }).click();
  await page.getByRole('heading', { name: 'Webhooks' }).waitFor();
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.activeElement?.id === 'webhooks'), 'webhooks : focus sur la carte');
  // Intégrations : carte e-mailing avec l'alternative
  const mail = page.locator('.int-card', { hasText: 'Outils d' });
  ok(
    (await mail.count()) === 1 && /Bientôt/.test(await mail.locator('.badge').innerText()),
    'Intégrations : carte e-mailing',
  );
  ok(
    (await mail.locator('.soon-why').innerText()).includes('En attendant'),
    'Intégrations : « En attendant : webhooks »',
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await mail.getByRole('button', { name: 'Utiliser les webhooks' }).click();
  ok(await page.evaluate(() => document.activeElement?.id === 'webhooks'), 'lien vers les webhooks');
  if (SHOTS) {
    await mail.scrollIntoViewIfNeeded();
    await page.locator('.l23-soon').screenshot({ path: `${SHOTS}/vb-02-integrations${sfx}.png` });
  }

  // ===== VB-03 : Sécurité =====
  await page.getByRole('link', { name: 'Sécurité' }).click();
  await page.getByRole('heading', { level: 2, name: 'Sécurité' }).waitFor();
  ok((await page.getByRole('heading', { name: 'Connexion unique (SSO / SAML)' }).count()) === 1, 'carte SSO');
  ok(
    await page.getByLabel('URL des métadonnées du fournisseur').isDisabled(),
    'champ des métadonnées désactivé',
  );
  ok(
    /invitation par e-mail et domaines autorisés/.test(await page.locator('.soon-why').innerText()),
    'encadré « En attendant : invitation par e-mail et domaines autorisés »',
  );
  ok(
    (await page.locator('.soon-why').getByRole('link', { name: 'Inviter des membres' }).count()) === 1,
    'lien vers Membres',
  );
  await noV2('Sécurité');
  await full('vb-03-securite');
  await page.goto(`${APP}/#/settings/soon?tab=sso`);
  await page.getByRole('heading', { name: 'Connexion unique (SSO / SAML)' }).waitFor();
  ok(true, 'onglet Connexion unique');

  // ===== VB-01 : éditeur =====
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  const ai = page.getByRole('menuitem', { name: /Assistance IA/ });
  ok((await ai.count()) === 1 && /Bientôt/.test(await ai.innerText()), 'menu ⋯ : « Assistance IA » Bientôt');
  const writer = page.getByRole('menuitem', { name: /Rédiger les textes/ });
  ok(
    /Bientôt/.test(await writer.innerText()) && !/V2/.test(await writer.innerText()),
    '« Rédiger les textes » : Bientôt, plus V2',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/vb-01-menu${sfx}.png` });
  const [tab] = await Promise.all([ctx.waitForEvent('page'), ai.click()]);
  await tab.waitForLoadState();
  ok(
    /#\/settings\/soon\?tab=ia$/.test(tab.url()),
    'ouvre « Fonctions à venir » (onglet IA) dans un nouvel onglet',
  );
  await tab.close();
  await page.locator('.canvas-hotspot').first().click();
  await page.waitForSelector('#hs-title');
  const link = page.locator('.hs-ai');
  ok(
    (await link.innerText()).includes('Assistance IA') &&
      (await link.getAttribute('href')).endsWith('#/settings/soon?tab=ia') &&
      (await link.getAttribute('target')) === '_blank',
    'panneau de la bulle : lien « Assistance IA »',
  );
  ok(
    !/\bV2\b/.test(await page.locator('.sp-panel, .hs-panel, aside').last().innerText()),
    'panneau : jamais « V2 »',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  ok(
    state.calls.every((c) => !/openai|anthropic|mistral|hubspot|salesforce/i.test(c.path)),
    'aucun appel à un tiers',
  );
  await b.close();
})();
