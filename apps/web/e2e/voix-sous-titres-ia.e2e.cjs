/**
 * Test e2e 065 / 066 : voix de synthèse (panneau Voix off) et sous-titres automatiques (étape vidéo),
 * ElevenLabs simulé. Avertissement avant l'envoi, aperçu puis Appliquer / Ignorer, sous-titres
 * relus dans l'éditeur de sous-titres. Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/voix-sous-titres-ia.e2e.cjs
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
  const shot = async (name) => {
    for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  const state = seed();
  const ws = state.tables.workspaces[0].id;
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  state.tables.steps.push({
    ...base,
    id: 'vid-1',
    position: 9,
    kind: 'video',
    title: 'Saisie de la fiche',
    image_path: null,
    video_path: `${ws}/${DEMO}/0b5c1f0e-0000-4000-8000-0000000000c1.webm`,
    video_duration_ms: 12000,
    video: { pauses: [], captions: [], hasVoice: true, frames: {} },
  });
  state.ai = {
    enabled: true,
    features: {
      write: true,
      translate: true,
      suggest: true,
      generate: true,
      dataset: true,
      chart: true,
      assistant: true,
      voice: true,
      captions: true,
    },
    used: 3,
    quota: 500,
    userToday: 0,
    userDailyRequests: 30,
    audioUsed: 40,
    audioQuota: 3600,
    workspaceQuotaReached: false,
    userQuotaReached: false,
    audioQuotaReached: false,
    renewsOn: '2026-12-01',
    canEdit: true,
    canManage: true,
  };
  state.aiReply = (task, input) =>
    task === 'voice'
      ? { path: `${ws}/${DEMO}/0b5c1f0e-0000-4000-8000-0000000000a1.mp3`, durationMs: 4200 }
      : {
          captions: [
            { from: 0, to: 2400, text: 'Ouvrez la fiche du jeune.' },
            { from: 2400, to: 6000, text: 'Renseignez la date d’entrée.' },
          ],
        };
  await install(page, state);
  const s1 = () => state.tables.steps.find((s) => s.demo_id === DEMO && s.position === 0);

  // ===== 065 : voix de synthèse =====
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  const sec = page.locator('.voice-sec');
  await sec.waitFor();
  ok((await sec.getByText('Bientôt').count()) === 0, '« Générer la voix » n’est plus en Bientôt');
  await sec.getByRole('button', { name: 'Générer la voix' }).click();
  ok(
    /envoyée à ElevenLabs/.test(await sec.locator('.ai-voice').textContent()),
    'Avertissement avant l’envoi',
  );
  ok(!(state.aiCalls || []).length, 'Rien n’est envoyé avant « Générer »');
  await sec.getByLabel('Voix', { exact: true }).selectOption('masculine');
  await shot('l30-voix-avant');
  await sec.getByRole('button', { name: 'Générer', exact: true }).click();
  await sec.getByRole('button', { name: 'Appliquer' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'voice' && call.input.voice === 'masculine' && call.input.text.length > 0,
    'Demande : texte de la transcription et voix',
  );
  ok((await sec.locator('.ai-voice audio').count()) === 1, 'Aperçu à écouter');
  ok(!s1().voice_path, 'Rien n’est appliqué avant « Appliquer »');
  await shot('l30-voix-apercu');
  await sec.getByRole('button', { name: 'Appliquer' }).click();
  await page.waitForTimeout(900);
  ok(
    /a1\.mp3$/.test(s1().voice_path || '') && s1().voice_duration_ms === 4200,
    'Voix off appliquée à l’étape',
  );

  // ===== 066 : sous-titres automatiques =====
  await page.locator('[data-step-index="1"], .rail li').last().click();
  await page.locator('.vd-stage video').waitFor();
  await page.getByRole('button', { name: 'Sous-titres automatiques' }).click();
  const box = page.locator('.ai-captions');
  ok(
    /La piste audio de cette vidéo est envoyée à ElevenLabs/.test(await box.textContent()),
    'Avertissement : piste audio envoyée',
  );
  await shot('l30-sous-titres-avant');
  const n = state.aiCalls.length;
  await box.getByRole('button', { name: 'Transcrire' }).click();
  const dlg = page.locator('dialog.vd-dialog');
  await dlg.waitFor();
  ok(
    state.aiCalls.at(-1).task === 'captions' && state.aiCalls.at(-1).input.stepId === 'vid-1',
    'Demande : étape vidéo',
  );
  ok(state.aiCalls.length === n + 1, 'Une seule demande');
  ok(
    (await dlg.getByText('Généré par IA, à vérifier').count()) === 1,
    'Mention IA dans l’éditeur de sous-titres',
  );
  const texts = await dlg
    .locator('textarea, input[aria-label*="Texte"]')
    .evaluateAll((e) => e.map((x) => x.value));
  ok(
    texts.some((x) => x.includes('Ouvrez la fiche du jeune.')),
    'Sous-titres proposés modifiables',
  );
  await shot('l30-sous-titres-apercu');
  await dlg.getByRole('button', { name: 'Appliquer' }).click();
  await page.waitForTimeout(900);
  const v = state.tables.steps.find((s) => s.id === 'vid-1').video;
  ok(v.captions.length === 2 && v.captionsDefault === true, 'Sous-titres appliqués à la vidéo');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
