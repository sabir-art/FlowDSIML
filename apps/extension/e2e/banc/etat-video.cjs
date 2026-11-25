/**
 * L60, lot B : enregistrement VIDÉO de bout en bout sur le banc, sans écran. Le flux de l'onglet est
 * remplacé par un faux flux (image animée, build WXT_E2E=1 seulement) : l'enregistrement, les repères
 * posés à chaque clic, l'arrêt et l'écran de revue sont réellement exécutés.
 * Prérequis : node e2e/mock-supabase.cjs, node e2e/banc/serveur.cjs, build WXT_E2E=1.
 * Usage : node e2e/banc/etat-video.cjs [SHOTS_DIR=…]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const BANC = 'http://localhost:54410';
const ext = path.resolve(__dirname, '../../.output/chrome-mv3');

(async () => {
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-banc-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto(`${BANC}/app`);
  await page.getByRole('heading', { name: 'Accueil' }).waitFor();
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  const tabId = await popup.evaluate(async (u) => (await chrome.tabs.query({ url: u + '/*' }))[0].id, BANC);
  const started = await popup.evaluate(
    (tabId) =>
      chrome.runtime
        .sendMessage({
          type: 'fd:start',
          workspaceId: '11111111-1111-1111-1111-111111111111',
          title: 'Banc, vidéo',
          tabId,
          mode: 'video',
          streamId: 'fd-e2e-faux-flux',
        })
        .then((r) => JSON.stringify(r ?? null))
        .catch((e) => `erreur : ${e.message}`),
    tabId,
  );
  await page.bringToFront();
  const status = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const until = async (fn, ms = 15000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await fn()) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  };
  ok(
    await until(async () => (await status())?.recording === true || (await status())?.mode === 'video'),
    `l’enregistrement démarre sur le faux flux (${started.slice(0, 120)})`,
  );
  await page.locator('[data-fd-ui]').first().waitFor({ state: 'attached' });
  // Trois gestes d'utilisateur : chacun pose un repère avec un libellé lisible
  // (le service compte les repères : chaque geste attend que le précédent soit compté, comme une
  // personne qui regarde l'écran avant de cliquer de nouveau)
  // et que la fenêtre anti-double-clic de la barre (400 ms) soit passée
  let dernier = 0;
  const reperes = async (n) => {
    const fait = await until(async () => ((await status())?.steps ?? 0) >= n, 8000);
    await until(() => Date.now() - dernier > 450, 2000);
    return fait;
  };
  const clic = async (cible) => {
    await until(() => Date.now() - dernier > 450, 2000);
    await cible.click();
    dernier = Date.now();
  };
  await clic(page.getByRole('link', { name: 'Clients' }));
  await page.getByRole('link', { name: 'Atelier Durand' }).waitFor();
  await reperes(1);
  await clic(page.getByRole('link', { name: 'Atelier Durand' }));
  await page.getByRole('button', { name: 'Ajouter une note' }).waitFor();
  await reperes(2);
  await clic(page.getByRole('button', { name: 'Ajouter une note' }));
  await page.getByText('Note ajoutée').waitFor();
  await reperes(3);
  // L'enregistrement a une durée réelle : on attend que l'état du service l'affiche
  await until(async () => ((await status())?.elapsedMs ?? (await status())?.seconds ?? 2) >= 2, 4000);
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/video-review.html'), { timeout: 30000 });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:video-stop' }).catch(() => undefined));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }).catch(() => undefined));
  const review = await reviewP;
  await review.waitForLoadState('domcontentloaded');
  const v = await review.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('fd-video', 1);
        r.onsuccess = () => {
          const g = r.result.transaction('video').objectStore('video').get('current');
          g.onsuccess = () => {
            const x = g.result;
            if (!x) return res(null);
            const blob = Object.values(x).find((b) => b instanceof Blob && /video/.test(b.type));
            res({
              cles: Object.keys(x),
              octets: blob?.size ?? 0,
              type: blob?.type ?? '',
              dureeMs: x.durationMs ?? x.duration ?? null,
              reperes: (x.marks ?? []).map((m) => ({ label: m.label, manuel: !!m.manual })),
            });
          };
        };
      }),
  );
  if (process.env.DEBUG) console.log('#', JSON.stringify(v));
  ok(
    !!v && v.octets > 5000 && /video\//.test(v.type),
    `une vidéo est enregistrée (${v?.octets} octets, ${v?.type})`,
  );
  ok(!!v && (v.dureeMs ?? 0) >= 500, `elle a une durée réelle (${v?.dureeMs} ms)`);
  const labels = (v?.reperes ?? []).map((r) => r.label);
  ok(
    labels.length >= 3 &&
      labels.includes('Clients') &&
      labels.includes('Atelier Durand') &&
      labels.includes('Ajouter une note') &&
      labels.every((l) => !/[#>{}]|:has\(/.test(l)),
    `un repère par clic, aux libellés lisibles (${JSON.stringify(labels)})`,
  );
  // L'écran de revue lit la vidéo enregistrée
  const played = await review
    .locator('video')
    .first()
    .evaluate(
      (el) =>
        new Promise((res) => {
          const done = () => res({ w: el.videoWidth, h: el.videoHeight, d: el.duration });
          if (el.readyState >= 1) return done();
          el.addEventListener('loadedmetadata', done, { once: true });
          el.addEventListener('error', () => res(null), { once: true });
        }),
    )
    .catch(() => null);
  ok(
    !!played && played.w === 1280 && played.h === 720,
    `la revue affiche la vidéo (${JSON.stringify(played)})`,
  );
  if (process.env.SHOTS_DIR)
    await review.screenshot({ path: `${process.env.SHOTS_DIR}/banc-video-revue.png` });
  await ctx.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
