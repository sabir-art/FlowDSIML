/**
 * L22-01 à 04 : notes privées du présentateur, lancement, vue présentateur, écran public.
 * Condition de relecture : la note n'apparaît ni dans le manifeste envoyé au lecteur ni dans le lecteur.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const NOTE = 'Note interne : rappeler le délai de traitement';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  // Tout ce que reçoit le lecteur (aperçu et présentation) est consigné pour vérifier l'absence des notes
  await ctx.addInitScript(() => {
    window.__fdMsgs = [];
    addEventListener('message', (e) => {
      try {
        window.__fdMsgs.push(JSON.stringify(e.data));
      } catch {
        /* message non sérialisable */
      }
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  await install(page, state);
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const st = (id) => state.tables.steps.find((s) => s.id === id);

  // L22-01 : notes privées dans l'onglet Étape
  await page.goto(`${BASE}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.locator('.stage-head').click();
  await page.waitForSelector('#st-notes');
  ok(
    (await page.getAttribute('#st-notes', 'maxlength')) === '1000',
    'L22-01 : notes limitées à 1 000 caractères',
  );
  await page.fill('#st-notes', `${NOTE}\nQuestion fréquente : pièces à fournir`);
  await page.waitForTimeout(900);
  ok(st('s1').presenter_notes?.startsWith(NOTE), 'L22-01 : notes enregistrées sur l’étape');
  if (SHOTS) await page.locator('.notes-sec').screenshot({ path: `${SHOTS}/l22-01-notes${sfx}.png` });

  // L22-02 : lancement depuis la barre de l'éditeur
  await page.getByRole('button', { name: 'Présenter', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: /Présenter/ });
  await dlg.waitFor();
  ok(
    await dlg.getByRole('radio', { name: /Deux fenêtres/ }).isChecked(),
    'L22-02 : Deux fenêtres par défaut',
  );
  ok((await dlg.getByLabel('Durée cible en minutes').inputValue()) === '15', 'L22-02 : minuteur à 15 min');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l22-02-lancer${sfx}.png` });

  // Fenêtre bloquée : message et Réessayer
  await page.evaluate(() => {
    window.__open = window.open;
    window.open = () => null;
  });
  await dlg.getByRole('button', { name: 'Lancer la présentation' }).click();
  ok(
    /Autorisez les fenêtres pop-up/.test(await dlg.getByRole('alert').textContent()),
    'L22-02 : pop-up bloquée signalée',
  );
  ok(await dlg.getByRole('button', { name: 'Réessayer' }).isVisible(), 'L22-02 : bouton Réessayer');
  await page.evaluate(() => {
    window.open = window.__open;
  });

  // Le faux Supabase est installé par page : on l'installe aussi sur la fenêtre de l'écran public
  ctx.on('page', (p) => void install(p, state));
  const [pub] = await Promise.all([
    ctx.waitForEvent('page'),
    dlg.getByRole('button', { name: 'Réessayer' }).click(),
  ]);
  pub.on('pageerror', (e) => errors.push(`public: ${e.message}`));
  await page.waitForURL(/#\/demos\/.*\/present\?/);
  await page.waitForSelector('.presenter iframe');

  // L22-03 : vue présentateur
  await page.waitForSelector('.presenter .live:not(.live--off)', { timeout: 10000 });
  ok(true, 'L22-03 : « Écran public ouvert »');
  // L26-09 : à l'étape 1, l'onglet « Démo » s'ouvre de lui-même ; les notes de l'étape sont sous « Étape 1 »
  await page.getByRole('tab', { name: 'Étape 1' }).click();
  // Les flèches sur les onglets changent d'onglet (motif tablist) : on quitte le focus
  await page.evaluate(() => document.activeElement?.blur?.());
  ok(
    (await page.locator('.notes li').first().textContent()) === NOTE,
    'L22-03 : notes en puces côté présentateur',
  );
  ok(/Étape 1 sur 3/.test(await page.locator('.pr-count').textContent()), 'L22-03 : Étape 1 sur 3');
  const timer = page.getByRole('timer');
  ok(
    /Temps écoulé : 0 min \d\d sur 15 min 00/.test(await timer.getAttribute('aria-label')),
    'L22-03 : minuteur étiqueté',
  );
  ok((await timer.getAttribute('aria-live')) === null, 'L22-03 : minuteur jamais annoncé automatiquement');

  // Écran public synchronisé
  await pub
    .waitForSelector('.pub iframe', { timeout: 10000 })
    .catch(async () => console.log('public:', await pub.textContent('body')));
  await pub.waitForFunction(() => /1 \/ 3/.test(document.querySelector('.pub .foot')?.textContent ?? ''));
  const pubFrame = pub.frames().find((f) => f.url().includes('/#/preview'));
  await pubFrame.waitForSelector('.p-tip-title', { timeout: 10000 });
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/l22-03-presentateur${sfx}.png` });
    await pub.setViewportSize({ width: 1440, height: 900 });
    await pub.screenshot({ path: `${SHOTS}/l22-04-public${sfx}.png` });
  }

  await page.keyboard.press('ArrowRight');
  await pub.waitForFunction(() => /2 \/ 3/.test(document.querySelector('.pub .foot')?.textContent ?? ''));
  ok(true, 'L22-03/04 : → passe à l’étape 2, l’écran public suit');
  ok(/Étape suivante · 3/.test(await page.locator('#nx-t').textContent()), 'L22-03 : étape suivante');
  await page.keyboard.press('ArrowRight');
  ok(/Dernière étape/.test(await page.locator('#nx-t').textContent()), 'L22-03 : dernière étape annoncée');
  await page.keyboard.press('ArrowLeft');

  await page.keyboard.press('b');
  ok(
    (await page.getByRole('button', { name: 'Écran noir' }).getAttribute('aria-pressed')) === 'true',
    'L22-03 : B, écran noir pressé',
  );
  await pubFrame.waitForSelector('.p-black[role="status"]', { timeout: 5000 });
  ok(
    /Présentation en pause/.test(await pubFrame.textContent('.p-black')),
    'L22-04 : « Présentation en pause » à l’écran public',
  );
  if (SHOTS) await pub.screenshot({ path: `${SHOTS}/l22-04-noir${sfx}.png` });
  await page.keyboard.press('b');

  await page.keyboard.press('n');
  ok((await page.locator('.notes').count()) === 0, 'L22-03 : N masque les notes');
  await page.keyboard.press('n');

  // Condition : la note n'est jamais transmise au lecteur ni affichée par lui
  const frames = [...page.frames(), ...pub.frames()].filter((f) => f.url().includes('/#/preview'));
  let leaked = false;
  for (const f of frames) {
    const msgs = await f.evaluate(() => window.__fdMsgs.join('\n'));
    const text = await f.evaluate(() => document.body.innerText);
    if (msgs.includes('Note interne') || text.includes('Note interne')) leaked = true;
  }
  ok(
    frames.length === 2 && !leaked,
    'Notes absentes du manifeste et du lecteur (présentateur et écran public)',
  );
  const pubMsgs = await pub.evaluate(() => window.__fdMsgs.join('\n'));
  ok(!pubMsgs.includes('Note interne'), 'Notes absentes du canal vers l’écran public');

  // Terminer : bilan de fin (L26-12) avec la durée, puis retour à l'éditeur ; l'écran public se ferme
  await page.keyboard.press('Escape');
  const rep = page.getByRole('dialog', { name: /Présentation terminée · 0 min \d\d/ });
  await rep.waitFor();
  ok(true, 'L22-03 / L26-12 : bilan de fin avec durée');
  await rep.getByRole('button', { name: 'Retour à l’éditeur' }).click();
  await page.waitForFunction(() => location.hash.endsWith('/edit'));
  await pub.waitForEvent('close', { timeout: 5000 }).catch(() => undefined);
  ok(
    pub.isClosed() || /Présentation terminée/.test(await pub.textContent('body')),
    'L22-04 : écran public fermé à la fin',
  );

  // Menu « … » d'une démo : Présenter ouvre la même modale
  await page.goto(`${BASE}/#/`);
  await page.locator('.demo-card, [data-demo-card]').first().waitFor();
  await page
    .getByRole('button', { name: /Actions|Plus d’actions/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Présenter' }).click();
  await page.getByRole('dialog', { name: /Présenter/ }).waitFor();
  ok(true, 'L22-02 : Présenter depuis le menu de la démo');

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
