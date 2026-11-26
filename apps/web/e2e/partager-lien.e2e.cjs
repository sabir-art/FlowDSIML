/**
 * Retours client, planche 2 : Partager › Lien.
 *  - ordre : bandeau d'accès, Lien de la démo, Adresse personnalisée, Paramètres d'URL ; 24 px entre sections,
 *    libellé → contrôle à 8 px ;
 *  - envoi : trois boutons icône seuls de 40 px (E-mail, Message, QR code), alignés sur le bord gauche du
 *    champ, 12 px dessous, 8 px entre eux ; infobulle au survol et au focus ; « Télécharger le QR code
 *    (PNG) » télécharge un PNG ;
 *  - envoi impossible (non publiée, ou « Sur invitation ») : aria-disabled et la raison dans l'infobulle ;
 *  - adresse personnalisée : préfixe coupé par la gauche, 55 % au plus ; sous 600 px, préfixe au-dessus
 *    (12 px), slug pleine largeur de 40 px, « Changer l'accès » en lien sous l'aide.
 * Faux Supabase, données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/partager-lien.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
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
const r = (b) => ({
  x: Math.round(b.x),
  y: Math.round(b.y),
  w: Math.round(b.width),
  h: Math.round(b.height),
});

(async () => {
  const b = await chromium.launch();
  for (const w of [1440, 390]) {
    const tag = String(w);
    const ctx = await themedContext(b, {
      viewport: { width: w, height: w > 600 ? 900 : 844 },
      locale: 'fr-FR',
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    seedExport(state, { steps: 3 });
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=link`);
    const lien = page.locator('#sh-panel-link');
    await lien.locator('#sh-pub').waitFor();
    await page.waitForTimeout(400);

    // Ordre et rythme
    const order = await lien.evaluate((el) =>
      [...el.querySelector('.shl-secs').children].map((c) =>
        c.classList.contains('shl-access')
          ? 'acces'
          : c.querySelector('#sh-pub')
            ? 'lien'
            : c.querySelector('#sh-slug')
              ? 'adresse'
              : c.classList.contains('shd-folds')
                ? 'parametres'
                : '?',
      ),
    );
    const gaps = await lien.evaluate((el) => {
      const kids = [...el.querySelector('.shl-secs').children];
      return kids
        .slice(1)
        .map((k, i) => Math.round(k.getBoundingClientRect().top - kids[i].getBoundingClientRect().bottom));
    });
    ok(
      order.join() === 'acces,lien,adresse,parametres' && gaps.every((g) => g === 24),
      `${tag} · ordre bandeau, lien, adresse, paramètres ; 24 px entre sections (${order.join()} ; ${gaps.join()})`,
    );
    const label = await lien.locator('.shl-label').boundingBox();
    const field = await lien.locator('#sh-pub').boundingBox();
    ok(
      (await lien.locator('.shl-label').innerText()) === 'Lien de la démo' &&
        Math.round(field.y - (label.y + label.height)) === 8,
      `${tag} · « Lien de la démo », libellé → champ à 8 px (${Math.round(field.y - (label.y + label.height))})`,
    );
    ok(
      (await page.locator('.shd-top .shd-access').count()) === 0,
      `${tag} · pas de pastille d’accès en en-tête`,
    );

    // Envoi : trois boutons icône
    const acts = lien.getByRole('group', { name: 'Partager ailleurs' });
    const btns = acts.locator('.fd-btn--icon');
    const boxes = [];
    for (let i = 0; i < 3; i++) boxes.push(r(await btns.nth(i).boundingBox()));
    const copy = r(await lien.locator('.fd-copy').boundingBox());
    ok(
      (await btns.count()) === 3 &&
        boxes.every((x) => x.w === 40 && x.h === 40) &&
        boxes[0].x === copy.x &&
        boxes[0].y - (copy.y + copy.h) === 12 &&
        boxes[1].x - (boxes[0].x + 40) === 8 &&
        boxes[2].x - (boxes[1].x + 40) === 8 &&
        (await acts.innerText()).trim() === '',
      `${tag} · 3 boutons icône de 40 px, bord gauche du champ, 12 px dessous, 8 px entre eux (${JSON.stringify(boxes)} ; champ ${JSON.stringify(copy)})`,
    );
    const names = await btns.evaluateAll((l) => l.map((x) => x.getAttribute('aria-label')));
    ok(
      names.join('|') === 'Envoyer par e-mail|Envoyer par message|Télécharger le QR code (PNG)',
      `${tag} · noms accessibles (${names.join(' | ')})`,
    );
    // Infobulle au survol, puis au focus
    await btns.nth(0).hover();
    await page.locator('.fd-tooltip').waitFor();
    ok(
      (await page.locator('.fd-tooltip').innerText()) === 'Envoyer par e-mail',
      `${tag} · infobulle au survol`,
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/partager-lien-infobulle-${tag}${sfx}.png` });
    await page.mouse.move(2, 2);
    await btns.nth(0).focus();
    await page.keyboard.press('Tab');
    await page.waitForFunction(
      () => document.querySelector('.fd-tooltip')?.textContent === 'Envoyer par message',
    );
    ok(true, `${tag} · infobulle au focus (« Envoyer par message »)`);
    // QR code en PNG
    const dl = page.waitForEvent('download');
    await btns.nth(2).click();
    const file = await dl;
    ok(
      /\.png$/.test(file.suggestedFilename()),
      `${tag} · QR code téléchargé en PNG (${file.suggestedFilename()})`,
    );

    // Adresse personnalisée
    const pre = await lien.locator('.sh-prefix').evaluate((el) => {
      const s = getComputedStyle(el);
      const g = el.parentElement.getBoundingClientRect();
      const p = el.getBoundingClientRect();
      return { dir: s.direction, ratio: p.width / g.width, top: p.bottom <= g.top, font: s.fontSize };
    });
    const slug = await lien.locator('#sh-slug').boundingBox();
    if (w > 600)
      ok(
        pre.dir === 'rtl' && pre.ratio <= 0.551 && Math.round(slug.height) === 40,
        `${tag} · préfixe coupé par la gauche, 55 % au plus (${pre.ratio.toFixed(2)})`,
      );
    else
      ok(
        pre.top && pre.font === '12px' && Math.round(slug.height) === 40 && slug.width > 250,
        `${tag} · préfixe au-dessus en 12 px, slug pleine largeur de 40 px (${JSON.stringify(pre)})`,
      );
    // Bandeau d'accès : bouton à 1440, lien sous l'aide à 390
    const btnVis = await lien.locator('.shl-access__btn').isVisible();
    const linkVis = await lien.locator('.shl-access__link').isVisible();
    ok(
      w > 600 ? btnVis && !linkVis : !btnVis && linkVis,
      `${tag} · « Changer l’accès » en ${w > 600 ? 'bouton' : 'lien sous l’aide'}`,
    );
    const lines = await lien
      .locator('.shl-access')
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));
    if (w <= 600) ok(lines <= 96, `${tag} · bandeau d’accès en 3 lignes au plus (${lines} px)`);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(scroll, `${tag} · aucun débordement horizontal`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/partager-lien-${tag}${sfx}.png` });
    const bad = (
      await new AxeBuilder({ page })
        .include('#sh-panel-link')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations.map((v) => v.id);
    ok(bad.length === 0, `${tag} · axe (${bad.join(', ')})`);

    // Envoi impossible : accès « Sur invitation »
    state.tables.demo_access = [{ demo_id: DEMO, mode: 'invite', ask_email: false, domains: [] }];
    await page.reload();
    await lien.locator('#sh-pub').waitFor();
    await page.waitForTimeout(400);
    const off = await btns.evaluateAll((l) => l.map((x) => x.getAttribute('aria-disabled')));
    await btns.nth(1).hover();
    await page.locator('.fd-tooltip').waitFor();
    ok(
      off.every((x) => x === 'true') &&
        (await page.locator('.fd-tooltip').innerText()) ===
          'Accès sur invitation : invitez les personnes depuis Accès.',
      `${tag} · « Sur invitation » : envoi grisé (aria-disabled), raison dans l’infobulle`,
    );
    ok(errors.length === 0, `${tag} · aucune erreur JS (${errors.join(' | ')})`);
    await ctx.close();
  }
  // Démo non publiée : raison « Publiez la démo pour envoyer son lien. »
  {
    const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    const page = await ctx.newPage();
    await install(page, seed());
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=link`);
    const btns = page.locator('#sh-panel-link .shl-acts .fd-btn--icon');
    await btns.first().waitFor();
    await page.waitForTimeout(400);
    await btns.nth(0).hover();
    await page.locator('.fd-tooltip').waitFor();
    ok(
      (await btns.first().getAttribute('aria-disabled')) === 'true' &&
        (await page.locator('.fd-tooltip').innerText()) === 'Publiez la démo pour envoyer son lien.',
      'non publiée : envoi grisé, « Publiez la démo pour envoyer son lien. »',
    );
    await ctx.close();
  }
  await b.close();
})();
