/**
 * Test e2e A8 (lecteur) : étapes HTML en iframe srcdoc sandbox (origine opaque, CSP, notre seul
 * script), opérations (texte avec variable, masquage, flou), démo guidée et Sandbox (liaison
 * automatique, lien vers une étape, « non disponible », pages clés). Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/html-player.e2e.cjs
 */
const { chromium } = require('playwright');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const S1 = '0b5c1f0e-0000-4000-8000-0000000000c1';
const S2 = '0b5c1f0e-0000-4000-8000-0000000000c2';
const S3 = '0b5c1f0e-0000-4000-8000-0000000000c3';
const page = (title, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body{margin:0;font:16px system-ui,sans-serif;color:#1c1917;background:#f5f5f4}
  nav{display:flex;gap:16px;padding:14px 24px;background:#a3195b}nav a{color:#fff;font-weight:600}
  main{padding:24px}.kpi{display:inline-block;margin:0 16px 16px 0;padding:16px 20px;border-radius:12px;background:#fff}
  .value{display:block;font-size:28px}</style></head><body>
  <nav id="menu"><a href="https://app.acme.example/">Accueil</a><a href="https://app.acme.example/agenda">Agenda</a><a href="https://app.acme.example/stats">Statistiques</a></nav>
  <main>${body}</main>
  <script>parent.postMessage({fd:1,t:'go',step:'${S3}'},'*')</script>
  <img src="x" onerror="parent.postMessage({fd:1,t:'go',step:'${S3}'},'*')" alt="">
  </body></html>`;
const pages = {
  'p1.html': page(
    'Accueil',
    `<h1>Tableau de bord</h1><div class="kpi"><span>Dossiers</span><b class="value">312</b></div>
     <div class="kpi"><span>Rendez-vous</span><b class="value">48</b></div>
     <p class="promo">Offre réservée</p><p class="owner">Xxxxxxx Xxxxxx</p><button id="export">Exporter</button>`,
  ),
  'p2.html': page('Agenda', '<h1>Agenda</h1><p>Mardi : atelier CV</p>'),
  'p3.html': page('Statistiques', '<h1>Statistiques</h1>'),
};
const base = (id, extra) => ({
  schemaVersion: 1,
  demoId: id,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000cf',
  workspaceId: 'w',
  title: 'Découvrir le tableau de bord',
  locale: 'fr',
  publishedAt: '2026-11-19T10:00:00Z',
  theme: {},
  variables: [{ key: 'company', label: 'Société', default: 'Acme' }],
  ...extra,
});
const step = (id, file, title, extra = {}) => ({
  id,
  kind: 'html',
  title,
  html: { url: `assets/${file}`, title, viewport: { w: 1280, h: 720 }, ops: [], links: [], ...extra },
});
const SAND = '0b5c1f0e-0000-4000-8000-0000000000d1';
const GUID = '0b5c1f0e-0000-4000-8000-0000000000d2';
const manifests = {
  [SAND]: base(SAND, {
    kind: 'sandbox',
    sandbox: { start: S1, autoLink: true, unlinked: 'toast', guide: false, keyPages: [S1, S2] },
    steps: [
      step(S1, 'p1.html', 'Accueil', {
        ops: [
          {
            id: 'o1',
            sel: 'div.kpi:nth-of-type(1) > b.value',
            op: 'text',
            value: '1 248 chez {{company}}',
            scope: 'step',
          },
          { id: 'o2', sel: 'p.promo', op: 'hide', scope: 'step' },
          { id: 'o3', sel: '#export', op: 'link', value: S3, scope: 'step' },
        ],
        links: [{ sel: '#menu > a:nth-of-type(2)', step: S2 }],
      }),
      step(S2, 'p2.html', 'Agenda', { links: [{ sel: '#menu > a:nth-of-type(1)', step: S1 }] }),
      step(S3, 'p3.html', 'Statistiques'),
    ],
  }),
  [GUID]: base(GUID, {
    steps: [step(S1, 'p1.html', 'Le tableau de bord'), step(S2, 'p2.html', 'L’agenda')],
  }),
};

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const tracked = [];
  const open = async (id, vp, qs = '') => {
    const p = await (await themedContext(b, { viewport: vp, locale: 'fr-FR' })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest: manifests[id] }),
      }),
    );
    await p.route('**/assets/*.html', (r) =>
      r.fulfill({ contentType: 'text/html', headers: cors, body: pages[r.request().url().split('/').pop()] }),
    );
    await p.route('**/functions/v1/track', (r) => {
      try {
        tracked.push(...(JSON.parse(r.request().postData() || '{}').events ?? []));
      } catch {}
      return r.fulfill({ status: 200, headers: cors, body: '{}' });
    });
    await p.goto(`${PLAYER}/#/d/${id}${qs}`);
    return p;
  };
  const frameText = async (p) =>
    (await p.frameLocator('.p-html-frame iframe').locator('body').innerText()) ?? '';

  // ===== Sandbox =====
  const p = await open(SAND, { width: 1440, height: 900 }, '?company=Globex');
  await p.waitForSelector('.p-html-frame iframe');
  const iframe = p.locator('.p-html-frame iframe');
  ok((await iframe.getAttribute('sandbox')) === 'allow-scripts', 'iframe sandbox="allow-scripts" seulement');
  const srcdoc = (await iframe.getAttribute('srcdoc')) ?? '';
  ok(
    /Content-Security-Policy/.test(srcdoc) &&
      /default-src 'none'/.test(srcdoc) &&
      /form-action 'none'/.test(srcdoc) &&
      /script-src 'sha256-/.test(srcdoc),
    'CSP stricte en tête de page',
  );
  ok(
    (srcdoc.match(/<script>/g) ?? []).length === 1 && !srcdoc.includes('<script>parent'),
    'script de la page retiré, le nôtre seul',
  );
  ok(/Page de la démo : Accueil/.test((await iframe.getAttribute('title')) ?? ''), 'iframe nommée');
  await p.frameLocator('.p-html-frame iframe').locator('h1').waitFor();
  await p.waitForTimeout(600);
  const t1 = await frameText(p);
  ok(/1 248 chez Globex/.test(t1), 'texte modifié, variable appliquée');
  ok(!/Offre réservée/.test(t1), 'élément masqué absent du rendu');
  ok(
    (await p.frameLocator('.p-html-frame iframe').locator('p.promo').getAttribute('aria-hidden')) === 'true',
    'élément masqué : aria-hidden',
  );
  ok(
    /Tableau de bord/.test(t1) && !/Statistiques/.test(await p.locator('.p-html-frame').innerText()),
    'gestionnaire onerror bloqué (aucune navigation)',
  );
  ok(
    (await p
      .frameLocator('.p-html-frame iframe')
      .locator('body')
      .evaluate(() => {
        try {
          return !!window.parent.document;
        } catch {
          return false;
        }
      })) === false,
    'la page ne lit pas le lecteur (origine opaque)',
  );
  ok(
    /1 pages clés vues sur 2|1 page clé vue sur 2|1 pages clés vues sur 2/.test(
      await p.locator('.p-html-key').innerText(),
    ),
    'pages clés : 1 sur 2',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l20-04-sandbox${sfx}.png` });
  // Clic non relié
  await p.frameLocator('.p-html-frame iframe').locator('#menu a', { hasText: 'Statistiques' }).click();
  await p.waitForTimeout(200);
  ok(
    (await p.locator('.p-html-toast').innerText()) === 'Cette partie n’est pas disponible dans la démo',
    '« non disponible » annoncé (role=status)',
  );
  ok((await p.locator('.p-html-toast').getAttribute('role')) === 'status', 'toast role=status');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l20-04-non-disponible${sfx}.png` });
  // Lien automatique (même adresse) au clavier
  await p.frameLocator('.p-html-frame iframe').locator('#menu a', { hasText: 'Agenda' }).focus();
  await p.keyboard.press('Enter');
  await p.waitForFunction(() =>
    /Agenda/.test(document.querySelector('.p-html-frame iframe')?.getAttribute('title') ?? ''),
  );
  await p.frameLocator('.p-html-frame iframe').locator('h1', { hasText: 'Agenda' }).waitFor();
  ok(/Mardi/.test(await frameText(p)), 'lien automatique vers la page Agenda (clavier)');
  await p.waitForTimeout(300);
  ok(/2 pages clés vues sur 2/.test(await p.locator('.p-html-key').innerText()), 'pages clés : 2 sur 2');
  await p.waitForTimeout(2600); // envoi des événements par lots (2 s)
  ok(
    tracked.some((e) => e.type === 'demo_complete'),
    'complétion : pages clés vues',
  );
  await p.frameLocator('.p-html-frame iframe').locator('#menu a', { hasText: 'Accueil' }).click();
  await p.frameLocator('.p-html-frame iframe').locator('h1', { hasText: 'Tableau de bord' }).waitFor();
  await p.frameLocator('.p-html-frame iframe').locator('#export').click();
  await p
    .frameLocator('.p-html-frame iframe')
    .locator('h1', { hasText: 'Statistiques' })
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  ok(/Statistiques/.test(await frameText(p)), 'lien vers une étape (Lier à une étape)');
  ok((await p.locator('.p-html-bar').count()) === 0, 'Sandbox : pas de bouton Suivant');

  // ===== Démo guidée =====
  const g = await open(GUID, { width: 1024, height: 800 });
  await g.waitForSelector('.p-html-frame iframe');
  await g.frameLocator('.p-html-frame iframe').locator('h1').waitFor();
  ok(
    (await g.getByRole('button', { name: 'Suivant', exact: true }).count()) === 1,
    'démo guidée : bouton Suivant',
  );
  await g.frameLocator('.p-html-frame iframe').locator('#menu a', { hasText: 'Agenda' }).click();
  await g.waitForTimeout(200);
  ok((await g.locator('.p-html-toast').innerText()) !== '', 'démo guidée : lien non relié annoncé');
  if (SHOTS) await g.screenshot({ path: `${SHOTS}/l20-04-guidee${sfx}.png` });
  await g.getByRole('button', { name: 'Suivant', exact: true }).click();
  await g.frameLocator('.p-html-frame iframe').locator('h1', { hasText: 'Agenda' }).waitFor();
  ok(true, 'Suivant mène à la page 2');
  // Mobile : mise à l'échelle sans défilement horizontal
  const m = await open(GUID, { width: 390, height: 844 });
  await m.waitForSelector('.p-html-frame iframe');
  ok(
    await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    '390 px : sans défilement horizontal',
  );
  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
