/**
 * Contrôle CI de COMP-01 §9 : aucun contrôle natif visible dans l'app ni dans le lecteur.
 *  1. Sur toutes les pages d'a11y.e2e.cjs (app et lecteur), en clair et en sombre : aucun `<select>`, aucun
 *     `<input type="date|time|datetime-local|month|week|color|range">` visible (taille non nulle, hors
 *     `sr-only`), hors des internes d'un composant marqués `data-comp-internal`.
 *  2. Chaque `<input type="file">` est masqué en `sr-only` (jamais `display: none`) et relié à un bouton
 *     visible (`aria-controls`) ou à un libellé (`<label>`, `aria-label` ou `aria-labelledby`).
 *  3. Chaque Select maison et chaque menu est ouvert : rôles, `aria-expanded`, `aria-activedescendant`
 *     valide, axe sans violation grave sur l'état ouvert, Échap referme et rend le focus au déclencheur.
 *  4. Clavier du Select : Entrée ouvre, Flèche bas deux fois, Entrée choisit ; la valeur change.
 *  5. Positionnement : un Select ouvert en bas de la fenêtre s'ouvre au-dessus, entièrement visible.
 * Usage : app web (:5173) et lecteur (:5174) lancés, puis `node e2e/controles-natifs.e2e.cjs [filtre…]`.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

/** Dans la page : contrôles natifs visibles et champs fichier mal masqués ou sans bouton. */
function natives() {
  const out = [];
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const srOnly = (el) => {
    const r = el.getBoundingClientRect();
    return el.classList.contains('sr-only') || (r.width <= 1 && r.height <= 1);
  };
  const name = (el) =>
    (el.getAttribute('aria-label') || el.id || el.name || el.className || el.tagName)
      .toString()
      .trim()
      .slice(0, 50);
  const sel =
    'select, input[type=date], input[type=time], input[type=datetime-local], input[type=month], input[type=week], input[type=color], input[type=range]';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[data-comp-internal]') || !shown(el) || srOnly(el)) continue;
    out.push({
      name: name(el),
      why: `${el.tagName.toLowerCase()}${el.type ? `[type=${el.type}]` : ''} natif visible`,
    });
  }
  for (const el of document.querySelectorAll('input[type=file]')) {
    const cs = getComputedStyle(el);
    if (el.hidden || cs.display === 'none') {
      out.push({ name: name(el), why: 'champ fichier en display: none (attendu : sr-only)' });
      continue;
    }
    if (!srOnly(el)) out.push({ name: name(el), why: 'champ fichier visible (attendu : sr-only)' });
    const linked =
      (el.id && document.querySelector(`[aria-controls="${CSS.escape(el.id)}"]`)) ||
      (el.labels && el.labels.length > 0) ||
      el.closest('label') ||
      // Champ ouvert par une entrée de menu ou un bouton absent à cet instant : il porte le nom de son action
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby');
    if (!linked) out.push({ name: name(el), why: 'champ fichier sans bouton (aria-controls) ni libellé' });
  }
  return out;
}

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const pages = [
    ...APP_PAGES.map((s) => ({ ...s, kind: 'app' })),
    ...PLAYER_PAGES.map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));

  // ===== 1 et 2 : aucun contrôle natif visible, champs fichier masqués et reliés =====
  let bad = 0;
  for (const theme of ['light', 'dark'])
    for (const s of pages) {
      let m;
      try {
        const check = (p) => p.evaluate(natives);
        m = s.kind === 'app' ? await appPage(b, s, theme, check) : await playerPage(b, s, theme, check);
      } catch (e) {
        console.log(`NOT OK - ${s.name} (${theme}) : contrôle impossible (${e.message.split('\n')[0]})`);
        process.exitCode = 1;
        continue;
      }
      bad += m.length;
      console.log(`${m.length ? 'NOT OK' : 'ok'} - ${s.name} (${theme})`);
      for (const x of m) console.log(`    « ${x.name} » : ${x.why}`);
    }
  if (bad) process.exitCode = 1;
  console.log(`${bad} contrôle(s) natif(s) sur ${pages.length} pages × 2 thèmes`);

  // ===== 3 : Select et menus ouverts (rôles, ARIA, axe, Échap) =====
  /** Ouvre jusqu'à 3 Select et 1 menu de la page ; renvoie les écarts. */
  const opened = async (p) => {
    const out = [];
    const axe = async (what) => {
      const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (serious.length) out.push(`${what} : axe ${serious.map((v) => v.id).join(', ')}`);
    };
    // Une modale ouverte masque le reste de la page : on ouvre alors les listes de la modale
    const modal = p.locator('dialog[open], [role="dialog"][aria-modal="true"]').last();
    const scope = (await modal.count()) ? modal : p.locator('body');
    const settled = (el) =>
      el.evaluate((n) => Promise.all(n.getAnimations({ subtree: true }).map((a) => a.finished)));
    const triggers = scope.locator('[role="combobox"].fd-sel:not([disabled]):visible');
    const n = Math.min(3, await triggers.count());
    for (let i = 0; i < n; i++) {
      const t = triggers.nth(i);
      const label = (await t.getAttribute('aria-label')) || (await t.getAttribute('id')) || `select ${i + 1}`;
      await t.scrollIntoViewIfNeeded();
      await t.click();
      const list = p.locator('.fd-sel-pop [role="listbox"]');
      if (!(await list.count())) {
        out.push(`${label} : la liste ne s'ouvre pas`);
        continue;
      }
      // Fin de l'animation d'ouverture de la liste (la page peut avoir d'autres animations sans fin)
      await settled(p.locator('.fd-sel-pop'));
      if ((await t.getAttribute('aria-expanded')) !== 'true')
        out.push(`${label} : aria-expanded absent à l'ouverture`);
      const active =
        (await t.getAttribute('aria-activedescendant')) ||
        (await p
          .locator('.fd-sel-pop [role="combobox"]')
          .getAttribute('aria-activedescendant')
          .catch(() => null));
      if (active && !(await p.locator(`[id="${active}"]`).count()))
        out.push(`${label} : aria-activedescendant sans cible (${active})`);
      await axe(label);
      await p.keyboard.press('Escape');
      await list.waitFor({ state: 'detached' });
      if ((await t.getAttribute('aria-expanded')) !== 'false')
        out.push(`${label} : aria-expanded reste vrai après Échap`);
      if (!(await t.evaluate((el) => el === document.activeElement)))
        out.push(`${label} : le focus ne revient pas au déclencheur`);
    }
    const menu = scope.locator('[aria-haspopup="menu"]:visible').first();
    if (await menu.count()) {
      const label = (await menu.getAttribute('aria-label')) || 'menu';
      await menu.scrollIntoViewIfNeeded();
      await menu.click();
      const items = p.locator('[role="menu"] [role="menuitem"], [role="menu"] [role="menuitemradio"]');
      if (!(await items.count())) out.push(`${label} : le menu ne s'ouvre pas`);
      else {
        if ((await menu.getAttribute('aria-expanded')) !== 'true')
          out.push(`${label} : aria-expanded absent`);
        await axe(label);
        await p.keyboard.press('Escape');
        await p.locator('[role="menu"]').first().waitFor({ state: 'detached' });
        if (!(await menu.evaluate((el) => el === document.activeElement)))
          out.push(`${label} : le focus ne revient pas au déclencheur`);
      }
    }
    return out;
  };
  for (const s of pages.filter((x) => x.kind === 'app' && !x.open)) {
    let m;
    try {
      m = await appPage(b, s, 'light', opened);
    } catch (e) {
      m = [`contrôle impossible (${e.message.split('\n')[0]})`];
    }
    ok(m.length === 0, `Listes et menus ouverts · ${s.name}${m.length ? ` : ${m.join(' ; ')}` : ''}`);
  }

  // ===== 4 et 5 : clavier et positionnement du Select (Paramètres › Sécurité, durée maximale des liens) =====
  if (!only.length) {
    const page = await (
      await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
    ).newPage();
    await install(page, seed());
    await page.goto(`${APP}/#/settings/security`);
    const t = page.locator('.sr-card [role="combobox"].fd-sel').first();
    await t.waitFor();
    const before = await t.getAttribute('data-value');
    await t.focus();
    await page.keyboard.press('Enter');
    await page.locator('.fd-sel-pop [role="listbox"]').waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.locator('.fd-sel-pop').waitFor({ state: 'detached' });
    ok(
      (await t.getAttribute('data-value')) !== before && (await t.getAttribute('aria-expanded')) === 'false',
      `clavier : Entrée, Flèche bas × 2, Entrée change la valeur (${before} → ${await t.getAttribute('data-value')})`,
    );
    // Fenêtre basse : le déclencheur est en bas, la liste passe au-dessus et reste dans la fenêtre
    const box = await t.boundingBox();
    await page.setViewportSize({ width: 1440, height: Math.max(320, Math.round(box.y + box.height + 24)) });
    await t.scrollIntoViewIfNeeded();
    await t.click();
    const pop = page.locator('.fd-sel-pop');
    await pop.waitFor();
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const pb = await pop.boundingBox();
    const tb = await t.boundingBox();
    const vp = page.viewportSize();
    ok(
      pb.y >= 0 && pb.y + pb.height <= vp.height + 1 && pb.x >= 0 && pb.x + pb.width <= vp.width + 1,
      `positionnement : liste entièrement visible (${Math.round(pb.y)} à ${Math.round(pb.y + pb.height)} sur ${vp.height})`,
    );
    ok(pb.y + pb.height <= tb.y + 1, 'positionnement : sans place en dessous, la liste s’ouvre au-dessus');
    await page.context().close();
  }

  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
