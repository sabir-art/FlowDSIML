/**
 * Test e2e L19b : onglet « Page publique » de Partager (app) et page publique vue par un visiteur
 * (lecteur, #/p/<id>), en ordinateur et en mobile, et page indisponible. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/page-publique.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000002';
const N = ' ';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });

  // ===== App : onglet Page publique =====
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  const demoRow = state.tables.demos.find((d) => d.id === DEMO);
  // L19b-02 : démo non publiée (note PRT-01 dans l'onglet) ; L19b-01 : démo publiée (version 2)
  demoRow.status = 'draft';
  demoRow.current_version_id = null;
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/share?tab=page`);
  const sw = page.getByRole('switch', { name: 'Page publique' });
  await sw.waitFor();
  ok((await page.getByText(/Démo non publiée/).count()) === 1, 'démo non publiée : note dans l’onglet');
  ok(
    (await page.getByRole('tab', { name: 'Page publique' }).getAttribute('aria-selected')) === 'true',
    'onglet ouvert depuis l’URL',
  );
  ok(!(await sw.isChecked()), 'page désactivée par défaut');
  ok((await page.getByText(/La page publique est désactivée/).count()) === 1, 'désactivée : alerte info');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l19b-02-onglet-off${sfx}.png` });
  demoRow.status = 'published';
  demoRow.current_version_id = 'v-2';
  state.tables.demo_versions.push({
    id: 'v-2',
    demo_id: DEMO,
    workspace_id: demoRow.workspace_id,
    number: 2,
    manifest: {},
    published_at: '2026-11-14T10:00:00Z',
  });
  demoRow.updated_at = '2026-11-14T10:00:00Z';
  await page.reload();
  await sw.waitFor();
  await sw.check();
  await page.getByLabel('Titre de la page').waitFor();
  ok(state.tables.demo_pages?.[0]?.enabled === true, 'page activée');
  ok((await page.getByLabel('Adresse de la page').inputValue()).endsWith(`#/p/${DEMO}`), 'adresse /p/<id>');
  ok(
    (await page.getByRole('switch', { name: 'Indexation par les moteurs de recherche' }).isChecked()) ===
      false,
    'indexation désactivée par défaut',
  );
  await page.getByLabel('Description').fill('Suivez pas à pas la prise en main, à votre rythme.');
  ok((await page.getByText('50 / 200 caractères').count()) === 1, 'compteur de la description');
  await page.getByLabel('Texte du bouton d’action').fill('Prendre rendez-vous');
  await page.getByLabel('Lien du bouton').fill('http://www.acme.example/rdv');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  ok((await page.getByText('Le lien doit commencer par https://.').count()) === 1, 'lien http refusé');
  await page.getByLabel('Lien du bouton').fill('https://www.acme.example/rdv');
  await page.getByRole('radio', { name: 'Sombre' }).click();
  await page.getByRole('switch', { name: 'Proposer d’autres démos du workspace' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText('Page publique enregistrée.').waitFor();
  const row = state.tables.demo_pages[0];
  ok(
    row.cta_url === 'https://www.acme.example/rdv' && row.style === 'dark' && row.related === true,
    'réglages enregistrés',
  );
  ok(
    (await page.getByRole('link', { name: 'Voir la page publique' }).getAttribute('target')) === '_blank',
    'nouvel onglet',
  );
  if (SHOTS) {
    await page
      .locator('.toast button[aria-label]')
      .first()
      .click()
      .catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.toast')).catch(() => {});
    // Pleine hauteur sans capture « fullPage » (la barre latérale, en 100vh, reste ancrée en haut)
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1440, height: h });
    await page.screenshot({ path: `${SHOTS}/l19b-01-onglet${sfx}.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  // Démo protégée : indexation impossible
  state.tables.demo_access = [
    { demo_id: DEMO, workspace_id: 'ws-1', mode: 'password', ask_email: false, expires_at: null },
  ];
  await page.reload();
  const ix = page.getByRole('switch', { name: 'Indexation par les moteurs de recherche' });
  await ix.waitFor();
  ok(await ix.isDisabled(), 'démo protégée : indexation désactivée');

  // ===== Lecteur : page publique =====
  const info = {
    demoId: DEMO,
    title: 'Créer un rapport en 2 minutes',
    description:
      'Suivez pas à pas la création d’un rapport, du choix du modèle à l’export. À votre rythme, sans compte.',
    cta: { label: 'Réserver un accompagnement', url: 'https://www.acme.example/rdv' },
    endTitle: `Besoin d’aide pour vos premiers rapports${N}?`,
    endBody: 'Un membre de l’équipe vous accompagne sur votre propre compte.',
    // La page n'hérite jamais du thème de l'app : la capture sombre utilise le style « Sombre »
    style: process.env.THEME === 'dark' ? 'dark' : 'light',
    indexable: false,
    steps: 6,
    updatedAt: '2026-11-14T10:00:00Z',
    workspace: 'Acme',
    privacyUrl: 'https://www.acme.example/confidentialite',
    a11y: 'non_evalue',
    a11yUrl: 'https://www.acme.example/accessibilite',
    related: [
      {
        demoId: '0b5c1f0e-0000-4000-8000-000000000009',
        title: 'Exporter en PDF',
        description: 'En trois clics.',
      },
    ],
  };
  let answer = info;
  const tracked = [];
  const pp = async (vp) => {
    const p = await (await themedContext(b, { viewport: vp, locale: 'fr-FR' })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/rest/v1/rpc/public_page', (r) =>
      r.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(answer) }),
    );
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          status: 'ok',
          manifest: {
            schemaVersion: 1,
            demoId: DEMO,
            versionId: '0b5c1f0e-0000-4000-8000-0000000000aa',
            workspaceId: 'w',
            title: info.title,
            locale: 'fr',
            publishedAt: '2026-11-14T10:00:00Z',
            theme: {},
            allowedEmbedOrigins: ['acme.example'],
            steps: [{ id: 's1', kind: 'text', title: 'Bienvenue', body: 'Commençons.' }],
          },
        }),
      }),
    );
    await p.route('**/functions/v1/track', (r) => {
      try {
        tracked.push(JSON.parse(r.request().postData() || '{}'));
      } catch {}
      return r.fulfill({ status: 200, headers: cors, body: '{}' });
    });
    return p;
  };
  const p1 = await pp({ width: 1440, height: 900 });
  await p1.goto(`${PLAYER}/#/p/${DEMO}`);
  await p1.getByRole('heading', { level: 1, name: info.title }).waitFor();
  ok((await p1.title()) === `${info.title} · Acme`, '<title> « titre · workspace »');
  ok((await p1.locator('meta[name="robots"]').getAttribute('content')) === 'noindex', 'noindex par défaut');
  ok(
    (await p1.locator('meta[name="description"]').getAttribute('content')) === info.description,
    'meta description',
  );
  ok((await p1.getByRole('heading', { level: 1 }).count()) === 1, 'un seul h1');
  ok(
    (await p1.locator('.pp-top img').count()) === 0 && (await p1.textContent('.pp-lg')) === 'A',
    'sans logo : initiale',
  );
  {
    // F7 : logo du workspace (bucket public branding)
    answer = { ...info, logoPath: '0b5c1f0e-0000-4000-8000-0000000000ff/logo.png' };
    const pl = await pp({ width: 1440, height: 900 });
    await pl.route('**/storage/v1/object/public/branding/**', (r) =>
      r.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      }),
    );
    await pl.goto(`${PLAYER}/#/p/${DEMO}`);
    await pl.getByRole('heading', { level: 1, name: info.title }).waitFor();
    const src = await pl.locator('.pp-top img.pp-logo').getAttribute('src');
    ok(
      /\/storage\/v1\/object\/public\/branding\/0b5c1f0e-0000-4000-8000-0000000000ff\/logo\.png$/.test(
        src ?? '',
      ),
      'logo du workspace affiché depuis le bucket public',
    );
    await pl.context().close();
    answer = info;
  }
  ok((await p1.getByText('6 étapes').count()) === 1, 'badge du nombre d’étapes');
  ok((await p1.getByText(/Environ/).count()) === 0, 'pas de durée estimée');
  ok(
    (await p1.getByRole('region', { name: `Démo interactive${N}: ${info.title}` }).count()) === 1,
    'zone du lecteur nommée',
  );
  ok(
    (await p1.getByRole('link', { name: /Accessibilité/ }).textContent()).includes('non conforme'),
    'mention d’accessibilité',
  );
  ok(
    (await p1.getByRole('link', { name: 'Exporter en PDF En trois clics.' }).getAttribute('href')) ===
      '#/p/0b5c1f0e-0000-4000-8000-000000000009',
    'autres démos',
  );
  if (SHOTS) await p1.screenshot({ path: `${SHOTS}/l19b-03-page${sfx}.png`, fullPage: true });
  await p1.getByRole('button', { name: 'Lancer la démo' }).click();
  const fr = p1.frameLocator('iframe');
  await fr.getByText('Commençons.', { exact: true }).waitFor();
  ok(
    (await p1.locator('iframe').getAttribute('sandbox')).includes('allow-scripts'),
    'lecteur en iframe sandbox',
  );
  ok(await p1.evaluate(() => document.activeElement?.tagName === 'IFRAME'), 'focus placé dans le lecteur');
  await p1.waitForTimeout(3000);
  await p1.evaluate(() =>
    document.querySelector('iframe').contentWindow.dispatchEvent(new Event('pagehide')),
  );
  await p1.waitForTimeout(500);
  ok(
    tracked.some((x) => x.channel === 'page'),
    'statistiques : canal « page »',
  );

  // Page intégrée par un site tiers : pas de lecteur embarqué, ouverture dans un onglet
  const p4 = await pp({ width: 1000, height: 700 });
  await p4.setContent(`<iframe src="${PLAYER}/#/p/${DEMO}" width="900" height="600"></iframe>`);
  const inner = p4.frameLocator('iframe');
  await inner.getByRole('link', { name: 'Lancer la démo' }).waitFor();
  ok(
    (await inner.getByRole('link', { name: 'Lancer la démo' }).getAttribute('target')) === '_blank',
    'page intégrée : le lecteur s’ouvre dans un onglet',
  );

  // Mobile 390 px
  const p2 = await pp({ width: 390, height: 844 });
  await p2.goto(`${PLAYER}/#/p/${DEMO}`);
  await p2.getByRole('heading', { level: 1 }).waitFor();
  ok(!(await p2.locator('.pp-cta').isVisible()), 'mobile : bouton d’en-tête masqué');
  ok(
    await p2.evaluate(() => document.documentElement.scrollWidth <= 390),
    'mobile : pas de défilement horizontal',
  );
  if (SHOTS) await p2.screenshot({ path: `${SHOTS}/l19b-04-page-mobile${sfx}.png`, fullPage: true });

  // Indisponible
  answer = null;
  const p3 = await pp({ width: 1440, height: 900 });
  await p3.goto(`${PLAYER}/#/p/${DEMO}`);
  await p3.getByRole('heading', { level: 1, name: 'Cette page n’est pas disponible' }).waitFor();
  ok(
    (await p3.locator('meta[name="robots"]').getAttribute('content')) === 'noindex',
    'indisponible : noindex',
  );
  if (SHOTS) await p3.screenshot({ path: `${SHOTS}/l19b-05-indisponible${sfx}.png` });

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
