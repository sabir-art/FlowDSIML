/**
 * EXT-CONNECT : canal app → extension, de bout en bout avec l'extension construite (faux Supabase).
 * L'« app » est ici l'origine du faux serveur (WXT_APP_URL=http://localhost:54400) ; 127.0.0.1 est une
 * origine étrangère. Usage :
 *   node e2e/mock-supabase.cjs &
 *   WXT_E2E=1 WXT_SUPABASE_URL=http://localhost:54400 WXT_SUPABASE_ANON_KEY=anon \
 *     WXT_APP_URL=http://localhost:54400 pnpm build
 *   node e2e/external.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DEMO = '22222222-2222-4222-8222-222222222222';
const WS = '11111111-1111-4111-8111-111111111111';
(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const results = [];
  const ok = (cond, label) => results.push([!!cond, label]);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const msg = {
    type: 'fd:sandbox-attach',
    v: 1,
    demoId: DEMO,
    workspaceId: WS,
    url: 'http://localhost:54400/page2',
  };
  const send = (page, m) =>
    page.evaluate(
      ([id, m]) =>
        new Promise((resolve) => {
          if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return resolve('no-channel');
          chrome.runtime.sendMessage(id, m, (r) => resolve(chrome.runtime.lastError ? 'no-response' : r));
        }),
      [extId, m],
    );

  // Manifeste : origine exacte de l'app, aucune permission ajoutée
  ok(
    JSON.stringify(manifest.externally_connectable) ===
      JSON.stringify({ matches: ['http://localhost:54400/*'] }),
    `manifeste : externally_connectable limité à l'origine de l'app (${JSON.stringify(manifest.externally_connectable)})`,
  );
  ok(
    JSON.stringify(manifest.permissions) ===
      JSON.stringify(['activeTab', 'storage', 'scripting', 'tabs', 'tabCapture', 'offscreen']),
    `manifeste : permissions inchangées (${manifest.permissions.join(', ')})`,
  );

  // Origine étrangère : le canal n'existe même pas dans la page
  const foreign = await ctx.newPage();
  await foreign.goto('http://127.0.0.1:54400/page');
  ok((await send(foreign, msg)) === 'no-channel', 'origine étrangère : aucun canal vers l’extension');

  // Origine de l'app : messages mal formés refusés
  const app = await ctx.newPage();
  await app.goto('http://localhost:54400/page');
  const bad = [
    { ...msg, type: 'fd:start' },
    { ...msg, v: 2 },
    { ...msg, demoId: 'pas-un-uuid' },
    { ...msg, url: 'javascript:alert(1)' },
    { ...msg, token: 'eyJhbGciOi' },
    'fd:sandbox-attach',
  ];
  for (const m of bad) {
    const r = await send(app, m);
    ok(
      r && r.ok === false && r.error === 'schema',
      `message mal formé refusé (${JSON.stringify(m).slice(0, 60)})`,
    );
  }
  // Message valide sans session dans l'extension : refusé, aucun onglet ouvert
  const before = ctx.pages().length;
  const r = await send(app, msg);
  ok(
    r && r.ok === false && r.error === 'signed-out',
    `sans session : refus « signed-out » (${JSON.stringify(r)})`,
  );
  ok(ctx.pages().length === before, 'sans session : aucun onglet ouvert');

  // Connecté : l'onglet s'ouvre et la capture HTML démarre, rattachée au Sandbox
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('#login button[type=submit]');
  await popup.waitForSelector('#setup:not([hidden])');
  const opened = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('/page2') });
  const r2 = await send(app, msg);
  await opened;
  ok(r2 && r2.ok === true, `connecté : accepté (${JSON.stringify(r2)})`);
  const st = await popup.evaluate(async () => ({
    status: await chrome.runtime.sendMessage({ type: 'fd:status' }),
    attach: (await chrome.storage.local.get('fd.attach'))['fd.attach'],
  }));
  ok(
    st.attach &&
      st.attach.demoId === '22222222-2222-4222-8222-222222222222' &&
      st.attach.origin === 'http://localhost:54400',
    'rattachement au Sandbox enregistré',
  );
  ok(st.status.recording && st.status.mode === 'html', 'capture HTML démarrée dans le nouvel onglet');
  // Fin de capture : la revue ajoute les pages au Sandbox existant (aucune démo créée)
  const logStart = (await (await fetch('http://localhost:54400/__log')).json()).length;
  await new Promise((r) => setTimeout(r, 1500)); // la page de départ est capturée dès l'injection
  const reviewP = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('/html-review.html') });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await review.waitForSelector('#send:not([disabled])');
  ok(
    (await review.isVisible('#attach')) && !(await review.isVisible('fieldset.kinds')),
    'revue : « ajoutées au Sandbox », sans choix du type',
  );
  await review.click('#send');
  await review.waitForURL((u) => u.href.includes(`/demos/${DEMO}/edit`), { timeout: 15000 }).catch(() => {});
  const log = (await (await fetch('http://localhost:54400/__log')).json()).slice(logStart);
  const posts = log.filter((l) => l.m === 'POST');
  ok(!posts.some((l) => l.u.startsWith('/rest/v1/demos')), 'aucune nouvelle démo créée');
  ok(
    posts.some((l) => l.u.startsWith('/rest/v1/steps') && (l.body || '').includes(DEMO)),
    'page ajoutée au Sandbox existant (steps.demo_id)',
  );

  for (const [c, l] of results) console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  await ctx.close();
  process.exit(results.every(([c]) => c) ? 0 : 1);
})();
