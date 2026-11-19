/**
 * L28-02 / L28-03 : voix off. Éditeur : section « Voix off » (import d'un fichier, transcription préremplie
 * avec la bulle, publication bloquée sans transcription, enregistrement au micro simulé, icône du rail).
 * Lecteur : son coupé au départ, « Activer le son », sous-titres par défaut, touche C.
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/voix-off.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
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
  const sec = page.locator('.voice-sec');
  await sec.waitFor();
  ok(/Voix off/i.test(await sec.innerText()), 'section « Voix off » dans l’onglet Étape');
  ok(
    (await sec.getByRole('button', { name: 'Enregistrer' }).count()) === 1 &&
      (await sec.getByRole('button', { name: 'Importer un fichier' }).count()) === 1,
    'section vide : Enregistrer et Importer un fichier',
  );
  const gen = sec.getByRole('button', { name: /Générer à partir du texte/ });
  ok(
    (await gen.getAttribute('aria-disabled')) === 'true' && /Bientôt/.test(await gen.innerText()),
    '« Générer à partir du texte » en « Bientôt »',
  );
  ok(
    /Une piste par étape, 2 minutes au plus\. MP3, M4A, WAV ou WebM, 5 Mo au plus\./.test(
      sp(await sec.innerText()),
    ),
    'aide : limites de la piste',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-02-voix-vide${sfx}.png` });
  }

  // Import d'un fichier
  await sec
    .locator('input[type=file]')
    .setInputFiles({ name: 'voix.wav', mimeType: 'audio/wav', buffer: wav(2) });
  await sec.locator('audio').waitFor();
  ok(await until(() => /\.wav$/.test(s1()?.voice_path || '')), 'piste importée enregistrée sur l’étape');
  ok(
    s1().voice_duration_ms >= 1900 && s1().voice_duration_ms <= 2100,
    `durée lue (${s1().voice_duration_ms} ms)`,
  );
  const tr = sec.getByLabel('Transcription');
  ok(
    /Créez une opportunité/.test(await tr.inputValue()),
    'transcription préremplie avec le texte de la bulle',
  );
  ok(
    (await sec.getByRole('checkbox', { name: 'Lancer la voix à l’arrivée sur l’étape' }).isChecked()) ===
      true,
    'lancement à l’arrivée : activé par défaut',
  );
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

  // Enregistrement au micro (micro simulé)
  await sec.getByRole('button', { name: 'Réenregistrer' }).click();
  const recUi = sec.getByRole('group', { name: 'Enregistrement en cours' });
  await recUi.waitFor();
  ok(/0:0\d \/ 2:00/.test(await recUi.innerText()), 'minuteur « 0:0x / 2:00 »');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await sec.screenshot({ path: `${SHOTS}/l28-02-voix-enregistrement${sfx}.png` });
  }
  await page.waitForTimeout(1500);
  await recUi.getByRole('button', { name: 'Terminer' }).click();
  ok(await until(() => /\.webm$/.test(s1()?.voice_path || ''), 8000), 'enregistrement : nouvelle piste WebM');
  ok(/haut à gauche/.test(s1().voice_transcript), 'transcription conservée après réenregistrement');

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
  const soundBtn = pl.getByRole('button', { name: 'Activer le son' });
  await soundBtn.waitFor();
  ok(true, 'lecteur : « Activer le son » au premier écran avec voix');
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
  await soundBtn.click();
  ok(
    await pl.locator('audio').evaluate((a) => new Promise((res) => setTimeout(() => res(!a.paused), 300))),
    'Activer le son : la voix démarre',
  );
  ok((await soundBtn.count()) === 0, 'bouton retiré une fois le son actif');
  await pl.keyboard.press('c');
  ok((await cc.count()) === 0, 'touche C : sous-titres masqués');
  const ccBtn = pl.getByRole('button', { name: 'Sous-titres' });
  ok((await ccBtn.getAttribute('aria-pressed')) === 'false', 'bouton Sous-titres : état annoncé');
  await ccBtn.click();
  ok((await cc.count()) === 1, 'bouton Sous-titres : réaffichés');
  await pl
    .getByRole('button', { name: /Étape suivante|Suivant/ })
    .first()
    .click();
  await pl.waitForTimeout(200);
  ok((await pl.locator('audio').count()) === 0 && (await cc.count()) === 0, 'étape suivante : voix arrêtée');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
