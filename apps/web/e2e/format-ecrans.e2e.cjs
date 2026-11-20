/**
 * L28-04 : format des écrans (onglet Réglages). Constat des tailles, format 16:9 en Adapter, aperçu, application
 * (repères recalculés, origine sauvegardée), Annuler, Recadrer avec liste de ce qui sort du cadre, retour aux
 * images d'origine. Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/format-ecrans.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const until = async (fn, ms = 8000) => {
    for (let i = 0; i < ms / 100; i++) {
      if (fn()) return true;
      await page.waitForTimeout(100);
    }
    return fn();
  };
  const state = seed();
  const t = state.tables;
  const imgs = () => t.steps.filter((s) => s.demo_id === DEMO && s.kind === 'image');
  const h1 = () => t.hotspots.find((h) => h.id === 'h1');
  const before = { x: h1().x, y: h1().y, path: imgs()[0].image_path };
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.locator('.ed-rail [data-tool="settings"][aria-pressed="false"]').click();
  const sec = page.locator('.fmt-sec');
  await sec.waitFor();
  ok(/Toutes les captures font 1 100 × 750\./.test(sp(await sec.innerText())), 'constat : une seule taille');
  ok(
    (await sec.getByRole('radio', { name: 'D’origine' }).isChecked()) === true,
    'format « D’origine » par défaut',
  );
  ok(
    (await sec.getByRole('radiogroup').count()) + (await sec.locator('fieldset').count()) >= 1,
    'formats en boutons radio',
  );
  ok(
    (await sec.getByLabel('Largeur de sortie').inputValue()) === '1280',
    'largeur de sortie : la plus proche des captures (1 280)',
  );

  await sec.getByRole('radio', { name: '16:9' }).check();
  ok(
    (await sec.getByRole('radio', { name: /^Adapter/ }).isChecked()) === true,
    'ajustement : Adapter par défaut',
  );
  await sec.locator('.fmt-thumbs img').nth(1).waitFor();
  ok((await sec.locator('.fmt-thumbs img').count()) === 2, 'aperçu avant / après');
  ok((await sec.locator('.fmt-warn').count()) === 0, 'Adapter : rien ne sort du cadre');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-04-format${sfx}.png` });
  }
  await sec.getByRole('button', { name: 'Appliquer à toutes les étapes' }).click();
  const dlg = page.getByRole('dialog', { name: 'Changer le format des écrans ?' });
  await dlg.waitFor();
  ok(
    /2 étapes passent en 16:9\. Les repères et les flous suivent l’image\. Les images d’origine sont conservées\./.test(
      sp(await dlg.innerText()),
    ),
    'confirmation : nombre, format, origines conservées',
  );
  await dlg.getByRole('button', { name: 'Appliquer à toutes les étapes' }).click();
  await page.getByText('Format appliqué à 2 étapes.').waitFor();
  ok(
    await until(() => imgs().every((s) => s.image_width === 1280 && s.image_height === 720 && s.original)),
    'captures en 1 280 × 720, origine sauvegardée',
  );
  // Repère sur le même pixel : 1 100 × 750 dans 1 280 × 720 → image de 1 056 × 720, bandes de 112 px
  const exp = (112 + before.x * 1056) / 1280;
  ok(
    await until(() => Math.abs(h1().x - exp) < 0.002),
    `repère recalculé (x ${h1().x.toFixed(4)} ≈ ${exp.toFixed(4)})`,
  );
  ok(Math.abs(h1().y - before.y) < 0.002, 'repère : y inchangé (pas de bande en hauteur)');

  // Annuler (toast)
  await page.getByRole('button', { name: 'Annuler' }).last().click();
  ok(
    await until(
      () => imgs()[0].image_path === before.path && !imgs()[0].original && Math.abs(h1().x - before.x) < 1e-6,
    ),
    'Annuler : image, origine et repère d’avant',
  );

  // Recadrer en 4:3 avec un repère au bord : signalé avant d'appliquer
  t.hotspots.find((h) => h.id === 'h1');
  await page.reload();
  await page.locator('.ed-rail [data-tool="settings"][aria-pressed="false"]').click();
  await sec.waitFor();
  await sec.getByRole('radio', { name: 'Personnalisé' }).check();
  await sec.getByLabel('Largeur (px)').fill('700');
  await sec.getByLabel('Hauteur (px)').fill('1400');
  await sec.getByRole('radio', { name: /^Recadrer/ }).check();
  const warn = sec.locator('.fmt-warn');
  await warn.waitFor();
  ok(
    /Étape \d : (le repère sort du cadre|une zone de flou est coupée)\./.test(sp(await warn.innerText())),
    'Recadrer : sortie du cadre listée avant d’appliquer',
  );
  await sec.getByLabel('Largeur (px)').fill('100');
  await sec.getByRole('alert').filter({ hasText: 'De 640 à 3 840 px.' }).waitFor();
  ok(
    await sec.getByRole('button', { name: 'Appliquer à toutes les étapes' }).isDisabled(),
    'taille personnalisée hors limites : application bloquée',
  );

  // Appliquer puis revenir aux images d'origine
  await sec.getByRole('radio', { name: '4:3' }).check();
  await sec.getByRole('button', { name: 'Appliquer à toutes les étapes' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Appliquer à toutes les étapes' }).click();
  await page.getByText('Format appliqué à 2 étapes.').waitFor();
  await until(() => imgs().every((s) => s.original));
  await sec.getByRole('button', { name: 'Revenir aux images d’origine' }).click();
  await page.getByText(/2 étapes revenues à leur image d’origine\./).waitFor();
  ok(
    imgs().every((s) => s.image_width === 1100 && !s.original) && Math.abs(h1().x - before.x) < 1e-5,
    'Revenir aux images d’origine : tailles et repères d’origine',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
