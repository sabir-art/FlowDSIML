/**
 * Test e2e L38 paquet 1 (revue « parcours de formation », n° 1 et 4). Données fictives.
 *  - n° 1 : Partager > Liens personnalisés d'un module de formation : « Lien du centre » en premier
 *    (#/c/<adresse>?l=<jeton>), copié aussi à la création d'un lien ; rien de tel hors formation.
 *  - n° 4 : fin d'un module ouvert depuis le centre : « Module suivant : … » et « Retour au centre »,
 *    puis « Voir mon attestation » après le dernier module ; rien de tel hors centre.
 * Usage : node e2e/formation-fin.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { centerFixture } = require('./center-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const PUBLIC = 'https://demos.tutoclick.example';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000002';
const F = (id) => `00000000-0000-4000-8000-0000000000${id}`;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];

  // ===== n° 1 : lien du centre dans Partager =====
  async function sharePage({ inPath }) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    const t = state.tables;
    const ws = t.workspaces[0].id;
    const demo = t.demos.find((d) => d.id === DEMO);
    demo.status = 'published';
    demo.current_version_id = 'v-2';
    t.demo_versions.push({
      id: 'v-2',
      demo_id: DEMO,
      workspace_id: ws,
      number: 2,
      manifest: {},
      published_at: '2026-11-14T10:00:00Z',
    });
    t.share_links.push({
      id: 'sl-1',
      demo_id: DEMO,
      workspace_id: ws,
      token: 'jeton-alex-0001',
      name: 'Alex Exemple',
      variables: {},
      is_active: true,
      expires_at: null,
      page_enabled: false,
      page_code: null,
      created_at: '2026-11-15T10:00:00Z',
    });
    t.paths = [{ id: 'p-1', workspace_id: ws, title: 'Logiciel métier', ordered: true }];
    t.path_modules = inPath
      ? [
          { path_id: 'p-1', demo_id: t.demos[0].id, workspace_id: ws, position: 0, required: true },
          { path_id: 'p-1', demo_id: DEMO, workspace_id: ws, position: 1, required: true },
        ]
      : [];
    t.training_centers = [
      {
        workspace_id: ws,
        slug: 'ml-exemple',
        draft: { paths: [{ id: 'p-1', visible: true }] },
        published: { paths: [{ id: 'p-1', visible: true }] },
        published_at: '2026-11-16T10:00:00Z',
        access_mode: 'link',
      },
    ];
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=perso`);
    await page.locator('table.sh-links').waitFor();
    return { ctx, page, t };
  }
  const clip = (page) => page.evaluate(() => navigator.clipboard.readText());
  {
    const { ctx, page, t } = await sharePage({ inPath: true });
    const note = page.getByRole('note');
    ok(
      /module 2 de «\s*Logiciel métier\s*» dans le centre de formation/.test(await note.textContent()),
      'n° 1 : note « module 2 de “Logiciel métier” », lien du centre à envoyer',
    );
    const actions = page.locator('table.sh-links tbody tr').first().locator('.sh-actions');
    const first = actions.locator('button').first();
    ok(
      (await first.getAttribute('aria-label')) ===
        'Copier le lien du centre de Alex Exemple (progression et attestation)',
      'n° 1 : « Lien du centre » en premier dans les actions du lien',
    );
    ok((await first.textContent()).includes('Lien du centre'), 'n° 1 : libellé visible « Lien du centre »');
    await first.click();
    ok(
      (await clip(page)) === `${PUBLIC}/#/c/ml-exemple?l=jeton-alex-0001`,
      'n° 1 : le lien copié est celui du centre avec le jeton du lien',
    );
    ok(
      (await page
        .getByRole('button', { name: 'Copier le lien de la démo seule de Alex Exemple' })
        .count()) === 1,
      'n° 1 : le lien de la démo seule passe en second',
    );
    // Création d'un lien : le lien du centre est copié
    await page.getByRole('button', { name: 'Nouveau lien' }).click();
    await page.fill('#sh-ln', 'Camille Exemple');
    await page.getByRole('button', { name: /Créer et copier le lien/ }).click();
    await page.getByText('Le lien du centre (progression et attestation) est copié').waitFor();
    const created = t.share_links.find((l) => l.name === 'Camille Exemple');
    ok(
      !!created?.token && (await clip(page)) === `${PUBLIC}/#/c/ml-exemple?l=${created.token}`,
      'n° 1 : à la création, le lien du centre est copié',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await sharePage({ inPath: false });
    ok((await page.getByRole('note').count()) === 0, 'hors formation : pas de note du centre');
    ok(
      (await page.getByRole('button', { name: /Lien du centre/ }).count()) === 0 &&
        (await page.getByRole('button', { name: 'Copier le lien Alex Exemple' }).count()) === 1,
      'hors formation : seul le lien de la démo, comme avant',
    );
    await ctx.close();
  }

  // ===== n° 4 : fin d'un module ouvert depuis le centre =====
  const step = (n, last) => ({
    id: `s${n}`,
    kind: 'image',
    image: { url: 'assets/a.png', width: 1100, height: 750 },
    title: `Étape ${n}`,
    body: '',
    hotspots: [
      {
        id: `h${n}`,
        x: 0.44,
        y: 0.45,
        w: 0.04,
        h: 0.04,
        title: last ? 'Terminez' : 'Continuez',
        placement: 'auto',
        action: { type: 'next' },
      },
    ],
  });
  const manifest = (demoId) => ({
    schemaVersion: 1,
    demoId,
    versionId: F('b0'),
    workspaceId: 'w',
    title: 'Fiches usagers',
    locale: 'fr',
    publishedAt: '2026-11-17T10:00:00Z',
    theme: {},
    variables: [],
    steps: [step(1), step(2, true)],
  });
  async function player(hash, center, viewport = { width: 1280, height: 860 }) {
    const ctx = await b.newContext({ viewport, locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const opened = [];
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest: manifest(JSON.parse(r.request().postData()).demoId) }),
      }),
    );
    await p.route('**/functions/v1/open-center', (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      opened.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(center) });
    });
    await p.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
    await p.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, headers: cors, body: 'null' }));
    await p.route('**/assets/**', (r) =>
      r.fulfill({ contentType: 'image/png', body: require('fs').readFileSync(`${__dirname}/fixture.png`) }),
    );
    // Jeton du lien personnel gardé en session par le centre (comme après #/c/<adresse>?l=…)
    await p.addInitScript(() => sessionStorage.setItem('fd.clink.ml-exemple', 'jeton-alex-0001'));
    await p.goto(`${PLAYER}/#${hash}`);
    await p.locator('.p-img').waitFor();
    // Étape 1 → 2, puis « Terminer » sur la dernière bulle
    await p.keyboard.press('ArrowRight');
    await p.getByRole('button', { name: 'Terminer' }).click();
    await p.locator('.p-end').waitFor();
    return { ctx, p, opened };
  }
  const from = `?c=ml-exemple&f=${F('f1')}`;
  {
    // Module 2 (« Fiches usagers ») d'une formation ordonnée : le suivant est « Agenda »
    const { ctx, p, opened } = await player(`/d/${F('a2')}${from}`, centerFixture());
    const next = p.getByRole('link', { name: 'Module suivant : Agenda' });
    await next.waitFor();
    ok(
      (await next.getAttribute('href')) === `#/d/${F('a3')}${from}`,
      'n° 4 : « Module suivant : Agenda » ouvre le module suivant, depuis le centre',
    );
    ok(
      (await next.getAttribute('class')).includes('p-btn-primary'),
      'n° 4 : « Module suivant » est le bouton principal',
    );
    ok(
      (await p.getByRole('link', { name: 'Retour au centre' }).getAttribute('href')) === '#/c/ml-exemple',
      'n° 4 : « Retour au centre »',
    );
    // Retour Lead UX : boutons-liens jamais soulignés, « Recommencer » en lien texte discret de 14 px
    const deco = await p
      .locator('.p-end a.p-btn')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).textDecorationLine));
    ok(
      deco.length >= 2 && deco.every((d) => d === 'none'),
      `Lead UX : liens-boutons non soulignés (${deco})`,
    );
    const again = p.locator('.p-end').getByRole('button', { name: 'Recommencer' });
    const st = await again.evaluate((e) => ({ cls: e.className, size: getComputedStyle(e).fontSize }));
    ok(st.cls.includes('p-link--muted') && st.size === '14px', `Lead UX : « Recommencer » en lien de 14 px`);
    ok(
      opened[0]?.slug === 'ml-exemple' && opened[0]?.linkToken === 'jeton-alex-0001',
      'n° 4 : le centre est interrogé avec le jeton personnel gardé en session',
    );
    ok(!p.url().includes('jeton'), 'n° 4 : le jeton n’apparaît jamais dans l’adresse');
    await ctx.close();
  }
  {
    // Dernier module obligatoire : « Voir mon attestation » (mobile)
    const c = centerFixture();
    const mods = c.paths[0].modules;
    mods[2] = { ...mods[2], status: 'validated', seen: 6, total: 6 };
    const { ctx, p } = await player(`/d/${F('a2')}${from}`, c, { width: 390, height: 844 });
    const cert = p.getByRole('link', { name: 'Voir mon attestation' });
    await cert.waitFor();
    ok(
      (await cert.getAttribute('href')) === `#/c/ml-exemple/f/${F('f1')}`,
      'n° 4 : formation terminée, « Voir mon attestation » ouvre la page de la formation',
    );
    ok(
      (await p.getByRole('link', { name: /Module suivant/ }).count()) === 0,
      'n° 4 : plus de module suivant',
    );
    const r = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    ok(r.sw <= r.cw + 1, `n° 4 : 390 px sans défilement horizontal (${r.sw} / ${r.cw})`);
    await ctx.close();
  }
  {
    // Démo ouverte seule (sans le centre) : fin inchangée
    const { ctx, p, opened } = await player(`/d/${F('a2')}`, centerFixture());
    ok(
      (await p.getByRole('link', { name: 'Retour au centre' }).count()) === 0 && opened.length === 0,
      'hors centre : pas de bouton du centre, le centre n’est pas interrogé',
    );
    ok((await p.getByRole('button', { name: 'Recommencer' }).count()) === 1, 'hors centre : « Recommencer »');
    await ctx.close();
  }
  // Le centre mène au module avec son origine
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    const p = await ctx.newPage();
    await p.route('**/functions/v1/open-center', (r) =>
      r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({
            contentType: 'application/json',
            headers: cors,
            body: JSON.stringify(centerFixture()),
          }),
    );
    await p.goto(`${PLAYER}/#/c/ml-exemple?l=jeton-alex-0001`);
    const me = p.getByRole('complementary', { name: 'Ma progression' });
    await me.waitFor();
    ok(
      (await me.getByRole('link').getAttribute('href')) === `#/d/${F('a2')}${from}`,
      'centre : la reprise ouvre le module avec l’adresse du centre et la formation',
    );
    await ctx.close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
