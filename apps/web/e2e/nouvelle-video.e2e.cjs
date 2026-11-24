/**
 * EXT-02 §4.1 bis : « Nouvelle démo », type Vidéo, étape 2. Enregistrer avec l'extension ou importer une
 * vidéo (MP4 ou WebM, 50 Mo et 10 min au plus) : envoi avec reprise et pourcentage, erreurs dans la zone,
 * confirmation avant de quitter pendant l'envoi, démo créée et éditeur ouvert. Données fictives.
 * Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/nouvelle-video.e2e.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'not ok'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const until = async (f, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await f()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return !!(await f());
  };

  for (const width of [1440, 390]) {
    const ctx = await themedContext(b, { viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    // Extension déjà vue par ce compte : la source est active (sinon « Bientôt », §18.4)
    state.tables.profiles[0].extension_seen_at = '2026-11-02T10:00:00Z';
    // Durée lue par le navigateur : fixée par le test (pas de vraie vidéo de 24 min dans le dépôt)
    await page.addInitScript(() => {
      window.__dur = 12;
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => window.__dur });
      const set = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src').set;
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        set(v) {
          if (this.tagName === 'VIDEO' && String(v).startsWith('blob:'))
            queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
          else set.call(this, v);
        },
      });
    });
    await install(page, state);
    await page.goto(`${APP}/#/`);
    const shot = async (name) => {
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}-${width}.png` });
    };
    const tag = `[${width}]`;

    await page
      .getByRole('button', { name: /^Nouvelle/ })
      .first()
      .click();
    const dlg = page.locator('dialog.new-demo-dialog[open]');
    await dlg.waitFor();
    await dlg.getByRole('radio', { name: /^Démo vidéo/ }).check();
    await dlg.getByRole('button', { name: 'Continuer' }).click();
    const win = page.locator('dialog.new-demo-dialog[open]');
    await win.getByRole('heading', { name: 'Nouvelle démo vidéo' }).waitFor();
    ok(/Étape 2 sur\s2 · Source/.test(await win.textContent()), `${tag} « Étape 2 sur 2 · Source »`);
    const ext = win.getByRole('button', { name: /^Enregistrer avec l’extension/ });
    ok(
      /Lancez l’enregistrement depuis l’extension : la vidéo s’ouvre ensuite pour vérification, puis dans l’éditeur\./.test(
        await ext.textContent(),
      ),
      `${tag} carte « Enregistrer avec l’extension »`,
    );
    ok((await win.locator('.nd-or').textContent()) === 'ou', `${tag} séparateur « ou »`);
    const zone = win.locator('.nd-vz');
    ok(
      (await zone.locator('b').textContent()) === 'Importer une vidéo' &&
        /Déposez le fichier ici ou choisissez-le\. MP4 ou WebM, 50\sMo et 10\smin au plus\./.test(
          await zone.textContent(),
        ),
      `${tag} zone « Importer une vidéo » et son aide`,
    );
    ok(
      (await zone.getByRole('button', { name: 'Choisir une vidéo…' }).count()) === 1,
      `${tag} bouton « Choisir une vidéo… »`,
    );
    ok((await win.getByText('Bientôt').count()) === 0, `${tag} ni modèle ni entrée « Bientôt »`);
    const order = await win.evaluate((el) => {
      const y = (s) => el.querySelector(s).getBoundingClientRect().top;
      return y('.nd-sources') < y('.nd-or') && y('.nd-or') < y('.nd-vz') && y('.nd-vz') < y('.nd-folder');
    });
    ok(order, `${tag} ordre : extension, « ou », zone, Dossier`);
    ok(
      (await win.getByRole('button', { name: 'Retour' }).count()) === 1 &&
        (await win.getByRole('button', { name: 'Annuler' }).count()) === 1,
      `${tag} pied : « Retour » et « Annuler »`,
    );
    const axe = async (label) => {
      const r = await new AxeBuilder({ page })
        .include('.new-demo-dialog')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      ok(r.violations.length === 0, `${tag} axe, ${label} (${r.violations.map((v) => v.id).join(', ')})`);
    };
    const noScroll = async (label) =>
      ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${tag} pas de défilement horizontal, ${label}`,
      );
    await axe('zone vide');
    await noScroll('zone vide');
    await shot('nouvelle-video');

    const give = (name, type, bytes = 2048) =>
      win
        .locator('.nd-vz input[type=file]')
        .setInputFiles({ name, mimeType: type, buffer: Buffer.alloc(bytes) });
    const alertText = async () => (await zone.getByRole('alert').textContent()).replace(/\s+/g, ' ');

    // Format refusé : rien n'est envoyé
    await give('presentation.mov', 'video/quicktime');
    await zone.getByRole('alert').waitFor();
    ok(
      (await alertText()) === '« presentation.mov » n’est pas accepté.Choisissez une vidéo MP4 ou WebM.',
      `${tag} format refusé : message`,
    );
    ok(
      (await zone
        .getByRole('button', { name: 'Choisir une autre vidéo' })
        .locator('svg.lucide-upload')
        .count()) === 1 && (await zone.evaluate((el) => getComputedStyle(el).borderStyle)) === 'solid',
      `${tag} format refusé : bord plein et « Choisir une autre vidéo »`,
    );
    await axe('erreur');
    await noScroll('erreur');
    await shot('nouvelle-video-format');

    // Trop lourd
    // Fichier creux de 53 Mo (au-delà de ce que Playwright passe en mémoire) : rien n'en est lu
    const big = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-video-')), 'atelier-complet.mp4');
    fs.closeSync(fs.openSync(big, 'w'));
    fs.truncateSync(big, 53 * 1024 * 1024);
    await win.locator('.nd-vz input[type=file]').setInputFiles(big);
    fs.rmSync(path.dirname(big), { recursive: true, force: true });
    ok(
      await until(async () =>
        (await alertText()).startsWith('« atelier-complet.mp4 » pèse 53 Mo.La limite est de 50 Mo'),
      ),
      `${tag} plus de 50 Mo : message avec le poids`,
    );
    await shot('nouvelle-video-lourd');

    // Trop long
    await page.evaluate(() => (window.__dur = 24 * 60));
    await give('reunion.webm', 'video/webm');
    ok(
      await until(async () =>
        (await alertText().catch(() => '')).startsWith(
          '« reunion.webm » dure 24 min.La limite est de 10 min',
        ),
      ),
      `${tag} plus de 10 min : message avec la durée`,
    );
    await shot('nouvelle-video-long');
    await page.evaluate(() => (window.__dur = 12));

    // Espace plein : rien n'est envoyé, lien vers l'utilisation
    state.storageUsage = { videos: 524288000 };
    await give('formation-acme.webm', 'video/webm');
    ok(
      await until(async () =>
        /^Le stockage de l’espace est plein \(500\sMo sur 500\sMo\)\.Supprimez des vidéos ou demandez plus d’espace à la DSI\.$/.test(
          await alertText().catch(() => ''),
        ),
      ),
      `${tag} espace plein : message`,
    );
    ok(
      (await zone.getByRole('link', { name: 'Voir l’utilisation' }).getAttribute('href')) ===
        '#/settings/usage',
      `${tag} espace plein : « Voir l’utilisation »`,
    );
    ok(!state.tus, `${tag} aucune erreur n’a déclenché d’envoi`);
    await shot('nouvelle-video-quota');
    state.storageUsage = {};

    // Envoi retenu : progression, puis coupure et reprise
    const demosBefore = state.tables.demos.length;
    let open;
    state.tusGate = new Promise((r) => (open = r));
    await win.locator('.nd-vz input[type=file]').setInputFiles({
      name: 'formation-acme.webm',
      mimeType: 'video/webm',
      buffer: Buffer.alloc(3 * 1024 * 1024),
    });
    const bar = zone.getByRole('progressbar', { name: 'Envoi de la vidéo' });
    await bar.waitFor();
    ok((await zone.locator('b').textContent()) === 'formation-acme.webm', `${tag} envoi : nom du fichier`);
    ok(
      await until(async () =>
        /^Envoi… \d+ % · \d+ sur 3 Mo$/.test(await zone.getByRole('status').textContent()),
      ),
      `${tag} envoi : « Envoi… n % · x sur 3 Mo »`,
    );
    ok(
      (await bar.evaluate((el) => getComputedStyle(el).height)) === '6px' &&
        (await bar.getAttribute('aria-valuenow')) !== null,
      `${tag} envoi : barre déterminée de 6 px`,
    );
    ok((await zone.getAttribute('aria-busy')) === 'true', `${tag} envoi : zone occupée`);
    await axe('envoi');
    await noScroll('envoi');
    await shot('nouvelle-video-envoi');

    // « Arrêter l'envoi » dans la zone (pas un second « Annuler ») : même confirmation
    ok(
      (await zone.getByRole('button').allTextContents()).join('|') === 'Arrêter l’envoi',
      `${tag} envoi : bouton « Arrêter l’envoi » dans la zone`,
    );
    await zone.getByRole('button', { name: 'Arrêter l’envoi' }).click();
    const stop0 = page.getByRole('dialog', { name: 'Arrêter l’envoi ?' });
    await stop0.waitFor();
    await stop0.getByRole('button', { name: 'Continuer' }).click();
    await stop0.waitFor({ state: 'hidden' });
    // La confirmation est vraiment refermée et le focus revenu dans la fenêtre avant la touche suivante
    await page.waitForFunction(
      () =>
        !document.querySelector('dialog.dialog-confirm[open]') &&
        !!document.activeElement?.closest('dialog.new-demo-dialog') &&
        document.getAnimations().every((x) => x.playState !== 'running'),
    );
    ok(await bar.isVisible(), `${tag} zone, « Continuer » : l’envoi se poursuit`);

    // Fermer pendant l'envoi : confirmation, « Continuer » garde l'envoi
    await page.keyboard.press('Escape');
    const stop = page.getByRole('dialog', { name: 'Arrêter l’envoi ?' });
    await stop.waitFor();
    await stop.getByRole('button', { name: 'Continuer' }).click();
    await stop.waitFor({ state: 'hidden' });
    ok(await bar.isVisible(), `${tag} « Continuer » : l’envoi se poursuit`);

    // Coupure : « Envoi interrompu », barre figée, « Reprendre »
    state.tusDown = true;
    open();
    const resume = zone.getByRole('button', { name: 'Reprendre' });
    await resume.waitFor({ timeout: 15000 });
    ok(
      /^Envoi interrompu · \d+ %$/.test(await zone.getByRole('status').textContent()),
      `${tag} coupure : « Envoi interrompu · n % »`,
    );
    await shot('nouvelle-video-interrompu');
    state.tusDown = false;
    state.tusGate = null;
    await resume.click();
    await page.waitForURL(/#\/demos\/[0-9a-f-]{36}\/edit/, { timeout: 15000 });
    const demo = state.tables.demos.at(-1);
    const step = state.tables.steps.find((s) => s.demo_id === demo.id);
    ok(
      state.tables.demos.length === demosBefore + 1 && demo.title === 'formation acme',
      `${tag} démo créée, titre = nom du fichier sans extension`,
    );
    ok(
      step?.kind === 'video' &&
        new RegExp(`^${demo.workspace_id}/${demo.id}/[0-9a-f-]{36}\\.webm$`).test(step.video_path) &&
        step.video_duration_ms === 12000 &&
        step.element_meta?.imported === true,
      `${tag} une étape vidéo, rangée dans l’espace, marquée importée`,
    );
    ok(
      state.tus.meta.bucketName === 'videos' &&
        state.tus.meta.contentType === 'video/webm' &&
        state.tus.auth &&
        // Coupure pendant la création : la reprise recrée l'envoi (une reprise en cours de route passe par HEAD)
        state.tus.calls.filter((m) => m === 'POST').length >= 2,
      `${tag} envoi avec reprise vers le bucket videos`,
    );
    await page.getByText('Démo vidéo créée').waitFor({ state: 'attached' });
    ok(true, `${tag} éditeur ouvert avec « Démo vidéo créée »`);

    // « Arrêter » : l'envoi est retiré, la démo aussi
    await page.goto(`${APP}/#/`);
    await page
      .getByRole('button', { name: /^Nouvelle/ })
      .first()
      .click();
    const again = page.locator('dialog.new-demo-dialog[open]');
    await again.waitFor();
    if (await again.getByRole('radio', { name: /^Démo vidéo/ }).count()) {
      await again.getByRole('radio', { name: /^Démo vidéo/ }).check();
      await again.getByRole('button', { name: 'Continuer' }).click();
    }
    const win2 = page.locator('dialog.new-demo-dialog[open]');
    await win2.getByRole('heading', { name: 'Nouvelle démo vidéo' }).waitFor();
    state.tus = null;
    state.tusGate = new Promise(() => {});
    const n = state.tables.demos.length;
    await win2.locator('.nd-vz input[type=file]').setInputFiles({
      name: 'essai.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.alloc(2048),
    });
    await win2.getByRole('progressbar').waitFor();
    await until(() => state.tables.demos.length === n + 1);
    await win2.getByRole('button', { name: 'Retour' }).click();
    const stop2 = page.getByRole('dialog', { name: 'Arrêter l’envoi ?' });
    await stop2.waitFor();
    await stop2.getByRole('button', { name: 'Arrêter' }).click();
    ok(
      await until(() => state.tables.demos.length === n),
      `${tag} « Arrêter » : la démo commencée est retirée`,
    );
    await page
      .locator('dialog.new-demo-dialog[open]')
      .getByRole('heading', { name: 'Nouvelle démo', exact: true })
      .waitFor();
    ok(true, `${tag} « Arrêter » depuis « Retour » : retour à l’étape 1`);
    state.tusGate = null;
    await ctx.close();
  }
  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})();
