/**
 * L28-02 / L28-03 : voix off. Éditeur : section « Voix off » (import d'un fichier, transcription préremplie
 * avec la bulle, publication bloquée sans transcription, enregistrement au micro simulé, icône du rail).
 * Lecteur : son coupé au départ, « Activer le son », sous-titres par défaut, touche C.
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/voix-off.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

/** WAV PCM 16 bits mono, 8 kHz, silence de `sec` secondes. */
function wav(sec) {
  const n = 8000 * sec;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
}

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    permissions: ['microphone'],
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const until = async (fn, ms = 6000) => {
    for (let i = 0; i < ms / 100; i++) {
      if (fn()) return true;
      await page.waitForTimeout(100);
    }
    return fn();
  };
  const state = seed();
  const s1 = () => state.tables.steps.find((s) => s.demo_id === DEMO && s.position === 0);
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  // L48-E : la voix off est l'outil « Voix off » du rail
  await openTool(page, 'voice');
  const sec = page.locator('.voice-sec');
  await sec.waitFor();
  ok(/Voix off/i.test(await sec.innerText()), 'section « Voix off » dans l’onglet Étape');
  // L62 §6 : segmenté « Source de la voix » : Générée, Enregistrée, Fichier
  const tabs = sec.getByRole('tablist', { name: 'Source de la voix' }).getByRole('tab');
  ok(
    (await tabs.allInnerTexts()).join('|') === 'Générée|Enregistrée|Fichier',
    `segmenté de la source (${(await tabs.allInnerTexts()).join(', ')})`,
  );
  ok(
    (await tabs.nth(0).getAttribute('aria-disabled')) === 'true' &&
      /Générer : désactivé par l’espace\./.test(sp(await sec.innerText())) &&
      (await tabs.nth(1).getAttribute('aria-selected')) === 'true',
    'Assistance IA coupée : « Générer » grisé avec la raison, « Enregistrer » choisi',
  );
  ok(
    (await sec.getByRole('button', { name: 'Démarrer l’enregistrement' }).count()) === 1 &&
      /Votre micro\. 2 minutes au plus\./.test(sp(await sec.innerText())),
    'Enregistrer : bouton rond et aide',
  );
  const forDemo = sec.getByRole('group', { name: 'Pour toute la démo' });
  ok(
    (await forDemo.getByRole('switch', { name: 'Lecture automatique' }).isChecked()) &&
      (await forDemo.getByRole('switch', { name: 'Sous-titres affichés' }).isChecked()) &&
      /Bulle/.test(await forDemo.getByRole('combobox', { name: 'Lecteur audio' }).innerText()),
    '« Pour toute la démo » : lecture automatique, sous-titres affichés, lecteur audio « Bulle »',
  );
  ok(
    /Les navigateurs bloquent le son avant le premier clic du visiteur/.test(
      await sec.getByRole('note').innerText(),
    ),
    'encart permanent sur le blocage du son',
  );
  await tabs.nth(1).focus();
  await page.keyboard.press('ArrowRight');
  ok(
    (await tabs.nth(2).getAttribute('aria-selected')) === 'true' &&
      (await sec.getByRole('button', { name: 'Importer…' }).count()) === 1 &&
      /MP3, M4A, WAV ou WebM, 5\sMo au plus\. Ou déposez le fichier sur ce bloc\./.test(
        sp(await sec.innerText()),
      ),
    'Importer (→ au clavier) : bouton « Importer… », formats et dépôt',
  );
  ok((await sec.locator('audio[controls], input[type=radio]').count()) === 0, 'aucun contrôle natif');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-02-voix-vide${sfx}.png` });
  }

  // MEDIA-01 §18.2 : le dépôt marche sur tout le bloc (pointillé et « Déposer le fichier ici »)
  const drag = (name, type, bytes) =>
    page.evaluateHandle(
      ([n, ty, by]) => {
        const d = new DataTransfer();
        d.items.add(new File([new Uint8Array(by)], n, { type: ty }));
        return d;
      },
      [name, type, bytes],
    );
  const texte = await drag('notes.txt', 'text/plain', [...Buffer.from('pas un son')]);
  await sec.dispatchEvent('dragenter', { dataTransfer: texte });
  const veil = sec.locator('.fd-drop__veil');
  await veil.waitFor();
  const vs = await veil.evaluate((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const b = e.parentElement.getBoundingClientRect();
    return {
      text: e.textContent.trim(),
      border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
      full: Math.abs(r.width - b.width) <= 1 && Math.abs(r.height - b.height) <= 1,
    };
  });
  ok(
    vs.text === 'Déposer le fichier ici' && vs.border === '2px dashed' && vs.full,
    `dépôt : tout le bloc en pointillé de 2 px, « Déposer le fichier ici » (${vs.text}, ${vs.border})`,
  );
  await sec.dispatchEvent('drop', { dataTransfer: texte });
  await sec.getByRole('alert').waitFor();
  ok(
    (await veil.count()) === 0 && !s1()?.voice_path,
    `dépôt d’un fichier qui n’est pas un son : refusé en alerte sous les boutons (${sp(await sec.getByRole('alert').innerText())})`,
  );

  // Import d'un fichier, envoi retenu le temps de voir « Envoi… » et la barre indéterminée (MEDIA-01 §18.2)
  let release;
  const held = new Promise((r) => (release = r));
  const slow = async (route) => {
    await held;
    await route.fallback();
  };
  await page.route('**/storage/v1/object/voices/**', slow);
  await sec
    .locator('input[type=file]')
    .setInputFiles({ name: 'voix.wav', mimeType: 'audio/wav', buffer: wav(2) });
  const bar = sec.getByRole('progressbar', { name: 'Envoi de la voix off' });
  await bar.waitFor();
  ok(
    (await sec.getByRole('button', { name: 'Envoi…' }).isDisabled()) &&
      (await bar.evaluate((e) => Math.round(e.getBoundingClientRect().height))) === 6 &&
      (await sec.getByRole('alert').count()) === 0,
    'envoi en cours : bouton « Envoi… » désactivé, barre de 6 px, l’erreur précédente a disparu',
  );
  release();
  const card = sec.locator('.vo-card');
  await card.waitFor();
  await page.unroute('**/storage/v1/object/voices/**', slow);
  ok((await bar.count()) === 0, 'envoi terminé : la barre disparaît');
  ok(await until(() => /\.wav$/.test(s1()?.voice_path || '')), 'piste importée enregistrée sur l’étape');
  ok(
    s1().voice_duration_ms >= 1900 && s1().voice_duration_ms <= 2100,
    `durée lue (${s1().voice_duration_ms} ms)`,
  );
  // L62 §6 : carte « Voix en place », la source reste visible, point vert sur « Fichier »
  ok(
    (await card.locator('b').innerText()) === 'Voix en place' &&
      (await card.locator('.vo-card__txt .muted').innerText()).trim() === 'Fichier · 0:02' &&
      (await card.getByRole('button', { name: 'Écouter' }).count()) === 1 &&
      (await card.locator('.vo-time').innerText()) === '0:00 / 0:02' &&
      (await sec.getByRole('button', { name: 'Remplacer…' }).count()) === 0 &&
      (await sec.getByRole('tablist').count()) === 1 &&
      (await tabs.nth(2).getAttribute('aria-selected')) === 'true' &&
      (await tabs.nth(2).locator('.vo-dot').count()) === 1 &&
      (await card.locator('.vo-card__icon svg.lucide-upload').count()) === 1 &&
      (await sec.locator('.vo-src-label').isVisible()) &&
      /\(Voix en place\)/.test(await tabs.nth(2).textContent()),
    'voix en place : carte « Voix en place · Fichier · 0:02 », lecteur, segmenté visible, point vert sur « Fichier »',
  );
  await card.getByRole('button', { name: 'Plus d’actions sur la voix' }).click();
  ok(
    (await page.getByRole('menuitem').allInnerTexts()).map((x) => x.trim()).join('|') ===
      'Télécharger|Supprimer la voix off',
    'menu de la voix : Télécharger, Supprimer la voix off',
  );
  await page.keyboard.press('Escape');
  const tr = sec.getByLabel(/^Transcription/);
  ok(
    /Créez une opportunité/.test(await tr.inputValue()) &&
      /Transcription \(obligatoire pour publier\)/.test(sp(await sec.innerText())),
    'transcription préremplie avec le texte de la bulle, « (obligatoire pour publier) »',
  );
  // Lecture automatique : réglage de la démo, appliqué aux voix en place
  const auto = forDemo.getByRole('switch', { name: 'Lecture automatique' });
  await auto.uncheck({ force: true });
  const demoRow = () => state.tables.demos.find((d) => d.id === DEMO);
  ok(
    await until(() => s1().voice_autoplay === false && demoRow().settings?.voice?.autoplay === false),
    'lecture automatique désactivée : réglage de la démo et voix de l’étape',
  );
  await auto.check({ force: true });
  ok(await until(() => s1().voice_autoplay === true), 'lecture automatique réactivée');
  ok(
    (await page.locator('.rail').getByRole('img', { name: 'Voix off' }).count()) +
      (await page.locator('[aria-label="Voix off"], [title="Voix off"]').count()) >
      0,
    'rail : icône de la voix off',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-02-voix-piste${sfx}.png` });
  }

  // Sans transcription : publication bloquée
  await tr.fill('');
  await sec.getByRole('alert').filter({ hasText: 'obligatoire pour publier' }).waitFor();
  await page
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const pe = page.locator('.publish-error');
  await pe.waitFor();
  ok(
    /Étape 1 : la voix off n’a pas de transcription\./.test(sp(await pe.innerText())) &&
      (await pe.getByRole('button', { name: 'Aller à l’étape 1' }).count()) === 1,
    'publication bloquée : « Étape 1 : la voix off n’a pas de transcription. » + Aller à l’étape 1',
  );
  await tr.fill('Créez une opportunité depuis le bouton en haut à gauche.');
  await until(() => /haut à gauche/.test(s1().voice_transcript || ''));

  // L62 §6 : changer d'onglet ne supprime rien ; la voix en place se réduit à une ligne de 44 px
  const avant = s1().voice_path;
  await tabs.nth(1).click();
  const mini = sec.locator('.vo-mini');
  await mini.waitFor();
  ok(
    s1().voice_path === avant &&
      (await card.count()) === 0 &&
      (await mini.evaluate((e) => Math.round(e.getBoundingClientRect().height))) === 44 &&
      (await mini.getByRole('button', { name: 'Écouter' }).count()) === 1 &&
      (await mini.locator('.vo-aud > :first-child').getAttribute('aria-label')) === 'Écouter' &&
      (await mini.locator('.vo-mini__txt').innerText()).replace(/\s+/g, ' ') === 'Voix en place Fichier' &&
      (await mini.locator('.vo-time').innerText()) === '0:02' &&
      (await mini.locator('.vo-dot').count()) === 0,
    `onglet « Enregistrée » : rien n’est supprimé, la voix en place devient une ligne de 44 px (${JSON.stringify({ same: s1().voice_path === avant, card: await card.count(), h: await mini.evaluate((e) => Math.round(e.getBoundingClientRect().height)), play: await mini.getByRole('button', { name: 'Écouter' }).count() })})`,
  );
  await sec.getByRole('button', { name: 'Démarrer l’enregistrement' }).click();
  const recUi = sec.getByRole('group', { name: 'Enregistrement en cours' });
  await recUi.waitFor();
  ok(
    /^0:0\d$/.test((await recUi.locator('.vo-time').innerText()).trim()) &&
      (await recUi.getByRole('button', { name: 'Arrêter l’enregistrement' }).count()) === 1 &&
      (await recUi.getByRole('button', { name: 'Pause' }).count()) === 1,
    'enregistrement : durée, arrêt (danger) et pause',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-02-voix-enregistrement${sfx}.png` });
  }
  await page.waitForFunction(() =>
    /0:0[1-9]/.test(document.querySelector('.vo-aud--rec .vo-time')?.textContent ?? ''),
  );
  await recUi.getByRole('button', { name: 'Arrêter l’enregistrement' }).click();
  // L62 §6 : voix en place : la prise arrive dans une carte « À écouter », rien n'est remplacé
  const fresh = sec.locator('.vo-fresh');
  await fresh.waitFor();
  ok(
    /\.wav$/.test(s1().voice_path) &&
      (await fresh.locator('.vo-fresh__tag').innerText()) === 'À écouter' &&
      (await fresh.getByRole('button', { name: 'Recommencer' }).count()) === 1 &&
      (await fresh.getByRole('button', { name: 'Garder l’actuelle' }).count()) === 1 &&
      (await fresh.getByRole('button', { name: 'Utiliser cette voix' }).count()) === 1,
    'après l’arrêt : carte « À écouter », Recommencer, Garder l’actuelle, Utiliser cette voix ; rien n’est remplacé',
  );
  // Recette UX l62-source-2 : en-tête commun, actions dans la carte, 12 px de retrait intérieur
  {
    const g = await fresh.evaluate((c) => {
      const cs = getComputedStyle(c);
      const inner = c.getBoundingClientRect().right - parseFloat(cs.borderRightWidth);
      const use = [...c.querySelectorAll('button')].find(
        (b) => b.textContent.trim() === 'Utiliser cette voix',
      );
      return {
        dedans: c.contains(use),
        retrait: Math.round((inner - use.getBoundingClientRect().right) * 10) / 10,
        titre: c.querySelector('.vo-card__txt b').textContent,
        ligne: c.querySelector('.vo-card__txt .muted').textContent,
        icone: !!c.querySelector('.vo-card__icon svg.lucide-mic'),
      };
    });
    ok(
      g.dedans &&
        Math.abs(g.retrait - 12) <= 1 &&
        g.titre === 'Nouvelle voix' &&
        g.ligne === 'Enregistrée' &&
        g.icone,
      `carte « Nouvelle voix » : icône Micro, « Enregistrée » (sans durée), actions dans la carte à 12 px du bord (${JSON.stringify(g)})`,
    );
  }
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-02-voix-ecoute${sfx}.png` });
  }
  // « Garder l’actuelle » : la prise est écartée, la voix en place ne bouge pas
  const enPlace = s1().voice_path;
  await fresh.getByRole('button', { name: 'Garder l’actuelle' }).click();
  await fresh.waitFor({ state: 'detached' });
  ok(s1().voice_path === enPlace, '« Garder l’actuelle » : la voix en place ne bouge pas');
  // Nouvelle prise, « Utiliser cette voix » : remplacée, toast avec « Annuler », qui remet l'ancienne
  const prise = async () => {
    // Après « Annuler », le panneau rouvre l'onglet de la voix remise (Fichier)
    await tabs.nth(1).click();
    await sec.getByRole('button', { name: 'Démarrer l’enregistrement' }).click();
    await page.waitForFunction(() =>
      /0:0[1-9]/.test(document.querySelector('.vo-aud--rec .vo-time')?.textContent ?? ''),
    );
    await recUi.getByRole('button', { name: 'Arrêter l’enregistrement' }).click();
    await fresh.waitFor();
    await fresh.getByRole('button', { name: 'Utiliser cette voix' }).click();
  };
  await prise();
  ok(
    await until(() => /\.webm$/.test(s1()?.voice_path || ''), 8000),
    '« Utiliser cette voix » : nouvelle piste WebM',
  );
  const annul = page.locator('.toast', { hasText: 'Voix remplacée par la voix enregistrée' });
  await annul.waitFor();
  await annul.getByRole('button', { name: 'Annuler' }).click();
  ok(
    await until(() => s1().voice_path === enPlace),
    'toast « Voix remplacée… » : « Annuler » remet la voix d’avant',
  );
  await prise();
  ok(await until(() => /\.webm$/.test(s1()?.voice_path || ''), 8000), 'nouvelle prise utilisée : piste WebM');
  ok(/haut à gauche/.test(s1().voice_transcript), 'transcription conservée après réenregistrement');
  await card.waitFor();
  ok(
    /^Enregistrée · 0:0\d$/.test((await card.locator('.vo-card__txt .muted').innerText()).trim()) &&
      (await tabs.nth(1).locator('.vo-dot').count()) === 1 &&
      (await card.locator('.vo-card__icon svg.lucide-mic').count()) === 1,
    'carte « Voix en place · Enregistrée », icône Micro, point vert sur « Enregistrée »',
  );
  // L62 §6 : import avec une voix en place : carte « À écouter », la voix en place reste jusqu'au choix
  {
    const avantImport = s1().voice_path;
    await tabs.nth(2).click();
    await sec
      .locator('input[type=file]')
      .setInputFiles({ name: 'autre.wav', mimeType: 'audio/wav', buffer: wav(1) });
    await fresh.waitFor();
    ok(
      s1().voice_path === avantImport &&
        (await fresh.getByRole('button', { name: 'Utiliser cette voix' }).count()) === 1,
      'import avec une voix en place : carte « À écouter », la voix en place ne bouge pas',
    );
    await fresh.getByRole('button', { name: 'Garder l’actuelle' }).click();
    await fresh.waitFor({ state: 'detached' });
    ok(s1().voice_path === avantImport, 'import, « Garder l’actuelle » : la voix en place reste');
    await tabs.nth(1).click();
  }

  // ===== L62 : l'Aperçu de l'éditeur fait entendre la voix de l'étape =====
  {
    await page.getByRole('radio', { name: 'Aperçu', exact: true }).click();
    const frame = page.frameLocator('iframe.preview-frame');
    const audio = frame.locator('audio');
    await audio.waitFor({ state: 'attached', timeout: 20000 });
    const src = (await audio.getAttribute('src')) || '';
    const controls = await frame
      .getByRole('button', { name: /Activer le son|Lire la voix|Écouter la voix/ })
      .count();
    ok(
      /\/voices\//.test(src) && /\.webm/.test(src) && controls >= 1,
      `Aperçu : la voix enregistrée de l’étape est chargée (adresse signée du bucket voices) avec sa commande d’écoute (${controls})`,
    );
    await page.keyboard.press('Escape');
    await page
      .locator('dialog.preview-dialog[open]')
      .waitFor({ state: 'detached' })
      .catch(() => {});
  }

  // ===== Lecteur =====
  const pl = await (
    await themedContext(b, { viewport: { width: 1280, height: 800 }, locale: 'fr-FR' })
  ).newPage();
  pl.on('pageerror', (e) => errors.push(`player: ${e.message}`));
  const PID = '0b5c1f0e-0000-4000-8000-0000000000c1';
  const manifest = {
    schemaVersion: 1,
    demoId: PID,
    versionId: '0b5c1f0e-0000-4000-8000-0000000000c9',
    workspaceId: 'w',
    title: 'Saisir un congé',
    locale: 'fr',
    publishedAt: '2026-11-19T10:00:00Z',
    theme: {},
    steps: [
      {
        id: 'a1',
        kind: 'text',
        title: 'Bienvenue',
        body: 'Ce module présente la demande de congé.',
        voice: {
          src: 'assets/voice-a1.wav',
          durationMs: 2000,
          transcript: 'Bienvenue. Ce module présente la demande de congé.',
          autoplay: true,
        },
      },
      { id: 'a2', kind: 'text', title: 'Fin', body: 'Merci.' },
    ],
  };
  await pl.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ status: 'ok', manifest }),
    }),
  );
  await pl.route('**/assets/voice-a1.wav', (r) =>
    r.fulfill({ contentType: 'audio/wav', headers: cors, body: wav(2) }),
  );
  await pl.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
  await pl.goto(`${PLAYER}/#/d/${PID}`);
  // EXT-02 §6.4 : lecteur de la voix dans la bulle (réglage par défaut), sous le texte
  const line = pl.locator('.p-voice-line');
  await line.waitFor();
  const playBtn = line.getByRole('button', { name: 'Écouter la voix' });
  const lineCc = line.getByRole('button', { name: 'Sous-titres' });
  ok(
    (await playBtn.count()) === 1 &&
      (await line.locator('.p-voice-time').innerText()) === '0:00 / 0:02' &&
      (await lineCc.getAttribute('aria-pressed')) === 'true',
    'bulle : lecture, temps « 0:00 / 0:02 », bouton des sous-titres enfoncé',
  );
  const geo = await line.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const b = e.querySelector('.p-voice-play').getBoundingClientRect();
    const body = e.parentElement.querySelector('.p-rich').getBoundingClientRect();
    return {
      h: Math.round(r.height),
      play: Math.round(b.width),
      under: r.top >= body.bottom,
      rond: getComputedStyle(e.querySelector('.p-voice-play')).borderRadius,
    };
  });
  ok(
    geo.h === 36 && geo.play === 28 && geo.under && geo.rond === '50%',
    `ligne de 36 px sous le texte, bouton de 28 px, rond (RADIUS-01) (${JSON.stringify(geo)})`,
  );
  ok(
    (await pl.getByRole('button', { name: 'Activer le son' }).count()) === 0 &&
      (await pl.locator('.p-controls .p-cc').count()) === 0,
    'bulle : la barre du lecteur n’a plus ses boutons de voix',
  );
  const cc = pl.locator('.p-voice-cc');
  ok(
    (await cc.innerText()) === 'Bienvenue. Ce module présente la demande de congé.',
    'sous-titres affichés par défaut',
  );
  ok(await pl.locator('audio').evaluate((a) => a.paused), 'son coupé au départ : rien ne joue');
  if (SHOTS) {
    await pl.mouse.move(0, 0);
    await pl.screenshot({ path: `${SHOTS}/l28-03-lecteur-voix${sfx}.png` });
  }
  await playBtn.click();
  ok(
    await pl.locator('audio').evaluate((a) => new Promise((res) => setTimeout(() => res(!a.paused), 300))),
    'lecture dans la bulle : la voix démarre',
  );
  ok(
    (await line.getByRole('button', { name: 'Mettre la voix en pause' }).count()) === 1,
    'le bouton devient « Mettre la voix en pause »',
  );
  await pl.keyboard.press('c');
  ok(
    (await cc.count()) === 0 && (await lineCc.getAttribute('aria-pressed')) === 'false',
    'touche C : sous-titres masqués, état annoncé',
  );
  await lineCc.click();
  ok((await cc.count()) === 1, 'bouton Sous-titres : réaffichés');
  await pl
    .getByRole('button', { name: /Étape suivante|Suivant/ })
    .first()
    .click();
  await pl.waitForTimeout(200);
  ok(
    (await pl.locator('audio').count()) === 0 && (await cc.count()) === 0 && (await line.count()) === 0,
    'étape suivante : voix arrêtée, plus de ligne audio',
  );

  // Réglage « Barre du lecteur », sous-titres masqués par défaut
  manifest.voice = { player: 'bar', captions: false };
  // Nouvelle visite : le son n'est plus actif
  await pl.evaluate(() => sessionStorage.clear());
  await pl.goto('about:blank');
  await pl.goto(`${PLAYER}/#/d/${PID}`);
  const soundBtn = pl.getByRole('button', { name: 'Activer le son' });
  await soundBtn.waitFor();
  ok(
    (await pl.locator('.p-voice-line').count()) === 0,
    'barre du lecteur : « Activer le son » dans la barre, pas de ligne dans la bulle',
  );
  const barCc = pl.locator('.p-controls').getByRole('button', { name: 'Sous-titres' });
  ok(
    (await cc.count()) === 0 && (await barCc.getAttribute('aria-pressed')) === 'false',
    'sous-titres masqués par défaut (réglage de la démo), le visiteur garde son bouton',
  );
  await barCc.click();
  ok(
    (await cc.innerText()) === 'Bienvenue. Ce module présente la demande de congé.',
    'le visiteur affiche les sous-titres : la transcription reste disponible',
  );
  await soundBtn.click();
  ok(
    await pl.locator('audio').evaluate((a) => new Promise((res) => setTimeout(() => res(!a.paused), 300))),
    'Activer le son : la voix démarre',
  );
  ok((await soundBtn.count()) === 0, 'bouton retiré une fois le son actif');
  // L62 : voix lancée automatiquement, le visiteur peut la mettre en pause et la reprendre
  {
    const pause = pl.locator('.p-controls').getByRole('button', { name: 'Mettre la voix en pause' });
    await pause.waitFor();
    ok(
      (await pause.evaluate((b) => getComputedStyle(b).borderRadius)) === '50%',
      'barre du lecteur : bouton lecture/pause de la voix rond (RADIUS-01)',
    );
    await pause.click();
    await pl.waitForFunction(() => document.querySelector('audio').paused);
    const resume = pl.locator('.p-controls').getByRole('button', { name: 'Écouter la voix off' });
    await resume.waitFor();
    ok(
      (await pause.count()) === 0,
      'barre du lecteur : la voix automatique se met en pause, le bouton devient « Écouter »',
    );
    await resume.click();
    await pl.waitForFunction(() => !document.querySelector('audio').paused);
    await pause.waitFor();
    ok(true, 'barre du lecteur : la voix reprend, le bouton redevient « Mettre la voix en pause »');
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
