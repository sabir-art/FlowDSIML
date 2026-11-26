/**
 * L60 §3 : Terminer sans donnée repérée. Pas d'écran de vérification : la barre devient le panneau
 * d'envoi (« Envoi des étapes… n / N », barre de progression, aide), puis l'éditeur s'ouvre dans l'onglet
 * TutoClick déjà ouvert. Contre le faux Supabase (mock-supabase.cjs), page /propre sans donnée personnelle.
 * Usage : comme capture.e2e.cjs (WXT_APP_URL=http://localhost:54400 obligatoire), puis
 * node e2e/terminer.e2e.cjs. SHOTS_DIR pour les captures.
 */
const { chromium } = require('playwright');
// L'éditeur s'ouvre après l'envoi sur le faux serveur : construction vérifiée avant tout
require('./build-app-url.cjs')();
const path = require('path');
const os = require('os');
const fs = require('fs');

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const SHOTS = process.env.SHOTS_DIR;
const WS = '11111111-1111-1111-1111-111111111111';

(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const until = async (f, ms = 15000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await f()) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  };

  const from = (await (await fetch('http://localhost:54400/__log')).json()).length;
  // Onglet de l'app déjà ouvert : c'est lui qui recevra l'éditeur
  const app = await ctx.newPage();
  await app.goto('http://localhost:54400/#/demos');
  const page = await ctx.newPage();
  await page.goto('http://localhost:54400/propre');
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  const status = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/propre*' }))[0].id,
  );
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: 'Projets',
        // L64 §2 : nouvelle démo dans le dossier « Ventes »
        folderId: 'f-ventes',
        tabId: a.tabId,
        mode: 'clicks',
      }),
    { tabId, WS },
  );
  await page.bringToFront();
  await page.locator('[data-fd-ui]').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(600);
  await page.click('#nouveau');
  ok(await until(async () => (await status()).steps === 1), 'première étape capturée');
  await page.waitForTimeout(500);
  await page.click('#filtrer');
  ok(await until(async () => (await status()).steps === 2), 'deuxième étape capturée');
  await page.waitForTimeout(500);

  // Terminer : la barre devient le panneau d'envoi, aucun écran de vérification au premier plan
  const seen = [];
  const watch = setInterval(async () => {
    const t = await page
      .evaluate(() => {
        const r = document.querySelector('[data-fd-ui]')?.shadowRoot;
        const p = r?.querySelector('.snd');
        return p && !p.hidden
          ? { t: p.querySelector('.snd-t').textContent, help: p.querySelector('small').textContent }
          : null;
      })
      .catch(() => null);
    if (t) seen.push(t);
  }, 100);
  await page.evaluate(() => document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.fin').click());
  await page.waitForTimeout(150);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/terminer-envoi.png` }).catch(() => undefined);
  const opened = await until(async () =>
    /#\/demos\/22222222-2222-2222-2222-222222222222\/edit/.test(app.url()),
  );
  clearInterval(watch);
  ok(
    seen.length > 0 &&
      seen.every((x) => /^Envoi des étapes… [0-2] \/ 2$/.test(x.t)) &&
      seen[0].help === 'La démo s’ouvre dans TutoClick dès que c’est prêt. Vous pouvez fermer cet onglet.',
    `Terminer sans donnée repérée : panneau « ${seen
      .map((x) => x.t)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' → ')} », avec l’aide`,
  );
  ok(opened, `l’éditeur s’ouvre dans l’onglet TutoClick déjà ouvert (${app.url()})`);
  const pages = ctx.pages().map((p) => p.url());
  ok(
    !pages.some((u) => u.includes('/review.html')),
    'aucun écran de vérification : l’onglet d’envoi s’est fermé',
  );
  ok(
    await until(() => page.evaluate(() => !document.querySelector('[data-fd-ui]')), 5000),
    'la barre se retire de la page capturée après l’envoi',
  );
  const st = await status();
  ok(!st.recording && st.steps === 0, 'capture terminée');
  const log = async () => (await (await fetch('http://localhost:54400/__log')).json()).slice(from);
  const created = (await log()).filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos'));
  ok(
    created.length === 1 && JSON.parse(created[0].body).folder_id === 'f-ventes',
    `L64 §2 : la nouvelle démo est créée dans le dossier choisi (${created[0]?.body?.slice(0, 120)})`,
  );

  // L64 §2 : Ajouter à une démo existante : pas de nouvelle démo, étapes à la fin, éditeur sans « ready »
  const from2 = (await log()).length + from;
  await page.bringToFront();
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: 'Projets',
        tabId: a.tabId,
        mode: 'clicks',
        appendDemo: { id: '55555555-5555-4555-8555-555555555555', title: 'Créer une facture' },
      }),
    { tabId, WS },
  );
  await page.locator('[data-fd-ui]').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(600);
  await page.click('#nouveau');
  ok(await until(async () => (await status()).steps === 1), 'ajout : étape capturée');
  await page.waitForTimeout(500);
  await app.goto('http://localhost:54400/#/demos');
  await page.bringToFront();
  await page.evaluate(() => document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.fin').click());
  ok(
    await until(() => /#\/demos\/55555555-5555-4555-8555-555555555555\/edit$/.test(app.url())),
    `ajout : l’éditeur de la démo choisie s’ouvre, sans « Démo prête » (${app.url()})`,
  );
  const log2 = (await (await fetch('http://localhost:54400/__log')).json()).slice(from2);
  const steps2 = log2
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps'))
    .map((l) => JSON.parse(l.body));
  ok(
    !log2.some((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos')) &&
      steps2.length === 1 &&
      steps2[0].demo_id === '55555555-5555-4555-8555-555555555555',
    `ajout : aucune démo créée, l’étape va dans la démo choisie (${steps2.length})`,
  );
  await ctx.close();
})();
