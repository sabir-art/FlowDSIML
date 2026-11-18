/** L14 : centre de formation public (lecteur) et réglages (app). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { centerFixture, seedCenterTables } = require('./center-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const F = (id) => `00000000-0000-4000-8000-0000000000${id}`;

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  async function center(hash, opts = {}, body = null, viewport = { width: 1440, height: 900 }) {
    const p = await b.newPage({ viewport, locale: 'fr-FR' });
    p.on('pageerror', (e) => errors.push(e.message));
    const calls = [];
    await p.route('**/functions/v1/open-center', (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      const req = JSON.parse(r.request().postData() || '{}');
      calls.push(req);
      const res = typeof body === 'function' ? body(req) : (body ?? centerFixture(opts));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify(res), headers: cors });
    });
    await p.goto(`${PLAYER}/#/c/ml-exemple${hash}`);
    await p.waitForTimeout(900);
    return { p, calls };
  }

  // L14-01 : visiteur identifié par son lien personnel
  {
    const { p, calls } = await center('?l=jeton-alex-0001');
    ok(
      calls[0]?.linkToken === 'jeton-alex-0001' && typeof calls[0]?.visitorId === 'string',
      'L14-01 : jeton du lien et visiteur transmis à open-center',
    );
    ok(!p.url().includes('jeton-alex'), 'L14-01 : le jeton ne reste pas dans l’adresse');
    ok(
      (await p.locator('h1').textContent()) === 'Se former aux outils de la Mission Locale',
      'L14-01 : titre réglé par l’admin',
    );
    const me = p.getByRole('complementary', { name: 'Ma progression' });
    ok(
      (await me.textContent()).includes('Nouvel outil de gestion') &&
        (await me.textContent()).includes('1 / 4'),
      'L14-01 : carte « Ma formation en cours »',
    );
    ok(
      (await me.getByRole('link').getAttribute('href')) === `#/d/${F('a2')}`,
      'L14-01 : reprise sur le module en cours',
    );
    ok((await p.locator('.fc').count()) === 4, 'L14-01 : une carte par formation');
    ok(
      (await p.locator('.fc').first().locator('a, button').count()) === 0,
      'L14-01 : un seul lien par carte, sans bouton',
    );
    ok(
      (await p.locator('.fc').first().textContent()).includes('Étape 4 sur 7'),
      'L14-01 : module en cours avec l’étape',
    );
    ok(
      (await p.locator('.fc').first().textContent()).includes('Après le module 2'),
      'L14-01 : module verrouillé (ordre imposé)',
    );
    ok(
      (await p.locator('.fc', { hasText: 'Statistiques' }).locator('.hb.key').count()) === 1,
      'L14-01 : badge « Mot de passe »',
    );
    ok(
      (await p.locator('.fc', { hasText: 'Accueil' }).textContent()).includes('Expiré'),
      'L14-01 : badge « Expiré »',
    );
    ok(!/\d+\s*min\b/.test(await p.locator('.ctr-grid').textContent()), 'L14-01 : aucune durée inventée');
    ok(
      (await p.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow',
      'L14 : noindex par défaut',
    );
    // L14-03 : étiquette + recherche, gardées dans l'adresse
    await p.getByRole('button', { name: /Bureautique/ }).click();
    await p.getByRole('searchbox', { name: /Rechercher une formation/ }).fill('agenda');
    await p.waitForTimeout(500);
    ok(
      p.url().includes('tag=Bureautique') && p.url().includes('q=agenda'),
      'L14-03 : filtres gardés dans l’adresse',
    );
    ok(
      (await p.locator('.fc').count()) === 1 && (await p.locator('.fc mark').count()) >= 1,
      'L14-03 : une formation, terme surligné',
    );
    ok(
      (await p.getByRole('status').first().textContent()).includes('1 formation'),
      'L14-03 : ligne de résultat',
    );
    ok(
      (await p.getByRole('button', { name: /Bureautique/ }).getAttribute('aria-pressed')) === 'true',
      'L14-03 : étiquette active (aria-pressed)',
    );
    // L14-04 : sans résultat
    await p.getByRole('searchbox', { name: /Rechercher une formation/ }).fill('badge d’accès');
    await p.waitForTimeout(500);
    ok(
      (await p.locator('.ctr-empty h2').textContent()).includes('Aucune formation pour'),
      'L14-04 : aucun résultat',
    );
    await p.locator('.ctr-empty').getByRole('button', { name: 'Effacer la recherche' }).click();
    await p.waitForTimeout(300);
    ok((await p.locator('.fc').count()) === 1, 'L14-04 : la recherche est effacée, l’étiquette reste');
    // Page d'une formation (navigation interne, sans rechargement)
    await p.getByRole('button', { name: /^Toutes/ }).click();
    await p.locator('.fc', { hasText: 'Statistiques' }).click();
    await p.waitForTimeout(300);
    ok(
      (await p.locator('h1').textContent()) === 'Statistiques d’activité' && calls.length === 1,
      'L14-05 : page de la formation sans nouvel appel',
    );
    ok(
      (await p.locator('.fp-list li', { hasText: 'Rapport' }).textContent()).includes(
        'Protégé par mot de passe',
      ),
      'L14-05 : module protégé signalé',
    );
    ok(
      (await p.locator('.fp-list li', { hasText: 'Rapport' }).getByRole('link').getAttribute('href')) ===
        `#/d/${F('c3')}`,
      'L14-05 : « Commencer » ouvre le lecteur (écran mot de passe L11)',
    );
    await p.close();
  }

  // L14-05 (maquette 3f8cd20) : module expiré daté, score d'un module validé, expiré hors progression
  {
    const { centerFixture: cf } = require('./center-data.cjs');
    const { p } = await center(`/f/${F('f3')}`, {}, cf({ statsStarted: true }));
    const exp = p.locator('.fp-list li', { hasText: 'Indicateurs' });
    ok(
      (await exp.textContent()).includes('plus disponible depuis le 30 sept. 2026') &&
        (await exp.locator('a').count()) === 0,
      'L14-05 : module expiré daté, sans action',
    );
    ok(
      (await p.locator('.fp-list li', { hasText: 'Lire le tableau' }).textContent()).includes(
        'Validé · score 85',
      ),
      'L14-05 : score du module validé',
    );
    ok(
      (await p.locator('.fp-head .hb').textContent()).includes('1 sur 3 validé'),
      'L14-05 : l’expiré ne compte pas dans la progression',
    );
    await p.goto(`${PLAYER}/#/c/ml-exemple`);
    await p.waitForSelector('.fc');
    ok(
      (await p.locator('.fc', { hasText: 'Statistiques' }).locator('.note').textContent()) ===
        '+ 1 module expiré',
      'L14-01 : note « + 1 module expiré »',
    );
    const foot = p.locator('.ctr-foot');
    ok(
      (await foot.textContent()).match(/Accessibilité.: non évaluée/) !== null &&
        (await foot.getByRole('link', { name: 'Données personnelles' }).getAttribute('href')).startsWith(
          'https://',
        ),
      'L14 : pied de page (statut et lien réglés)',
    );
    await p.close();
  }

  // L14-06 / L15-07 : formation terminée, attestation délivrée par le serveur
  {
    const { p } = await center(`/f/${F('f2')}?l=jeton-alex-0001`);
    ok(
      (await p.locator('.fp-done h2').textContent()) === 'Formation terminée, bravo Alex',
      'L14-06 : bandeau de fin',
    );
    const btn = p.locator('.fp-done button');
    ok(
      !(await btn.isDisabled()) && !(await btn.textContent()).includes('Bientôt'),
      'L15-07 : bouton d’attestation actif, sans « Bientôt »',
    );
    ok(
      (await p.locator('.fp-list li .cta').allTextContents()).every((x) => x.startsWith('Revoir')),
      'L14-06 : « Revoir » partout',
    );
    const sent = [];
    let reply = {};
    await p.route('**/rest/v1/rpc/issue_certificate', (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      sent.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify(reply), headers: cors });
    });
    // Refus du serveur (lien désactivé, module non validé) : message, aucun fichier
    await btn.click();
    await p.waitForSelector('.fp-cert-s.err');
    ok(
      sent[0]?.p_link_token === 'jeton-alex-0001' && sent[0]?.p_path === F('f2'),
      'L15-07 : jeton du lien et formation envoyés à issue_certificate',
    );
    ok(/n’a pas pu être délivrée/.test(await p.locator('.fp-cert-s').textContent()), 'L15-07 : refus expliqué');
    reply = { error: 'name_missing' };
    await btn.click();
    await p.waitForFunction(() => /nom n’est pas renseigné/.test(document.querySelector('.fp-cert-s')?.textContent || ''));
    ok(true, 'L15-07 : nom manquant expliqué');
    reply = {
      certificateId: '000042',
      issuedAt: '2026-11-12T10:00:00Z',
      learner: 'Alex Martin',
      path: 'Agenda partagé',
      workspace: 'Mission Locale Exemple',
      validatedAt: '2026-11-04T11:00:00Z',
      modules: [
        { title: 'Partager un agenda', best: null },
        { title: 'Planifier un rendez-vous', best: null },
      ],
    };
    p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(async (e) => { console.log('status:', await p.locator('.fp-cert-s').textContent(), errors); throw e; }), btn.click()]);
    const pdf = require('fs').readFileSync(await dl.path()).toString('latin1');
    ok(dl.suggestedFilename() === 'attestation-agenda-partage.pdf', 'L15-07 : nom du fichier');
    ok(pdf.startsWith('%PDF-') && /\/Count 1/.test(pdf) && pdf.includes('/Lang (fr-FR)'), 'L15-07 : PDF d’une page, en français');
    ok((await p.locator('.fp-cert-s').textContent()) === '', 'L15-07 : plus de message après la création');
    await p.close();
  }

  // Sans lien personnel : pas de bouton d'attestation
  {
    const { p } = await center(`/f/${F('f2')}`);
    ok((await p.locator('.fp-done button').count()) === 0, 'L15-07 : sans lien personnel, aucun bouton');
    await p.close();
  }

  // L14-02 : visiteur non identifié
  {
    const { p } = await center('', { identified: false });
    ok(
      (await p.getByRole('complementary', { name: 'Suivre sa progression' }).count()) === 1,
      'L14-02 : carte « Retrouvez votre progression »',
    );
    ok(
      (await p.locator('.ctr-av, .who').count()) === 0 && (await p.locator('.fc-pg').count()) === 0,
      'L14-02 : ni prénom ni progression',
    );
    await p.close();
  }

  // L14-07 : centre vide ; centre introuvable ; mot de passe du centre
  {
    const { p } = await center('', { empty: true });
    ok(
      (await p.locator('.ctr-empty h2').textContent()) === 'Aucune formation pour le moment',
      'L14-07 : centre vide',
    );
    ok((await p.locator('.ctr-search').count()) === 0, 'L14-07 : ni recherche ni filtres');
    await p.close();
    const nf = await center('', {}, { status: 'not_found' });
    ok((await nf.p.locator('.p-sys-card').count()) === 1, 'L14 : centre introuvable, écran système');
    await nf.p.close();
    const pw = await center('', {}, (req) =>
      req.password === 'mot-de-passe-centre'
        ? { ...centerFixture(), grant: 'g' }
        : {
            status: req.password ? 'password_wrong' : 'password_required',
            title: 'Centre',
            workspace: 'Mission Locale Exemple',
            remaining: 4,
          },
    );
    await pw.p.locator('#p-gate-pw').fill('mauvais');
    await pw.p.getByRole('button', { name: /Accéder/ }).click();
    await pw.p.waitForTimeout(300);
    ok((await pw.p.locator('.p-gate-err').count()) === 1, 'L14 : mot de passe du centre refusé');
    await pw.p.locator('#p-gate-pw').fill('mot-de-passe-centre');
    await pw.p.getByRole('button', { name: /Accéder/ }).click();
    await pw.p.waitForTimeout(400);
    ok((await pw.p.locator('.fc').count()) === 4, 'L14 : mot de passe du centre accepté');
    await pw.p.close();
  }

  // Mobile : pas de défilement horizontal
  {
    const { p } = await center('', {}, null, { width: 390, height: 844 });
    ok(
      !(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
      'L14 : mobile sans défilement horizontal',
    );
    await p.close();
  }

  // L14-08 / L14-09 : réglages
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message));
    const s = seed();
    seedCenterTables(s);
    s.takenSlugs = ['deja-prise'];
    const state = await install(p, s);
    const tc = () => state.tables.training_centers[0];
    await p.goto(`${APP}/#/`);
    await p.getByRole('link', { name: 'Centre de formation' }).click();
    await p.waitForSelector('.cfg14');
    ok(
      (await p.locator('.page-head__sub').textContent()).includes('1 modification non publiée'),
      'L14-08 : statut publié et modifications en attente',
    );
    await p.getByLabel('Adresse de la page').fill('deja-prise');
    await p.waitForTimeout(600);
    ok((await p.locator('#c-slug-h').textContent()).includes('déjà prise'), 'L14-08 : adresse déjà prise');
    await p.getByLabel('Adresse de la page').fill('mission-locale-exemple');
    await p.waitForTimeout(600);
    ok((await p.locator('#c-slug-h').textContent()).includes('disponible'), 'L14-08 : adresse disponible');
    await p.locator('#c-brand').fill('#F2E94E');
    await p.waitForTimeout(700);
    ok(
      (await p.locator('#c-brand-h').textContent()).includes('refusée') && tc().draft.brand === '#A3195B',
      'L14-08 : couleur trop claire refusée avec le contraste',
    );
    await p.locator('#c-brand').fill('#0E5A85');
    await p.waitForTimeout(800);
    ok(tc().draft.brand === '#0E5A85', 'L14-08 : couleur conforme enregistrée dans le brouillon');
    await p.getByRole('radio', { name: 'Contraste renforcé' }).check();
    await p.getByRole('checkbox', { name: 'Afficher Agenda partagé' }).uncheck();
    await p.waitForTimeout(800);
    ok(
      tc().draft.style === 'contrast' && tc().draft.paths.find((x) => x.id === 'p-agenda').visible === false,
      'L14-08 : style et formation masquée',
    );
    await p.getByRole('checkbox', { name: 'Afficher Logiciel métier' }).focus();
    await p.keyboard.press('Alt+ArrowDown');
    await p.waitForTimeout(800);
    ok(tc().draft.paths[1].id === 'p-logiciel', 'L14-08 : ordre changé au clavier (Alt + flèche)');
    ok(tc().published.style === 'workspace', 'L14-08 : la page publiée ne change pas avant « Publier »');
    await p.getByRole('button', { name: 'Publier les modifications' }).click();
    await p.waitForTimeout(600);
    ok(tc().published.style === 'contrast', 'L14-08 : publication');
    ok(
      (await p.getByRole('radio', { name: /Par domaine e-mail/ }).isDisabled()) &&
        (await p.getByText('Bientôt').count()) >= 2,
      'L14-08 : domaine et invitation « Bientôt »',
    );
    await p.getByLabel('Mot de passe de la page').fill('court');
    ok(
      await p.getByRole('button', { name: 'Enregistrer le mot de passe' }).isDisabled(),
      'L14-08 : mot de passe de 8 caractères au moins',
    );
    await p.getByLabel('Mot de passe de la page').fill('mot-de-passe-centre');
    await p.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
    await p.waitForTimeout(600);
    ok(tc().access_mode === 'password', 'L14-08 : mot de passe de la page enregistré');
    await p.close();

    const v = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const s2 = seed();
    seedCenterTables(s2, { empty: true });
    await install(v, s2);
    await v.goto(`${APP}/#/center`);
    await v.waitForSelector('.cfg14');
    const pub = v.getByRole('button', { name: 'Publier le centre' });
    ok(
      (await pub.isDisabled()) && (await pub.getAttribute('aria-describedby')) === 'cfg-why',
      'L14-09 : publication désactivée, raison liée',
    );
    ok(
      (await v.locator('.warn14').textContent()).includes('au moins une formation visible'),
      'L14-09 : avertissement',
    );
    ok((await v.locator('.cfg-empty').count()) === 1, 'L14-09 : état vide des formations');
    await v.close();

    const e = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const s3 = seed();
    s3.tables.members[0].role = 'editor';
    await install(e, s3);
    await e.goto(`${APP}/#/learners`);
    await e.waitForTimeout(1200);
    ok(
      (await e.getByRole('link', { name: 'Centre de formation' }).count()) === 0,
      'L14-08 : entrée réservée aux propriétaires et admins',
    );
    await e.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
