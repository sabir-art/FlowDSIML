/**
 * L16 : modale « Diffuser » (états L16-01 à 09) et paquets SCORM. Données fictives (Mission Locale
 * Exemple, *.acme.example). Le paquet téléchargé est dézippé et chargé dans un faux LMS (API SCORM 1.2
 * puis 2004 simulées) : LMSInitialize / LMSSetValue / LMSFinish et Initialize / SetValue / Terminate
 * sont vérifiés, ainsi que l'absence d'appel à TutoClick sans l'option des statistiques.
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { unzipSync, strFromU8 } = require('fflate');
const { install, seed } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const { PUBLIC_PLAYER } = require('./fake-supabase.cjs');
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const LMS = 'http://lms.exemple.test';
const nb = (s) => (s || '').replace(/[  ]/g, ' ');

const QUIZ = {
  mode: 'quiz',
  threshold: 70,
  attempts: 3,
  feedback: 'each',
  shuffle: false,
  required: true,
  questions: [
    {
      id: 'q1',
      type: 'single',
      prompt: 'Où se trouve le bouton « + Ajouter » ?',
      answers: [
        { id: 'a1', label: 'En haut à droite de la liste', correct: true },
        { id: 'a2', label: 'Dans le menu Paramètres', correct: false },
      ],
      explanation: '',
      stepId: null,
      points: 1,
    },
  ],
};

function seedDistribute(s, { published = true } = {}) {
  seedExport(s, { steps: 3, published });
  const t = s.tables;
  t.diffusions = [];
  t.training_centers = [
    { workspace_id: t.workspaces[0].id, slug: 'ml-exemple', published_at: '2026-11-01T09:00:00Z' },
  ];
  t.demos[0].settings = { allowedEmbedOrigins: ['www.acme.example'] };
  if (!published) return s;
  const v = t.demo_versions.find((x) => x.id === t.demos[0].current_version_id);
  v.manifest.quiz = QUIZ;
  // Pas de modification après la publication (badge « Publiée »)
  t.demos[0].updated_at = v.published_at;
  const body = Buffer.from(JSON.stringify(v.manifest));
  s.storage[`published/${DEMO}/v3.json`] = { data: body, type: 'application/json' };
  s.storage[`published/${DEMO}/latest.json`] = { data: body, type: 'application/json' };
  s.embedViews = [
    {
      origin: 'https://intranet.acme.example',
      views: 57,
      last_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
  ];
  return s;
}

(async () => {
  // Test seulement : le lecteur de développement est sur localhost ; Chromium bloquerait qu'une page
  // « publique » (intranet fictif) charge popup.js depuis localhost (accès au réseau local).
  const b = await chromium.launch({
    args: [
      '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights',
    ],
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seedDistribute(seed());
  await install(page, state);
  const t = state.tables;
  const settle = () =>
    page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
  const closeToasts = async () => {
    for (const x of await page.locator('.toast .toast-close').all()) await x.click().catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.toast'));
  };
  const shot = async (name) => {
    if (!SHOTS) return;
    await closeToasts();
    await settle();
    await page.screenshot({ path: `${SHOTS}/l16-${name}${sfx}.png` });
  };
  const dlg = page.locator('dialog.dif-dialog[open]');
  const tab = (name) => dlg.getByRole('tab', { name });

  // ===== Accès : menu d'une démo du tableau de bord =====
  await page.goto(`${APP}/#/`);
  await page
    .getByRole('button', { name: /Actions.*Créer une fiche usager/ })
    .first()
    .click();
  const items = await page.getByRole('menuitem').allTextContents();
  const iShare = items.findIndex((x) => /Partager/.test(x));
  ok(
    /Diffuser/.test(items[iShare + 1] || ''),
    'Accès : « Diffuser » juste après « Partager » (tableau de bord)',
  );
  await page.getByRole('menuitem', { name: 'Diffuser' }).click();
  await dlg.waitFor();
  await dlg.locator('.dif-sub').waitFor();
  ok(
    nb(await dlg.locator('h2').first().textContent()) === 'Diffuser « Créer une fiche usager »',
    'Modale nommée par le titre',
  );
  ok(
    /Publiée/.test(await dlg.locator('.dif-sub').textContent()) &&
      /version 3, publiée le/.test(nb(await dlg.locator('.dif-sub').textContent())),
    'Sous-titre : badge et version',
  );
  ok((await tab('SCORM').getAttribute('aria-selected')) === 'true', 'Onglet SCORM par défaut');
  ok(
    await tab('SCORM').evaluate((el) => el === document.activeElement),
    'Focus sur l’onglet actif à l’ouverture',
  );

  // ===== L16-01 : réglages SCORM =====
  ok(
    (await dlg.getByRole('radio', { name: 'SCORM 1.2' }).getAttribute('aria-checked')) === 'true',
    'SCORM 1.2 par défaut',
  );
  ok(
    await dlg.getByRole('radio', { name: 'Toutes les étapes vues' }).isChecked(),
    'Critère « Toutes les étapes vues » par défaut',
  );
  ok(
    await dlg.getByLabel('Score minimum en pourcentage').isDisabled(),
    'Score minimum inactif hors critère quiz',
  );
  ok(
    (await dlg.locator('.dif-map tbody tr').count()) === 3 &&
      !/Score/.test(await dlg.locator('.dif-map').textContent()),
    'Tableau : pas de ligne Score (critère étapes)',
  );
  await dlg.getByRole('radio', { name: /Quiz réussi/ }).check();
  ok(
    (await dlg.locator('.dif-map tbody tr').count()) === 4 &&
      /70\s?%/.test(nb(await dlg.locator('.dif-map').textContent())),
    'Tableau : ligne Score et seuil (critère quiz)',
  );
  ok(
    /pour un contrôle certifiant, utilisez le lien en ligne/.test(await dlg.textContent()),
    'Mention : bonnes réponses incluses dans le paquet',
  );
  await dlg.getByRole('radio', { name: 'Toutes les étapes vues' }).check();
  const stats = dlg.getByRole('switch', { name: /Envoyer aussi les statistiques/ });
  ok(!(await stats.isChecked()), 'Statistiques TutoClick désactivées par défaut');
  ok(/données d’usage pseudonymisées/.test(await dlg.textContent()), 'Mention : données pseudonymisées');
  await shot('01-scorm');

  // ===== L16-02 : génération en cours (captures ralenties) =====
  let slow = true;
  await page.route('**/object/sign/published/**/assets/**', async (r) => {
    if (slow) await new Promise((res) => setTimeout(res, 700));
    return r.fallback();
  });
  await dlg.getByRole('button', { name: 'Générer le paquet' }).click();
  const status = dlg.locator('.dif-block[role="status"]');
  await status.locator('text=Captures 1 sur 3').waitFor();
  ok(true, 'En cours : avancement réel « Captures n sur 3 »');
  ok(
    (await dlg.getByRole('progressbar').getAttribute('aria-valuenow')) !== null,
    'En cours : progressbar avec aria-valuenow',
  );
  ok(
    await dlg.getByRole('radio', { name: 'Toutes les étapes vues' }).isDisabled(),
    'En cours : réglages verrouillés',
  );
  ok(
    (await dlg.getByRole('button', { name: 'Génération…' }).getAttribute('aria-disabled')) === 'true',
    'En cours : bouton « Génération… » inactif',
  );
  await shot('02-scorm-cours');

  // ===== L16-03 : prêt =====
  await dlg.locator('.dif-file').waitFor({ timeout: 15000 });
  slow = false;
  const fileText = nb(await dlg.locator('.dif-file').textContent());
  ok(
    /creer-une-fiche-usager-scorm12\.zip/.test(fileText) &&
      /SCORM 1\.2 · version 3 · réussite : toutes les étapes vues/.test(fileText),
    'Prêt : fichier, version, critère',
  );
  ok(/\d+ Ko|\d+(,\d)? Mo/.test(fileText), 'Prêt : poids réel');
  ok(/Paquet prêt\./.test(await dlg.locator('.alert-success').textContent()), 'Prêt : alerte de succès');
  await shot('03-scorm-pret');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByRole('button', { name: 'Télécharger' }).click(),
  ]);
  const p12 = { name: dl.suggestedFilename(), files: unzipSync(fs.readFileSync(await dl.path())) };
  ok(p12.name === 'creer-une-fiche-usager-scorm12.zip', 'Téléchargement : nom du fichier');
  const names = Object.keys(p12.files);
  ok(
    ['imsmanifest.xml', 'index.html', 'package.js', 'tutoclick.css', 'tutoclick.js'].every((f) =>
      names.includes(f),
    ) && names.filter((f) => f.startsWith('assets/')).length === 3,
    'Paquet : manifeste SCORM, lecteur, configuration et 3 captures',
  );
  const ims = strFromU8(p12.files['imsmanifest.xml']);
  ok(
    /<schemaversion>1\.2<\/schemaversion>/.test(ims) && !/masteryscore/.test(ims),
    'imsmanifest 1.2 sans seuil (critère étapes)',
  );
  ok(
    /"pass":\{"kind":"steps"\},"stats":null/.test(strFromU8(p12.files['package.js'])),
    'Paquet : critère étapes, aucun envoi à TutoClick',
  );
  ok(
    t.diffusions.some((d) => d.kind === 'scorm' && d.label === 'SCORM 1.2 · v3'),
    'Diffusion SCORM enregistrée',
  );
  // Changer un réglage invalide le fichier
  await dlg.getByRole('button', { name: 'Modifier les réglages' }).click();
  ok(
    (await dlg.locator('.dif-file').count()) === 0 &&
      (await dlg.getByRole('button', { name: 'Générer le paquet' }).count()) === 1,
    'Modifier les réglages : retour à « Générer le paquet »',
  );

  /** Faux LMS : page parente avec l'API SCORM, SCO servi depuis le paquet dézippé. */
  async function runInLms(files, version, studentId, waitStats = false) {
    const lms = await ctx.newPage();
    lms.on('pageerror', (e) => errors.push(`sco: ${e.message}`));
    const outside = [];
    lms.on('request', (r) => {
      if (!r.url().startsWith(LMS)) outside.push(r.url());
    });
    await lms.route(`${LMS}/**`, (r) => {
      const u = new URL(r.request().url());
      if (u.pathname === '/cours') {
        const api12 = `window.API={LMSInitialize:a=>(log('LMSInitialize'),'true'),LMSGetValue:k=>(log('get '+k),data[k]||''),LMSSetValue:(k,v)=>(log('set '+k+'='+v),data[k]=v,'true'),LMSCommit:()=>(log('LMSCommit'),'true'),LMSFinish:()=>(log('LMSFinish'),'true'),LMSGetLastError:()=>'0',LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};`;
        const api2004 = `window.API_1484_11={Initialize:a=>(log('Initialize'),'true'),GetValue:k=>(log('get '+k),data[k]||''),SetValue:(k,v)=>(log('set '+k+'='+v),data[k]=v,'true'),Commit:()=>(log('Commit'),'true'),Terminate:()=>(log('Terminate'),'true'),GetLastError:()=>'0',GetErrorString:()=>'',GetDiagnostic:()=>''};`;
        const init =
          version === '1.2'
            ? `{'cmi.core.lesson_status':'not attempted','cmi.core.student_id':'${studentId}','cmi.core.entry':'ab-initio'}`
            : `{'cmi.completion_status':'unknown','cmi.learner_id':'${studentId}','cmi.entry':'ab-initio'}`;
        return r.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>LMS fictif</title></head><body><h1>Cours</h1>
<script>window.calls=[];const log=c=>calls.push(c);window.data=${init};${version === '1.2' ? api12 : api2004}</script>
<iframe id="sco" src="/sco/index.html" title="Module" style="width:1100px;height:760px;border:0"></iframe></body></html>`,
        });
      }
      const f = files[u.pathname.replace(/^\/sco\//, '')];
      if (!f) return r.fulfill({ status: 404, body: 'absent' });
      const type = u.pathname.endsWith('.html')
        ? 'text/html'
        : u.pathname.endsWith('.js')
          ? 'text/javascript'
          : u.pathname.endsWith('.css')
            ? 'text/css'
            : 'image/png';
      return r.fulfill({ contentType: type, body: Buffer.from(f) });
    });
    await lms.goto(`${LMS}/cours`);
    const sco = lms.frameLocator('#sco');
    await sco.locator('.p-stage').waitFor();
    const next = sco.locator('.p-controls [aria-label="Étape suivante"]');
    const toQuiz = sco.getByRole('button', { name: 'Passer au quiz' });
    const quizCard = sco.locator('.p-quiz-card');
    // Étapes jusqu'au quiz (la dernière flèche « suivante » ouvre le quiz)
    for (let i = 0; i < 6 && !(await quizCard.isVisible()); i++) {
      if (await toQuiz.isVisible()) await toQuiz.click();
      else await next.click();
      await lms.waitForTimeout(250);
    }
    await sco.getByLabel('En haut à droite de la liste').check();
    await sco.getByRole('button', { name: 'Valider ma réponse' }).click();
    await sco.getByRole('button', { name: 'Voir mon résultat' }).click();
    await sco.locator('.p-quiz-result').waitFor();
    // Statistiques : envoi groupé 2 s après le dernier événement (l'envoi par balise au
    // déchargement n'est pas toujours intercepté par Playwright)
    if (waitStats) await lms.waitForTimeout(2600);
    // Fin de session : le LMS décharge le SCO
    await lms.evaluate(() => {
      document.getElementById('sco').src = 'about:blank';
    });
    await lms.waitForFunction(() => calls.includes('LMSFinish') || calls.includes('Terminate'));
    return { lms, calls: await lms.evaluate(() => calls), data: await lms.evaluate(() => data), outside };
  }

  const r12 = await runInLms(p12.files, '1.2', 'etu-0042');
  ok(r12.calls[0] === 'LMSInitialize', 'SCORM 1.2 : LMSInitialize en premier');
  ok(r12.calls.includes('set cmi.core.lesson_status=incomplete'), 'SCORM 1.2 : « incomplete » au démarrage');
  ok(r12.calls.includes('set cmi.core.lesson_location=2'), 'SCORM 1.2 : lesson_location suit les étapes');
  ok(r12.data['cmi.core.lesson_status'] === 'completed', 'SCORM 1.2, critère étapes : « completed »');
  ok(!r12.calls.some((c) => c.includes('score')), 'SCORM 1.2, critère étapes : quiz non transmis');
  ok(
    /^\d{2,4}:\d{2}:\d{2}\.\d{2}$/.test(r12.data['cmi.core.session_time'] || ''),
    'SCORM 1.2 : session_time HH:MM:SS.SS',
  );
  ok(r12.calls.at(-1) === 'LMSFinish', 'SCORM 1.2 : LMSFinish en dernier');
  ok(
    r12.outside.length === 0,
    `SCORM 1.2 : aucun appel hors du LMS${r12.outside.length ? ` (${r12.outside[0]})` : ''}`,
  );
  if (SHOTS) {
    await r12.lms.evaluate(() => (document.getElementById('sco').src = '/sco/index.html'));
    await r12.lms.frameLocator('#sco').locator('.p-stage').waitFor();
    await r12.lms.screenshot({ path: `${SHOTS}/l16-10-lms-sco${sfx}.png` });
  }
  await r12.lms.close();

  // SCORM 2004, critère quiz (80 %), option statistiques : génération en arrière-plan puis toast
  await dlg.getByRole('radio', { name: 'SCORM 2004' }).click();
  await dlg.getByRole('radio', { name: /Quiz réussi/ }).check();
  await dlg.getByLabel('Score minimum en pourcentage').fill('80');
  await stats.check();
  slow = true;
  await dlg.getByRole('button', { name: 'Générer le paquet' }).click();
  await status.waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.dif-dialog[open]'));
  ok(true, 'Échap ferme la modale pendant la génération');
  slow = false;
  const readyToast = page.locator('.toast', { hasText: 'Paquet SCORM prêt' });
  await readyToast.waitFor({ timeout: 15000 });
  ok(true, 'Génération continuée hors de la modale : toast « Paquet SCORM prêt »');
  const [dl2] = await Promise.all([
    page.waitForEvent('download'),
    readyToast.getByRole('button', { name: 'Télécharger' }).click(),
  ]);
  const p2004 = { name: dl2.suggestedFilename(), files: unzipSync(fs.readFileSync(await dl2.path())) };
  ok(p2004.name === 'creer-une-fiche-usager-scorm2004.zip', 'Toast : « Télécharger » le paquet 2004');
  ok(/2004 4th Edition/.test(strFromU8(p2004.files['imsmanifest.xml'])), 'imsmanifest 2004 4e édition');
  ok(
    /"pass":\{"kind":"quiz","min":80\},"stats":\{"trackUrl":"[^"]+\/functions\/v1\/track"\}/.test(
      strFromU8(p2004.files['package.js']),
    ),
    'Paquet 2004 : critère quiz 80 %, statistiques',
  );
  const tracked = [];
  await ctx.route('**/functions/v1/track', (r) => {
    tracked.push(r.request().postData() || '');
    return r.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } });
  });
  const r2004 = await runInLms(p2004.files, '2004', 'etu-0042', true);
  ok(
    r2004.calls[0] === 'Initialize' && r2004.calls.at(-1) === 'Terminate',
    'SCORM 2004 : Initialize puis Terminate',
  );
  ok(r2004.data['cmi.completion_status'] === 'completed', 'SCORM 2004 : completion_status « completed »');
  ok(
    r2004.data['cmi.success_status'] === 'passed' && r2004.data['cmi.score.scaled'] === '1',
    'SCORM 2004, critère quiz : passed et score.scaled',
  );
  ok(/^PT/.test(r2004.data['cmi.session_time'] || ''), 'SCORM 2004 : session_time ISO 8601');
  for (let i = 0; i < 50 && !tracked.length; i++) await page.waitForTimeout(100);
  ok(tracked.length > 0, 'Option statistiques : événements envoyés à TutoClick');
  ok(
    tracked.every((x) => !x.includes('etu-0042')) && /"visitorId":"[0-9a-f]{40}"/.test(tracked[0] || ''),
    'Option statistiques : identifiant LMS haché, jamais en clair',
  );
  await r2004.lms.close();
  await ctx.unroute('**/functions/v1/track');

  // ===== L16-04 : erreur (capture illisible à l'étape 2) =====
  await page.goto(`${APP}/#/demos/${DEMO}/distribute`);
  await dlg.waitFor();
  ok(/\/demos\/.*\/edit\?distribute=1/.test(page.url()), 'Adresse directe : modale au-dessus de l’éditeur');
  ok((await tab('SCORM').getAttribute('aria-selected')) === 'true', 'Onglet mémorisé (SCORM)');
  // Le paquet 2004 généré plus haut reste disponible à la réouverture : on revient aux réglages
  // Le paquet est restauré juste après l'ouverture : attendre plutôt que compter tout de suite
  ok(
    await dlg
      .locator('.dif-file')
      .waitFor({ timeout: 5000 })
      .then(async () => (await dlg.locator('.dif-file').count()) === 1)
      .catch(() => false),
    'Réouverture : le paquet prêt reste disponible',
  );
  await dlg.getByRole('button', { name: 'Modifier les réglages' }).click();
  await page.route('**/object/sign/published/**/assets/st-2.webp*', (r) =>
    r.fulfill({ status: 404, body: 'x' }),
  );
  await dlg.getByRole('button', { name: 'Générer le paquet' }).click();
  const err = dlg.locator('.alert-danger[role="alert"]');
  await err.waitFor();
  ok(
    /Le paquet n’a pas pu être généré\./.test(await err.textContent()) &&
      /étape 2 est illisible/.test(await err.textContent()),
    'Erreur : cause (capture de l’étape 2)',
  );
  ok(
    (await err.getByRole('button', { name: 'Ouvrir l’étape 2' }).count()) === 1,
    'Erreur : lien « Ouvrir l’étape 2 »',
  );
  ok(
    !(await dlg.getByRole('radio', { name: 'Toutes les étapes vues' }).isDisabled()),
    'Erreur : réglages modifiables',
  );
  await shot('04-scorm-erreur');
  await page.unroute('**/object/sign/published/**/assets/st-2.webp*');
  await dlg.locator('.modal-foot').getByRole('button', { name: 'Réessayer' }).click();
  await dlg.locator('.dif-file').waitFor({ timeout: 15000 });
  ok(true, 'Réessayer : paquet prêt');

  // ===== L16-05 : intranet, iframe =====
  await tab('Intranet').click();
  ok(
    (await dlg.getByRole('radio', { name: 'Dans la page (iframe)' }).getAttribute('aria-checked')) === 'true',
    'Intranet : iframe par défaut',
  );
  ok(
    await dlg.getByRole('switch', { name: /Démarrer au clic/ }).isChecked(),
    'Démarrer au clic activé par défaut',
  );
  await dlg.getByLabel(/Adresse de l’intranet/).fill('intranet.acme.example');
  const warn = dlg.locator('.alert-warning');
  await warn.waitFor();
  ok(
    (await warn.locator('b').textContent()) === 'intranet.acme.example' &&
      /n’est pas dans les sites autorisés/.test(await warn.textContent()),
    'Alerte : domaine non autorisé',
  );
  const code = () => dlg.locator('pre.dif-code').textContent();
  ok(
    /title="Démo : Créer une fiche usager"/.test(nb(await code())) &&
      /loading="lazy" allow="fullscreen"/.test(await code()) &&
      /aspect-ratio:16\/10/.test(await code()) &&
      /start=click/.test(await code()),
    'Code iframe : title, lazy, plein écran, 16:10, démarrage au clic',
  );
  ok(
    (await dlg.getByRole('img', { name: 'Aperçu sur une page d’intranet fictive' }).count()) === 1,
    'Aperçu : role=img nommé',
  );
  ok(
    /intranet\.acme\.example\/outils/.test(await dlg.locator('.dif-prev .bar').textContent()),
    'Aperçu : barre d’adresse avec le domaine',
  );
  await dlg.getByLabel('Taille', { exact: true }).selectOption('fixed');
  ok(
    (await dlg.getByLabel('Largeur (px)').count()) === 1 && /width:960px;height:600px/.test(await code()),
    'Taille fixe : largeur et hauteur',
  );
  await dlg.getByLabel('Taille', { exact: true }).selectOption('fluid');
  ok(
    (await dlg.locator('.dif-prev .emb').evaluate((el) => el.getBoundingClientRect().width)) >
      0.9 * (await dlg.locator('.dif-prev .pg').evaluate((el) => el.clientWidth - 28)),
    'Aperçu : « S’adapte à la largeur » remplit la largeur',
  );
  await dlg.getByLabel(/Adresse de l’intranet/).blur();
  await shot('05-intranet');
  // ===== L16-06 : bouton + pop-up =====
  await dlg.getByRole('radio', { name: 'Bouton + pop-up' }).click();
  ok(
    (await dlg.getByLabel('Texte du bouton').inputValue()) === 'Lancer le tutoriel',
    'Texte du bouton par défaut',
  );
  await dlg.getByLabel('Position').selectOption('float');
  await dlg.getByLabel('Langue de l’interface').selectOption('en');
  const popup = await code();
  ok(
    popup.includes(`data-tutoclick="${DEMO}"`) &&
      /data-tutoclick-float/.test(popup) &&
      /popup\.js" defer/.test(popup) &&
      /data-tutoclick-lang="en"/.test(popup),
    'Code pop-up : bouton data-tutoclick, flottant, popup.js',
  );
  ok((await dlg.locator('.alert-warning').count()) === 1, 'Pop-up : même alerte de site non autorisé');
  ok(!/\S="[^"\n]*\n/.test(popup), 'Code pop-up : coupé entre les attributs');
  await shot('06-intranet-popup');
  await warn.getByRole('button', { name: 'L’ajouter' }).click();
  await page.locator('.toast', { hasText: 'ajouté aux sites autorisés' }).waitFor();
  ok(
    t.demos[0].settings.allowedEmbedOrigins.includes('intranet.acme.example'),
    '« L’ajouter » : site autorisé ajouté',
  );
  await page.waitForFunction(() => !document.querySelector('dialog.dif-dialog .alert-warning'));
  ok(true, 'Alerte retirée après l’ajout');
  await dlg.getByRole('button', { name: 'Copier le code d’intégration' }).click();
  await page.locator('.toast', { hasText: 'Code copié' }).waitFor();
  ok(
    t.diffusions.some((d) => d.kind === 'intranet' && d.label === 'intranet.acme.example'),
    'Copie : intranet déclaré',
  );

  // popup.js réel sur une page d'intranet fictive : bouton, fenêtre modale, Échap depuis le lecteur
  const host = await ctx.newPage();
  host.on('pageerror', (e) => errors.push(`popup: ${e.message}`));
  await install(host, state);
  const hostCode = popup.replace('data-tutoclick-float', 'data-tutoclick-float data-tutoclick-start="click"');
  await host.route('http://intranet.acme.example/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Intranet</title></head><body><h1>Outils de l’équipe</h1>${hostCode}</body></html>`,
    }),
  );
  await host.goto('http://intranet.acme.example/outils');
  const pbtn = host.getByRole('button', { name: 'Lancer le tutoriel' });
  await host.waitForFunction(
    () => document.querySelector('[data-tutoclick]')?.getAttribute('aria-haspopup') === 'dialog',
  );
  ok(await pbtn.evaluate((el) => getComputedStyle(el).position === 'fixed'), 'popup.js : bouton flottant');
  await pbtn.click();
  const pdlg = host.locator('dialog.tcp-dlg[open]');
  await pdlg.waitFor();
  const src = await pdlg.locator('iframe').getAttribute('src');
  ok(
    src.startsWith(`${PUBLIC_PLAYER}/#/d/${DEMO}?`) && /start=click/.test(src) && /lang=en/.test(src),
    'popup.js : lecteur avec réglages',
  );
  const frame = host.frameLocator('dialog.tcp-dlg iframe');
  await frame.getByRole('button', { name: 'Launch the demo' }).click();
  await frame.locator('.p-stage').waitFor();
  ok(true, 'Lecteur : couverture « Launch the demo » puis démarrage');
  await host.keyboard.press('Escape');
  await host.waitForFunction(() => !document.querySelector('dialog.tcp-dlg[open]'));
  ok(
    await pbtn.evaluate((el) => el === document.activeElement),
    'popup.js : Échap (focus dans le lecteur) ferme, focus rendu au bouton',
  );
  await host.close();

  // ===== L16-07 : e-mail =====
  await tab('E-mail').click();
  ok(
    nb(await dlg.getByLabel('Objet').inputValue()) === 'Tutoriel : Créer une fiche usager',
    'Objet prérempli',
  );
  const body = await dlg.getByLabel('Message').inputValue();
  ok(
    body.includes(`#/d/${DEMO}`) && !/minute|question/.test(body),
    'Message : lien direct, ni durée ni nombre de questions',
  );
  ok(
    /\d+ \/ 1 500 caractères/.test(nb(await dlg.locator('.dif-count').textContent())),
    'Compteur « n / 1 500 caractères »',
  );
  const to = dlg.getByLabel(/Destinataires/);
  await to.fill('camille@acme.example, pas-une-adresse');
  await dlg.getByLabel('Objet').focus();
  ok(
    (await to.getAttribute('aria-invalid')) === 'true' &&
      /Adresse invalide : pas-une-adresse/.test(nb(await dlg.textContent())),
    'Adresse invalide signalée à la sortie du champ',
  );
  await to.fill('camille@acme.example');
  await to.blur();
  const mailto = await dlg.getByRole('link', { name: 'Ouvrir dans ma messagerie' }).getAttribute('href');
  ok(
    mailto.startsWith('mailto:camille%40acme.example?subject=Tutoriel') &&
      mailto.includes(encodeURIComponent(`#/d/${DEMO}`)),
    'Lien mailto encodé',
  );
  await shot('07-mail');
  await dlg.getByLabel('Message').fill('x'.repeat(1501));
  ok(
    (await dlg.getByRole('link', { name: 'Ouvrir dans ma messagerie' }).getAttribute('aria-disabled')) ===
      'true' && /Message trop long/.test(await dlg.textContent()),
    'Au-delà de 1 500 caractères : mailto désactivé',
  );
  await dlg.getByRole('button', { name: 'Copier le texte' }).click();
  await page.locator('.toast', { hasText: 'Texte copié' }).waitFor();
  ok(true, '« Copier le texte » reste disponible');

  // ===== L16-08 : où elle est diffusée (nouvelle version publiée) =====
  t.demos[0].current_version_id = 'v-nouvelle';
  // L16-08 : la version 4 a sa propre date (l'en-tête affiche celle de la version courante)
  t.demo_versions.push({
    ...t.demo_versions[0],
    id: 'v-nouvelle',
    number: 4,
    published_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  });
  // Vues réelles du lien direct (événements demo_view hors intégration)
  t.events = t.events || [];
  for (let i = 0; i < 23; i++)
    t.events.push({
      id: `ev-direct-${i}`,
      demo_id: DEMO,
      workspace_id: t.workspaces[0].id,
      type: 'demo_view',
      embed_origin: null,
      occurred_at: new Date(Date.now() - i * 3600000).toISOString(),
    });
  t.demos[0].updated_at = t.demo_versions.find((x) => x.id === 'v-nouvelle').published_at;
  await page.goto(`${APP}/#/`);
  await page.goto(`${APP}/#/demos/${DEMO}/distribute`);
  await dlg.waitFor();
  await tab(/Où elle est diffusée/).click();
  await dlg.locator('.dif-list li').first().waitFor();
  const where = nb(await dlg.locator('.dif-list').textContent());
  ok(
    /Lien direct/.test(where) && /Formation « Nouvel outil de gestion »/.test(where),
    'Où : lien direct et centre de formation',
  );
  ok(/23 vues/.test(where) && /57 vues/.test(where), 'Où : vues réelles du lien direct');
  ok(
    /version 4, publiée le/.test(nb(await dlg.locator('.dif-sub').textContent())) &&
      !/10 nov/.test(await dlg.locator('.dif-sub').textContent()),
    'En-tête : date de la version courante',
  );
  ok(
    /intranet\.acme\.example · 57 vues · vue pour la dernière fois/.test(where),
    'Où : intranet, vues réelles',
  );
  const lmsRow = dlg.locator('.dif-list li', { hasText: 'LMS · SCORM 1.2' });
  ok(
    (await lmsRow.locator('.fd-status').textContent()) === 'Version ancienne',
    'Où : paquet « Version ancienne »',
  );
  ok(!/vue/.test(await lmsRow.textContent()), 'Où : aucune vue inventée pour un paquet SCORM');
  ok(
    String(
      await tab(/Où elle est diffusée/)
        .locator('.tab-count')
        .textContent(),
    ) === String(await dlg.locator('.dif-list li').count()),
    'Compteur de l’onglet = nombre de lignes',
  );
  await shot('08-diffusions');
  await lmsRow.getByRole('button', { name: 'Générer la version 4' }).click();
  ok(
    (await tab('SCORM').getAttribute('aria-selected')) === 'true' &&
      (await dlg.getByRole('radio', { name: 'SCORM 1.2' }).getAttribute('aria-checked')) === 'true',
    '« Générer la version 4 » : onglet SCORM, mêmes réglages',
  );

  // ===== L16-09 : démo non publiée =====
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  const s2 = seedDistribute(seed(), { published: false });
  await install(p2, s2);
  await p2.goto(`${APP}/#/demos/${DEMO}/distribute`);
  const d2 = p2.locator('dialog.dif-dialog[open]');
  await d2.locator('.dif-empty').waitFor();
  ok(
    /Brouillon/.test(await d2.locator('.dif-sub').textContent()) &&
      /jamais publiée/.test(await d2.locator('.dif-sub').textContent()),
    'Non publiée : sous-titre « Brouillon · jamais publiée »',
  );
  ok(
    (await d2.getByRole('tab', { name: 'SCORM' }).getAttribute('aria-disabled')) === 'true' &&
      (await d2.getByRole('tab', { name: 'E-mail' }).getAttribute('aria-disabled')) === 'true',
    'Non publiée : onglets en aria-disabled',
  );
  ok(
    /Publiez la démo pour la diffuser/.test(await d2.textContent()) &&
      (await d2.getByRole('link', { name: 'Ouvrir dans l’éditeur' }).count()) === 1,
    'Non publiée : état vide et « Ouvrir dans l’éditeur »',
  );
  if (SHOTS) {
    await p2.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    await p2.screenshot({ path: `${SHOTS}/l16-09-non-publiee${sfx}.png` });
  }
  await p2.close();

  // ===== Droits : un lecteur ne voit pas l'entrée =====
  t.members[0].role = 'viewer';
  await page.goto(`${APP}/#/`);
  await page.reload();
  await page
    .getByRole('button', { name: /Actions.*Créer une fiche usager/ })
    .first()
    .click();
  ok(
    (await page.getByRole('menuitem', { name: 'Diffuser' }).count()) === 0,
    'Lecteur : pas d’entrée « Diffuser »',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
