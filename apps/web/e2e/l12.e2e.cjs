/** L12 : gains rapides de l'éditeur (libellés, style, rechercher-remplacer, annulation, raccourcis). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  // Deuxième étape avec bulle, pour « Appliquer à toutes les étapes »
  state.tables.hotspots.push({
    ...state.tables.hotspots[0],
    id: 'h2',
    step_id: 's2',
    title: 'Ouvrir le rapport',
    body: 'Le rapport mensuel de {{company}}',
    placement: 'top',
    position: 0,
  });
  await install(page, state);
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const hs = (id) => state.tables.hotspots.find((h) => h.id === id);
  const st = (id) => state.tables.steps.find((s) => s.id === id);

  await page.goto(`${BASE}/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.locator('.canvas-hotspot').first().click();
  await page.waitForSelector('#hs-next');

  // L12-05 : libellés des boutons, montrés tout de suite dans la bulle du canevas
  await page.fill('#hs-next', 'J’ai compris');
  await page.fill('#hs-prev', 'Retour');
  await page.getByLabel('Afficher « Précédent »').check();
  ok((await page.textContent('#hs-next-c')).trim() === '12 / 24', 'L12-05 : compteur de 24 caractères');
  await page.waitForTimeout(900);
  ok(
    st('s1').options?.buttonLabel === 'J’ai compris' && st('s1').options?.showPrev === true,
    'L12-05 : libellés enregistrés dans les options de l’étape',
  );

  // L12-03 : appliquer le style à toutes les étapes, puis Ctrl Z (une seule annulation)
  await page.locator('[data-canvas-item]').first().click();
  await page.getByRole('button', { name: 'Appliquer à toutes les étapes…' }).click();
  await page.waitForSelector('.modal');
  ok(
    !(await page
      .locator('.modal')
      .getByRole('checkbox', { name: /Type de guidage/ })
      .isChecked()),
    'L12-03 : type de guidage décoché par défaut',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l12-style.png` });
  await page.getByRole('button', { name: /Appliquer à 1 étape/ }).click();
  await page.waitForSelector('.toast');
  await page.waitForTimeout(900);
  ok(
    hs('h2').placement === hs('h1').placement && st('s2').options?.buttonLabel === 'J’ai compris',
    'L12-03 : position et libellés copiés sur l’autre étape',
  );
  ok(/Ctrl Z pour annuler/.test(await page.textContent('.toast')), 'L12-03 : toast avec annulation');
  await page.locator('.stage-head').click();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(900);
  ok(
    hs('h2').placement === 'top' && !st('s2').options?.buttonLabel,
    'L12-03 : Ctrl Z annule l’application en une seule étape',
  );
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(900);
  ok(st('s2').options?.buttonLabel === 'J’ai compris', 'Ctrl Maj Z rétablit');

  // L12-04 : rechercher et remplacer
  await page.keyboard.press('Control+f');
  await page.waitForSelector('.find');
  await page.fill('#find-q', 'rapport');
  ok(/1 sur 2/.test(await page.textContent('.find .count')), 'L12-04 : compteur « 1 sur n »');
  ok((await page.locator('.rail-hits').count()) === 1, 'L12-04 : pastille orange sur la vignette');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l12-find.png` });
  await page.fill('.find input[aria-label="Remplacer par"]', 'tableau');
  await page.getByRole('button', { name: /Tout remplacer \(2\)/ }).click();
  await page.waitForTimeout(900);
  ok(
    hs('h2').title === 'Ouvrir le tableau' && hs('h2').body === 'Le tableau mensuel de {{company}}',
    'L12-04 : tout remplacer, variables intactes',
  );
  await page.fill('#find-q', 'company');
  ok(
    (await page.locator('.find .count').textContent()).includes('0 sur 0'),
    'L12-04 : une variable n’est jamais un résultat',
  );
  await page.keyboard.press('Escape');
  await page.waitForSelector('.find', { state: 'detached' });
  await page.locator('.stage-head').click();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(900);
  ok(hs('h2').title === 'Ouvrir le rapport', 'L12-04 : Ctrl Z annule « Tout remplacer »');

  // L12-06 : raccourcis
  await page.keyboard.press('?');
  await page.waitForSelector('.kb-modal');
  ok((await page.locator('.kb-grid section').count()) === 4, 'L12-06 : quatre groupes de raccourcis');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l12-keys.png` });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.kb-modal', { state: 'detached' });
  await page.keyboard.press('h');
  ok(
    (await page.getByRole('button', { name: /hotspot/i, pressed: true }).count()) >= 1,
    'L12-06 : H active l’outil hotspot',
  );

  await page.keyboard.press('Escape');

  // L12-01 : masque opaque (outil B, Aplat, couleur, texte), puis toutes les étapes
  await page.keyboard.press('b');
  const box = await page.locator('.canvas-frame').boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.2, { steps: 5 });
  await page.mouse.up();
  await page.waitForSelector('.blur-panel');
  await page.getByRole('radio', { name: 'Aplat' }).click();
  await page.getByRole('button', { name: 'Blanc' }).click();
  await page.fill('#mk-t', 'Donnée masquée');
  await page.waitForTimeout(900);
  const m1 = (st('s1').blurs || []).at(-1);
  ok(
    m1?.style === 'solid' && m1.color === '#FFFFFF' && m1.text === 'Donnée masquée',
    'L12-01 : aplat blanc avec texte enregistré',
  );
  ok(
    (await page.textContent('.canvas-blur-tag')).trim() === 'Masque',
    'L12-01 : étiquette « Masque » sur le canevas',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l12-mask.png` });
  await page.getByLabel('Toutes les étapes, même position').check();
  await page.waitForTimeout(900);
  ok(
    (st('s2').blurs || []).some((b) => b.style === 'solid' && b.text === 'Donnée masquée'),
    'L12-01 : masque copié sur les autres étapes, même position',
  );
  await page.getByLabel('Cette étape seulement').check();
  await page.waitForTimeout(900);
  ok(!(st('s2').blurs || []).some((b) => b.text === 'Donnée masquée'), 'L12-01 : copies retirées');

  // L12-02 : zoom déplaçable au clavier
  await page
    .getByRole('button', { name: /Retour à l’étape|Étape/ })
    .first()
    .click()
    .catch(() => {});
  await page.keyboard.press('Escape');
  await page
    .getByLabel('Zoomer sur une zone')
    .check()
    .catch(async () => {
      await page.locator('#zoom-on').check();
    });
  await page.waitForSelector('.canvas-zoom');
  await page
    .getByRole('radio', { name: '300 %' })
    .click()
    .catch(async () => {
      await page.locator('.zoom-levels button').nth(2).click();
    });
  await page.locator('.canvas-zoom').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(900);
  const z = st('s1').zoom;
  ok(
    z && z.scale === 3 && Math.abs(z.x - 0.6) < 0.001,
    'L12-02 : niveau 300 % et déplacement de 10 % (Maj + flèche)',
  );
  ok(
    /Zoom 300/.test(await page.getAttribute('.canvas-zoom', 'aria-valuetext')),
    'L12-02 : cadre en role="slider" avec position décrite',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l12-zoom.png` });

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
