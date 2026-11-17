/** Test e2e de l'éditeur (faux Supabase). Usage : app web lancée sur :5173 avec VITE_SUPABASE_ANON_KEY défini. */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };

  await page.goto(`${BASE}/#/demos/0b5c1f0e-0000-4000-8000-000000000001/edit`);
  await page.waitForSelector('.canvas-frame img');
  ok((await page.locator('.steplist li').count()) === 3, 'liste des 3 étapes');
  ok((await page.locator('.canvas-hotspot').count()) === 1, 'hotspot affiché sur l’étape 1');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor.png` });

  // Sélection du hotspot → panneau
  await page.locator('.canvas-hotspot').first().click();
  await page.waitForSelector('#hs-title');
  await page.fill('#hs-title', 'Créez votre opportunité');
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' && c.path.endsWith('/hotspots') && c.body?.title === 'Créez votre opportunité',
    ),
    'modification du hotspot enregistrée',
  );

  // Déplacement du hotspot
  const box = await page.locator('.canvas-hotspot').first().boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y - 60, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) => c.method === 'PATCH' && c.path.endsWith('/hotspots') && typeof c.body?.x === 'number',
    ),
    'déplacement du hotspot enregistré',
  );

  // Clavier (ED1) : focus, flèche droite ×5 avec Maj, Suppr
  await page.getByRole('tab', { name: 'Étape' }).click();
  const hs = page.locator('.canvas-hotspot').first();
  await hs.focus();
  await page.keyboard.press('Enter');
  const before = Number((await hs.getAttribute('style')).match(/left: ([\d.]+)%/)[1]);
  await page.keyboard.press('Shift+ArrowRight');
  const after = Number((await hs.getAttribute('style')).match(/left: ([\d.]+)%/)[1]);
  ok(Math.abs(after - before - 5) < 0.6, 'hotspot déplacé au clavier (Maj+→ = 5 %)');
  ok((await page.textContent('[aria-live="polite"]')).includes('%'), 'annonce aria-live du déplacement');

  // Ajout d'un hotspot avec l'outil
  await page.getByRole('button', { name: 'Hotspot', exact: true }).click();
  const frame = await page.locator('.canvas-frame').boundingBox();
  await page.mouse.click(frame.x + frame.width * 0.8, frame.y + frame.height * 0.2);
  await page.waitForTimeout(300);
  ok((await page.locator('.canvas-hotspot').count()) === 2, 'nouveau hotspot ajouté');

  // Flou
  await page.getByRole('button', { name: 'Flou', exact: true }).click();
  await page.mouse.move(frame.x + 50, frame.y + 50);
  await page.mouse.down();
  await page.mouse.move(frame.x + 250, frame.y + 100, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) =>
        c.method === 'PATCH' &&
        c.path.endsWith('/steps') &&
        Array.isArray(c.body?.blurs) &&
        c.body.blurs.length === 1,
    ),
    'zone floutée ajoutée',
  );

  // Réordonnancement
  await page.locator('.steplist li').nth(2).hover();
  await page.locator('.steplist li').nth(2).getByRole('button', { name: 'Monter' }).click();
  await page.waitForTimeout(300);
  ok(
    (await page.locator('.steplist-title').nth(1).textContent()) === 'Merci !',
    'étape déplacée vers le haut',
  );

  // Onglets thème, formulaire, variables
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.locator('#th-radius').fill('20');
  await page.getByRole('tab', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Créer le formulaire' }).click();
  await page.waitForSelector('#f-title');
  ok(state.tables.forms.length === 1, 'formulaire de lead créé');
  ok((await page.locator('text={{company}}').count()) > 0, 'variables du workspace listées');
  await page.getByRole('tab', { name: 'Étape' }).click();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-after.png` });
  await page.waitForTimeout(900);
  ok(
    state.calls.some(
      (c) => c.method === 'PATCH' && c.path.endsWith('/demos') && c.body?.settings?.theme?.radius === 20,
    ),
    'thème enregistré dans la démo',
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
