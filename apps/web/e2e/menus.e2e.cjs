/** Test e2e des overlays (§15.7) : menus rendus dans #fd-portal, entièrement visibles, à 8 px des bords. */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  /** Vérifie que le menu ouvert est dans le portail et que chaque élément est entièrement visible. */
  async function checkMenu(page, name) {
    const menu = page.locator('[role=menu]');
    await menu.waitFor();
    ok(await menu.evaluate((el) => el.parentElement?.id === 'fd-portal'), `${name} : rendu dans #fd-portal`);
    const vp = page.viewportSize();
    const box = await menu.boundingBox();
    ok(
      box.x >= 8 &&
        box.y >= 8 &&
        box.x + box.width <= vp.width - 8 + 0.5 &&
        box.y + box.height <= vp.height - 8 + 0.5,
      `${name} : menu à 8 px au moins des bords (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)})`,
    );
    const items = page.locator('[role=menu] [role^=menuitem]');
    const n = await items.count();
    let all = n > 0;
    for (let i = 0; i < n; i++) {
      const r = await items.nth(i).boundingBox();
      const visible = await items.nth(i).evaluate((el) => {
        const rr = el.getBoundingClientRect();
        const hit = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
        return !!hit && (hit === el || el.contains(hit));
      });
      if (!r || r.x < 0 || r.y < 0 || r.x + r.width > vp.width || r.y + r.height > vp.height || !visible)
        all = false;
    }
    ok(all, `${name} : les ${n} éléments sont entièrement visibles et cliquables`);
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('[role=menu] .menu-item')].some(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ),
    );
    ok(!clipped, `${name} : aucun libellé coupé`);
  }

  for (const [w, h] of [
    [1440, 900],
    [1024, 768],
    [390, 844],
  ]) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page);
    await page.goto(`${APP}/#/`);
    await page.waitForSelector('.demo-card');
    if (w < 1024) {
      // DB1 : Échap ferme le tiroir de navigation et rend le focus au bouton menu
      const burger = page.getByRole('button', { name: 'Ouvrir le menu' });
      await burger.click();
      await page.waitForTimeout(300);
      ok(
        await page.evaluate(() => document.getElementById('sidebar').contains(document.activeElement)),
        `${w}px : focus placé dans le tiroir`,
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      ok(
        !(await page.locator('.shell').evaluate((el) => el.classList.contains('nav-open'))),
        `${w}px : Échap ferme le tiroir`,
      );
      ok(
        await page
          .getByRole('button', { name: 'Ouvrir le menu' })
          .evaluate((el) => el === document.activeElement),
        `${w}px : focus rendu au bouton menu`,
      );
      for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
      ok(
        await page.evaluate(() => !document.getElementById('sidebar').contains(document.activeElement)),
        `${w}px : tiroir fermé hors de l'ordre de tabulation`,
      );
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
      await page.waitForTimeout(300);
      for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
      ok(
        await page.evaluate(() => document.getElementById('sidebar').contains(document.activeElement)),
        `${w}px : focus piégé dans le tiroir ouvert`,
      );
    }
    const account = page.getByRole('button', { name: 'Mon compte' });
    await account.click();
    await checkMenu(page, `${w}px menu du compte`);
    ok(
      (await page.getByRole('menuitemradio').count()) === 3,
      `${w}px : sélecteur de thème dans le menu du compte`,
    );
    await page.keyboard.press('Escape');
    ok(
      await account.evaluate((el) => el === document.activeElement),
      `${w}px : Échap ferme et rend le focus`,
    );
    if (w < 1024) {
      await page.mouse.click(w - 6, h / 2); // voile à droite du tiroir
      await page.waitForTimeout(300);
    }

    // Menu ⋯ de la dernière carte (la plus à droite)
    await page.locator('.demo-card .menu-trigger').last().click();
    await checkMenu(page, `${w}px menu ⋯ d'une carte`);
    await page.mouse.click(5, h - 5);
    ok((await page.locator('[role=menu]').count()) === 0, `${w}px : clic extérieur ferme le menu`);
    await page.close();
  }
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
