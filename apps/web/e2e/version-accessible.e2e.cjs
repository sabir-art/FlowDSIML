/**
 * L29-03 / L29-04 : export « Version accessible (HTML) » : format dans la modale, options de contenu
 * seules, fichier autonome (lang, title, h1/h2/h3, sommaire, lien d'évitement, textes alternatifs,
 * images intégrées), audit axe du fichier ouvert hors connexion, lien après le PDF. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/version-accessible.e2e.cjs
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
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
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    acceptDownloads: true,
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const s = seed();
  seedExport(s);
  // L29 §3.5 : texte alternatif saisi sur l'étape 2 (prioritaire sur le texte construit)
  for (const v of s.tables.demo_versions)
    if (v.manifest?.steps?.[1]) v.manifest.steps[1].alt = 'Liste des usagers filtrée par structure.';
  await install(p, s);
  await p.goto(`${APP}/#/`);
  await p.waitForTimeout(900);
  await p
    .getByRole('button', { name: /Actions.*Créer une fiche usager/ })
    .first()
    .click();
  await p.getByRole('menuitem', { name: /^Exporter/ }).click();
  const d = p.locator('dialog.x15-dialog[open]');
  await d.waitFor();
  const radios = await d
    .getByRole('group', { name: /Format/ })
    .locator('label.exp-format')
    .allInnerTexts();
  ok(/Version accessible \(HTML\)/.test(radios[2] || ''), 'troisième format : « Version accessible (HTML) »');
  await d.getByRole('radio', { name: /Version accessible/ }).click();
  ok(
    (await d.getByRole('switch', { name: /Captures/ }).count()) === 1 &&
      (await d.locator('select').count()) === 0 &&
      (await d.getByRole('radiogroup', { name: 'Mise en page' }).count()) === 0,
    'options : contenu seulement (pas de mise en page ni de papier)',
  );
  ok(
    /étapes · un seul fichier, lisible hors connexion\./.test(
      await d.locator('.x15-foot .fd-help').innerText(),
    ),
    'aide du pied',
  );
  if (SHOTS) {
    await p.mouse.move(0, 0);
    await d.screenshot({ path: `${SHOTS}/l29-03-export${sfx}.png` });
  }
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 60000 }),
    d.getByRole('button', { name: 'Exporter la version accessible' }).click(),
  ]);
  ok(/-accessible\.html$/.test(dl.suggestedFilename()), `nom du fichier (${dl.suggestedFilename()})`);
  await d.getByRole('heading', { name: 'Version accessible prête' }).waitFor();
  const html = fs.readFileSync(await dl.path(), 'utf8');
  ok(
    !/<script/i.test(html) && !/https?:\/\/[^"]*\.(webp|png|jpe?g)/.test(html),
    'autonome : aucun script, images intégrées',
  );

  // Fichier ouvert hors connexion : structure, sommaire, alt, axe
  const off = await b.newContext({ offline: true });
  const v = await off.newPage();
  await v.setContent(html);
  ok((await v.getAttribute('html', 'lang')) === 'fr-FR', 'lang="fr-FR"');
  ok((await v.title()) === 'Créer une fiche usager', 'title = titre de la démo');
  ok((await v.locator('h1').count()) === 1, 'un h1');
  const h3 = await v.locator('h3').allInnerTexts();
  ok(h3.length === 7 && /^Étape 1 · /.test(h3[0]), `h3 « Étape n · titre » (${h3.length})`);
  ok((await v.locator('nav a').count()) === 7, 'sommaire : un lien par étape');
  const alts = await v.locator('img').evaluateAll((l) => l.map((i) => i.getAttribute('alt')));
  ok(
    alts[1] === 'Liste des usagers filtrée par structure.',
    `texte alternatif saisi prioritaire (${alts[1]})`,
  );
  ok(
    alts.length > 0 && alts.filter((_, k) => k !== 1).every((a) => /^Capture d’écran : .+\./.test(a || '')),
    'sinon textes alternatifs construits',
  );
  const loaded = await v.locator('img').evaluateAll((l) => l.every((i) => i.complete && i.naturalWidth > 0));
  ok(loaded, 'images visibles hors connexion');
  await v.keyboard.press('Tab');
  ok(
    (await v.evaluate(() => document.activeElement?.textContent)) === 'Aller au contenu',
    'premier Tab : « Aller au contenu »',
  );
  const res = (await new AxeBuilder({ page: v }).analyze()).violations.map((x) => x.id);
  ok(res.length === 0, `axe : aucune violation (${res.join(', ')})`);
  await v.setViewportSize({ width: 640, height: 900 });
  const scroll = await v.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(scroll, 'zoom 200 % (640 px) : pas de défilement horizontal');
  await v.evaluate(() => document.activeElement && document.activeElement.blur());
  if (SHOTS) await v.screenshot({ path: `${SHOTS}/l29-04-fichier${sfx}.png` });
  await off.close();

  // Après le PDF : lien « Télécharger aussi la version accessible (HTML) »
  await d.getByRole('button', { name: 'Exporter dans un autre format' }).click();
  await d.getByRole('radio', { name: /^PDF/ }).click();
  await Promise.all([
    p.waitForEvent('download', { timeout: 60000 }),
    d.getByRole('button', { name: 'Exporter en PDF' }).click(),
  ]);
  const also = d.getByRole('button', { name: 'Télécharger aussi la version accessible (HTML)' });
  await also.waitFor();
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), also.click()]);
  ok(/-accessible\.html$/.test(dl2.suggestedFilename()), 'après le PDF : version accessible téléchargée');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
