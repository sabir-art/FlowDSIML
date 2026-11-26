/**
 * Retours client (demandé deux fois) : le contenu déplié d'une option d'accès fait partie de l'option.
 * Pour « Avec un mot de passe », « Sur invitation » et « Par domaine e-mail » : les réglages sont DANS la
 * carte de l'option choisie (sous l'en-tête, séparés par un filet), bords gauche et droit égaux à ceux de
 * la carte (±1 px), aucun retrait. « Toute personne avec le lien » ne déplie rien. À 1440 et 390 px.
 * Faux Supabase, données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/acces-options-alignement.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const b = await chromium.launch();
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const tag = `${vp.width}`;
    const ctx = await themedContext(b, { viewport: vp, locale: 'fr-FR' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    seedExport(state, { steps: 3 });
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=access`);

    await page.getByRole('radio', { name: /Toute personne avec le lien/ }).check();
    await page.waitForTimeout(200);
    ok(
      (await page.locator('.l11-cfg').count()) === 0 &&
        (await page.locator('.l11-item.is-open').count()) === 0,
      `${tag} · « Toute personne avec le lien » ne déplie rien`,
    );

    for (const [name, slug] of [
      ['Avec un mot de passe', 'mdp'],
      ['Sur invitation', 'invitation'],
      ['Par domaine e-mail', 'domaine'],
    ]) {
      await page.getByRole('radio', { name: new RegExp(name) }).check();
      const cfg = page.locator('.l11-cfg');
      await cfg.first().waitFor();
      await page.waitForTimeout(250);
      const g = await page.evaluate(() => {
        const c = document.querySelector('.l11-cfg');
        const item = c.closest('.l11-item');
        const head = item?.querySelector('.l11-opt');
        const r = (e) => e.getBoundingClientRect();
        const cs = item ? getComputedStyle(item) : null;
        const ccs = getComputedStyle(c);
        return {
          inItem: !!item && item.classList.contains('is-open') && !!head?.querySelector('input:checked'),
          card: item && { l: r(item).left, r: r(item).right, t: r(item).top, b: r(item).bottom },
          head: head && { l: r(head).left, r: r(head).right, b: r(head).bottom },
          cfg: { l: r(c).left, r: r(c).right, t: r(c).top, b: r(c).bottom },
          border: cs?.borderTopWidth,
          rule: ccs.borderTopWidth !== '0px' && ccs.borderTopStyle === 'solid',
          marginLeft: ccs.marginLeft,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      const near = (a, b2) => Math.abs(a - b2) <= 1;
      ok(g.inItem, `${tag} · ${name} : les réglages sont dans la carte de l'option cochée`);
      ok(
        g.card &&
          near(g.cfg.l, g.head.l) &&
          near(g.cfg.r, g.head.r) &&
          g.cfg.l >= g.card.l &&
          g.cfg.r <= g.card.r + 0.5 &&
          g.cfg.b <= g.card.b + 0.5 &&
          g.marginLeft === '0px',
        `${tag} · ${name} : bords gauche et droit des réglages = ceux de la carte (±1 px), sans retrait (${JSON.stringify(
          {
            cfg: [Math.round(g.cfg.l), Math.round(g.cfg.r)],
            head: g.head && [Math.round(g.head.l), Math.round(g.head.r)],
          },
        )})`,
      );
      ok(
        g.rule && near(g.cfg.t, g.head.b),
        `${tag} · ${name} : réglages sous l'en-tête, séparés par un filet`,
      );
      ok(!g.overflow, `${tag} · ${name} : pas de défilement horizontal`);
      if (SHOTS) {
        await page.locator('.l11-item.is-open').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/acces-option-${slug}-${tag}${sfx}.png` });
      }
    }
    ok(errors.length === 0, `${tag} · aucune erreur JS ${errors.join(' | ')}`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await ctx.close();
  }
  await b.close();
})();
