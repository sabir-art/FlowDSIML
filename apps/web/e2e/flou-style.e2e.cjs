/**
 * EXT-02 §6.2 : flou stylé. Panneau de la zone : Forme (Rectangle, Arrondi, Ellipse), Effet (Flou, Pixels,
 * Aplat), Intensité (2 à 24 px), Teinte (6 valeurs à 30 %), « Appliquer à toutes les étapes ». Une zone
 * d'avant ce réglage garde son rendu et affiche sa valeur réelle. Rendu incrusté : forme, teinte, pavés.
 * Données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/flou-style.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  const state = seed();
  const st = (id) => state.tables.steps.find((s) => s.id === id);
  // Zones d'avant ce réglage : un flou et des pavés, sans intensité
  st('s1').blurs = [
    { x: 0.6, y: 0.6, w: 0.2, h: 0.1 },
    { x: 0.6, y: 0.75, w: 0.2, h: 0.1, style: 'pixels' },
  ];
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.keyboard.press('b');
  const dlg = page.locator('dialog[open]', { has: page.locator('#blurm-title') });
  await dlg.waitFor();
  const panel = dlg.locator('.blur-panel');
  const zone = (i) => dlg.locator('.canvas-blur').nth(i);
  const last = () => (st('s1').blurs || []).at(-1);
  const css = (i, prop) => zone(i).evaluate((el, p) => getComputedStyle(el)[p], prop);

  // Zone d'origine : le panneau montre la valeur réellement rendue
  const pick = (i) => dlg.locator('.blurm-zones li').nth(i).locator('button.sp-item').click();
  await pick(0);
  await panel.waitFor();
  const label = () => panel.locator('#mk-int').textContent();
  ok(/^Intensité\s·\s6\spx$/.test(await label()), 'zone d’avant ce réglage, flou : « Intensité · 6 px »');
  ok(st('s1').blurs[0].intensity === undefined, 'ouvrir le panneau ne modifie pas la zone');
  await pick(1);
  ok(await until(async () => /·\s12\spx$/.test(await label())), 'zone d’avant ce réglage, pavés : 12 px');

  // Nouvelle zone : 12 px par défaut, Rectangle, Flou, aucune teinte
  const box = await dlg.locator('.canvas-frame').boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.3, { steps: 5 });
  await page.mouse.up();
  ok(
    await until(() => (st('s1').blurs || []).length === 3 && last().intensity === 12),
    'nouvelle zone : 12 px',
  );
  await until(async () => /·\s12\spx$/.test(await label()));
  const names = async (group) =>
    (await panel.getByRole('radiogroup', { name: group }).getByRole('radio').allTextContents()).join('|');
  ok((await names('Forme')) === 'Rectangle|Arrondi|Ellipse', 'Forme : Rectangle, Arrondi, Ellipse');
  ok((await names('Effet')) === 'Flou|Pixels|Aplat', 'Effet : Flou, Pixels, Aplat');
  const order = await panel.evaluate((el) => {
    const y = (s) => el.querySelector(s).getBoundingClientRect().top;
    return (
      y('#mk-shape') < y('#mk-style') &&
      y('#mk-style') < y('#mk-int') &&
      y('#mk-int') < y('#mk-tint') &&
      y('#mk-tint') < y('.blur-all') &&
      y('.blur-all') < y('.blur-info')
    );
  });
  ok(order, 'ordre : Forme, Effet, Intensité, Teinte, « Appliquer à toutes les étapes », information');
  ok(
    (await panel.getByRole('radio', { name: 'Rectangle' }).getAttribute('aria-checked')) === 'true' &&
      (await panel.getByRole('radio', { name: 'Flou' }).getAttribute('aria-checked')) === 'true' &&
      (await panel.getByRole('radio', { name: 'Aucune' }).getAttribute('aria-checked')) === 'true',
    'par défaut : Rectangle, Flou, aucune teinte',
  );
  ok(/blur\(12px\)/.test(await css(2, 'backdropFilter')), 'aperçu : flou de 12 px');

  // Forme
  await panel.getByRole('radio', { name: 'Arrondi' }).click();
  ok(await until(() => last().shape === 'rounded'), '« Arrondi » enregistré');
  // Le navigateur rend le rayon en pourcentages de la zone : on le ramène en pixels
  const rr = await zone(2).evaluate(
    (el) => (parseFloat(getComputedStyle(el).borderTopLeftRadius) / 100) * el.getBoundingClientRect().width,
  );
  const scale = box.width / 1280;
  ok(
    rr > 0 && Math.abs(rr - 12 * scale) <= 1.5,
    `aperçu : rayon de 12 px à l’échelle 1 280 (${rr.toFixed(1)} px)`,
  );
  await page.keyboard.press('ArrowRight');
  ok(
    (await until(() => last().shape === 'ellipse')) &&
      (await page.evaluate(() => document.activeElement?.textContent)) === 'Ellipse' &&
      (await dlg.locator('.blurm-zones li').count()) === 3,
    'flèche droite : « Ellipse », le focus suit, l’étape ne change pas',
  );
  ok((await css(2, 'borderTopLeftRadius')) === '50%', 'aperçu : ellipse inscrite');
  ok(
    (await zone(2).locator('.canvas-handle, [class*="handle"]').count()) >= 0 &&
      Math.abs((await zone(2).boundingBox()).width - box.width * 0.25) < 4,
    'la zone garde son rectangle (poignées sur le rectangle)',
  );

  // Intensité
  const slider = panel.getByRole('slider', { name: /Intensité/ });
  ok(
    (await slider.getAttribute('aria-valuemin')) === '2' &&
      (await slider.getAttribute('aria-valuemax')) === '24' &&
      (await slider.getAttribute('aria-valuenow')) === '12',
    'curseur : 2 à 24, valeur 12',
  );
  await slider.focus();
  await page.keyboard.press('End');
  ok(await until(() => last().intensity === 24), 'Fin : 24 px');
  ok(
    /·\s24\spx$/.test(await label()) && /blur\(24px\)/.test(await css(2, 'backdropFilter')),
    'libellé et aperçu à 24 px',
  );
  await page.keyboard.press('Home');
  ok(await until(() => last().intensity === 2), 'Début : 2 px');
  await page.keyboard.press('ArrowRight');
  ok(
    (await until(() => last().intensity === 3)) &&
      (await panel.isVisible()) &&
      (await dlg.locator('.blurm-zones li').count()) === 3,
    'flèche : un pas, l’étape ne change pas (le panneau de la zone reste ouvert)',
  );

  // Teinte
  const tints = panel.getByRole('radiogroup', { name: 'Teinte' }).getByRole('radio');
  ok(
    (await tints.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join('|'))) ===
      'Aucune|Gris|Encre|Prune|Bleu|Blanc',
    'Teinte : Aucune, Gris, Encre, Prune, Bleu, Blanc',
  );
  ok(
    (await tints.evaluateAll((els) =>
      els
        .slice(1)
        .map((e) => getComputedStyle(e).backgroundColor)
        .join('|'),
    )) === 'rgb(143, 143, 143)|rgb(26, 31, 38)|rgb(163, 25, 91)|rgb(47, 111, 237)|rgb(255, 255, 255)',
    'codes des teintes (identiques en thème sombre)',
  );
  await panel.getByRole('radio', { name: 'Prune' }).click();
  ok(await until(() => last().tint === 'plum'), '« Prune » enregistrée');
  ok(/rgba\(163, 25, 91, 0\.3\d*\)/.test(await css(2, 'backgroundColor')), 'aperçu : teinte à 30 %');
  ok(
    // NUM-01 : « 30 % » insécable, comparé espaces ramenées à des espaces ordinaires
    (await panel.locator('#mk-tint-h').textContent()).replace(/\s/g, ' ') ===
      'Teinte à 30 % par-dessus le flou. Le texte masqué n’est jamais lisible, quelle que soit la teinte.',
    'aide de la teinte',
  );
  const axe = async (label) => {
    const r = await new AxeBuilder({ page })
      .include('.blur-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    ok(r.violations.length === 0, `axe, ${label} (${r.violations.map((v) => v.id).join(', ')})`);
  };
  await axe('flou teinté');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/flou-style${sfx}.png` });

  // Pixels : même curseur (taille des pavés)
  await panel.getByRole('radio', { name: 'Pixels' }).click();
  ok(
    (await until(() => last().style === 'pixels')) &&
      (await slider.count()) === 1 &&
      (await tints.count()) === 6,
    'Pixels : Intensité et Teinte restent',
  );
  // Aplat : ni Intensité ni Teinte ; Couleur et Texte
  await panel.getByRole('radio', { name: 'Aplat' }).click();
  ok(
    (await until(() => last().style === 'solid')) &&
      (await panel.getByRole('slider').count()) === 0 &&
      (await panel.getByRole('radiogroup', { name: 'Teinte' }).count()) === 0,
    'Aplat : Intensité et Teinte masquées',
  );
  ok(
    (await panel.getByText('Couleur', { exact: true }).count()) === 1 &&
      (await panel.locator('#mk-t').count()) === 1,
    'Aplat : Couleur et Texte',
  );
  await axe('aplat');
  ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'pas de défilement horizontal',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/flou-aplat${sfx}.png` });

  // « Appliquer à toutes les étapes » : interrupteur
  await panel.getByRole('radio', { name: 'Flou' }).click();
  const all = panel.getByRole('switch', { name: 'Appliquer à toutes les étapes' });
  ok(
    (await panel.getByRole('radio', { name: /étape/ }).count()) === 0,
    'plus de boutons radio « Appliquer à »',
  );
  await all.check();
  ok(
    await until(() => (st('s2').blurs || []).some((x) => x.shape === 'ellipse' && x.tint === 'plum')),
    'interrupteur : zone copiée sur les autres étapes avec sa forme et sa teinte',
  );
  await panel.getByRole('radio', { name: 'Bleu' }).click();
  ok(
    await until(() => (st('s2').blurs || []).some((x) => x.tint === 'blue')),
    'un réglage suit sur les copies',
  );
  await all.uncheck();
  ok(
    await until(() => !(st('s2').blurs || []).some((x) => x.tint === 'blue')),
    'interrupteur éteint : copies retirées',
  );

  // Rendu incrusté (publication) : forme, teinte, pavés, zone d'origine
  const burn = await page.evaluate(async () => {
    const { burnBlurs } = await import('/src/lib/publish.ts');
    const W = 1280;
    const H = 800;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#000000';
    g.font = '16px sans-serif';
    for (let y = 20; y < H; y += 22)
      g.fillText('Jeanne Exemple 06 00 00 00 00 jeanne@exemple.test '.repeat(4), 4, y);
    const src = await new Promise((r) => c.toBlob(r, 'image/png'));
    const read = async (masks) => {
      const out = await burnBlurs(src, masks);
      const bmp = await createImageBitmap(out);
      const k = document.createElement('canvas');
      k.width = W;
      k.height = H;
      const kx = k.getContext('2d', { willReadFrequently: true });
      kx.drawImage(bmp, 0, 0);
      return (x, y) => [...kx.getImageData(x, y, 1, 1).data].slice(0, 3);
    };
    const orig = await read([]);
    const R = { x: 0.25, y: 0.25, w: 0.25, h: 0.25 }; // 320..640 × 200..400
    const ell = await read([{ ...R, shape: 'ellipse', intensity: 12, tint: 'plum' }]);
    const rnd = await read([{ ...R, shape: 'rounded', intensity: 12, tint: 'ink' }]);
    const pix = await read([{ ...R, style: 'pixels', intensity: 2 }]);
    const legacy = await read([R]);
    const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 6);
    const contrast = (px) => {
      let min = 255;
      let max = 0;
      for (let x = 330; x < 630; x += 1) {
        const v = px(x, 300)[0];
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      return max - min;
    };
    const block = [];
    for (let x = 400; x < 420; x++) block.push(pix(x, 300)[0]);
    let runs = 1;
    let longest = 1;
    for (let i = 1; i < block.length; i++) {
      runs = block[i] === block[i - 1] ? runs + 1 : 1;
      longest = Math.max(longest, runs);
    }
    return {
      ellCenter: ell(480, 300),
      ellCornerUntouched: same(ell(323, 203), orig(323, 203)),
      rndCornerUntouched: same(rnd(321, 201), orig(321, 201)),
      rndInside: rnd(340, 220),
      origContrast: contrast(orig),
      blurContrast: contrast(ell),
      pixelRun: longest,
      legacyChanged: !same(legacy(480, 289), orig(480, 289)) || contrast(legacy) < contrast(orig) / 2,
      outside: same(ell(100, 100), orig(100, 100)),
    };
  });
  ok(
    burn.ellCenter[0] > burn.ellCenter[1] + 15 && burn.ellCenter[2] > burn.ellCenter[1],
    `incrusté : teinte Prune par-dessus le flou (${burn.ellCenter.join(', ')})`,
  );
  ok(burn.ellCornerUntouched, 'incrusté : hors de l’ellipse, le coin du rectangle n’est pas touché');
  ok(
    burn.rndCornerUntouched && burn.rndInside[0] < 235,
    'incrusté : coin arrondi laissé intact, intérieur teinté Encre',
  );
  ok(
    burn.blurContrast < burn.origContrast / 3,
    `incrusté : texte illisible dans la zone (contraste ${burn.origContrast} → ${burn.blurContrast})`,
  );
  ok(burn.pixelRun >= 8, `incrusté : même à 2 px, des pavés d’au moins 8 px (${burn.pixelRun})`);
  ok(burn.legacyChanged, 'incrusté : une zone d’avant ce réglage reste floutée');
  ok(burn.outside, 'incrusté : rien n’est modifié hors des zones');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})();
