/**
 * Recette L49 P4 (docs/ux/specs/l49-securite-html.md §4.1, §3, §7). Données fictives ; Google Safe
 * Browsing simulé (aucun appel réel, adresse de test officielle).
 *  - éditeur : lien signalé « Bloqué, site signalé » (texte danger, icône, ni badge ni interrupteur) ;
 *    rapport « liens dangereux bloqués » ; vérification indisponible (état partiel, date, nouvelle
 *    autorisation refusée avec sa raison) ;
 *  - publication : lien autorisé devenu dangereux → bloqué, alerte « Le lien … a été bloqué. » ;
 *  - lecteur : un lien signalé ne fait rien, même avec une ancienne autorisation.
 * Usage : node e2e/l49-safebrowsing.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const BAD = 'https://testsafebrowsing.appspot.com/s/malware.html';
const DOC = 'https://docs.globex.example/guide';
const NEW = 'https://autre.initech.example/';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const SA = '0b5c1f0e-0000-4000-8000-0000000004f1';
const SB = '0b5c1f0e-0000-4000-8000-0000000004f2';
const page = (h1) => `<!doctype html><html><head><meta charset="utf-8"><title>${h1}</title></head><body><main>
  <h1>${h1}</h1>
  <a id="bad" data-tc-href="${BAD}" data-tc-ext="blocked">Offre spéciale</a>
  <a id="doc" data-tc-href="${DOC}" data-tc-ext="off">Guide</a>
  <a id="new" data-tc-href="${NEW}" data-tc-ext="off">Autre site</a>
</main></body></html>`;
const zero = { scripts: 0, handlers: 0, frames: 0, forms: 0, externalLinks: 2, piiReplaced: 0, other: 0 };
const links = [
  { sel: '#bad', href: BAD, label: 'Offre spéciale' },
  { sel: '#doc', href: DOC, label: 'Guide' },
  { sel: '#new', href: NEW, label: 'Autre site' },
];

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const watch = (p) =>
    p.on('pageerror', (e) => {
      if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
    });

  // ===== Éditeur =====
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  state.htmlPages = {};
  const add = (id, i, title, security, ops) => {
    const path = `${ws}/${DEMO}/${id}.html`;
    state.htmlPages[path] = page(title);
    state.tables.steps.unshift({
      ...base,
      id,
      position: -2 + i,
      kind: 'html',
      title,
      image_path: null,
      html_path: path,
      html_ops: ops,
      html_meta: {
        title,
        url: 'https://app.acme.example/aide',
        viewport: { w: 1280, h: 720 },
        links,
        security,
      },
    });
  };
  add(
    SA,
    0,
    'Aide',
    { ...zero, dangerousLinks: 1, blocked: [BAD], safeBrowsing: 'ok', analyzedAt: '2026-11-21T02:00:00Z' },
    [{ id: 'e1', sel: '#doc', op: 'extlink', value: DOC, scope: 'step' }],
  );
  add(SB, 1, 'Offres', { ...zero, safeBrowsing: 'unavailable', analyzedAt: '2026-11-21T02:00:00Z' }, [
    { id: 'e2', sel: '#doc', op: 'extlink', value: DOC, scope: 'step' },
  ]);
  state.tables.steps.sort((a, b2) => a.position - b2.position);
  const ed = await (
    await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
  ).newPage();
  watch(ed);
  await install(ed, state);
  await ed.goto(`${APP}/#/demos/${DEMO}/edit`);
  await ed.frameLocator('.html-stage iframe').locator('h1').waitFor();
  const xl = ed.locator('.xlinks');
  await xl.waitFor();
  const row = (i) => xl.locator('li').nth(i);
  ok(
    (await xl.locator('.sec-title').textContent()).trim() === 'Liens externes · 3',
    'lien signalé listé avec les liens externes',
  );
  const blocked = row(0).locator('.xlinks-blocked');
  ok((await blocked.innerText()) === 'Bloqué, site signalé', '« Bloqué, site signalé »');
  const style = await blocked.evaluate((el) => {
    const s = getComputedStyle(el);
    return [
      s.fontSize,
      s.fontWeight,
      s.backgroundColor,
      s.borderTopStyle,
      !!el.querySelector('svg[aria-hidden="true"]'),
    ];
  });
  ok(
    style[0] === '13px' &&
      style[1] === '600' &&
      style[2] === 'rgba(0, 0, 0, 0)' &&
      style[3] === 'none' &&
      style[4],
    `texte danger 13 px 600, icône, sans fond ni bordure (${style.join()})`,
  );
  ok((await row(0).getByRole('switch').count()) === 0, 'interrupteur retiré (pas grisé)');
  const sec = ed.getByRole('group', { name: 'Sécurité de la page' });
  ok(
    (await sec.locator('.hsec-status strong').innerText()) === 'Éléments retirés',
    'lien bloqué : « Éléments retirés »',
  );
  await sec.getByRole('button', { name: 'Détail' }).click();
  ok(
    (await sec.locator('.hsec-list li').last().innerText()).replace(/\s+/g, ' ') ===
      'Lien dangereux bloqué 1',
    'rapport : lien dangereux bloqué (Google Safe Browsing)',
  );
  const note = await sec
    .locator('.hsec-note')
    .evaluate((el) => [el.textContent, getComputedStyle(el).fontSize]);
  ok(
    note.join() === 'Vérifié par Google Safe Browsing,12px',
    `R3 : source sous la liste, 12 px (${note.join()})`,
  );

  // Vérification indisponible
  await ed.locator('.rail-list .step').nth(1).click();
  await ed.frameLocator('.html-stage iframe').locator('h1', { hasText: 'Offres' }).waitFor();
  await ed.waitForTimeout(200);
  ok(
    (await sec.locator('.hsec-status strong').innerText()) === 'Vérification partielle',
    'indisponible : « Vérification partielle »',
  );
  await sec.getByRole('button', { name: 'Détail' }).click();
  const off = (await sec.locator('.hsec-gsb-off').innerText()).replace(/\s+/g, ' ');
  ok(
    off.startsWith('Vérification Google indisponible') &&
      /Dernière tentative/.test(off) &&
      (await sec.locator('.hsec-gsb-off svg[aria-hidden="true"]').count()) === 1,
    `« Vérification Google indisponible », icône et date (${off})`,
  );
  ok(
    (await row(1).getByRole('switch').isChecked()) &&
      (await row(2).innerText()).includes('Vérification Google indisponible, réessayez plus tard') &&
      (await row(2).getByRole('switch').count()) === 0,
    'lien déjà autorisé : gardé ; nouveau lien : autorisation refusée avec la raison',
  );

  // Publication : le lien autorisé « Guide » est signalé entre-temps
  state.flaggedUrls = [DOC];
  await ed
    .locator('.ed-bar')
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const gdpr = ed.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  for (const c of await gdpr.locator('.gdpr-checks input').all()) await c.check();
  await gdpr.getByRole('button', { name: 'Publier en public' }).click();
  const alert = ed.locator('.publish-error__text');
  await alert.waitFor({ timeout: 5000 }).catch(() => undefined);
  ok(
    (await alert.count()) &&
      (await alert.innerText()).startsWith('Le lien Guide mène à un site signalé : il a été bloqué.'),
    `alerte dans l’éditeur (${(await alert.count()) ? await alert.innerText() : 'absente'})`,
  );
  ok(
    !state.tables.demo_versions.some((v) => v.demo_id === DEMO && v.public_ack) &&
      state.tables.steps
        .filter((s) => [SA, SB].includes(s.id))
        .every((s) => !s.html_ops.some((o) => o.op === 'extlink')),
    'autorisation retirée, publication arrêtée pour que l’auteur voie le changement',
  );

  // ===== Lecteur : un lien signalé ne fait rien =====
  const D = '0b5c1f0e-0000-4000-8000-0000000004e1';
  const manifest = {
    schemaVersion: 1,
    demoId: D,
    versionId: '0b5c1f0e-0000-4000-8000-0000000004ef',
    workspaceId: 'w',
    title: 'Aide',
    locale: 'fr',
    publishedAt: '2026-11-21T10:00:00Z',
    theme: {},
    variables: [],
    steps: [
      {
        id: SA,
        kind: 'html',
        title: 'Aide',
        html: {
          url: 'assets/aide.html',
          title: 'Aide',
          viewport: { w: 1280, h: 720 },
          links: [],
          // Ancienne autorisation : la vérification l'emporte
          ops: [{ id: 'e9', sel: '#bad', op: 'extlink', value: BAD, scope: 'step' }],
        },
      },
    ],
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  watch(p);
  await p.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ status: 'ok', manifest }),
    }),
  );
  await p.route('**/assets/aide.html', (r) =>
    r.fulfill({ contentType: 'text/html', headers: cors, body: page('Aide') }),
  );
  await p.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
  let opened = 0;
  ctx.on('page', () => opened++);
  await p.goto(`${PLAYER}/#/d/${D}`);
  const frame = p.frameLocator('.p-html-frame iframe');
  await frame.locator('h1').waitFor();
  await p.waitForTimeout(400);
  await frame.locator('#bad').click();
  await p.waitForTimeout(300);
  ok(
    (await p.locator('dialog.p-leave').count()) === 0 &&
      (await p.locator('.p-html-toast').innerText()) === '' &&
      opened === 0,
    'lecteur : lien signalé sans effet (ni dialogue, ni message, ni onglet)',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
