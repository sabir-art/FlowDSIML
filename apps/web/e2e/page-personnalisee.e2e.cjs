/**
 * Test e2e L25-13 à L25-15 : page personnalisée d'un lien. Modale « Nouveau lien personnalisé »
 * (section Page personnalisée) et page vue par le destinataire (#/p/<id>/<code>) : contenu du lien,
 * démo protégée (pas de token), lien inactif, code inconnu. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/page-personnalisee.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000002';
const CAMILLE = '0b5c1f0e-0000-4000-8000-0000000000c1';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });

  // ===== App : modale « Nouveau lien personnalisé » =====
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  const t = state.tables;
  const demoRow = t.demos.find((d) => d.id === DEMO);
  demoRow.status = 'published';
  demoRow.current_version_id = 'v-2';
  t.demo_versions.push({
    id: 'v-2',
    demo_id: DEMO,
    workspace_id: demoRow.workspace_id,
    number: 2,
    manifest: {},
    published_at: '2026-11-14T10:00:00Z',
  });
  t.variables.push({ id: 'var-2', workspace_id: 'ws-1', key: 'email', label: 'E-mail', default_value: '' });
  t.members.push({ workspace_id: 'ws-1', user_id: CAMILLE, role: 'editor', created_at: '2026-02-01' });
  state.memberDirectory = { [CAMILLE]: { full_name: 'Camille Fictive', email: 'camille@acme.example' } };

  // Page publique désactivée : section désactivée avec « Activer la page publique »
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/share`);
  await page.getByRole('tab', { name: 'Liens personnalisés' }).click();
  await page.getByRole('button', { name: 'Nouveau lien' }).click();
  const sw = page.getByRole('checkbox', { name: 'Page personnalisée' });
  await sw.waitFor();
  ok((await sw.isDisabled()) && !(await sw.isChecked()), 'page publique désactivée : section désactivée');
  ok(
    (await page.getByRole('button', { name: 'Activer la page publique' }).count()) === 1,
    'lien « Activer la page publique »',
  );
  await page.getByRole('button', { name: 'Activer la page publique' }).click();
  ok(
    (await page.getByRole('tab', { name: 'Page publique' }).getAttribute('aria-selected')) === 'true',
    'ouvre l’onglet Page publique',
  );

  // Page publique activée : section activée par défaut
  t.demo_pages = [
    {
      demo_id: DEMO,
      workspace_id: 'ws-1',
      enabled: true,
      title: '',
      description: '',
      cta_label: 'Prendre rendez-vous',
      cta_url: 'https://www.acme.example/rdv',
    },
  ];
  await page.reload();
  await page.getByRole('tab', { name: 'Liens personnalisés' }).click();
  await page.getByRole('button', { name: 'Nouveau lien' }).click();
  await sw.waitFor();
  ok(await sw.isChecked(), 'activée par défaut si la page publique l’est');
  await page.fill('#sh-ln', 'Globex — Marie');
  await page.fill('#sh-v-company', 'Globex');
  await page.fill('#sh-v-email', 'marie@globex.example');
  ok((await page.getByText(/Jamais affichée sur la page/).count()) === 1, 'aide sous la variable email');
  await page.fill('#sh-pp-title', 'Votre démo, {{company}}');
  ok(sp(await page.textContent('#sh-pp-title-h')) === 'Aperçu : Votre démo, Globex', 'aperçu du titre');
  await page.fill('#sh-v-company', '');
  ok(
    sp(await page.textContent('#sh-pp-title-h')) === 'Aperçu : Votre démo',
    'variable vide : retirée avec la virgule',
  );
  await page.fill('#sh-v-company', 'Globex');
  await page.fill('#sh-pp-msg', 'Bonjour Marie, voici la démo dont nous avons parlé.');
  ok(sp(await page.textContent('#sh-pp-msg-c')) === '51 / 400 caractères', 'compteur du message');
  const opts = await page.locator('#sh-pp-sign option').allTextContents();
  ok(
    opts.includes('Camille Fictive') && !opts.some((o) => o.includes('@')),
    'signature : noms seulement, jamais l’e-mail',
  );
  await page.selectOption('#sh-pp-sign', CAMILLE);
  await page.fill('#sh-pp-url', 'http://www.globex.example');
  ok(
    sp(await page.textContent('#sh-pp-url-e')) === 'Saisissez une adresse qui commence par https://',
    'lien du bouton : https exigé',
  );
  await page.getByRole('button', { name: 'Créer et copier le lien' }).click();
  await page.waitForTimeout(400);
  ok(t.share_links.length === 0, 'http : création bloquée');
  await page.fill('#sh-pp-url', '');
  if (SHOTS) {
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/l25-13-modale${sfx}.png` });
  }
  await page.getByRole('button', { name: 'Créer et copier le lien' }).click();
  await page.waitForTimeout(800);
  const link = t.share_links[0];
  ok(
    link?.page_enabled === true &&
      /^[0-9A-Za-z]{12}$/.test(link.page_code || '') &&
      link.page_title === 'Votre démo, {{company}}' &&
      link.signed_by === CAMILLE &&
      link.cta_url === null,
    'lien créé avec sa page (code tiré par la base)',
  );
  ok(
    (await page.getByText('Personnalisée', { exact: true }).count()) === 1,
    'liste : badge « Personnalisée »',
  );
  if (SHOTS) {
    await page
      .locator('.toast button[aria-label]')
      .first()
      .click()
      .catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.toast')).catch(() => {});
    await page.screenshot({ path: `${SHOTS}/l25-13-liste${sfx}.png` });
  }

  // ===== Lecteur : page personnalisée =====
  const CODE = 'Ab3dE5fG7hJ9';
  const pageInfo = {
    demoId: DEMO,
    title: 'Créer un rapport en 2 minutes',
    description: 'Suivez pas à pas la création d’un rapport, du choix du modèle à l’export.',
    cta: { label: 'Prendre rendez-vous', url: 'https://www.acme.example/rdv' },
    endTitle: '',
    endBody: '',
    style: process.env.THEME === 'dark' ? 'dark' : 'light',
    indexable: false,
    steps: 6,
    updatedAt: '2026-11-14T10:00:00Z',
    workspace: 'Acme',
    privacyUrl: 'https://www.acme.example/confidentialite',
    a11y: 'non_evalue',
    a11yUrl: null,
    related: [{ demoId: '0b5c1f0e-0000-4000-8000-000000000009', title: 'Exporter en PDF', description: '' }],
  };
  const okAnswer = {
    status: 'ok',
    page: pageInfo,
    personal: {
      title: 'Votre démo, {{company}}',
      message: 'Bonjour Marie, voici la démo dont nous avons parlé.',
      signer: { name: 'Camille Fictive', initials: 'CF' },
      cta: { label: 'Réserver un créneau', url: 'https://www.acme.example/globex' },
      variables: { company: 'Globex' },
      datasetRow: 1,
      token: 'tok-globex',
    },
  };
  let answer = okAnswer;
  const asked = [];
  const pp = async (vp) => {
    const p = await (await themedContext(b, { viewport: vp, locale: 'fr-FR' })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/rest/v1/rpc/personal_page', (r) => {
      asked.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(answer) });
    });
    await p.route('**/rest/v1/rpc/public_page', (r) =>
      r.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(pageInfo) }),
    );
    await p.route('**/rest/v1/rpc/resolve_share_link', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ demoId: DEMO, linkId: 'l1', variables: { company: 'Globex' }, datasetRow: 1 }),
      }),
    );
    await p.route('**/functions/v1/**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: '{"status":"not_found"}',
      }),
    );
    return p;
  };
  const p1 = await pp({ width: 1440, height: 900 });
  await p1.goto(`${PLAYER}/#/p/${DEMO}/${CODE}`);
  await p1.getByRole('heading', { level: 1, name: 'Votre démo, Globex' }).waitFor();
  ok(asked[0]?.p_demo === DEMO && asked[0]?.p_code === CODE, 'personal_page(id, code)');
  ok((await p1.title()) === 'Votre démo, Globex · Acme', '<title> personnalisé');
  ok(
    (await p1.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow',
    'jamais indexée ni suivie',
  );
  ok(
    (await p1.locator('meta[name="referrer"]').getAttribute('content')) === 'no-referrer',
    'pas de référent',
  );
  ok((await p1.locator('meta[property="og:title"]').count()) === 0, 'pas d’Open Graph personnalisé');
  ok(
    sp(await p1.textContent('.pp-badge')).includes('Préparée pour Globex'),
    'badge « Préparée pour Globex »',
  );
  ok(
    (await p1.textContent('.pp-msg')).includes('voici la démo') &&
      (await p1.textContent('.pp-avatar')) === 'CF',
    'message et initiales du signataire',
  );
  ok(sp(await p1.textContent('.pp-sign')).includes('Camille Fictive'), 'signature');
  ok(
    (
      await p1.getByRole('link', { name: /Réserver un créneau/ }).evaluateAll((a) => a.map((x) => x.href))
    ).every((h) => h === 'https://www.acme.example/globex') &&
      (await p1.getByRole('link', { name: /Prendre rendez-vous/ }).count()) === 0,
    'bouton du lien (en haut et en fin de page)',
  );
  ok((await p1.getByText('Exporter en PDF').count()) === 0, 'autres démos masquées');
  ok((await p1.locator('.pp-notice').count()) === 1, 'mention « page préparée pour vous »');
  ok(!(await p1.content()).includes('marie@globex.example'), 'aucun e-mail dans la page');
  if (SHOTS) {
    const h = await p1.evaluate(() => document.documentElement.scrollHeight);
    await p1.setViewportSize({ width: 1440, height: h });
    await p1.screenshot({ path: `${SHOTS}/l25-14-page${sfx}.png` });
    await p1.setViewportSize({ width: 1440, height: 900 });
  }
  await p1.getByRole('button', { name: 'Lancer la démo' }).click();
  const src = await p1.locator('.pp-stage iframe').getAttribute('src');
  ok(src.endsWith('#/l/tok-globex?ch=page'), 'lecteur ouvert par le token du lien');

  // Mobile
  const pm = await pp({ width: 390, height: 844 });
  await pm.goto(`${PLAYER}/#/p/${DEMO}/${CODE}`);
  await pm.getByRole('heading', { level: 1 }).waitFor();
  ok(
    await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'mobile : pas de défilement horizontal',
  );
  if (SHOTS) await pm.screenshot({ path: `${SHOTS}/l25-14-mobile${sfx}.png`, fullPage: true });

  // Démo protégée : pas de token, le lecteur passe par l'écran habituel
  answer = { ...okAnswer, personal: { ...okAnswer.personal, token: null } };
  const p2 = await pp({ width: 1440, height: 900 });
  await p2.goto(`${PLAYER}/#/p/${DEMO}/${CODE}`);
  await p2.getByRole('heading', { level: 1 }).waitFor();
  await p2.getByRole('button', { name: 'Lancer la démo' }).click();
  ok(
    (await p2.locator('.pp-stage iframe').getAttribute('src')).endsWith(`#/d/${DEMO}?ch=page`),
    'démo protégée : lecteur sans token',
  );

  // Lien inactif
  answer = { status: 'inactive', publicPage: true, demoId: DEMO };
  const p3 = await pp({ width: 1440, height: 900 });
  await p3.goto(`${PLAYER}/#/p/${DEMO}/${CODE}`);
  await p3.getByRole('heading', { level: 1 }).waitFor();
  ok(
    (await p3.getByRole('link', { name: 'Voir la démo publique' }).getAttribute('href')) === `#/p/${DEMO}`,
    'lien inactif : renvoi vers la page publique',
  );
  ok(
    (await p3.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow',
    'lien inactif : noindex',
  );
  if (SHOTS) await p3.screenshot({ path: `${SHOTS}/l25-15-inactif${sfx}.png` });

  // Code inconnu ou démo supprimée : page indisponible
  answer = { status: 'not_found' };
  const p4 = await pp({ width: 1440, height: 900 });
  await p4.goto(`${PLAYER}/#/p/${DEMO}/${CODE}`);
  await p4.getByRole('heading', { level: 1 }).waitFor();
  ok(
    (await p4.getByRole('link', { name: 'Voir la démo publique' }).count()) === 0,
    'not_found : page indisponible',
  );
  // Code mal formé : route refusée sans appel
  const before = asked.length;
  const p5 = await pp({ width: 1440, height: 900 });
  await p5.goto(`${PLAYER}/#/p/${DEMO}/abc`);
  await p5.waitForTimeout(800);
  ok(asked.length === before, 'code mal formé : aucun appel');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
