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

  // CAD-08 (révisé le 25/11) : en bas au milieu, le plus récent en bas, 4 s, fermeture suspendue au
  // survol ; sous 600 px, toute la largeur moins 16 px de chaque côté, et 16 px au-dessus de la barre
  // « Modifications non enregistrées » quand elle est là
  for (const width of [1440, 390]) {
    const p2 = await b.newPage({ viewport: { width, height: 800 } });
    p2.on('pageerror', (e) => errors.push(e.message));
    await install(p2, seedMaquette());
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
    await list.last().hover();
    await p2.waitForFunction(() =>
      [...document.querySelectorAll('.toasts .toast')].every((el) => el.getAnimations().length === 0),
    );
    const m = await p2.evaluate(() => {
      const els = [...document.querySelectorAll('.toasts .toast')];
      const r = els.map((el) => el.getBoundingClientRect());
      const vw = document.documentElement.clientWidth;
      // Zone de contenu principale : à droite de la barre latérale et de la colonne des Paramètres
      const zone = (
        document.querySelector('.st-main') ?? document.getElementById('main')
      ).getBoundingClientRect();
      const nav = document.querySelector('.st-nav')?.getBoundingClientRect();
      const probe = document.createElement('i');
      probe.style.borderRadius = 'var(--fd-radius-surface)';
      document.body.append(probe);
      const surface = getComputedStyle(probe).borderTopLeftRadius;
      probe.remove();
      const last = r.at(-1);
      return {
        bottom: Math.round(innerHeight - last.bottom),
        centre:
          vw < 600
            ? Math.abs((last.left + last.right) / 2 - vw / 2) <= 1
            : Math.abs((last.left + last.right) / 2 - (zone.left + zone.width / 2)) <= 1,
        // Le toast ne mord pas sur la navigation
        clearOfNav: !nav || nav.width === 0 || r.every((x) => x.left >= nav.right),
        left: Math.round(last.left),
        w: Math.round(last.width),
        order: els.map((el) => (el.textContent.includes('Éditeur') ? 'second' : 'premier')).join('|'),
        stacked: r[1].top >= r[0].bottom + 8 - 0.5,
        radius: getComputedStyle(els[0]).borderTopLeftRadius === surface,
        live: els[0].closest('[role="status"]')?.getAttribute('aria-live'),
        close: !!els[0].querySelector('button[aria-label="Fermer"]'),
        // La pile laisse passer les clics hors des toasts
        through: getComputedStyle(document.querySelector('.toasts')).pointerEvents === 'none',
      };
    });
    ok(
      m.order === 'premier|second' &&
        m.stacked &&
        m.radius &&
        m.live === 'polite' &&
        m.close &&
        m.through &&
        m.centre &&
        m.clearOfNav &&
        (width >= 600
          ? m.bottom === 24 && m.w <= 420
          : m.bottom === 16 && m.left === 16 && m.w === width - 32),
      `toasts à ${width} px : en bas, au milieu de la zone de contenu, le plus récent en bas (${JSON.stringify(m)})`,
    );
    // Souris sur la pile : rien ne se ferme, même après la durée d'affichage ; souris partie : tout se ferme
    const t0 = Date.now();
    await p2.waitForFunction((t) => Date.now() - t > 4600, t0);
    const kept = await list.count();
    await p2.mouse.move(2, 2);
    await list.first().waitFor({ state: 'detached', timeout: 8000 });
    ok(
      kept === 2 && (await list.count()) === 0,
      `toasts à ${width} px : fermeture suspendue au survol, puis reprise (${kept} gardés)`,
    );
    await p2.close();
  }
  // Sous 600 px, barre « Modifications non enregistrées » affichée : la pile se pose 16 px au-dessus
  {
    const p3 = await b.newPage({ viewport: { width: 390, height: 800 } });
    p3.on('pageerror', (e) => errors.push(e.message));
    await install(p3, seed());
    await p3.goto(`${APP}/#/settings/workspace`);
    const name = p3.locator('#ws-name');
    await name.waitFor();
    const bar = p3.getByRole('region', { name: 'Modifications non enregistrées' });
    // Saisie tenue : si l'espace finit de se charger après coup, le formulaire reprend ses valeurs
    const typed = async () => {
      await name.fill('Acme modifié');
      await p3.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p3.waitForLoadState('networkidle');
      return (await name.inputValue()) === 'Acme modifié';
    };
    for (let i = 0; i < 5 && !(await typed()); i++);
    await bar.waitFor();
    await bar.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    // La pile (vide ici) est ancrée par son bas : c'est là que se pose le prochain toast
    const gap = await p3.evaluate(() => {
      const t = document.querySelector('.toasts').getBoundingClientRect();
      const s = document.querySelector('.stg-savebar').getBoundingClientRect();
      return Math.round(s.top - t.bottom);
    });
    ok(gap === 16, `390 px : la pile des toasts se pose 16 px au-dessus de la barre collée (${gap})`);
    await p3.close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
