/**
 * L29 §3.5 : champ « Texte alternatif de la capture » (onglet Étape, section « Accessibilité ») :
 * placeholder par défaut, 250 caractères, compteur, enregistrement. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/texte-alternatif.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 1000 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const field = p.getByLabel('Texte alternatif de la capture');
  await field.waitFor();
  const step = state.tables.steps.find((s) => s.demo_id === DEMO && s.kind === 'image');
  ok(
    /^Capture d’écran : .+\.$/.test((await field.getAttribute('placeholder')) || ''),
    'placeholder : texte par défaut',
  );
  ok((await field.getAttribute('maxlength')) === '250', '250 caractères au plus');
  ok(/Laissé vide, le texte est/.test(await p.locator('#st-alt-h').innerText()), 'aide de la spec');
  await field.fill('Tableau de bord, menu Opportunités ouvert.');
  ok((await p.locator('#st-alt-n').innerText()) === '42 / 250', 'compteur');
  for (let i = 0; i < 40 && !state.tables.steps.find((s) => s.id === step.id)?.alt_text; i++)
    await p.waitForTimeout(100);
  await p.waitForTimeout(1200);
  ok(
    state.tables.steps.find((s) => s.id === step.id)?.alt_text ===
      'Tableau de bord, menu Opportunités ouvert.',
    'texte alternatif enregistré sur l’étape',
  );
  if (SHOTS) {
    await p.mouse.move(0, 0);
    await field
      .locator('xpath=ancestor::div[contains(@class,"sec")][1]')
      .screenshot({ path: `${SHOTS}/l29-05-texte-alternatif${sfx}.png` });
  }
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
