/**
 * COL-02 (COMP-01 §19) : poignée de bord de la colonne Dossiers. Plus d'icône panneau dans l'en-tête ;
 * pastille de 20 × 40 px à cheval sur le filet (bouton « Replier les dossiers », aria-expanded) ; le
 * filet est un séparateur redimensionnable (souris, ← → Début Fin, Entrée), de 200 à 360 px ; repliée,
 * la colonne disparaît et une demi-pastille de 18 × 40 px reste au bord du contenu ; largeur et repli
 * gardés ; pas de poignée sous 1 024 px. Faux Supabase, données de la maquette.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const box = (l) =>
  l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
const slotIs = (page, w) =>
  page.waitForFunction(
    (w) => Math.round(document.querySelector('.fcol-slot').getBoundingClientRect().width) === w,
    w,
  );

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
    // Le thème de l'app vient de sa préférence gardée, pas du réglage du navigateur
    await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
    const page = await ctx.newPage();
    await install(page, seedMaquette());
    await page.goto(`${APP}/#/`);
    const nav = page.getByRole('navigation', { name: 'Dossiers' });
    await nav.waitFor();
    const tag = theme === 'light' ? 'clair' : 'sombre';
    const slot = page.locator('.fcol-slot');
    const btn = page.locator('.fd-cgrip__btn');
    const sep = page.getByRole('separator', { name: 'Largeur des dossiers' });

    // ----- Dépliée -----
    ok(
      (await nav.locator('.fcol__head button').count()) === 1 &&
        (await nav.getByRole('button', { name: 'Nouveau dossier' }).first().count()) === 1,
      `${tag} : l’en-tête n’a plus que « Dossiers » et « Nouveau dossier » (plus d’icône panneau)`,
    );
    const s0 = await box(slot);
    const b0 = await box(btn);
    ok(s0.w === 232, `${tag} : colonne de 232 px par défaut (${s0.w})`);
    ok(
      b0.w === 20 && b0.h === 40 && Math.abs(b0.x + b0.w / 2 - (s0.x + s0.w)) <= 1,
      `${tag} : pastille de 20 × 40 px à cheval sur le filet (${b0.w} × ${b0.h})`,
    );
    ok(Math.abs(b0.y + b0.h / 2 - 450) <= 1, `${tag} : pastille centrée dans la hauteur visible`);
    ok(
      (await btn.getAttribute('aria-label')) === 'Replier les dossiers' &&
        (await btn.getAttribute('aria-expanded')) === 'true' &&
        (await btn.getAttribute('aria-controls')) === (await nav.getAttribute('id')),
      `${tag} : bouton « Replier les dossiers », aria-expanded, aria-controls`,
    );
    ok(
      (await sep.getAttribute('aria-orientation')) === 'vertical' &&
        (await sep.getAttribute('aria-valuemin')) === '200' &&
        (await sep.getAttribute('aria-valuemax')) === '360' &&
        (await sep.getAttribute('aria-valuenow')) === '232' &&
        (await sep.getAttribute('tabindex')) === '0',
      `${tag} : séparateur vertical, 200 à 360 px, valeur 232`,
    );
    const sb = await box(sep);
    ok(
      sb.w === 12 && sb.h === 900 && (await sep.evaluate((e) => getComputedStyle(e).cursor)) === 'col-resize',
      `${tag} : zone de prise de 12 px sur toute la hauteur, curseur col-resize`,
    );

    // ----- Clavier -----
    await sep.focus();
    await page.keyboard.press('ArrowRight');
    await slotIs(page, 248);
    ok((await sep.getAttribute('aria-valuenow')) === '248', `${tag} : → élargit de 16 px`);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await slotIs(page, 216);
    ok(true, `${tag} : ← rétrécit de 16 px`);
    await page.keyboard.press('Home');
    await slotIs(page, 200);
    await page.keyboard.press('ArrowLeft');
    ok((await sep.getAttribute('aria-valuenow')) === '200', `${tag} : Début donne 200 px, borne basse tenue`);
    await page.keyboard.press('End');
    await slotIs(page, 360);
    await page.keyboard.press('ArrowRight');
    ok((await sep.getAttribute('aria-valuenow')) === '360', `${tag} : Fin donne 360 px, borne haute tenue`);
    await page.keyboard.press('Enter');
    await slotIs(page, 0);
    ok((await btn.getAttribute('aria-expanded')) === 'false', `${tag} : Entrée replie la colonne`);
    await page.keyboard.press('Enter');
    await slotIs(page, 360);
    ok(true, `${tag} : Entrée la déplie à sa largeur`);

    // ----- Glissement -----
    const g = await box(sep);
    await page.mouse.move(g.x + 6, 300);
    await page.mouse.down();
    await page.mouse.move(g.x + 6 - 60, 300, { steps: 4 });
    ok(
      Math.round((await box(slot)).w) === 300 &&
        (await page.locator('.fd-cgrip__width').innerText()).replace(/\s/g, ' ') === '300 px',
      `${tag} : glissement à 300 px, bulle « 300 px »`,
    );
    ok(
      (await page.locator('.fd-cgrip').evaluate((e) => e.classList.contains('is-drag'))) &&
        (await slot.evaluate((e) => getComputedStyle(e).transitionDuration)) === '0s',
      `${tag} : pas d’animation pendant le glissement`,
    );
    await page.mouse.up();
    ok((await page.locator('.fd-cgrip__width').count()) === 0, `${tag} : la bulle disparaît au relâchement`);
    // Sous le minimum, la colonne se replie
    const g2 = await box(sep);
    await page.mouse.move(g2.x + 6, 300);
    await page.mouse.down();
    await page.mouse.move(g2.x + 6 - 160, 300, { steps: 4 });
    await page.mouse.up();
    await slotIs(page, 0);
    ok(true, `${tag} : glissée sous le minimum, la colonne se replie`);

    // ----- Repliée -----
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.fcol-clip')).visibility === 'hidden',
    );
    const b1 = await box(btn);
    const main = await box(page.locator('.demos-main'));
    ok(
      b1.w === 18 && b1.h === 40 && Math.abs(b1.x - main.x) <= 1,
      `${tag} : demi-pastille de 18 × 40 px au bord gauche du contenu (${b1.w} × ${b1.h})`,
    );
    ok(
      (await btn.getAttribute('aria-label')) === 'Déplier les dossiers' &&
        (await page.getByRole('navigation', { name: 'Dossiers' }).count()) === 0,
      `${tag} : « Déplier les dossiers » ; la colonne n’est plus dans l’arbre d’accessibilité`,
    );
    ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${tag} : pas de défilement horizontal`,
    );
    const axeClosed = await new AxeBuilder({ page }).exclude('.demo-cover').analyze();
    const badClosed = axeClosed.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(badClosed.length === 0, `${tag} : axe, colonne repliée (${badClosed.map((v) => v.id).join(', ')})`);

    // ----- Mémoire -----
    await page.reload();
    await page.locator('.demos-section .list-toolbar').waitFor();
    ok((await box(slot)).w === 0, `${tag} : repli gardé après rechargement`);
    await btn.click();
    await slotIs(page, 300);
    ok(true, `${tag} : dépliée à la largeur gardée (300 px)`);
    ok(
      (await slot.evaluate((e) => getComputedStyle(e).transitionDuration)) === '0.2s',
      `${tag} : repli et dépli animés en 200 ms`,
    );
    const axeOpen = await new AxeBuilder({ page }).exclude('.demo-cover').analyze();
    const badOpen = axeOpen.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(badOpen.length === 0, `${tag} : axe, colonne dépliée (${badOpen.map((v) => v.id).join(', ')})`);
    await ctx.close();
  }

  // ----- Animation coupée avec prefers-reduced-motion -----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await install(page, seedMaquette());
    await page.goto(`${APP}/#/`);
    await page.getByRole('navigation', { name: 'Dossiers' }).waitFor();
    const dur = await page.locator('.fcol-slot').evaluate((e) => getComputedStyle(e).transitionDuration);
    // 0 s, ou la durée quasi nulle de la règle globale de l'app
    ok(parseFloat(dur) <= 0.001, `prefers-reduced-motion : pas d’animation (${dur})`);
    await ctx.close();
  }

  // ----- Sous 1 024 px : pas de poignée -----
  {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    await install(page, seedMaquette());
    await page.goto(`${APP}/#/`);
    await page.locator('.demos-section .list-toolbar').waitFor();
    ok(
      (await page.locator('.fd-cgrip').count()) === 0 &&
        (await page.getByRole('separator', { name: 'Largeur des dossiers' }).count()) === 0,
      '390 px : pas de poignée ni de séparateur',
    );
    await page.close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
