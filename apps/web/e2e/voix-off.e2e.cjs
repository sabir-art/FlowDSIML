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
  // EXT-02 §6.4 : sans voix, segmenté « Générer », « Enregistrer », « Importer »
  const tabs = sec.getByRole('tablist', { name: 'Source de la voix' }).getByRole('tab');
  ok(
    (await tabs.allInnerTexts()).join('|') === 'Générer|Enregistrer|Importer',
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
  // Voix en place : carte, lecteur dessiné, « Remplacer… », menu
  ok(
    (await card.locator('b').innerText()) === 'Voix importée' &&
      /^0:02$/.test((await card.locator('.vo-card__txt .muted').innerText()).trim()) &&
      (await card.getByRole('button', { name: 'Écouter' }).count()) === 1 &&
      (await card.locator('.vo-time').innerText()) === '0:00 / 0:02' &&
      (await card.getByRole('button', { name: 'Remplacer…' }).count()) === 1 &&
      (await sec.getByRole('tablist').count()) === 0,
    'voix en place : carte « Voix importée », durée, lecteur dessiné, « Remplacer… », plus de segmenté',
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

  // « Remplacer… » rouvre le segmenté ; enregistrement au micro (micro simulé), écoute avant de garder
  await card.getByRole('button', { name: 'Remplacer…' }).click();
  ok(
    (await sec.getByRole('tablist').count()) === 1 &&
      (await sec.getByRole('button', { name: 'Garder la voix actuelle' }).count()) === 1,
    '« Remplacer… » : le segmenté revient, avec « Garder la voix actuelle »',
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
  await sec.getByText('Écoutez avant de garder').waitFor();
  ok(
    /\.wav$/.test(s1().voice_path) &&
      (await sec.getByRole('button', { name: 'Recommencer' }).count()) === 1 &&
      (await sec.getByRole('button', { name: 'Garder', exact: true }).count()) === 1,
    'après l’arrêt : « Écoutez avant de garder », « Recommencer » et « Garder » ; rien n’est encore remplacé',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-02-voix-ecoute${sfx}.png` });
  }
  await sec.getByRole('button', { name: 'Garder', exact: true }).click();
  ok(await until(() => /\.webm$/.test(s1()?.voice_path || ''), 8000), '« Garder » : nouvelle piste WebM');
  ok(/haut à gauche/.test(s1().voice_transcript), 'transcription conservée après réenregistrement');
  await card.waitFor();
  ok((await card.locator('b').innerText()) === 'Voix enregistrée', 'carte « Voix enregistrée »');

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
    return { h: Math.round(r.height), play: Math.round(b.width), under: r.top >= body.bottom };
  });
  ok(
    geo.h === 36 && geo.play === 28 && geo.under,
    `ligne de 36 px sous le texte, bouton de 28 px (${JSON.stringify(geo)})`,
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

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
