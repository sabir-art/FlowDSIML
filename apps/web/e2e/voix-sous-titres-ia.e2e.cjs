/**
 * Test e2e L30b (065 / 066) : voix de synthèse (panneau Voix off) et sous-titres automatiques (étape
 * vidéo, voix enregistrée), ElevenLabs simulé. Texte modifiable, 6 voix avec extrait, vitesse, aperçu,
 * confirmation avant de remplacer, toast « Annuler » ; modale avant chaque envoi d'audio ; limite de
 * 2 min ; quotas (L30-13) et fonction désactivée. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/voix-sous-titres-ia.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const FEATURES = {
  write: true,
  translate: true,
  suggest: true,
  generate: true,
  dataset: true,
  chart: true,
  assistant: true,
  voice: true,
  captions: true,
};

function prepare(over = {}) {
  const state = seed();
  const ws = state.tables.workspaces[0].id;
  const base = state.tables.steps.find((s) => s.demo_id === DEMO && s.position === 0);
  // Étape 1 : voix enregistrée, transcription avec une variable
  Object.assign(base, {
    voice_path: `${ws}/${DEMO}/0b5c1f0e-0000-4000-8000-0000000000b1.webm`,
    voice_duration_ms: 9000,
    voice_transcript: 'Bienvenue chez {{company}}. Ouvrez la fiche du jeune.',
  });
  const video = (id, position, ms) => ({
    ...base,
    id,
    position,
    kind: 'video',
    title: id === 'vid-1' ? 'Saisie de la fiche' : 'Visite complète',
    image_path: null,
    voice_path: null,
    voice_duration_ms: null,
    voice_transcript: null,
    video_path: `${ws}/${DEMO}/0b5c1f0e-0000-4000-8000-0000000000c${position}.webm`,
    video_duration_ms: ms,
    video: { pauses: [], captions: [], hasVoice: true, frames: {} },
  });
  state.tables.steps.push(video('vid-1', 8, 12000), video('vid-2', 9, 150000));
  state.ai = {
    enabled: true,
    features: { ...FEATURES },
    used: 3,
    quota: 500,
    userToday: 0,
    userDailyRequests: 30,
    workspaceQuotaReached: false,
    userQuotaReached: false,
    ttsUsed: 40,
    ttsQuota: 300,
    sttUsed: 20,
    sttQuota: 300,
    renewsOn: '2026-12-01',
    canEdit: true,
    canManage: true,
    ...over,
  };
  state.aiReply = (task) =>
    task === 'voice'
      ? { path: `${ws}/${DEMO}/0b5c1f0e-0000-4000-8000-0000000000a1.mp3`, durationMs: 4200 }
      : {
          captions: [
            { from: 0, to: 2400, text: 'Ouvrez la fiche du jeune.' },
            { from: 2400, to: 6000, text: 'Renseignez la date d’entrée.' },
          ],
          text: 'Ouvrez la fiche du jeune. Renseignez la date d’entrée.',
          language: 'fra',
        };
  return state;
}

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  let page = await ctx.newPage();
  let sec, panel, ask, dlg;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const until = async (f, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (f()) return true;
      await page.waitForTimeout(100);
    }
    return f();
  };
  const shot = async (name, keepToast = false) => {
    if (!keepToast)
      for (const x of await page.locator('.toast button[aria-label]').all()) await x.click().catch(() => {});
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  let fresh = true;
  const open = async (state) => {
    // Une page neuve par scénario (même URL : sinon l'application n'est pas rechargée)
    if (!fresh) {
      await page.close();
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
    }
    fresh = false;
    sec = page.locator('.voice-sec');
    panel = sec.locator('.ai-voice');
    ask = page.getByRole('dialog', { name: 'Envoyer l’audio pour transcription ?' });
    dlg = page.locator('dialog.vd-dialog');
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/edit`);
    await page.locator('[data-step-index="0"]').click();
    await page.locator('.voice-sec').waitFor();
  };
  const railTo = async (title) => {
    await page.locator('.rail-li', { hasText: title }).locator('[data-step-index]').click();
    await page.locator('.vd-stage video').waitFor();
  };

  // ===== L30-11 : voix de synthèse =====
  let state = prepare();
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* */
    }
  });
  await open(state);
  const s1 = () => state.tables.steps.find((s) => s.demo_id === DEMO && s.position === 0);
  ok((await sec.getByText('Bientôt').count()) === 0, '« Générer à partir du texte » n’est plus en Bientôt');
  await sec.getByRole('button', { name: 'Générer à partir du texte' }).click();
  const txt = panel.getByLabel('Texte à lire');
  ok(
    (await txt.inputValue()) === 'Bienvenue chez {{company}}. Ouvrez la fiche du jeune.',
    'Texte à lire prérempli avec la transcription',
  );
  ok(
    /Les variables sont lues avec leur valeur par défaut \(\{\{company\}\} → « votre entreprise »\)/.test(
      await panel.textContent(),
    ),
    'Aide : variables lues avec leur valeur par défaut',
  );
  ok((await panel.getByRole('radio').count()) === 9, '6 voix et 3 vitesses');
  ok(
    (await panel.getByRole('button', { name: /^Écouter un exemple de la voix/ }).count()) === 6,
    'Un exemple par voix',
  );
  ok(await panel.getByRole('radio', { name: 'Normale' }).isChecked(), 'Vitesse « Normale » par défaut');
  ok(/Environ\s\d+\ss/.test(await panel.textContent()), 'Durée estimée');
  ok(
    (await panel.getByText('Le texte ci-dessus sera envoyé à ElevenLabs pour produire l’audio.').count()) ===
      1,
    'Avertissement au-dessus du bouton',
  );
  ok(!(state.aiCalls || []).length, 'Rien n’est envoyé à l’ouverture');
  const used0 = state.ai.used;
  await panel.getByRole('button', { name: 'Écouter un exemple de la voix Antoine' }).click();
  await until(() => (state.aiCalls || []).some((c) => c.task === 'voice_sample'));
  ok(
    state.aiCalls.at(-1).task === 'voice_sample' && state.aiCalls.at(-1).input.voice === 'antoine',
    'Exemple demandé sans texte',
  );
  ok(state.ai.used === used0, 'L’exemple ne consomme pas de quota');
  await panel.getByRole('radio', { name: /Antoine/ }).check();
  await panel.getByRole('radio', { name: 'Rapide' }).check();
  await shot('l30-11-voix-panneau');
  await panel.getByRole('button', { name: 'Générer la voix' }).click();
  await panel.getByRole('button', { name: 'Appliquer' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'voice' &&
      call.input.voice === 'antoine' &&
      call.input.speed === 'fast' &&
      call.input.text === 'Bienvenue chez votre entreprise. Ouvrez la fiche du jeune.',
    'Demande : texte avec les valeurs par défaut, voix et vitesse',
  );
  ok((await panel.locator('audio').count()) === 1, 'Aperçu à écouter');
  ok(/Durée\s:\s4\ss/.test(await panel.textContent()), 'Durée réelle');
  ok((await panel.getByText('Généré par IA, à vérifier').count()) === 1, 'Mention IA');
  ok(
    (await panel.getByRole('button', { name: 'Générer à nouveau' }).count()) === 1,
    'Lien « Générer à nouveau »',
  );
  ok(/b1\.webm$/.test(s1().voice_path), 'Rien n’est appliqué avant « Appliquer »');
  await shot('l30-11-voix-apercu');
  await panel.getByRole('button', { name: 'Appliquer' }).click();
  const confirm = page.getByRole('dialog', {
    name: 'Remplacer votre enregistrement par la voix de synthèse ?',
  });
  await confirm.waitFor();
  ok(true, 'Confirmation avant de remplacer la voix enregistrée');
  await shot('l30-11-voix-remplacer');
  await confirm.getByRole('button', { name: 'Remplacer' }).click();
  ok(await until(() => /a1\.mp3$/.test(s1().voice_path || '')), 'Voix de synthèse appliquée');
  ok(
    s1().voice_duration_ms === 4200 &&
      s1().voice_transcript === 'Bienvenue chez votre entreprise. Ouvrez la fiche du jeune.' &&
      s1().options?.aiVoice === true,
    'Transcription = texte lu, repère IA',
  );
  const demo = () => state.tables.demos.find((d) => d.id === DEMO);
  ok(await until(() => demo().settings?.aiVoice === 'antoine'), 'Voix mémorisée pour la démo');
  await page.getByText('Voix appliquée.').waitFor();
  ok(
    (await page.locator('.rail-li .rail-ai[aria-label="Voix off générée par l’IA"]').count()) === 1,
    'Liste des étapes : icône voix avec repère « IA »',
  );
  await shot('l30-11-voix-appliquee', true);
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
  ok(
    await until(() => /b1\.webm$/.test(s1().voice_path || '') && !s1().options?.aiVoice),
    '« Annuler » rétablit l’enregistrement',
  );

  // ===== L30-12 : transcription de la voix enregistrée =====
  await sec.getByRole('button', { name: 'Transcrire la voix' }).click();
  await ask.waitFor();
  ok(
    /La piste audio de cette étape \(9\ss\) sera envoyée à ElevenLabs/.test(await ask.textContent()),
    'Modale avant l’envoi, avec la durée',
  );
  ok(
    !(await ask.getByRole('checkbox', { name: 'Ne plus demander pour cette démo' }).isChecked()),
    'Case non cochée',
  );
  await shot('l30-12-envoi-audio');
  const n0 = state.aiCalls.length;
  await ask.getByRole('button', { name: 'Annuler' }).click();
  ok(state.aiCalls.length === n0, '« Annuler » : rien n’est envoyé');
  await sec.getByRole('button', { name: 'Transcrire la voix' }).click();
  await ask.getByRole('button', { name: 'Envoyer' }).click();
  const tr = sec.getByRole('group', { name: 'Proposition' });
  await tr.waitFor();
  ok(
    state.aiCalls.at(-1).task === 'captions' && state.aiCalls.at(-1).input.source === 'voice',
    'Demande : voix off de l’étape',
  );
  ok(/Langue détectée\s: Français/.test(await tr.textContent()), 'Langue détectée');
  await shot('l30-12-transcription-voix');
  await tr.getByRole('button', { name: 'Appliquer' }).click();
  ok(
    await until(() => s1().voice_transcript === 'Ouvrez la fiche du jeune. Renseignez la date d’entrée.'),
    'Transcription remplacée par le texte entendu',
  );

  // ===== L30-12 : sous-titres d'une vidéo =====
  await railTo('Saisie de la fiche');
  await page.getByRole('button', { name: 'Transcription automatique' }).click();
  await ask.waitFor();
  ok(/\(12\ss\)/.test(await ask.textContent()), 'Modale : durée de la vidéo');
  await ask.getByRole('button', { name: 'Envoyer' }).click();
  await dlg.waitFor();
  ok(
    state.aiCalls.at(-1).input.stepId === 'vid-1' && state.aiCalls.at(-1).input.source === 'video',
    'Demande : étape vidéo',
  );
  ok(
    (await dlg.getByText('Généré par IA, à vérifier').count()) === 1,
    'Mention IA dans l’éditeur de sous-titres',
  );
  ok((await dlg.getByText('Langue détectée : Français').count()) === 1, 'Langue détectée');
  const texts = await dlg.locator('input[aria-label*="Texte"]').evaluateAll((e) => e.map((x) => x.value));
  ok(texts.includes('Ouvrez la fiche du jeune.'), 'Sous-titres proposés modifiables');
  ok((await dlg.getByRole('button', { name: 'Ignorer' }).count()) === 1, 'Appliquer ou Ignorer');
  await shot('l30-12-sous-titres-apercu');
  await dlg.getByRole('button', { name: 'Appliquer' }).click();
  const vid = () => state.tables.steps.find((s) => s.id === 'vid-1').video;
  ok(
    await until(() => vid().captions.length === 2 && vid().captionsDefault === true),
    'Sous-titres appliqués',
  );
  await page.getByText('Sous-titres appliqués.').waitFor();
  // Deuxième demande : « Ne plus demander », puis remplacement confirmé
  await page.getByRole('button', { name: 'Transcription automatique' }).click();
  await ask.getByRole('checkbox', { name: 'Ne plus demander pour cette démo' }).check();
  await ask.getByRole('button', { name: 'Envoyer' }).click();
  await dlg.waitFor();
  await dlg.locator('input[aria-label*="Texte"]').first().fill('Ouvrez la fiche.');
  await dlg.getByRole('button', { name: 'Appliquer' }).click();
  const rep = page.getByRole('dialog', { name: 'Remplacer les sous-titres existants ?' });
  await rep.waitFor();
  ok(/Les 2 sous-titres actuels/.test(await rep.textContent()), 'Confirmation : sous-titres existants');
  await shot('l30-12-remplacer');
  await rep.getByRole('button', { name: 'Remplacer' }).click();
  ok(await until(() => vid().captions[0]?.text === 'Ouvrez la fiche.'), 'Sous-titres relus appliqués');
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
  ok(
    await until(() => vid().captions[0]?.text === 'Ouvrez la fiche du jeune.'),
    '« Annuler » rétablit les sous-titres',
  );
  const n1 = state.aiCalls.length;
  await page.getByRole('button', { name: 'Transcription automatique' }).click();
  await dlg.waitFor();
  ok(state.aiCalls.length === n1 + 1 && (await ask.count()) === 0, '« Ne plus demander » : envoi direct');
  await dlg.getByRole('button', { name: 'Ignorer' }).click();
  // Vidéo de plus de 2 min
  await railTo('Visite complète');
  const n2 = state.aiCalls.length;
  await page.getByRole('button', { name: 'Transcription automatique' }).click();
  await page
    .getByText(
      'Vidéo trop longue pour une transcription automatique (2 min au plus). Importez un fichier .vtt.',
    )
    .waitFor();
  ok(state.aiCalls.length === n2, 'Plus de 2 min : rien n’est envoyé');
  await shot('l30-12-trop-longue');

  // ===== L30-13 : quotas et fonction désactivée =====
  state = prepare({ ttsUsed: 298 });
  await open(state);
  await sec.getByRole('button', { name: 'Générer à partir du texte' }).click();
  await panel.getByText(/Il reste 2\ss ce mois-ci, la demande en demande environ \d+\ss\./).waitFor();
  ok(
    await panel.getByRole('button', { name: 'Générer la voix' }).isDisabled(),
    'Demande trop longue : bouton désactivé',
  );
  await shot('l30-13-reste-quota');

  state = prepare({ ttsUsed: 300, sttUsed: 300 });
  await open(state);
  await sec.getByRole('button', { name: 'Générer à partir du texte' }).click();
  await panel.getByRole('button', { name: 'Générer la voix' }).click();
  const alert = panel.getByRole('alert');
  ok(
    /^Quota de voix de synthèse atteint pour ce mois \(300\ss\)\. Il se renouvelle le 1\sdécembre\s2026\.$/.test(
      await alert.textContent(),
    ),
    'Quota de voix atteint, sans envoi',
  );
  ok(!(state.aiCalls || []).some((c) => c.task === 'voice'), 'Quota atteint : rien n’est envoyé');
  ok((await panel.getByRole('button', { name: 'Fermer' }).count()) === 1, 'Bouton « Fermer »');
  await shot('l30-13-quota-voix');
  await panel.getByRole('button', { name: 'Fermer' }).click();
  await sec.getByRole('button', { name: 'Transcrire la voix' }).click();
  ok(
    /^Quota de sous-titres automatiques atteint pour ce mois \(300\ss\)\./.test(
      await sec.locator('.ai-captions [role="alert"]').textContent(),
    ),
    'Quota de sous-titres atteint',
  );

  state = prepare({ features: { ...FEATURES, voice: false, captions: false } });
  await open(state);
  const entry = sec.getByRole('button', { name: 'Générer à partir du texte' });
  ok((await entry.getAttribute('aria-disabled')) === 'true', 'Voix désactivée : entrée estompée');
  ok(
    (await sec.locator('.ai-tip').first().textContent()) ===
      'Voix de synthèse désactivée dans cet espace. Un administrateur peut l’activer dans Paramètres > Assistance IA.',
    'Infobulle de la voix désactivée',
  );
  await entry.hover();
  await shot('l30-13-desactive');
  await railTo('Saisie de la fiche');
  ok(
    (await page.getByRole('button', { name: 'Transcription automatique' }).getAttribute('aria-disabled')) ===
      'true',
    'Sous-titres désactivés : entrée estompée',
  );

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
