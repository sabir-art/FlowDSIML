/**
 * Test e2e L30b (065 / 066) : voix de synthèse (panneau Voix off) et sous-titres automatiques (étape
 * vidéo, voix enregistrée), ElevenLabs simulé. Texte modifiable, 6 voix avec extrait, vitesse, aperçu,
 * confirmation avant de remplacer, toast «\u202fAnnuler\u202f» ; modale avant chaque envoi d'audio ; limite de
 * 2 min ; quotas (L30-13) et fonction désactivée. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/voix-sous-titres-ia.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
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
    panel = sec.locator('#vo-panel');
    ask = page.getByRole('dialog', { name: 'Envoyer l’audio pour transcription ?' });
    dlg = page.locator('dialog.vd-dialog');
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/edit`);
    await page.locator('[data-step-index="0"]').click();
    await openTool(page, 'voice');
    await page.locator('.voice-sec').waitFor();
  };
  const railTo = async (title) => {
    await page.locator('.rail-li', { hasText: title }).locator('[data-step-index]').click();
    await page.locator('.vd-stage video').waitFor();
  };

  // ===== L30-10 : voix de synthèse =====
  let state = prepare();
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('fd.ai.sttNoAsk.0b5c1f0e-0000-4000-8000-000000000001');
    } catch {
      /* */
    }
  });
  await open(state);
  const s1 = () => state.tables.steps.find((s) => s.demo_id === DEMO && s.position === 0);
  // EXT-02 §6.4 : «\u202fGénérer\u202f» dans le panneau, sans fenêtre à part
  const toGenerate = async () => {
    await sec.getByRole('button', { name: 'Remplacer…' }).click();
    await sec.getByRole('tab', { name: 'Générer' }).click();
  };
  // L62 §8 : sélecteur de voix (déclencheur, fenêtre de 400 px, liste des voix du compte)
  const voices = async () => {
    if ((await panel.locator('.vp-pop').count()) === 0) await panel.locator('.vp-trigger').click();
    const list = panel.getByRole('listbox');
    await list.waitFor();
    const names = await list.locator('.vp-nm').allTextContents();
    return { list, names };
  };
  await toGenerate();
  const txt = panel.getByLabel(/^Texte lu/);
  ok(
    (await txt.inputValue()) === 'Bienvenue chez {{company}}. Ouvrez la fiche du jeune.',
    'Texte lu prérempli avec la transcription',
  );
  ok(
    (await panel.getByText('(sert aussi de transcription)').count()) === 1,
    'Le texte lu sert aussi de transcription',
  );
  ok(
    /Les variables sont lues avec leur valeur par défaut \(\{\{company\}\} → «\u202fvotre entreprise\u202f»\)/.test(
      await panel.textContent(),
    ),
    'Aide : variables lues avec leur valeur par défaut',
  );
  ok(/53\scaractères · environ\s\d+\ss/.test(await panel.textContent()), 'Compteur et durée estimée');
  ok(
    (await panel.getByText('Langue de la démo : français.').count()) === 1,
    'Langue de la démo rappelée sous la voix',
  );
  ok((await panel.getByRole('radio').count()) === 0, 'Ni liste de voix à cocher, ni vitesse');
  ok(
    (await panel
      .getByText('Le texte est envoyé à notre service de synthèse vocale (ElevenLabs) pour créer la voix.')
      .count()) === 1,
    'Avertissement au-dessus du bouton',
  );
  ok(
    (state.aiCalls || []).every((c) => c.task === 'voice_list'),
    'Rien n’est envoyé à l’ouverture (liste des voix seulement)',
  );
  const v0 = await voices();
  const pop = panel.locator('.vp-pop');
  ok(
    (await pop.evaluate((e) => Math.round(e.getBoundingClientRect().width))) === 400 &&
      (await page.evaluate(() => document.activeElement?.getAttribute('type'))) === 'search',
    'Sélecteur : fenêtre de 400 px, recherche avec le focus',
  );
  const secs = (await pop.locator('.vp-sec').allTextContents()).map((x) => x.replace(/\s+/g, ' ').trim());
  ok(
    secs[0] === 'Recommandées pour le français 4' && secs[1] === 'Toutes les voix 5' && v0.names.length === 5,
    `Sélecteur : langue de la démo par défaut, « Recommandées pour le français » puis « Toutes les voix » (${secs.join(' | ')})`,
  );
  ok(
    /^Camille/.test(v0.names[0]) && !v0.names.some((n) => /Claire/.test(n)),
    'Sélecteur : noms réels des voix du compte, aucun emplacement fixe',
  );
  // Lignes de 56 px, sans colonne de coche : avatars alignés, pastille sur l'avatar de la voix choisie
  const rows = pop.locator('[role="option"]');
  const geo = await rows.evaluateAll((l) =>
    l.map((r) => ({
      h: Math.round(r.getBoundingClientRect().height),
      left: Math.round(
        r.querySelector('.vp-av').getBoundingClientRect().left - r.getBoundingClientRect().left,
      ),
      sel: r.getAttribute('aria-selected'),
      check: !!r.querySelector('.vp-av-check'),
      first: r.firstElementChild.className,
    })),
  );
  ok(
    geo.every((g) => g.h === 56 && g.left === geo[0].left && g.first === 'vp-av') &&
      geo.filter((g) => g.sel === 'true').length === 1 &&
      geo.find((g) => g.sel === 'true').check,
    'CHOIX-01 : lignes de 56 px, avatar en tête, voix choisie marquée sur l’avatar et aria-selected',
  );
  await shot('l62-selecteur-voix');
  // Recherche sans tenir compte des accents, filtre Genre, état vide
  const search = pop.getByRole('searchbox');
  await search.fill('elodie');
  ok(
    (await pop.locator('.vp-nm').allTextContents()).join() === 'Élodie' &&
      /Résultats\s1/.test(await pop.locator('.vp-sec').first().textContent()),
    'Recherche « elodie » : « Élodie » trouvée, section « Résultats »',
  );
  await search.fill('');
  await pop.getByRole('button', { name: /^Genre/ }).click();
  await pop.getByRole('menuitemradio', { name: 'Masculine' }).click();
  ok(
    (await pop.locator('.vp-nm').allTextContents()).join() === 'Antoine,Hugo,George',
    'Filtre Genre « Masculine », langue de la démo : Antoine, Hugo et George',
  );
  await search.fill('zzz');
  await pop.getByText('Aucune voix pour «\u202fzzz\u202f»').waitFor();
  await pop.getByRole('button', { name: 'Effacer les filtres' }).click();
  ok(
    (await pop.locator('.vp-nm').count()) === 5,
    'État vide : « Effacer les filtres » rend les voix de la langue de la démo',
  );
  // Écouter : bouton rond de 32 px, exemple dans la langue de la démo, sans quota, ne choisit pas la voix
  const used0 = state.ai.used;
  const listen = pop.getByRole('button', { name: 'Écouter Antoine' });
  const lb = await listen.evaluate((e) => ({
    w: Math.round(e.getBoundingClientRect().width),
    r: getComputedStyle(e).borderRadius,
  }));
  ok(lb.w === 32 && lb.r === '50%', `Écouter : bouton rond de 32 px (${lb.w} px, ${lb.r})`);
  await listen.click();
  await until(() => (state.aiCalls || []).some((c) => c.task === 'voice_sample'));
  const sample = state.aiCalls.filter((c) => c.task === 'voice_sample').at(-1);
  ok(
    sample.input.voice === 'voixFrM0000001' && sample.lang === 'fr' && !('text' in sample.input),
    'Exemple de la voix écoutée, en français, sans texte de la démo',
  );
  ok(state.ai.used === used0, 'L’exemple ne consomme pas de quota');
  ok(
    (await pop.locator('[aria-selected="true"] .vp-nm').textContent()) === 'Camille',
    'Écouter n’est jamais l’action de choix',
  );
  // Clavier : recherche, Entrée choisit la voix active, la fenêtre se ferme
  await search.fill('antoine');
  await search.press('Enter');
  await pop.waitFor({ state: 'detached' });
  ok(
    /Antoine/.test(await panel.locator('.vp-trigger').textContent()),
    'Clavier : Entrée choisit la voix, la fenêtre se ferme',
  );
  await shot('l30-10-voix-panneau');
  // L62 : le service de voix refuse. La cause est dite (clé, crédits, voix), pas « Réessayez »
  // Une voix différente à chaque cas : un exemple déjà écouté est gardé en cache, sans nouvel appel
  const pas = ['George', 'Élodie', 'Hugo', 'Camille'];
  const ecouter = async () => {
    await voices();
    await panel.getByRole('button', { name: `Écouter ${pas.shift()}` }).click();
  };
  for (const [code, text] of [
    ['PROVIDER_KEY', 'Le service de voix refuse la clé de l’espace. Prévenez un administrateur.'],
    ['PROVIDER_QUOTA', 'Les crédits du service de voix sont épuisés. Prévenez un administrateur.'],
    ['PROVIDER_VOICE', 'Cette voix n’est pas disponible sur le service de voix.'],
    // Refus 402 du fournisseur (offre gratuite, voix réservée à une offre payante)
    ['PROVIDER_PLAN', 'L’offre du compte du service de voix ne permet pas cette demande.'],
  ]) {
    state.aiProvider = code;
    await ecouter();
    await panel.getByText(text, { exact: false }).first().waitFor();
    const sampleSaid = await panel.getByText(text, { exact: false }).count();
    await page.keyboard.press('Escape');
    await panel.getByRole('button', { name: /Générer la voix|Réessayer/ }).click();
    await page.waitForFunction(
      (t) =>
        [...document.querySelectorAll('[role="alert"], .error-msg, .ai-error')].some((e) =>
          e.textContent.includes(t),
        ),
      text,
    );
    ok(
      sampleSaid >= 1 && (await panel.getByText('La proposition n’a pas pu être générée').count()) === 0,
      `service de voix en refus (${code}) : la cause est dite pour l’exemple et pour la génération`,
    );
  }
  state.aiProvider = null;
  await panel.getByRole('button', { name: /Générer la voix|Réessayer/ }).click();
  await panel.getByRole('button', { name: 'Utiliser' }).waitFor();
  const call = state.aiCalls.at(-1);
  ok(
    call.task === 'voice' &&
      call.input.voice === 'voixFrM0000001' &&
      call.input.speed === 'normal' &&
      call.input.text === 'Bienvenue chez votre entreprise. Ouvrez la fiche du jeune.',
    'Demande : texte avec les valeurs par défaut et voix choisie',
  );
  ok(
    (await panel.getByText('Aperçu', { exact: true }).count()) === 1 &&
      (await panel.getByRole('button', { name: 'Écouter', exact: true }).count()) === 1,
    'Aperçu à écouter',
  );
  ok(/0:00 \/ 0:04/.test(await panel.locator('.vo-time').textContent()), 'Durée réelle');
  ok((await panel.locator('audio[controls]').count()) === 0, 'Pas de lecteur natif');
  const two = await panel.locator('.vo-two button').allTextContents();
  ok(two.join('|') === 'Régénérer|Utiliser', '«\u202fRégénérer\u202f» et «\u202fUtiliser\u202f» côte à côte');
  ok(/b1\.webm$/.test(s1().voice_path), 'Rien n’est appliqué avant «\u202fUtiliser\u202f»');
  await shot('l30-10-voix-apercu');
  // Accessibilité et espacements du panneau «\u202fGénérer\u202f» (aperçu affiché)
  const axe = await new AxeBuilder({ page })
    .include('.voice-sec')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  ok(
    axe.violations.length === 0,
    `Panneau «\u202fGénérer\u202f» : aucune violation axe (${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ') + ' ' + n.failureSummary).join('; ')}`).join(', ')})`,
  );
  const tight = await page.evaluate(() => {
    const out = [];
    for (const box of document.querySelectorAll('#vo-panel, #vo-panel .vo-two, #vo-panel .vo-voice')) {
      const kids = [...box.children].filter((c) => c.getClientRects().length && !c.matches('.sr-only'));
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1].getBoundingClientRect();
        const b = kids[i].getBoundingClientRect();
        const gap = Math.max(b.top - a.bottom, b.left - a.right);
        if (gap < 8) out.push(`${kids[i].className} ${Math.round(gap)}`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth) out.push('défilement horizontal');
    return out;
  });
  ok(
    tight.length === 0,
    `Panneau «\u202fGénérer\u202f» : 8 px au moins entre les blocs (${tight.join(' ; ')})`,
  );
  await panel.getByRole('button', { name: 'Utiliser' }).click();
  const confirm = page.getByRole('dialog', {
    name: 'Remplacer votre enregistrement par la voix de synthèse ?',
  });
  await confirm.waitFor();
  ok(true, 'Confirmation avant de remplacer la voix enregistrée');
  await shot('l30-10-voix-remplacer');
  await confirm.getByRole('button', { name: 'Remplacer' }).click();
  ok(await until(() => /a1\.mp3$/.test(s1().voice_path || '')), 'Voix de synthèse appliquée');
  ok(
    s1().voice_duration_ms === 4200 &&
      s1().voice_transcript === 'Bienvenue chez votre entreprise. Ouvrez la fiche du jeune.' &&
      s1().options?.aiVoice === true,
    'Transcription = texte lu, repère IA',
  );
  const demo = () => state.tables.demos.find((d) => d.id === DEMO);
  ok(await until(() => demo().settings?.aiVoice === 'voixFrM0000001'), 'Voix mémorisée pour la démo');
  await page.getByText('Voix appliquée.').waitFor();
  ok(
    (await page.locator('.rail-li .rail-ai[aria-label="Voix off générée par l’IA"]').count()) === 1,
    'Liste des étapes : icône voix avec repère «\u202fIA\u202f»',
  );
  await shot('l30-10-voix-appliquee', true);
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
  ok(
    await until(() => /b1\.webm$/.test(s1().voice_path || '') && !s1().options?.aiVoice),
    '«\u202fAnnuler\u202f» rétablit l’enregistrement',
  );

  // ===== L30-11 : transcription de la voix enregistrée =====
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
  await shot('l30-11-envoi-audio');
  const n0 = state.aiCalls.length;
  await ask.getByRole('button', { name: 'Annuler' }).click();
  ok(state.aiCalls.length === n0, '«\u202fAnnuler\u202f» : rien n’est envoyé');
  await sec.getByRole('button', { name: 'Transcrire la voix' }).click();
  await ask.getByRole('button', { name: 'Envoyer' }).click();
  const tr = sec.getByRole('group', { name: 'Proposition' });
  await tr.waitFor();
  ok(
    state.aiCalls.at(-1).task === 'captions' && state.aiCalls.at(-1).input.source === 'voice',
    'Demande : voix off de l’étape',
  );
  ok(/Langue détectée\s: Français/.test(await tr.textContent()), 'Langue détectée');
  await shot('l30-11-transcription-voix');
  await tr.getByRole('button', { name: 'Appliquer' }).click();
  ok(
    await until(() => s1().voice_transcript === 'Ouvrez la fiche du jeune. Renseignez la date d’entrée.'),
    'Transcription remplacée par le texte entendu',
  );

  // ===== L30-11 : sous-titres d'une vidéo =====
  await railTo('Saisie de la fiche');
  // L48-E : les sous-titres de la vidéo sont dans l'outil «\u202fÉtape\u202f»
  await openTool(page, 'step');
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
  await shot('l30-11-sous-titres-apercu');
  await dlg.getByRole('button', { name: 'Appliquer' }).click();
  const vid = () => state.tables.steps.find((s) => s.id === 'vid-1').video;
  ok(
    await until(() => vid().captions.length === 2 && vid().captionsDefault === true),
    'Sous-titres appliqués',
  );
  await page.getByText('Sous-titres appliqués.').waitFor();
  // Deuxième demande : «\u202fNe plus demander\u202f», puis remplacement confirmé
  await page.getByRole('button', { name: 'Transcription automatique' }).click();
  await ask.getByRole('checkbox', { name: 'Ne plus demander pour cette démo' }).check();
  await ask.getByRole('button', { name: 'Envoyer' }).click();
  await dlg.waitFor();
  await dlg.locator('input[aria-label*="Texte"]').first().fill('Ouvrez la fiche.');
  await dlg.getByRole('button', { name: 'Appliquer' }).click();
  const rep = page.getByRole('dialog', { name: 'Remplacer les sous-titres existants ?' });
  await rep.waitFor();
  ok(/Les 2 sous-titres actuels/.test(await rep.textContent()), 'Confirmation : sous-titres existants');
  await shot('l30-11-remplacer');
  await rep.getByRole('button', { name: 'Remplacer' }).click();
  ok(await until(() => vid().captions[0]?.text === 'Ouvrez la fiche.'), 'Sous-titres relus appliqués');
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
  ok(
    await until(() => vid().captions[0]?.text === 'Ouvrez la fiche du jeune.'),
    '«\u202fAnnuler\u202f» rétablit les sous-titres',
  );
  const n1 = state.aiCalls.length;
  await page.getByRole('button', { name: 'Transcription automatique' }).click();
  await dlg.waitFor();
  ok(
    state.aiCalls.length === n1 + 1 && (await ask.count()) === 0,
    '«\u202fNe plus demander\u202f» : envoi direct',
  );
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
  await shot('l30-11-trop-longue');

  // ===== L30-13 : quotas et fonction désactivée =====
  state = prepare({ ttsUsed: 298 });
  // Liste du compte illisible (droit manquant) : repli silencieux sur les voix proposées
  state.aiVoiceList = [];
  await open(state);
  await toGenerate();
  ok(
    await until(async () => {
      const v = await voices();
      await page.keyboard.press('Escape');
      return v.names.length === 6 && /^Claire/.test(v.names[0]);
    }),
    'Liste des voix du compte illisible : repli sur les voix proposées, sans blocage',
  );
  await panel.getByText(/Il reste 2\ss ce mois-ci, la demande en demande environ \d+\ss\./).waitFor();
  ok(
    await panel.getByRole('button', { name: 'Générer la voix' }).isDisabled(),
    'Demande trop longue : bouton désactivé',
  );
  await shot('l30-13-reste-quota');

  state = prepare({ ttsUsed: 300, sttUsed: 300 });
  await open(state);
  await toGenerate();
  const alert = panel.getByRole('alert');
  await alert.waitFor();
  ok(
    /^Quota de voix de synthèse atteint pour ce mois \(300\ss\)\. Il se renouvelle le 1\sdécembre\s2026\.$/.test(
      await alert.textContent(),
    ),
    'Quota de voix atteint : message et date de remise à zéro, dans le panneau',
  );
  ok(
    await panel.getByRole('button', { name: 'Générer la voix' }).isDisabled(),
    'Quota atteint : bouton désactivé',
  );
  ok(!(state.aiCalls || []).some((c) => c.task === 'voice'), 'Quota atteint : rien n’est envoyé');
  await shot('l30-13-quota-voix');
  await sec.getByRole('button', { name: 'Garder la voix actuelle' }).click();
  await sec.getByRole('button', { name: 'Transcrire la voix' }).click();
  ok(
    /^Quota de sous-titres automatiques atteint pour ce mois \(300\ss\)\./.test(
      await sec.locator('.ai-captions [role="alert"]').textContent(),
    ),
    'Quota de sous-titres atteint',
  );

  state = prepare({ features: { ...FEATURES, voice: false, captions: false } });
  await open(state);
  await sec.getByRole('button', { name: 'Remplacer…' }).click();
  const entry = sec.getByRole('tab', { name: 'Générer' });
  ok(
    (await entry.getAttribute('aria-disabled')) === 'true',
    'Voix désactivée : onglet «\u202fGénérer\u202f» grisé',
  );
  ok(
    (await sec.locator('#vo-gen-off').textContent()) === 'Générer : désactivé par l’espace.',
    'Raison affichée sous les onglets',
  );
  await shot('l30-13-desactive');
  await railTo('Saisie de la fiche');
  await openTool(page, 'step');
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
