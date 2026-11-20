/**
 * L44 : infobulles des boutons à icône (données fictives, pages de a11y.e2e.cjs).
 *  - Inventaire : sur toutes les pages de l'app, du lecteur et du centre, chaque bouton ou lien visible
 *    sans texte a un nom (aria-label) et plus aucun `title` (repris par l'infobulle).
 *  - Clavier : ouverture immédiate à la tabulation, sous la barre du haut, libellé seul masqué aux
 *    lecteurs d'écran ; Échap ferme l'infobulle sans fermer la modale parente.
 *  - Survol : ouverture après 300 ms.
 *  - Lecteur à 390 et 1 280 px : Langue et Plein écran entiers, flèche dans l'axe de l'icône.
 * Usage : app web (:5173) et player (:5174) lancés, puis `node e2e/infobulles.e2e.cjs [filtre…]`.
 */
const { chromium } = require('playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');

/** Boutons et liens visibles sans texte : nom accessible et absence de `title`. */
function inventory() {
  const hidden = '.sr-only, .visually-hidden';
  const text = (el) => {
    let out = '';
    const walk = (n) => {
      if (n.nodeType === 3) out += n.textContent;
      else if (n.nodeType === 1 && !n.matches(hidden)) n.childNodes.forEach(walk);
    };
    el.childNodes.forEach(walk);
    return out.trim();
  };
  const out = [];
  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden' || text(el)) continue;
    const name =
      el.getAttribute('aria-label') ||
      (el.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ')
        .trim() ||
      el.dataset.tip ||
      '';
    const why = !name.trim() ? 'sans nom' : el.hasAttribute('title') ? 'title restant' : '';
    out.push({ name: name || el.outerHTML.slice(0, 80), why });
  }
  return out;
}

/** Géométrie de l'infobulle ouverte par rapport à son bouton. */
function tipGeometry(sel) {
  const tip = document.querySelector('.fd-tooltip');
  const btn = document.querySelector(sel);
  if (!tip || !btn) return null;
  const t = tip.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  const arrow = parseFloat(tip.style.getPropertyValue('--fd-tip-arrow'));
  const side = tip.dataset.side;
  return {
    text: tip.textContent,
    side,
    hidden: tip.getAttribute('aria-hidden'),
    inside:
      t.left >= 0 && t.top >= 0 && t.right <= innerWidth && t.bottom <= document.documentElement.clientHeight,
    arrowOnIcon:
      side === 'top' || side === 'bottom'
        ? Math.abs(t.left + arrow - (b.left + b.width / 2)) <= 1
        : Math.abs(t.top + arrow - (b.top + b.height / 2)) <= 1,
    gap: side === 'top' ? b.top - t.bottom : side === 'bottom' ? t.top - b.bottom : null,
  };
}

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  // ===== Comportement =====
  if (!only.length) {
    const dash = APP_PAGES.find((s) => s.route === '/#/' || s.route === '/#/demos') ?? APP_PAGES[3];
    await appPage(b, dash, 'light', async (p) => {
      const bell = p.locator('.nb-bell:visible').first();
      const label = await bell.getAttribute('aria-label');
      await bell.focus();
      await p.keyboard.press('Shift+Tab');
      await p.keyboard.press('Tab');
      await p.waitForSelector('.fd-tooltip', { timeout: 1000 });
      const g = await p.evaluate(tipGeometry, '.nb-bell');
      ok(g && g.text === label, `clavier : infobulle immédiate « ${label} »`);
      ok(g && g.side === 'bottom' && Math.abs(g.gap - 8) <= 1, 'barre du haut : infobulle dessous, à 8 px');
      ok(
        g && g.hidden === 'true',
        'libellé seul : bulle masquée aux lecteurs d’écran (nom non lu deux fois)',
      );
      ok(g && g.arrowOnIcon && g.inside, 'flèche dans l’axe de l’icône, bulle entière');
      await p.keyboard.press('Escape');
      ok((await p.locator('.fd-tooltip').count()) === 0, 'Échap ferme l’infobulle');
      // Raccourci : lu comme description
      await p.keyboard.press('Shift+Tab');
      await p.waitForSelector('.fd-tooltip', { timeout: 1000 });
      const help = await p.evaluate(() => {
        const tip = document.querySelector('.fd-tooltip');
        const btn = document.activeElement;
        return {
          help: btn.classList.contains('help-btn'),
          kbd: [...tip.querySelectorAll('kbd')].map((k) => k.textContent).join('+'),
          described: btn.getAttribute('aria-describedby') === tip.id && !tip.hasAttribute('aria-hidden'),
          spoken: tip.querySelector('.fd-tooltip__keys').getAttribute('aria-label'),
        };
      });
      ok(
        help.help && help.kbd === 'F1' && help.described && help.spoken === 'raccourci F1',
        'Aide : raccourci F1 dans une pastille, lu comme description',
      );
      await p.keyboard.press('Escape');
      // Survol : 300 ms
      await p.mouse.move(5, 5);
      await p.waitForTimeout(600);
      await bell.hover();
      await p.waitForTimeout(150);
      const early = await p.locator('.fd-tooltip').count();
      await p.waitForTimeout(300);
      ok(early === 0 && (await p.locator('.fd-tooltip').count()) === 1, 'survol : ouverture après 300 ms');
      await p.mouse.move(5, 5);
      await p.waitForTimeout(250);
      ok((await p.locator('.fd-tooltip').count()) === 0, 'survol quitté : infobulle fermée');
      return [];
    });

    // Échap dans une modale : l'infobulle se ferme, la modale reste ouverte
    const modal = APP_PAGES.find((s) => s.name === 'Démos · export PDF');
    if (modal)
      await appPage(b, modal, 'light', async (p) => {
        const dlg = p.getByRole('dialog').first();
        const close = dlg.locator('button[aria-label]').first();
        await close.focus();
        await p.keyboard.press('Shift+Tab');
        await p.keyboard.press('Tab');
        const opened = await p
          .waitForSelector('.fd-tooltip', { timeout: 1000 })
          .then(() => true)
          .catch(() => false);
        await p.keyboard.press('Escape');
        ok(
          opened && (await p.locator('.fd-tooltip').count()) === 0 && (await dlg.isVisible()),
          `Échap dans « ${modal.name} » : infobulle fermée, modale ouverte`,
        );
        return [];
      });

    // Lecteur : Langue et Plein écran au bord droit, à 390 et 1 280 px
    for (const width of [390, 1280])
      await playerPage(b, PLAYER_PAGES[0], 'light', async (p) => {
        await p.setViewportSize({ width, height: width < 500 ? 844 : 800 });
        await p.waitForTimeout(400);
        for (const name of ['Langue', 'Plein écran']) {
          const btn = p.getByRole('button', { name, exact: false }).last();
          if (!(await btn.count()) || !(await btn.isVisible())) {
            // Sous 500 px, Langue et Plein écran quittent la barre (réglages compacts du lecteur)
            ok(
              width < 500,
              `lecteur ${width} px : « ${name} » ${width < 500 ? 'masqué sur mobile' : 'présent'}`,
            );
            continue;
          }
          await btn.hover();
          await p.waitForSelector('.fd-tooltip', { timeout: 1500 });
          const id = await btn.evaluate((el) => {
            el.dataset.tipProbe = '1';
            return '[data-tip-probe="1"]';
          });
          const g = await p.evaluate(tipGeometry, id);
          await btn.evaluate((el) => delete el.dataset.tipProbe);
          ok(g && g.inside && g.arrowOnIcon, `lecteur ${width} px : « ${name} » entière, flèche sur l’icône`);
          await p.mouse.move(5, 5);
          await p.waitForTimeout(250);
        }
        return [];
      });
  }

  // ===== Inventaire =====
  const pages = [
    ...APP_PAGES.map((s) => ({ ...s, kind: 'app' })),
    ...PLAYER_PAGES.map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));
  let count = 0;
  let bad = 0;
  const check = (p) => p.evaluate(inventory);
  for (const s of pages) {
    let m;
    try {
      m = s.kind === 'app' ? await appPage(b, s, 'light', check) : await playerPage(b, s, 'light', check);
    } catch (e) {
      console.log(`NOT OK - ${s.name} : inventaire impossible (${e.message.split('\n')[0]})`);
      process.exitCode = 1;
      continue;
    }
    count += m.length;
    const ko = m.filter((x) => x.why);
    bad += ko.length;
    console.log(`${ko.length ? 'NOT OK' : 'ok'} - ${s.name} : ${m.length} bouton(s) à icône`);
    for (const x of ko) console.log(`    « ${x.name} » : ${x.why}`);
  }
  await b.close();
  console.log(`\n${bad} bouton(s) à icône sans nom ou avec title, sur ${count} (${pages.length} pages)`);
  if (bad) process.exitCode = 1;
})();
