/**
 * L26-02 / L26-03 : tiroir d'aide (bouton et F1, non modal, Échap), articles « Sur cette page »,
 * recherche sans accents, article et compteur anonyme, visite guidée en aperçu, contact d'aide.
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/aide.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

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
  state.tables.workspaces[0].settings = {
    ...(state.tables.workspaces[0].settings || {}),
    helpContact: 'support@acme.example',
  };
  await install(page, state);

  // ===== L26-02 : ouverture par le bouton =====
  await page.goto(`${BASE}/#/`);
  const btn = page.getByRole('button', { name: 'Aide', exact: true }).first();
  await btn.click();
  const drawer = page.getByRole('complementary', { name: 'Aide' });
  await drawer.waitFor();
  ok((await btn.getAttribute('aria-expanded')) === 'true', 'bouton : aria-expanded');
  ok(
    await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') === 'Rechercher dans l’aide',
    ),
    'focus dans la recherche',
  );
  ok((await page.getByRole('dialog').count()) === 0, 'tiroir non modal');
  const onPage = drawer.getByRole('region', { name: /Sur cette page · Démos/ });
  ok((await onPage.locator('.help-link').count()) === 3, '« Sur cette page · Démos » : 3 articles');
  ok(
    (await onPage.getByRole('button', { name: 'Visite guidée de cette page' }).count()) === 1,
    'visite guidée',
  );
  ok(/support@acme\.example/.test(await drawer.locator('.help-foot').innerText()), 'pied : contact d’aide');
  ok(
    (await drawer.getByRole('link', { name: 'Contacter la DSI' }).getAttribute('href')) ===
      'mailto:support@acme.example',
    'pied : lien mailto',
  );
  // La page reste utilisable
  await page.getByRole('button', { name: 'Nouvelle démo' }).first().focus();
  ok(await drawer.isVisible(), 'page utilisable, tiroir ouvert');
  await drawer.getByRole('searchbox').focus();
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${SHOTS}/l26-02-aide${sfx}.png` });
  }
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'detached' });
  ok(await btn.evaluate((e) => e === document.activeElement), 'Échap : fermé, focus rendu au bouton');

  // F1
  await page.keyboard.press('F1');
  await drawer.waitFor();
  ok(true, 'F1 ouvre l’aide');

  // ===== Visite guidée : démo statique embarquée, lecteur en aperçu =====
  await onPage.getByRole('button', { name: 'Visite guidée de cette page' }).click();
  const tour = page.getByRole('dialog', { name: 'Visite de la page Démos' });
  await tour.waitFor();
  const src = await tour.locator('iframe').getAttribute('src');
  ok(src.endsWith('/#/preview'), 'visite : lecteur en aperçu (aucune statistique)');
  // Le vrai lecteur (local) reçoit le manifeste statique et affiche la première bulle
  const player = tour.frameLocator('iframe');
  await player
    .getByText(/Toutes les démos de l.espace sont ici/)
    .first()
    .waitFor({ timeout: 10000 });
  ok(true, 'visite : le lecteur joue la démo statique (première bulle)');
  ok(/allow-scripts/.test(await tour.locator('iframe').getAttribute('sandbox')), 'visite : iframe sandbox');
  await page.keyboard.press('Escape');
  await tour.waitFor({ state: 'detached' }).catch(() => undefined);
  ok(await drawer.isVisible(), 'Échap dans la visite : le tiroir reste ouvert');

  // Sans visite pour la page : entrée gardée, désactivée, « Bientôt »
  await page.route('**/help/index.json', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, tours: [] }) }),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Aide', exact: true }).first().click();
  const soonTour = drawer.getByRole('button', { name: /Visite guidée de cette page/ });
  await soonTour.waitFor();
  ok(
    (await soonTour.getAttribute('aria-disabled')) === 'true' && /Bientôt/.test(await soonTour.innerText()),
    'sans visite : entrée désactivée avec « Bientôt »',
  );
  await page.unroute('**/help/index.json');

  // ===== L26-03 : recherche =====
  await drawer.getByRole('searchbox').fill('scorm');
  const res = drawer.locator('.help-results');
  await res.locator('h3').waitFor();
  const h3 = sp(await res.locator('h3').textContent());
  ok(/^\d+ résultats? pour « scorm »$/.test(h3), `titre « n résultats pour « scorm » » (${h3})`);
  ok((await res.getAttribute('aria-live')) === 'polite', 'résultats annoncés (aria-live)');
  ok((await res.locator('mark').first().innerText()) === 'SCORM', 'terme en <mark>');
  ok(
    /Diffusion · /.test(await res.locator('.help-link small').first().innerText()),
    'rubrique sous le titre',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l26-03-recherche${sfx}.png` });
  await drawer.getByRole('searchbox').fill('DONNEES personnelles');
  ok(
    /Données personnelles et floutage/.test(await res.innerText()),
    'recherche insensible aux accents et à la casse',
  );
  await drawer.getByRole('searchbox').fill('zzzz');
  ok(/Aucun article ne correspond/.test(await res.innerText()), 'aucun résultat : message');

  // Article
  await drawer.getByRole('searchbox').fill('scorm');
  await res.locator('.help-link').first().click();
  const art = drawer.getByRole('article');
  await art.waitFor();
  ok((await art.getByRole('heading', { level: 2 }).count()) === 1, 'article : titre h2');
  ok(
    await art.getByRole('button', { name: 'Retour' }).evaluate((e) => e === document.activeElement),
    'article : focus sur Retour',
  );
  await art.getByRole('button', { name: 'Oui' }).click();
  await art.getByText('Merci pour votre réponse.').waitFor();
  ok(
    (state.helpFeedback || []).length === 1 && state.helpFeedback[0].p_helpful === true,
    'L41 : vote « Oui » enregistré (sans texte)',
  );
  await art.getByRole('button', { name: 'Retour' }).click();
  await res.waitFor();
  ok(true, 'retour aux résultats');
  await page.keyboard.press('Escape');

  // ===== Éditeur : les articles suivent l'onglet =====
  await page.goto(`${BASE}/#/demos/${DEMO}/edit`);
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  await drawer.getByRole('region', { name: /Sur cette page · Éditeur · Étape/ }).waitFor();
  ok(true, 'éditeur : onglet Étape');
  // Le tiroir non modal recouvre le panneau : changement d'onglet au clavier
  await page.getByRole('tab', { name: 'Design' }).focus();
  await page.keyboard.press('Enter');
  await drawer.getByRole('region', { name: /Sur cette page · Éditeur · Design/ }).waitFor({ timeout: 3000 });
  ok(true, 'éditeur : les articles suivent l’onglet Design');
  await page.keyboard.press('Escape');

  // ===== L48-A §5 : sans lien du support, pas de pied « Contacter la DSI » =====
  state.tables.workspaces[0].settings = { ...state.tables.workspaces[0].settings, helpContact: null };
  await page.goto(`${BASE}/#/settings/workspace`);
  await page.reload();
  await page.getByRole('button', { name: 'Aide', exact: true }).first().click();
  await drawer.waitFor();
  await page.waitForTimeout(300);
  ok((await drawer.locator('.help-foot').count()) === 0, 'sans lien du support : pied masqué');
  await page.keyboard.press('Escape');
  // Réglage « Contact d'aide »
  const field = page.getByLabel('Lien du support');
  await field.fill('pas une adresse');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  ok(
    /adresse e-mail ou un lien/.test(await page.locator('#ws-help-error').innerText()),
    'contact invalide refusé',
  );
  await field.fill('support@acme.example');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  await page.waitForTimeout(500);
  ok(
    state.tables.workspaces[0].settings.helpContact === 'support@acme.example',
    'lien du support enregistré',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
