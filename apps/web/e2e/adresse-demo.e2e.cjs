/**
 * L28-01 : adresse personnalisée d'une démo (#/l/<partie lisible>-<suffixe>) dans Partager > Lien : saisie,
 * validation à la frappe, mot réservé, enregistrement, lien public mis à jour, nouvelle adresse au
 * changement, lecteur sans champ. Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/adresse-demo.e2e.cjs
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
  const shot = async (name) => {
    if (!SHOTS) return;
    for (const x of await page.locator('.toast-close').all()) await x.click().catch(() => {});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    await page.locator('#sh-panel-link').screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  const t = state.tables;
  const d = t.demos.find((x) => x.id === DEMO);
  d.status = 'published';
  d.current_version_id = d.current_version_id || 'v-1';
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/share`);
  // §1.3 : l'adresse personnalisée est une ligne repliable du mode Lien
  const fold = page.getByRole('button', { name: 'Adresse personnalisée', exact: true });
  await fold.waitFor();
  ok(
    (await fold.getAttribute('aria-expanded')) === 'false',
    'ligne « Adresse personnalisée » repliée par défaut',
  );
  await fold.click();
  const field = page.locator('#sh-slug');
  await field.waitFor();
  const save = page.getByRole('button', { name: 'Enregistrer l’adresse' });
  ok(!/Bientôt/.test(await page.locator('label[for=sh-slug]').innerText()), 'plus de « Bientôt »');
  ok(await save.isDisabled(), 'enregistrer : désactivé sans saisie');
  ok(
    /Un suffixe de 6 caractères est ajouté à l’enregistrement, pour que l’adresse reste unique\. L’ancienne adresse redirige vers la démo pendant 90 jours\./.test(
      sp(await page.locator('#sh-slug-help').innerText()),
    ),
    'aide : suffixe et redirection 90 jours',
  );

  await field.fill('ab');
  await page.getByRole('alert').filter({ hasText: 'De 3 à 48 caractères' }).waitFor();
  ok(await save.isDisabled(), 'trop court : message de format, enregistrer désactivé');
  await field.fill('admin');
  await page.getByRole('alert').filter({ hasText: 'Ce mot est réservé' }).waitFor();
  ok(true, 'mot réservé refusé');
  await field.fill('Accueil RH');
  ok((await field.inputValue()) === 'accueil-rh', 'saisie normalisée (minuscules, tirets)');
  await page.locator('#sh-slug-state').filter({ hasText: 'Adresse valide.' }).waitFor();
  ok((await page.locator('.sh-suffix').innerText()).trim() === '-xxxxxx', 'suffixe à venir affiché en gris');
  await shot('l28-01-adresse-saisie');
  await save.click();
  await page.getByText('Adresse enregistrée.').waitFor();
  const a1 = t.demo_addresses.find((x) => !x.retired_at).address;
  ok(/^accueil-rh-[A-Za-z0-9]{6}$/.test(a1), 'adresse enregistrée avec un suffixe base62');
  ok((await page.locator('#sh-pub').inputValue()).endsWith(`/#/l/${a1}`), 'lien public : nouvelle adresse');
  ok((await page.locator('.sh-suffix').innerText()).trim() === `-${a1.slice(-6)}`, 'suffixe réel affiché');
  await shot('l28-01-adresse-enregistree');

  await field.fill('accueil');
  await page.locator('#sh-slug-state').filter({ hasText: 'Adresse valide.' }).waitFor();
  await save.click();
  await page.waitForTimeout(300);
  ok(
    t.demo_addresses.filter((x) => x.demo_id === DEMO && !x.retired_at).length === 1 &&
      t.demo_addresses.find((x) => x.address === a1).retired_at,
    'changement : une seule adresse courante, l’ancienne est retirée (redirigée 90 jours)',
  );

  // Lecteur : pas de champ, adresse affichée
  t.members[0].role = 'viewer';
  await page.reload();
  await page.getByRole('button', { name: 'Adresse personnalisée', exact: true }).click();
  await page.locator('.sh-addr-ro').waitFor();
  ok((await page.locator('#sh-slug').count()) === 0, 'lecteur : adresse affichée sans champ');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
