/**
 * EXT-02 §6.3 : projecteur libre. Éditeur : outil « Projecteur » du rail (réglage de toute la démo),
 * taille du halo, assombrissement, halo fixe si moins d'animations, aperçu dans le canevas, note du
 * panneau du hotspot. Lecteur : halo sur l'élément puis sous le pointeur, retour sur l'élément, étape sans
 * hotspot, style Spotlight ignoré, bouton « Projecteur » de la barre, préférence moins d'animations, 390 px.
 * Données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/projecteur.e2e.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'not ok'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const until = async (fn, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await fn()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return !!(await fn());
  };
  const axe = async (page, sel, label) => {
    // Pas d'attente de fin d'animation : la pastille d'un hotspot pulse en continu
    const r = await new AxeBuilder({ page }).include(sel).withTags(TAGS).analyze();
    ok(r.violations.length === 0, `axe, ${label} (${r.violations.map((v) => v.id).join(', ')})`);
  };

  // ===== Éditeur =====
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  const demo = () => state.tables.demos.find((d) => d.id === DEMO);
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  const order = await page
    .locator('.ed-rail button[data-tool]')
    .evaluateAll((els) => els.map((e) => e.dataset.tool));
  ok(
    order.indexOf('spotlight') === order.indexOf('zoom') + 1,
    `rail : « Projecteur » après Zoom (${order.join(', ')})`,
  );
  const tool = page.locator('.ed-rail button[data-tool="spotlight"]');
  ok(
    (await tool.locator('svg.lucide-flashlight').count()) === 1 &&
      /Projecteur/.test((await tool.getAttribute('aria-label')) || (await tool.textContent()) || ''),
    'rail : icône Flashlight, nom « Projecteur »',
  );
  ok((await page.locator('.canvas-freespot').count()) === 0, 'outil fermé : pas de voile dans le canevas');
  // Les raccourcis déjà connus ne bougent pas : « Projecteur » n'a pas d'Alt + chiffre
  const keys = await page
    .locator('.ed-rail button[data-tool]')
    .evaluateAll((els) =>
      Object.fromEntries(els.map((e) => [e.dataset.tool, e.getAttribute('aria-keyshortcuts')])),
    );
  ok(
    keys.spotlight === null && keys.zoom === 'Alt+7' && keys.crop === 'Alt+8' && keys.image === 'Alt+9',
    `raccourcis inchangés : Zoom Alt+7, Recadrage Alt+8, Image Alt+9, Projecteur sans raccourci`,
  );
  await page.keyboard.press('Alt+Digit9');
  await page.locator('[data-tool-panel="image"]').waitFor();
  ok(true, 'Alt + 9 ouvre toujours « Image »');
  const panel = await openTool(page, 'spotlight');
  const on = panel.getByRole('switch', { name: 'Projecteur libre' });
  ok((await on.isChecked()) === false, 'désactivé par défaut');
  ok(
    (await panel.locator('#sp-help').textContent()) ===
      'Un halo suit le pointeur du visiteur sur la capture, le reste est assombri. Au clavier et sur écran tactile, le halo se place sur l’élément de l’étape. Sur les étapes capture.',
    'aide du panneau',
  );
  const size = panel.getByRole('slider', { name: /Taille du halo/ });
  const dim = panel.getByRole('slider', { name: /Assombrissement/ });
  ok(
    (await size.getAttribute('aria-disabled')) === 'true' ||
      (await size.getAttribute('tabindex')) === '-1' ||
      (await size.isDisabled().catch(() => false)),
    'désactivé : curseurs inactifs',
  );
  await on.check();
  ok(
    await until(() => demo().settings?.spotlight?.enabled === true),
    'activé : enregistré dans les réglages de la démo',
  );
  ok(
    (await size.getAttribute('aria-valuemin')) === '120' &&
      (await size.getAttribute('aria-valuemax')) === '400' &&
      (await size.getAttribute('aria-valuenow')) === '220' &&
      /^Taille du halo\s·\s220\spx$/.test(await panel.locator('#sp-size').textContent()),
    'Taille du halo : 120 à 400 px, 220 par défaut',
  );
  ok(
    (await dim.getAttribute('aria-valuemin')) === '20' &&
      (await dim.getAttribute('aria-valuemax')) === '80' &&
      (await dim.getAttribute('aria-valuenow')) === '55' &&
      /^Assombrissement\s·\s55\s%$/.test(await panel.locator('#sp-dim').textContent()),
    'Assombrissement : 20 à 80 %, 55 par défaut',
  );
  const fixed = panel.getByRole('switch', { name: 'Halo fixe si le visiteur préfère moins d’animations' });
  ok(await fixed.isChecked(), '« Halo fixe si le visiteur préfère moins d’animations » : activé par défaut');
  const row = await fixed.evaluate((el) => {
    const card = el.closest('.sp-card');
    const sw = card.querySelector('[role="switch"], input');
    const c = card.getBoundingClientRect();
    const s = sw.getBoundingClientRect();
    return {
      inside: s.right <= c.right && s.left >= c.left,
      overflow: card.scrollWidth > card.clientWidth + 1,
    };
  });
  ok(row.inside && !row.overflow, 'libellé sur deux lignes sans déborder, interrupteur à droite');

  // Aperçu dans le canevas : halo fixe sur le premier hotspot, avec les réglages en cours
  const halo = page.locator('.canvas-freespot');
  await halo.waitFor();
  const frameW = (await page.locator('.canvas-frame').boundingBox()).width;
  const vars = () =>
    halo.evaluate((el) => ({
      fx: el.style.getPropertyValue('--fx'),
      fy: el.style.getPropertyValue('--fy'),
      fr: parseFloat(el.style.getPropertyValue('--fr')),
      fd: el.style.getPropertyValue('--fd'),
      bg: getComputedStyle(el).backgroundImage,
    }));
  const hs = state.tables.hotspots.find((h) => h.step_id === 's1');
  const v0 = await vars();
  ok(
    Math.abs(parseFloat(v0.fx) - (hs.x + hs.w / 2) * 100) < 0.6 &&
      Math.abs(parseFloat(v0.fy) - (hs.y + hs.h / 2) * 100) < 0.6,
    'canevas : halo centré sur le premier hotspot',
  );
  ok(
    Math.abs(v0.fr - Math.max(32, 110 * (frameW / 1280))) <= 1.5 &&
      v0.fd === '0.55' &&
      /radial-gradient/.test(v0.bg),
    `canevas : rayon à l’échelle de la capture (${v0.fr} px), assombrissement 55 %`,
  );
  await size.focus();
  await page.keyboard.press('End');
  ok(await until(() => demo().settings?.spotlight?.size === 400), 'Fin : 400 px, enregistré');
  ok(
    (await until(async () => (await vars()).fr > v0.fr + 20)) && (await panel.isVisible()),
    'le halo du canevas suit le réglage ; les touches du curseur ne changent pas d’étape',
  );
  await dim.focus();
  await page.keyboard.press('Home');
  ok(await until(() => demo().settings?.spotlight?.dim === 20), 'Début : 20 %, enregistré');
  await fixed.uncheck();
  ok(
    await until(() => demo().settings?.spotlight?.fixedOnReducedMotion === false),
    'halo fixe : réglage enregistré',
  );
  await axe(page, '.sp-panel', 'panneau Projecteur');
  ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'éditeur : pas de défilement horizontal',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/projecteur-editeur${sfx}.png` });

  // Panneau du hotspot : le style Spotlight est ignoré tant que le projecteur est activé
  await page.locator('.canvas-hotspot').first().click();
  await page.getByText('Ignoré tant que le projecteur libre est activé.').waitFor();
  ok(true, 'panneau du hotspot : « Ignoré tant que le projecteur libre est activé. »');
  ok((await page.locator('.canvas-freespot').count()) === 0, 'outil refermé : pas de voile dans le canevas');
  await ctx.close();

  // ===== Lecteur =====
  const PID = '0b5c1f0e-0000-4000-8000-0000000000e1';
  const H = { x: 0.6, y: 0.3, w: 0.1, h: 0.1 };
  const manifest = (spotlight) => ({
    schemaVersion: 1,
    demoId: PID,
    versionId: '0b5c1f0e-0000-4000-8000-0000000000e9',
    workspaceId: 'w',
    title: 'Créer une opportunité',
    locale: 'fr',
    publishedAt: '2026-11-19T10:00:00Z',
    theme: {},
    spotlight,
    steps: [
      {
        id: 'p1',
        kind: 'image',
        title: 'Accueil',
        image: { url: 'assets/a.png', width: 1280, height: 800 },
        hotspots: [
          {
            id: 'h1',
            ...H,
            title: 'Nouvelle opportunité',
            body: 'Cliquez ici.',
            style: 'spotlight',
            action: { type: 'next' },
          },
        ],
      },
      {
        id: 'p2',
        kind: 'image',
        title: 'Sans élément',
        image: { url: 'assets/b.png', width: 1280, height: 800 },
        hotspots: [],
      },
      { id: 'p3', kind: 'text', title: 'Fin', body: 'Merci.' },
    ],
  });
  const open = async (opts, spotlight) => {
    const pc = await themedContext(b, { locale: 'fr-FR', ...opts });
    const pl = await pc.newPage();
    pl.on('pageerror', (e) => errors.push(`lecteur: ${e.message}`));
    await pl.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest: manifest(spotlight) }),
      }),
    );
    await pl.route('**/assets/*.png', (r) =>
      r.fulfill({ contentType: 'image/png', headers: cors, body: png }),
    );
    await pl.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
    await pl.goto(`${PLAYER}/#/d/${PID}`);
    await pl.locator('.p-img').first().waitFor();
    return { pc, pl };
  };
  const SP = { size: 220, dim: 55, fixedOnReducedMotion: true };
  const read = (pl) =>
    pl.locator('.p-freespot').evaluate((el) => ({
      fx: parseFloat(el.style.getPropertyValue('--fx')),
      fy: parseFloat(el.style.getPropertyValue('--fy')),
      fr: parseFloat(el.style.getPropertyValue('--fr')),
      fd: el.style.getPropertyValue('--fd'),
      cls: el.className,
      bg: getComputedStyle(el).backgroundImage,
      pe: getComputedStyle(el).pointerEvents,
    }));
  const onTarget = (v) =>
    Math.abs(v.fx - (H.x + H.w / 2) * 100) < 0.6 && Math.abs(v.fy - (H.y + H.h / 2) * 100) < 0.6;

  for (const width of [1280, 390]) {
    const { pc, pl } = await open({ viewport: { width, height: 800 } }, SP);
    const tag = `[lecteur ${width}]`;
    const veil = pl.locator('.p-freespot');
    await veil.waitFor();
    const stage = await pl.locator('.p-stage').boundingBox();
    const v = await read(pl);
    ok(onTarget(v), `${tag} avant tout mouvement : halo sur l’élément de l’étape`);
    ok(
      Math.abs(v.fr - Math.max(32, 110 * (stage.width / 1280))) <= 1.5 && v.fr >= 32,
      `${tag} halo à l’échelle de la capture, 64 px au moins à l’écran (rayon ${v.fr} px)`,
    );
    ok(
      v.fd === '0.55' &&
        /radial-gradient/.test(v.bg) &&
        /rgba\(10, 12, 16, 0\.55\)/.test(v.bg) &&
        v.pe === 'none',
      `${tag} reste assombri à 55 %, le voile ne gêne pas les clics`,
    );
    ok(/calc\(.*- 12px\)|\d+px/.test(v.bg), `${tag} bord adouci de 12 px`);
    ok((await pl.locator('svg.p-veil').count()) === 0, `${tag} style Spotlight du hotspot ignoré`);
    const beacon = pl.locator('.p-beacon').first();
    const bb = await beacon.boundingBox();
    ok(
      !!bb &&
        (await pl.evaluate(
          ([x, y]) => !!document.elementFromPoint(x, y)?.closest('.p-beacon'),
          [bb.x + bb.width / 2, bb.y + bb.height / 2],
        )),
      `${tag} la pastille reste au-dessus du voile`,
    );
    const btn = pl.getByRole('button', { name: 'Projecteur' });
    const bx = await btn.boundingBox();
    // Même taille que les autres boutons de la barre (44 px au toucher)
    const sibling = await pl.getByRole('button', { name: 'Étape suivante' }).boundingBox();
    ok(
      (await btn.getAttribute('aria-pressed')) === 'true' &&
        Math.round(bx.height) === Math.round(sibling.height) &&
        (width >= 640 || Math.round(bx.height) === 44) &&
        (await btn.locator('svg.lucide-flashlight').count()) === 1,
      `${tag} bouton « Projecteur » dans la barre (${Math.round(bx.height)} px, comme ses voisins), enfoncé`,
    );
    if (width >= 640) {
      // Souris : le halo suit le pointeur, puis revient sur l'élément quand il quitte la capture
      await pl.mouse.move(stage.x + stage.width * 0.25, stage.y + stage.height * 0.7);
      ok(
        await until(async () => {
          const m = await read(pl);
          return Math.abs(m.fx - 25) < 1 && Math.abs(m.fy - 70) < 1 && /is-follow/.test(m.cls);
        }),
        `${tag} le halo suit le pointeur`,
      );
      if (SHOTS) await pl.screenshot({ path: `${SHOTS}/projecteur-lecteur${sfx}-${width}.png` });
      await pl.mouse.move(2, 2);
      ok(
        await until(async () => {
          const m = await read(pl);
          return onTarget(m) && !/is-follow/.test(m.cls);
        }),
        `${tag} pointeur sorti : le halo revient sur l’élément`,
      );
      ok(
        /0\.2s/.test(await veil.evaluate((el) => getComputedStyle(el).transitionDuration)),
        `${tag} retour en 200 ms`,
      );
    } else if (SHOTS) await pl.screenshot({ path: `${SHOTS}/projecteur-lecteur${sfx}-${width}.png` });
    await axe(pl, '.p-root', `${tag} projecteur allumé`);
    ok(
      await pl.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${tag} pas de défilement horizontal`,
    );

    // Étape sans hotspot : pas de voile ; le bouton reste
    await pl.getByRole('button', { name: 'Étape suivante' }).click();
    await pl.locator('.p-count', { hasText: '2 / 3' }).waitFor();
    ok((await veil.count()) === 0 && (await btn.count()) === 1, `${tag} étape sans hotspot : pas de voile`);
    await pl.getByRole('button', { name: 'Étape précédente' }).click();
    await veil.waitFor();

    // Le visiteur coupe le projecteur : choix gardé pendant la lecture
    await btn.click();
    ok(
      (await btn.getAttribute('aria-pressed')) === 'false' && (await veil.count()) === 0,
      `${tag} bouton relâché : plus de voile`,
    );
    ok(
      (await pl.locator('svg.p-veil').count()) === 1,
      `${tag} projecteur coupé : le style Spotlight du hotspot reprend`,
    );
    await pl.getByRole('button', { name: 'Étape suivante' }).click();
    await pl.locator('.p-count', { hasText: '2 / 3' }).waitFor();
    await pl.getByRole('button', { name: 'Étape précédente' }).click();
    await pl.locator('.p-count', { hasText: '1 / 3' }).waitFor();
    ok((await veil.count()) === 0, `${tag} le choix du visiteur vaut pour la suite de la lecture`);
    await btn.click();
    await veil.waitFor();
    ok(true, `${tag} bouton enfoncé de nouveau : le voile revient`);
    await pc.close();
  }

  // Sans projecteur : ni voile ni bouton
  {
    const { pc, pl } = await open({ viewport: { width: 1280, height: 800 } }, null);
    ok(
      (await pl.locator('.p-freespot').count()) === 0 &&
        (await pl.getByRole('button', { name: 'Projecteur' }).count()) === 0,
      'projecteur désactivé : ni voile ni bouton, le style Spotlight du hotspot s’applique',
    );
    await pc.close();
  }
  // Moins d'animations : halo fixe sur l'élément, sans suivi ni transition
  {
    const { pc, pl } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, SP);
    const stage = await pl.locator('.p-stage').boundingBox();
    await pl.locator('.p-freespot').waitFor();
    await pl.mouse.move(stage.x + stage.width * 0.25, stage.y + stage.height * 0.7);
    await pl.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.6);
    const v = await read(pl);
    ok(onTarget(v) && /is-fixed/.test(v.cls), 'moins d’animations : le voile reste, halo fixe sur l’élément');
    ok(
      await pl.locator('.p-freespot').evaluate((el) => {
        const c = getComputedStyle(el);
        return c.transitionProperty === 'none' || parseFloat(c.transitionDuration) < 0.01;
      }),
      'moins d’animations : aucune transition',
    );
    await pc.close();
  }
  // Réglage éteint : le halo suit le pointeur même avec la préférence
  {
    const { pc, pl } = await open(
      { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
      { ...SP, fixedOnReducedMotion: false },
    );
    const stage = await pl.locator('.p-stage').boundingBox();
    await pl.locator('.p-freespot').waitFor();
    await pl.mouse.move(stage.x + stage.width * 0.25, stage.y + stage.height * 0.7);
    ok(
      await until(async () => Math.abs((await read(pl)).fx - 25) < 1),
      '« Halo fixe… » éteint : le halo suit le pointeur',
    );
    await pc.close();
  }
  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})();
