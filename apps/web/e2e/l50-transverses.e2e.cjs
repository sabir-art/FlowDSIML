/**
 * Audit L50, écarts transverses (docs/ux/audit/l50-audit-ui.md §12). Données fictives.
 *  - X2 : un seul indicateur de focus sur les champs (halo au clavier, bordure inchangée) ;
 *  - X3 : pas d'aplat `hero` sur les cartes (Apprenants, centre de formation).
 * Usage : app web (:5173) et lecteur (:5174) lancés, puis `node e2e/l50-transverses.e2e.cjs`.
 */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { learnersFixture } = require('./learners-data.cjs');
const { centerFixture } = require('./center-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  /** Couleur calculée d'une variable CSS (pour comparer aux styles calculés). */
  const cssColor = (page, v) =>
    page.evaluate((name) => {
      const el = document.createElement('span');
      el.style.color = `var(${name})`;
      document.body.append(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    }, v);

  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
    const state = await install(page);
    const f = learnersFixture();
    state.learners = f.progress;
    state.learnerDetail = f.detail;

    // ===== X2 : champ de recherche de Démos =====
    await page.goto(`${APP}/#/`);
    const search = page.getByRole('searchbox', { name: 'Rechercher une démo' });
    await search.waitFor();
    const before = await search.evaluate((el) => getComputedStyle(el).borderTopColor);
    // Au clavier : focus par Tab depuis l'élément précédent
    await search.focus();
    await search.evaluate((el) => el.blur());
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const after = await search.evaluate((el) => ({
      focused: document.activeElement === el,
      border: getComputedStyle(el).borderTopColor,
      shadow: getComputedStyle(el).boxShadow,
    }));
    ok(
      after.focused && after.border === before && after.shadow !== 'none',
      `${theme} : X2, focus au clavier : halo seul, bordure inchangée (${before} → ${after.border})`,
    );

    // ===== X3 : cartes d'Apprenants sans aplat =====
    await page.goto(`${APP}/#/learners`);
    await page.waitForSelector('.l13 .kpis .fd-card');
    const surface = await cssColor(page, '--fd-color-surface');
    const kpis = await page.$$eval('.l13 .kpis .fd-card', (els) =>
      els.map((e) => getComputedStyle(e).backgroundColor),
    );
    // X1 : barres de progression en `text`, validées ou non
    const text = await cssColor(page, '--fd-color-text');
    const fills = await page.$$eval('.lp .fd-bar__fill', (els) =>
      els.map((e) => getComputedStyle(e).backgroundColor),
    );
    ok(
      fills.length > 0 && fills.every((c) => c === text),
      `${theme} : X1, progression des apprenants en text (${[...new Set(fills)].join(', ')})`,
    );
    ok(
      kpis.length >= 4 && kpis.every((c) => c === surface),
      `${theme} : X3, cartes d’Apprenants en surface, sans aplat (${[...new Set(kpis)].join(', ')})`,
    );
    await ctx.close();
  }

  // ===== X3 : centre de formation, carte « Ma formation en cours » =====
  {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/functions/v1/open-center', (r) =>
      r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(centerFixture({})),
            headers: cors,
          }),
    );
    await p.goto(`${PLAYER}/#/c/ml-exemple?l=jeton-alex-0001`);
    const me = p.getByRole('complementary', { name: 'Ma progression' });
    await me.waitFor();
    const st = await me.evaluate((el) => {
      const root = el.closest('.ctr');
      const v = (n) => getComputedStyle(root).getPropertyValue(n).trim();
      const probe = (c) => {
        const s = document.createElement('span');
        s.style.color = c;
        root.append(s);
        const out = getComputedStyle(s).color;
        s.remove();
        return out;
      };
      const link = el.querySelector('a');
      return {
        bg: getComputedStyle(el).backgroundColor,
        surface: probe(v('--c-surface')),
        link: getComputedStyle(link).backgroundColor,
        brand: probe(v('--brand')),
        bar: getComputedStyle(el.querySelector('.track span')).backgroundColor,
        barH: Math.round(el.querySelector('.track').getBoundingClientRect().height),
      };
    });
    ok(
      st.bg === st.surface && st.link === st.brand && st.bar === st.brand && st.barH === 6,
      `X3 : « Ma formation en cours » en surface, barre de 6 px et bouton aux couleurs du thème (${JSON.stringify(st)})`,
    );
    await p.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
