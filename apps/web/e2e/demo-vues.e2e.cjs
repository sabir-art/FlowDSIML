/**
 * Retours client du 24/11 (2e série) §9 : Analytics, Leads et Visiteurs dans la démo. Barre de démo
 * commune (retour, nom et état, onglets Édition · Aperçu · Analytics · Leads · Visiteurs, Partager,
 * Publier), sans la barre latérale de l'application ni changement de page complet ; retour selon
 * l'origine ; focus sur le h1 de la vue ; 390 px (onglets en bouton-menu, Partager en bouton icône).
 * Données fictives. Usage : [THEME=dark] [WIDTH=390] [SHOTS_DIR=…] node e2e/demo-vues.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const WIDTH = Number(process.env.WIDTH || 1440);
const MOBILE = WIDTH < 900;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: WIDTH, height: MOBILE ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  await install(page, state);
  // Un changement de page complet remettrait ce témoin à zéro
  const mark = () => page.evaluate(() => (window.__sameDocument = true));
  const kept = () => page.evaluate(() => window.__sameDocument === true);
  const hash = (re) => page.waitForFunction((s) => new RegExp(s).test(location.hash), re.source);
  const noSidebar = async () =>
    (await page.getByRole('navigation', { name: 'Navigation principale' }).count()) === 0;
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const h1 = () => page.locator('h1').first();
  const focusOnH1 = () => page.evaluate(() => document.activeElement?.tagName === 'H1');
  const settle = () =>
    page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== 'running'),
    );
  const shot = async (name) => {
    if (!SHOTS) return;
    await settle();
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}-${WIDTH}.png` });
  };
  const axe = async (name) => {
    const r = await new AxeBuilder({ page }).analyze();
    const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(
      bad.length === 0,
      `${name} : axe sans violation (${bad.map((v) => `${v.id} ${v.nodes[0]?.target}`).join(' ; ')})`,
    );
  };
  /** Change de vue par l'onglet (ou par le bouton-menu à 390 px). */
  const go = async (label) => {
    if (MOBILE) {
      await page.locator('.dv-tabs-menu button').click();
      await page.getByRole('menuitem', { name: label }).click();
    } else await page.locator('.dv-tabs').getByRole('link', { name: label, exact: true }).click();
  };

  // ===== Depuis les Démos : vue Analytics =====
  await page.goto(`${APP}/#/demos/${DEMO}/analytics`);
  await page.locator('.dv-bar').waitFor();
  await mark();
  ok(await noSidebar(), 'Analytics de la démo : pas de barre latérale de l’application');
  ok(
    (await page.locator('.dv-tt b').textContent()) === 'Démo CRM' &&
      (await page.locator('.dv-state').textContent()) === 'Non publiée',
    'barre : nom de la démo, état « Non publiée »',
  );
  ok((await h1().textContent()) === 'Analytics de « Démo CRM »', 'h1 de la vue (lu, non affiché)');
  if (!MOBILE) {
    const tabs = await page.locator('.dv-tabs a').allTextContents();
    ok(
      tabs.map((x) => x.trim()).join('|') === 'Édition|Aperçu|Analytics|Leads|Visiteurs',
      `onglets : ${tabs.join(', ')}`,
    );
    ok(
      (await page.locator('.dv-tabs a[aria-current="page"]').textContent()).trim() === 'Analytics',
      'onglet courant : Analytics',
    );
    ok(
      (await page.locator('.dv-back').textContent()).trim() === 'Démos' &&
        (await page.locator('.dv-bar__r').getByRole('link', { name: 'Publier' }).count()) === 1,
      'retour « Démos », « Partager » et « Publier » à droite',
    );
  } else {
    ok(
      (await page.locator('.dv-tabs').isHidden()) &&
        (await page.locator('.dv-tabs-menu button').textContent()).trim() === 'Analytics',
      '390 : les onglets sont un bouton-menu « Analytics »',
    );
    const share = page.locator('.dv-share');
    const box = await share.boundingBox();
    ok(
      (await share.getAttribute('aria-label')) === 'Partager' && box.width <= 40,
      '390 : « Partager » en bouton icône, avec son nom',
    );
  }
  ok(
    (await page.getByRole('group', { name: 'Période' }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Exporter', exact: false }).count()) >= 1,
    'Analytics : période (7 j, 30 j, 90 j) et export en bouton icône',
  );
  ok(
    (await page.getByRole('heading', { name: 'Par moyen de partage' }).count()) === 1,
    'Analytics : « Par moyen de partage »',
  );
  ok(await noScroll(), 'Analytics : pas de défilement horizontal');
  await shot('demo-analytics');
  await axe('Analytics');

  // ===== Leads =====
  await go('Leads');
  await hash(/\/leads$/);
  await page.waitForFunction(() => /^Leads de/.test(document.querySelector('h1')?.textContent || ''));
  ok(await kept(), 'Leads : pas de changement de page complet');
  ok(
    (await noSidebar()) && (await page.locator('.dv-bar').count()) === 1,
    'Leads : même barre, pas de barre latérale',
  );
  ok(
    await page.waitForFunction(() => document.activeElement?.tagName === 'H1').then(() => true),
    'Leads : focus sur le h1 de la vue',
  );
  ok(
    (await page.getByRole('table').count()) >= 1 || (await page.getByText(/Aucun lead/).count()) >= 1,
    'Leads : tableau des leads de la démo',
  );
  ok(await noScroll(), 'Leads : pas de défilement horizontal');
  await shot('demo-leads');
  await axe('Leads');

  // ===== Visiteurs =====
  await go('Visiteurs');
  await hash(/\/visitors$/);
  await page.waitForFunction(() => /^Visiteurs de/.test(document.querySelector('h1')?.textContent || ''));
  ok((await kept()) && (await noSidebar()), 'Visiteurs : même page, pas de barre latérale');
  ok(await focusOnH1(), 'Visiteurs : focus sur le h1 de la vue');
  ok(
    (await page.getByRole('group', { name: 'Moyen de partage' }).getByRole('button').allTextContents()).join(
      '|',
    ) === 'Tous|Lien|Intégration|Liens personnalisés|Page de la démo',
    'Visiteurs : filtre par moyen de partage (mêmes noms que la fenêtre Partager)',
  );
  ok(
    !(await page.getByRole('table').locator('thead th').allTextContents()).includes('Démo'),
    'Visiteurs : pas de colonne « Démo » (c’est la démo courante)',
  );
  ok(
    (await page.evaluate(() => getComputedStyle(document.querySelector('.mk.dv')).backgroundColor)) ===
      (await page.evaluate(() => {
        const x = document.createElement('i');
        x.style.background = 'var(--fd-color-content-bg)';
        document.body.appendChild(x);
        const c = getComputedStyle(x).backgroundColor;
        x.remove();
        return c;
      })),
    'fond du contenu : --fd-color-content-bg',
  );
  ok(await noScroll(), 'Visiteurs : pas de défilement horizontal');
  await shot('demo-visiteurs');
  await axe('Visiteurs');

  // ===== Édition : même jeu d'onglets dans l'éditeur, puis retour =====
  if (!MOBILE) {
    await go('Édition');
    await hash(/\/edit$/);
    await page.locator('.ed-tabs').waitFor();
    ok(await kept(), 'Édition : pas de changement de page complet');
    const names = [
      ...(await page.locator('.ed-tabs button').allTextContents()),
      ...(await page.locator('.ed-tabs a').allTextContents()),
    ].map((x) => x.trim());
    ok(
      names.join('|') === 'Édition|Aperçu|Analytics|Leads|Visiteurs',
      `éditeur : mêmes onglets (${names.join(', ')})`,
    );
    await page.locator('.ed-tabs').getByRole('link', { name: 'Visiteurs' }).click();
    await hash(/\/visitors$/);
    ok(await kept(), 'retour à Visiteurs depuis l’éditeur');
    // Aperçu : ouvre l'éditeur sur l'aperçu
    await go('Aperçu');
    await hash(/\/edit$/);
    await page.locator('.ed-tabs button[aria-checked="true"]').filter({ hasText: 'Aperçu' }).waitFor();
    ok(true, 'Aperçu : l’éditeur s’ouvre sur l’aperçu');
  }

  // ===== Retour selon l'origine : depuis l'Analytics de l'espace =====
  await page.goto(`${APP}/#/analytics?tab=demos`);
  await page.locator('.an-demos__name').first().waitFor();
  const row = page.locator('.an-demos__name', { hasText: 'Démo CRM' }).first();
  if (await row.count()) {
    await row.click();
    await hash(/\/demos\/.+\/analytics$/);
    await page.locator('.dv-back').waitFor();
    const back = page.locator('.dv-back');
    ok(
      (await back.getAttribute('href')) === '#/analytics',
      'venu de l’Analytics de l’espace : retour « ← Analytics »',
    );
    await go('Visiteurs');
    await hash(/\/visitors$/);
    ok(
      (await page.locator('.dv-back').getAttribute('href')) === '#/analytics',
      'l’origine est gardée d’onglet en onglet',
    );
    await page.locator('.dv-back').click();
    await hash(/^#\/analytics/);
    ok(true, 'retour à l’Analytics de l’espace');
  } else ok(false, 'Analytics de l’espace : lien vers la démo introuvable');

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
