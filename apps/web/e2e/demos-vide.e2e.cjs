/**
 * REV-05 : état vide des démos (une phrase et « Nouvelle démo ») ; indicateurs masqués tant qu'aucune démo
 * n'est publiée. Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/demos-vide.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

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
  const shot = async (name) => {
    if (!SHOTS) return;
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png`, fullPage: true });
  };
  const state = seed();
  const t = state.tables;
  const all = t.demos.splice(0);
  const allSteps = t.steps.splice(0);

  // Aucune démo
  await install(page, state);
  await page.goto(`${APP}/#/`);
  const empty = page.locator('.demos-empty');
  await empty.waitFor();
  const txt = await empty.innerText();
  ok(
    /Aucune démo pour l’instant/.test(txt) &&
      /« Démarrer la capture »/.test(txt) &&
      !/1\.|Terminez/.test(txt),
    'état vide : une phrase avec « Démarrer la capture »',
  );
  ok((await empty.getByRole('button', { name: 'Nouvelle démo' }).count()) === 1, 'bouton « Nouvelle démo »');
  ok((await page.locator('.stat-row:not(.stat-row--ghost)').count()) === 0, 'aucun indicateur à zéro');
  await shot('rev-05-demos-vide');

  // Des brouillons, rien de publié
  t.demos.push(...all.slice(0, 2).map((d) => ({ ...d, status: 'draft' })));
  t.steps.push(...allSteps);
  await page.reload();
  await page.locator('.stats-later').waitFor();
  ok(
    (await page.locator('.stats-later').innerText()).trim() ===
      'Les statistiques apparaîtront après la première publication.',
    'brouillons : « Les statistiques apparaîtront après la première publication. »',
  );
  ok((await page.locator('.stat-row:not(.stat-row--ghost)').count()) === 0, 'brouillons : indicateurs masqués');
  await shot('rev-05-demos-brouillons');

  // Une démo publiée : les indicateurs reviennent
  t.demos[0].status = 'published';
  await page.reload();
  await page.locator('.stat-row').waitFor();
  ok((await page.locator('.stats-later').count()) === 0, 'publiée : indicateurs affichés');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
