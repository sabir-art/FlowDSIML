/**
 * Toasts et navigation : une navigation décidée par la personne (lien de l'application, Précédent du
 * navigateur) ferme les toasts affichés ; une action sur la page et une redirection qui suit une action
 * gardent le leur (la redirection après un import est contrôlée par onboarding-import).
 * Données fictives. Usage : node e2e/toasts-navigation.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  await install(page, state);
  const toasts = page.locator('.toasts .toast');
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>',
  );
  const send = (name) =>
    page.locator('#media-page-file').setInputFiles({ name, mimeType: 'image/svg+xml', buffer: svg });

  await page.goto(`${APP}/#/`);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('link', { name: 'Médiathèque' }).click();
  await page.locator('#media-page-file').waitFor({ state: 'attached' });
  await send('pictogramme.svg');
  await toasts.first().waitFor();
  ok((await toasts.count()) === 1, 'import : un toast affiché');

  // Une action sur la page ne ferme pas le toast
  await page.getByRole('heading', { level: 1 }).click();
  ok((await toasts.count()) === 1, 'clic dans la page : le toast reste');
  // Le lien de la page courante non plus
  await nav.getByRole('link', { name: 'Médiathèque' }).click();
  ok((await toasts.count()) === 1, 'lien de la page courante : le toast reste');

  // Navigation décidée par la personne : le toast de la page quittée se ferme
  await nav.getByRole('link', { name: 'Démos' }).click();
  await page.waitForFunction(() => location.hash === '#/');
  await toasts.first().waitFor({ state: 'detached' });
  ok((await toasts.count()) === 0, 'lien de la navigation : le toast de la page quittée est fermé');

  // Précédent du navigateur : même règle
  await nav.getByRole('link', { name: 'Médiathèque' }).click();
  await page.locator('#media-page-file').waitFor({ state: 'attached' });
  await send('fleche.svg');
  await toasts.first().waitFor();
  await page.goBack();
  await page.waitForFunction(() => location.hash === '#/');
  await toasts.first().waitFor({ state: 'detached' });
  ok((await toasts.count()) === 0, 'Précédent du navigateur : le toast est fermé');

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
