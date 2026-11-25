/**
 * Toasts et navigation : une navigation décidée par la personne (lien de l'application, Précédent du
 * navigateur) ferme les toasts affichés ; une action sur la page et une redirection qui suit une action
 * gardent le leur (la redirection après un import est contrôlée par onboarding-import).
 * Données fictives. Usage : node e2e/toasts-navigation.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
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

  // CAD-08 (révisé le 25/11) : en haut à droite sous la barre du haut, le plus récent en haut, 4 s,
  // fermeture suspendue au survol ; sous 600 px, toute la largeur moins 16 px de chaque côté
  for (const width of [1440, 390]) {
    const p2 = await b.newPage({ viewport: { width, height: 800 } });
    p2.on('pageerror', (e) => errors.push(e.message));
    await install(p2, seedMaquette());
    // Hors Paramètres : 16 px sous la barre du haut (8 px sous 600 px)
    await p2.goto(`${APP}/#/media`);
    await p2.locator('#media-page-file').waitFor({ state: 'attached' });
    await p2
      .locator('#media-page-file')
      .setInputFiles({ name: 'repere.svg', mimeType: 'image/svg+xml', buffer: svg });
    await p2.locator('.toasts .toast').first().waitFor();
    await p2
      .locator('.toasts .toast')
      .first()
      .evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
    const under = await p2.evaluate(() => {
      const bar = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--fd-layout-topbar-height'),
      );
      return Math.round(document.querySelector('.toasts .toast').getBoundingClientRect().top - bar);
    });
    ok(
      under === (width >= 600 ? 16 : 8),
      `toasts à ${width} px, hors Paramètres : ${under} px sous la barre du haut`,
    );
    await p2.locator('.toasts .toast button[aria-label="Fermer"]').click();
    await p2.locator('.toasts .toast').first().waitFor({ state: 'detached' });
    await p2.goto(`${APP}/#/settings/members`);
    // Deux confirmations simples (sans action) : deux changements de rôle
    const setRole = async (role) => {
      await p2.getByRole('button', { name: 'Actions pour Nina Roux' }).click();
      await p2.getByRole('menuitemradio', { name: role }).click();
    };
    const list = p2.locator('.toasts .toast');
    await p2.getByRole('button', { name: 'Actions pour Nina Roux' }).waitFor();
    await setRole('Admin');
    await list.first().waitFor();
    await list.first().evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
    await setRole('Éditeur');
    await p2.waitForFunction(() => document.querySelectorAll('.toasts .toast').length === 2);
    // La souris sur la pile suspend la fermeture
    await list.first().hover();
    await p2.waitForFunction(() =>
      [...document.querySelectorAll('.toasts .toast')].every((el) => el.getAnimations().length === 0),
    );
    const m = await p2.evaluate(() => {
      const els = [...document.querySelectorAll('.toasts .toast')];
      const r = els.map((el) => el.getBoundingClientRect());
      // Paramètres : l'en-tête porte les actions de la page, la pile commence sous sa bande
      const head = document.querySelector('.stg-page');
      const acts = document.querySelector('.stg-page__acts')?.getBoundingClientRect();
      const bar = head.getBoundingClientRect().bottom + scrollY;
      const probe = document.createElement('i');
      probe.style.borderRadius = 'var(--fd-radius-surface)';
      document.body.append(probe);
      const surface = getComputedStyle(probe).borderTopLeftRadius;
      probe.remove();
      const tools = [...document.querySelectorAll('[aria-label="Aide"], [aria-label="Notifications"]')]
        .map((x) => x.getBoundingClientRect())
        .filter((x) => x.width > 0);
      return {
        top: Math.round(r[0].top - bar),
        right: Math.round(document.documentElement.clientWidth - r[0].right),
        left: Math.round(r[0].left),
        w: Math.round(r[0].width),
        order: els.map((el) => (el.textContent.includes('Éditeur') ? 'second' : 'premier')).join('|'),
        stacked: r[1].top >= r[0].bottom + 8 - 0.5,
        radius: getComputedStyle(els[0]).borderTopLeftRadius === surface,
        live: els[0].closest('[role="status"]')?.getAttribute('aria-live'),
        overTools: tools.some((t) =>
          r.some((x) => x.top < t.bottom && x.bottom > t.top && x.left < t.right && x.right > t.left),
        ),
        close: !!els[0].querySelector('button[aria-label="Fermer"]'),
        overActs:
          !!acts &&
          r.some(
            (x) => x.top < acts.bottom && x.bottom > acts.top && x.left < acts.right && x.right > acts.left,
          ),
      };
    });
    ok(
      m.order === 'second|premier' &&
        m.stacked &&
        m.radius &&
        m.live === 'polite' &&
        m.close &&
        !m.overTools &&
        !m.overActs &&
        m.right === 16 &&
        (width >= 600 ? m.top === 16 && m.w <= 360 : m.top === 8 && m.left === 16),
      `toasts à ${width} px : en haut à droite sous l’en-tête des Paramètres, le plus récent en haut, sans couvrir l’aide, la cloche ni les actions de la page (${JSON.stringify(m)})`,
    );
    // Souris sur la pile : rien ne se ferme, même après la durée d'affichage ; souris partie : tout se ferme
    const t0 = Date.now();
    await p2.waitForFunction((t) => Date.now() - t > 4600, t0);
    const kept = await list.count();
    await p2.mouse.move(2, 700);
    await list.first().waitFor({ state: 'detached', timeout: 8000 });
    ok(
      kept === 2 && (await list.count()) === 0,
      `toasts à ${width} px : fermeture suspendue au survol, puis reprise (${kept} gardés)`,
    );
    await p2.close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
