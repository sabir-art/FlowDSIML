/**
 * Test e2e F7 (L21-03) : étape vidéo dans l'éditeur (canevas, montage, pauses-étapes, coupe,
 * sous-titres .vtt et liste éditable, lecture, conversion en captures, blocage de publication).
 * Données fictives (faux Supabase). Usage : SHOTS_DIR=… [THEME=dark] node e2e/video-editor.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  state.tables.steps.unshift({
    ...base,
    id: 'vid-1',
    position: 0,
    kind: 'video',
    title: 'Saisie de la fiche',
    image_path: null,
    video_path: `${ws}/${DEMO}/0b5c1f0e-0000-4000-8000-0000000000c1.webm`,
    video_duration_ms: 12000,
    video: {
      pauses: [{ id: 'p1', t: 3000, title: 'Ouvrez la fiche', body: 'Cliquez sur « Nouvelle fiche ».' }],
      captions: [],
      hasVoice: true,
      frames: { p1: `${ws}/${DEMO}/frame-p1.webp` },
    },
  });
  state.tables.steps.filter((s) => s.id !== 'vid-1' && s.demo_id === DEMO).forEach((s) => (s.position += 1));
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.locator('.vd-stage video').waitFor();
  const v = () => state.tables.steps.find((s) => s.id === 'vid-1').video;

  ok((await page.locator('.floatbar').count()) === 0, 'barre d’outils de capture masquée');
  ok((await page.getByRole('img', { name: /Piste vidéo de 00:12/ }).count()) === 1, 'piste vidéo résumée');
  ok((await page.getByText('00:00 / 00:12 · après coupe 00:12').count()) === 1, 'temps et durée après coupe');

  // Pause existante : sélection, bulle, texte modifié
  await page.getByRole('button', { name: 'Pause-étape 1 · 00:03 · Ouvrez la fiche' }).click();
  await page.getByText('Pause 1 sur 1').waitFor();
  await page.getByLabel('Texte de la bulle').fill('Cliquez sur « Nouvelle fiche » en haut.');
  await page.waitForTimeout(1200);
  ok(v().pauses[0].body === 'Cliquez sur « Nouvelle fiche » en haut.', 'texte de la bulle enregistré');

  // Clavier sur les pistes : avancer, ajouter une pause, couper
  const tracks = page.getByRole('group', { name: 'Pistes du montage' });
  await tracks.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('p');
  await page.waitForTimeout(1500);
  // La pause 1 sélectionnée a placé la tête à 00:03 : +5 s puis +1 s
  ok(v().pauses.length === 2 && Math.abs(v().pauses[1].t - 9000) < 400, 'P : pause ajoutée à 00:09');
  ok(!!v().frames[v().pauses[1].id], 'image de la pause enregistrée');
  await tracks.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('c');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('c');
  await page.waitForTimeout(1200);
  ok(
    v().cuts?.length === 1 &&
      Math.abs(v().cuts[0].from - 10000) < 400 &&
      Math.abs(v().cuts[0].to - 12000) < 400,
    'C deux fois : coupe 00:10 → 00:12',
  );
  ok((await page.locator('.vd-cut').count()) === 1, 'coupe en hachures sur la piste');
  ok((await page.getByText(/après coupe 00:10/).count()) === 1, 'durée après coupe mise à jour');

  // Sous-titres : import .vtt puis modification
  await page.locator('input[type=file][accept*=".vtt"]').setInputFiles({
    name: 'sous-titres.vtt',
    mimeType: 'text/vtt',
    buffer: Buffer.from(
      'WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nOuvrez la fiche de l’usager.\n\n00:00:03.000 --> 00:00:05.000\nRemplissez les champs.\n',
    ),
  });
  await page.getByText('2 sous-titres importés.').waitFor();
  await page.waitForTimeout(1200);
  ok(
    v().captions.length === 2 && v().captionsDefault === true,
    'import .vtt : 2 sous-titres, affichés par défaut',
  );
  await page.getByRole('button', { name: 'Modifier (2)' }).click();
  const dlg = page.getByRole('dialog', { name: 'Sous-titres' });
  await dlg.getByLabel('Texte du sous-titre 2').fill('Remplissez les champs obligatoires.');
  await dlg.getByLabel('Fin du sous-titre 1').fill('abc');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  ok((await dlg.getByText(/Sous-titre 1.: temps ou texte invalide/).count()) === 1, 'temps invalide refusé');
  await dlg.getByLabel('Fin du sous-titre 1').fill('0:02.5');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(1200);
  ok(v().captions[1].text === 'Remplissez les champs obligatoires.', 'sous-titre modifié');
  ok(
    (await page
      .locator('.ai-entry', { hasText: 'Transcription automatique' })
      .getAttribute('aria-disabled')) === 'true',
    '066 : « Transcription automatique » désactivé tant que l’Assistance IA ne l’est pas',
  );

  // Lecture
  await page.getByRole('switch', { name: 'Lecture automatique, sans son au départ' }).uncheck();
  await page.waitForTimeout(1200);
  ok(v().autoplayMuted === false, 'lecture automatique désactivée');
  ok((await page.getByText('Oui · 00:12').count()) === 1, 'voix enregistrée : oui');

  // Capture de l'état L21-03 : première pause sélectionnée
  await page
    .getByRole('button', { name: 'Précédente' })
    .click()
    .catch(() => {});
  ok(
    (await page.getByRole('button', { name: /Retirer la coupe de/ }).innerText()).includes(
      'Supprimer la coupe',
    ),
    'coupe : bouton nommé « Supprimer la coupe »',
  );
  ok(
    (await page.locator('#video-tl-slot .vd-tl').count()) === 1 &&
      (await page.locator('.frame .vd-tl').count()) === 0,
    'carte Montage sous le canevas, hors du cadre',
  );
  if (SHOTS) {
    for (const x of await page.locator('.toast .toast-close').all()) await x.click().catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.toast')).catch(() => {});
    // Panneau en haut : section « Pause-étape 1 · 00:03 » et « Texte de la bulle »
    await page.evaluate(() =>
      document.querySelectorAll('.panel, .panel-body, aside').forEach((el) => (el.scrollTop = 0)),
    );
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/l21-03-editeur-video${sfx}.png` });
  }

  // L21-03 (reprise UX) : une pause placée dans la coupe, contour warning et aide
  {
    const vid = state.tables.steps.find((s) => s.id === 'vid-1');
    const keep = vid.video;
    vid.video = {
      ...keep,
      pauses: [
        ...keep.pauses,
        { id: 'p-cut', t: 11000, title: 'Vérifiez la fiche', body: 'Relisez avant d’enregistrer.' },
      ],
      frames: { ...keep.frames, 'p-cut': keep.frames.p1 },
    };
    await page.reload();
    await page.locator('.vd-stage video').waitFor();
    const pc = page.getByRole('button', { name: /Pause-étape 3 · 00:11/ });
    ok((await page.locator('.vd-pin.in-cut').count()) === 1, 'pause dans une coupe : contour warning');
    await pc.click();
    await page.getByText(/Dans une coupe.: ignorée à la lecture/).waitFor();
    ok(true, 'pause dans une coupe : aide « ignorée à la lecture »');
    if (SHOTS) {
      for (const x of await page.locator('.toast .toast-close').all()) await x.click().catch(() => {});
      await page.evaluate(() =>
        document.querySelectorAll('.panel, .panel-body, aside').forEach((el) => (el.scrollTop = 0)),
      );
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/l21-03-pause-coupe${sfx}.png` });
    }
    vid.video = keep;
    await page.reload();
    await page.locator('.vd-stage video').waitFor();
  }

  // Conversion en captures
  const n0 = state.tables.steps.filter((s) => s.demo_id === DEMO).length;
  await page.getByRole('button', { name: 'Créer 2 étapes captures' }).click();
  await page.getByText('2 étapes captures créées après la vidéo.').waitFor();
  const steps = state.tables.steps.filter((s) => s.demo_id === DEMO).sort((a, b) => a.position - b.position);
  ok(steps.length === n0 + 2, '2 étapes créées');
  ok(
    steps[1].kind === 'image' && steps[1].title === 'Ouvrez la fiche' && steps[0].id === 'vid-1',
    'capture après la vidéo, avec le texte de la bulle',
  );
  ok(
    (state.copies || []).some((c) => c.from.endsWith('frame-p1.webp')),
    'image de pause copiée',
  );

  // Publication bloquée sans fichier
  state.tables.steps.find((s) => s.id === 'vid-1').video_path = null;
  await page.reload();
  await page.locator('.vd-missing').waitFor();
  await page
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  ok(
    await page
      .getByText(/L’étape 1 est une vidéo sans fichier/)
      .waitFor({ timeout: 3000 })
      .then(
        () => true,
        () => false,
      ),
    'publication bloquée : vidéo sans fichier',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
