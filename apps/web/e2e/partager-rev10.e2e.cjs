/**
 * REV-10 : onglet Lien de Partager. « GIF / vidéo » (l'adresse personnalisée est testée par adresse-demo)
 * ouvre l'export sur le GIF, exemple d'URL avec les variables présentes dans la démo, texte d'aide.
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/partager-rev10.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
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
  const state = seed();
  const t = state.tables;
  // Version publiée réelle (manifeste) : sans elle, l'export bascule sur « La démo publiée n'a pas pu être
  // chargée » et le bouton radio disparaît (échec intermittent du 21/11)
  seedExport(state);
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/share`);
  await page.locator('#sh-slug').waitFor();
  const code = page.getByRole('region', { name: /Personnaliser par paramètres/ });
  await code.getByText(/\?company=/).waitFor();
  ok(/\?company=/.test(await code.innerText()), 'exemple : variable présente dans la démo (company)');
  const help = sp(await page.locator('#sh-panel-link .sh-help').innerText());
  ok(
    help === 'Remplacez la valeur par celle du destinataire, ou utilisez un lien personnalisé.',
    'aide : « Remplacez la valeur… »',
  );
  // §1 : l'export (PDF, GIF, vidéo) est un mode de la fenêtre, sous « Fichiers », sans « Bientôt »
  const exp = page.locator('.shd-nav').getByRole('button', { name: 'Exporter', exact: true });
  ok(!/Bientôt/.test(await exp.innerText()), 'mode « Exporter » sans « Bientôt »');
  // P1-5 : outil interne, aucun bouton de réseau social (on garde E-mail)
  ok(
    (await page.locator('#sh-panel-link a[href*="linkedin."], #sh-panel-link a[href*="x.com"]').count()) ===
      0 && (await page.locator('#sh-panel-link a[href^="mailto:"]').count()) === 1,
    'Partager : ni LinkedIn ni X, « E-mail » gardé',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.locator('#sh-panel-link').screenshot({ path: `${SHOTS}/rev-10-partager${sfx}.png` });
  }
  await exp.click();
  await page.locator('#sh-panel-export').getByRole('button', { name: 'Exporter (PDF, GIF)' }).click();
  await page.locator('dialog.x15-dialog[open] input[type="radio"][value="gif"]').check({ force: true });
  // État final de l'export : démo chargée (aperçu prêt), GIF coché ; pas d'écran d'erreur
  const loaded = await page
    .waitForFunction(
      () => {
        const d = document.querySelector('dialog.x15-dialog[open]');
        if (!d || d.classList.contains('x15-small')) return d ? 'erreur' : false;
        const r = d.querySelector('input[type="radio"][value="gif"]');
        return r && !r.disabled && d.querySelector('.exp-preview, canvas, img')
          ? r.checked
            ? 'gif'
            : 'autre'
          : false;
      },
      null,
      { timeout: 30000 },
    )
    .then((h) => h.jsonValue());
  ok(loaded === 'gif', `mode « Exporter » : la fenêtre d’export s’ouvre, GIF prêt (${loaded})`);
  await page.keyboard.press('Escape');
  await page.locator('dialog.x15-dialog').waitFor({ state: 'detached' });
  await page.locator('.shd-nav').getByRole('button', { name: 'Lien', exact: true }).click();
  await page.locator('#sh-panel-link').waitFor();

  // Sans variable dans les textes : pas d'exemple inventé
  for (const h of t.hotspots) h.body = h.body.replace(/\{\{[^}]*\}\}/g, 'vous');
  for (const s of t.steps) {
    s.title = (s.title || '').replace(/\{\{[^}]*\}\}/g, '');
    s.body = (s.body || '').replace(/\{\{[^}]*\}\}/g, '');
  }
  await page.reload();
  await page.locator('#sh-panel-link .sh-help').waitFor();
  ok(
    !/\?/.test(await code.innerText()) &&
      /n’utilise pas de variable/.test(await page.locator('#sh-panel-link .sh-help').innerText()),
    'sans variable : URL seule et explication',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
