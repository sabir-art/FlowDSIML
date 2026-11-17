/** Test e2e du thème de l'interface : clair par défaut, bascule Sombre / Système, persistance, contraste AA. */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

/** Contraste WCAG entre deux couleurs CSS calculées « rgb(r, g, b) ». */
function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c
      .match(/\d+(\.\d+)?/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

(async () => {
  const b = await chromium.launch();
  // Système en sombre : l'app doit malgré tout s'ouvrir en clair (défaut).
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const pairs = () =>
    page.evaluate(() => {
      const cs = (sel, prop) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el)[prop] : null;
      };
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      return [
        ['texte / fond', cs('h1', 'color'), bodyBg],
        ['texte muted / fond', cs('.user-text span', 'color'), cs('.sidebar', 'backgroundColor') || bodyBg],
        [
          'lien de nav / fond',
          cs('.fd-nav__item:not([aria-current])', 'color'),
          cs('.sidebar', 'backgroundColor') || bodyBg,
        ],
      ].filter(([, c, k]) => c && k && !/rgba\(0, 0, 0, 0\)/.test(k));
    });

  // Écran de connexion : sélecteur présent, clair par défaut
  await page.goto(`${APP}/#/login`);
  await page.waitForSelector('.auth-prefs [role=radiogroup]');
  ok((await theme()) === 'light', 'clair par défaut, même si le système est en sombre');
  await page.getByRole('radio', { name: 'Sombre' }).click();
  ok((await theme()) === 'dark', 'bascule en sombre depuis la page de connexion');
  ok((await page.evaluate(() => localStorage.getItem('fd.theme'))) === 'dark', 'choix mémorisé localement');
  await page.getByRole('radio', { name: 'Clair' }).click();

  // App connectée (nouvel onglet du même contexte : le localStorage est partagé)
  await page.close();
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  await page.goto(`${APP}/#/`);
  await page.waitForSelector('.demo-card');
  const lightBg = await bg();
  for (const [l, c, k] of await pairs())
    ok(contrast(c, k) >= 4.5, `contraste AA en clair : ${l} (${contrast(c, k).toFixed(2)})`);

  // Menu du compte → Sombre
  await page.getByRole('button', { name: 'Mon compte' }).click();
  await page.getByRole('menuitemradio', { name: 'Sombre' }).click();
  ok((await theme()) === 'dark', 'bascule en sombre depuis le menu du compte');
  ok((await bg()) !== lightBg, 'le fond change de couleur');
  ok(state.user.user_metadata.theme === 'dark', 'choix enregistré sur le compte (user_metadata.theme)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok((await pairs()).length === 3, 'trois paires de contraste mesurées en sombre');
  for (const [l, c, k] of await pairs())
    ok(contrast(c, k) >= 4.5, `contraste AA en sombre : ${l} (${contrast(c, k).toFixed(2)})`);

  // DB2 : en sombre, les aperçus du player restent en clair (texte compris)
  await page.goto(`${APP}/#/`);
  await page.waitForSelector('.demo-cover');
  const cover = await page
    .locator('.demo-cover')
    .last()
    .evaluate((el) => {
      const c = el.querySelector('.demo-cover-title') || el;
      return [
        getComputedStyle(c).color,
        getComputedStyle(el.querySelector('.demo-cover-empty') || el).backgroundColor,
      ];
    });
  ok(
    contrast(cover[0], cover[1]) >= 4.5,
    `contraste AA en sombre : vignette de démo (${contrast(cover[0], cover[1]).toFixed(2)})`,
  );

  // Rechargement : pas de retour au clair
  await page.reload();
  ok((await theme()) === 'dark', 'thème conservé au rechargement (posé avant le rendu)');

  // Profil → Système (le contexte simule un système sombre)
  await page.goto(`${APP}/#/settings/profile`);
  await page.getByRole('radio', { name: 'Système' }).click();
  ok((await theme()) === 'system', 'choix « Système » depuis le profil');
  await page.waitForTimeout(100);
  ok((await bg()) !== lightBg, 'Système suit la préférence sombre du navigateur');
  await page.getByRole('radio', { name: 'Clair' }).click();
  ok((await bg()) === lightBg, 'retour au clair');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
