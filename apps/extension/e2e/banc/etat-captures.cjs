/**
 * L60, lot A : la détection de données personnelles en mode CAPTURES D'ÉCRAN, sur le banc. Un clic sur
 * un bouton de la fiche « /donnees » crée une étape ; ses zones à flouter doivent couvrir le nom et
 * l'adresse e-mail (fictifs), jamais le bouton ni le lien (faux positif corrigé : une phrase cachée
 * « Indiquez votre nom. » faisait du bouton suivant une « valeur de nom »).
 * Prérequis : node e2e/mock-supabase.cjs, node e2e/banc/serveur.cjs, build WXT_E2E=1.
 * Usage : node e2e/banc/etat-captures.cjs
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
  await page.goto(`${BANC}/donnees`);
  await page.getByRole('heading', { name: 'Fiche contact' }).waitFor();
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  const tabId = await popup.evaluate(async (u) => (await chrome.tabs.query({ url: u + '/*' }))[0].id, BANC);
  await popup.evaluate(
    (tabId) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: '11111111-1111-1111-1111-111111111111',
        title: 'Banc, captures',
        tabId,
      }),
    tabId,
  );
  await page.bringToFront();
  await page.locator('[data-fd-ui]').first().waitFor({ state: 'attached' });
  // Rectangles des éléments de la page, en pixels CSS (la page ne défile pas) : recette du petit lot UX,
  // une barre peut s'ouvrir entre le clic et la capture ; les zones se jugent donc sur l'IMAGE de chaque
  // capture, jamais sur la fenêtre du départ
  const boxes = await page.evaluate(() => {
    const r = (sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    };
    return {
      nom: r('#v-nom'),
      mail: r('#v-mail'),
      client: r('#v-client'),
      responsable: r('dl dd'),
      bouton: r('button.btn'),
      lien: r('main a'),
    };
  });
  const steps = () =>
    popup.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'fd:status' })).steps);
  // Trois captures de la même page, sans défilement (anti double-clic de 400 ms respecté)
  let dernier = 0;
  for (const cible of ['button.btn', 'h1', 'button.btn']) {
    const n = await steps();
    while (Date.now() - dernier < 450) await new Promise((r) => setTimeout(r, 50));
    dernier = Date.now();
    await page.locator(cible).first().click();
    const fin = Date.now() + 15000;
    while (Date.now() < fin && (await steps()) <= n) await new Promise((r) => setTimeout(r, 200));
  }
  ok((await steps()) >= 1, 'un clic sur le bouton crée une étape');
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'), { timeout: 20000 });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await review.waitForLoadState('domcontentloaded');
  const captures = await review.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('fd-pending', 1);
        r.onsuccess = () => {
          const g = r.result.transaction('captures').objectStore('captures').getAll();
          g.onsuccess = () => res(g.result.map(({ image, full, ...c }) => c));
        };
      }),
  );
  // Zone en pixels CSS de l'image capturée
  const enPx = (c, z) => {
    const w = c.width / Math.max(1, c.dpr || 1);
    const h = c.height / Math.max(1, c.dpr || 1);
    return { x: z.rect.x * w, y: z.rect.y * h, w: z.rect.w * w, h: z.rect.h * h };
  };
  // La zone recouvre l'élément : son milieu vertical est dans la boîte de l'élément (2 px de marge)
  const couvre = (z, b) => {
    const my = z.y + z.h / 2;
    return z.x < b.x + b.w && z.x + z.w > b.x && my >= b.y - 2 && my <= b.y + b.h + 2;
  };
  const touche = (z, b) => z.x < b.x + b.w && z.x + z.w > b.x && z.y < b.y + b.h && z.y + z.h > b.y;
  if (process.env.DEBUG) console.log('#', JSON.stringify({ boxes, captures }));
  ok(
    boxes.client.y > 300 && boxes.responsable.y > 300,
    `données à plus de 300 px du haut (« Client » à ${Math.round(boxes.client.y)} px, « Responsable » à ${Math.round(boxes.responsable.y)} px)`,
  );
  ok(captures.length >= 3, `trois captures de la même page (${captures.length})`);
  for (const [i, c] of captures.entries()) {
    const zones = (c.detections ?? c.zones ?? []).map((z) => enPx(c, z));
    const manque = ['nom', 'mail', 'client', 'responsable'].filter(
      (k) => !zones.some((z) => couvre(z, boxes[k])),
    );
    ok(
      !manque.length,
      `capture ${i + 1} (image de ${Math.round(c.height / Math.max(1, c.dpr || 1))} px de haut) : chaque zone recouvre son élément, en haut comme à plus de 300 px${manque.length ? ` ; décalées : ${manque.join(', ')}` : ''}`,
    );
    ok(
      !zones.some((z) => touche(z, boxes.bouton)) && !zones.some((z) => touche(z, boxes.lien)),
      `capture ${i + 1} : ni le bouton « Modifier la fiche » ni le lien ne sont repérés : aucun flou à tort`,
    );
  }
  // Page piège (recette UX) : rien de personnel, donc AUCUNE zone repérée, à chaque clic
  {
    await review.close();
    const p2 = await ctx.newPage();
    await p2.goto(`${BANC}/piege`);
    await p2.getByRole('heading', { name: 'Offres' }).waitFor();
    const tab2 = await popup.evaluate(
      async (u) => (await chrome.tabs.query({ url: u + '/piege' }))[0].id,
      BANC,
    );
    await popup.evaluate(
      (tabId) =>
        chrome.runtime.sendMessage({
          type: 'fd:start',
          workspaceId: '11111111-1111-1111-1111-111111111111',
          title: 'Banc, page piège',
          tabId,
        }),
      tab2,
    );
    await p2.bringToFront();
    await p2.locator('[data-fd-ui]').first().waitFor({ state: 'attached' });
    const base = await steps();
    // Le bouton aux textes collés en premier : aucun clic récent, l'anti double-clic (400 ms) ne l'écarte pas
    for (const sel of ['#colle-btn', '#colles', '#ville', 'button.btn']) {
      const n = await steps();
      await p2.locator(sel).first().click();
      const end = Date.now() + 15000;
      while (Date.now() < end && (await steps()) <= n) await new Promise((r) => setTimeout(r, 200));
    }
    const made = (await steps()) - base;
    const rev2 = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'), { timeout: 20000 });
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
    const r2 = await rev2;
    await r2.waitForLoadState('domcontentloaded');
    const caps = await r2.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('fd-pending', 1);
          r.onsuccess = () => {
            const g = r.result.transaction('captures').objectStore('captures').getAll();
            g.onsuccess = () =>
              res(
                g.result.map((c) => ({
                  title: c.title,
                  label: c.label,
                  zones: (c.zones ?? []).map((z) => z.type),
                })),
              );
          };
        }),
    );
    const piege = caps.filter((c) => c.title === 'Offres');
    const total = piege.reduce((n, c) => n + c.zones.length, 0);
    ok(
      made >= 2 && piege.length === made && total === 0,
      `page piège, ${piege.length} captures : ${total} zone(s) repérée(s), 0 attendue (${JSON.stringify(piege.map((c) => c.zones))})`,
    );
    // Recette 277f878 §2 : bouton aux spans collés, premier morceau de texte plutôt que « Cliquez ici »
    const labels = caps.map((c) => c.label);
    ok(
      labels.includes('Créer une note'),
      `bouton aux textes collés : « Créer une note » (${JSON.stringify(labels)})`,
    );
  }
  await ctx.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
