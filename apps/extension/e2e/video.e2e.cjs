/**
 * F7 : tests de bout en bout de la capture vidéo et mobile (faux Supabase, mock-supabase.cjs).
 * Usage : comme capture.e2e.cjs, puis node e2e/video.e2e.cjs. SHOTS_DIR pour les captures.
 * L'enregistrement de l'onglet lui-même (tabCapture) n'est pas pilotable sans écran : l'écran de
 * vérification est alimenté par un enregistrement déposé dans le stockage local de l'extension.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WS = '11111111-1111-1111-1111-111111111111';
(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  // Le faux Supabase peut avoir servi un autre test : seules les requêtes de ce test comptent
  const start = (await (await fetch('http://localhost:54400/__log')).json()).length;
  const getLog = async () => (await (await fetch('http://localhost:54400/__log')).json()).slice(start);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const sfx = process.env.THEME === 'dark' ? '-sombre' : '';
  const shot = (p, name, fullPage = false) =>
    process.env.SHOTS_DIR && p.screenshot({ path: `${process.env.SHOTS_DIR}/${name}${sfx}.png`, fullPage });
  const results = [];
  const ok = (cond, label) => results.push([!!cond, label]);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto('http://localhost:54400/page');
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 340, height: 820 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('#login button[type=submit]');
  await popup.waitForSelector('#setup:not([hidden])');

  // L21-01 : trois cartes de type, options propres à chacun
  const cards = await popup.$$eval('.type-card b', (b) => b.map((x) => x.textContent));
  ok(
    cards.length === 4 &&
      /clic/.test(cards[0]) &&
      /HTML/.test(cards[1]) &&
      /Vidéo/.test(cards[2]) &&
      /mobile/.test(cards[3]),
    'types de capture (clics, HTML, vidéo, mobile)',
  );
  ok(
    (await popup.$('#opt-video[hidden]')) && (await popup.$('#opt-mobile[hidden]')),
    'aucune option en mode clics',
  );
  await popup.click('.type-card:has(input[value=video])');
  ok(await popup.isVisible('#opt-video'), 'options vidéo affichées');
  ok(!(await popup.isChecked('#webcam')), 'webcam désactivée par défaut');
  ok(
    await popup.$eval('#opt-video input[disabled]', (i) => i.checked),
    'vérification des données toujours active',
  );
  ok(/enregistrement/.test(await popup.textContent('#start')), 'bouton « Démarrer l’enregistrement »');
  await popup.keyboard.press('ArrowDown');
  ok(await popup.isChecked('input[value=mobile]'), 'les cartes se parcourent au clavier');
  ok(await popup.isVisible('#opt-mobile'), 'options mobile affichées');
  await popup.selectOption('#device', 'custom');
  ok(await popup.isVisible('#custom-size'), 'taille personnalisée');
  await popup.selectOption('#device', 'phone');
  await shot(popup, 'l21-01-popup-mobile', true);
  await popup.click('.type-card:has(input[value=video])');
  await shot(popup, 'l21-01-popup-video', true);
  // L21-01 : carte « Capture HTML » choisie
  await popup.click('.type-card:has(input[value=html])');
  ok(await popup.isChecked('input[value=html]'), 'carte « Capture HTML » sélectionnable');
  await shot(popup, 'l21-01-popup-html', true);
  await popup.click('.type-card:has(input[value=clicks])');

  // Format mobile : l'onglet est émulé (390 px, tactile), la démo est créée en mobile
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  const st = await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: 'Mobile',
        tabId: a.tabId,
        mode: 'mobile',
        viewport: { w: 390, h: 844 },
      }),
    { tabId, WS },
  );
  await page.bringToFront();
  await page.waitForTimeout(800);
  const emu = await page.evaluate(() => ({ w: screen.width, touch: navigator.maxTouchPoints }));
  ok(st.recording && st.mode === 'mobile', 'capture mobile démarrée');
  ok(emu.w === 390 && emu.touch > 0, `onglet émulé en 390 px tactile (${emu.w}, ${emu.touch})`);
  await page.click('#go');
  await page.waitForTimeout(2500);
  const stM = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  ok(stM.steps === 1 && !stM.lastError, `un toucher crée une capture (${stM.lastError ?? ''})`);
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const review = await reviewP;
  await page.waitForTimeout(500);
  ok((await page.evaluate(() => screen.width)) > 390, 'émulation retirée à la fin');
  await review.waitForSelector('#state.is-done');
  await review.click('#send');
  await review.waitForURL(/22222222/, { timeout: 15000 }).catch(() => {});
  let log = await getLog();
  const demoPost = log.find((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos'));
  const demoBody = demoPost && JSON.parse(demoPost.body);
  ok(demoBody?.device === 'mobile' && demoBody.viewport?.w === 390, 'démo créée en mobile avec sa taille');
  const capM = log.find((l) => l.u.startsWith('/storage/v1/object/captures/'));
  ok(capM && capM.len > 1000, 'capture mobile téléversée');

  // L21-02 : barre d'enregistrement et flou incrusté dans la page
  await popup.evaluate(
    (tabId) => chrome.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/videobar.js'] }),
    tabId,
  );
  await page.bringToFront();
  await page.waitForTimeout(1200);
  const bar = await page.evaluate(() => {
    const host = [...document.querySelectorAll('[data-fd-ui]')].find((e) => e.shadowRoot);
    const r = host?.shadowRoot;
    return {
      timer: !!r?.querySelector('[role=timer]'),
      buttons: [...(r?.querySelectorAll('button') ?? [])].map(
        (b) => b.getAttribute('title') ?? b.textContent,
      ),
      blurred: document.querySelectorAll('[data-fd-blur]').length,
    };
  });
  ok(bar.timer, 'chronomètre role=timer');
  ok(
    bar.buttons.some((t) => /Alt \+ Maj \+ M/.test(t)),
    'raccourcis rappelés au survol',
  );
  ok(bar.blurred >= 5, `données personnelles floutées dans la page (${bar.blurred})`);
  await shot(page, 'l21-02-barre');
  await page.reload();

  // L21-03 : vérification des images clés, puis envoi par reprise
  const fixture = fs
    .readFileSync(path.resolve(__dirname, '../../web/e2e/fixture-video.webm'))
    .toString('base64');
  const seed = async (big) =>
    popup.evaluate(
      async (a) => {
        const bytes = Uint8Array.from(atob(a.fixture), (c) => c.charCodeAt(0));
        const blob = a.big
          ? new Blob([new Uint8Array(52 * 1024 * 1024)], { type: 'video/webm' })
          : new Blob([bytes], { type: 'video/webm' });
        const frame = async (hue) => {
          const c = new OffscreenCanvas(640, 400);
          const g = c.getContext('2d');
          g.fillStyle = `hsl(${hue} 50% 80%)`;
          g.fillRect(0, 0, 640, 400);
          g.fillStyle = '#333';
          g.font = '32px sans-serif';
          g.fillText('Acme — exemple', 40, 80);
          return c.convertToBlob({ type: 'image/webp' });
        };
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('fd-video', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('video', { keyPath: 'id' });
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const v = {
          id: 'current',
          blob,
          mime: 'video/webm',
          durationMs: 8000,
          marks: [
            {
              t: 1200,
              label: 'Créer un projet',
              manual: false,
              zones: [
                { x: 0.1, y: 0.2, w: 0.25, h: 0.08 },
                { x: 0.55, y: 0.6, w: 0.2, h: 0.08 },
              ],
            },
            { t: 1800, label: 'Créer un projet', manual: false, zones: [] },
            { t: 4200, label: 'Étape marquée', manual: true, zones: [{ x: 0.3, y: 0.3, w: 0.3, h: 0.1 }] },
            { t: 6500, label: 'Enregistrer', manual: false, zones: [] },
          ],
          frames: [await frame(200), await frame(210), await frame(120), await frame(30)],
          hasVoice: false,
          micDenied: true,
          blurredZones: 7,
          workspaceId: a.WS,
          title: 'Vidéo test',
          device: 'desktop',
          viewport: null,
          url: 'http://localhost:54400/page',
        };
        await new Promise((res, rej) => {
          const t = db.transaction('video', 'readwrite');
          t.objectStore('video').put(v);
          t.oncomplete = res;
          t.onerror = () => rej(t.error);
        });
      },
      { fixture, big, WS },
    );
  await seed(true);
  const vr = await ctx.newPage();
  await vr.setViewportSize({ width: 1280, height: 900 });
  vr.on('pageerror', (e) => console.log('# pageerror', e.message));
  await vr.goto(`chrome-extension://${extId}/video-review.html`);
  await vr.waitForSelector('#frames li');
  ok(
    /Raccourcissez ou découpez l’enregistrement/.test(await vr.textContent('#alert')),
    'au-delà de 50 Mo : message clair',
  );
  ok(await vr.isDisabled('#send'), 'au-delà de 50 Mo : envoi impossible');
  ok(
    /Envoi impossible : la vidéo pèse [\d,]+\s?Mo, 50\sMo au plus/.test(
      (await vr.textContent('#reason')).replace(/\u00a0/g, ' '),
    ) && (await vr.getAttribute('#send', 'aria-describedby')) === 'reason',
    'au-delà de 50 Mo : raison liée au bouton désactivé',
  );
  await shot(vr, 'l21-03-trop-lourd', true);
  await seed(false);
  await vr.reload();
  await vr.waitForSelector('#frames li');
  ok(await vr.isHidden('#alert'), 'sous 50 Mo : pas d’alerte');
  ok((await vr.$$('#frames li')).length === 3, 'clics rapprochés fusionnés (3 images clés)');
  ok(
    /^3 zones floutées repérées/.test(await vr.textContent('#blurred')),
    'nombre de zones issu de la détection',
  );
  ok(
    (await vr.textContent('#meta')).includes('00:12') && !(await vr.textContent('#meta')).includes('00:08'),
    'une seule durée : celle de la vidéo',
  );
  ok(
    await vr.$$eval('#frames img', (i) =>
      i.every((x) => x.alt && x.naturalWidth > 0 && x.src.startsWith('data:image')),
    ),
    'images clés tirées de la vidéo, avec texte alternatif',
  );
  ok((await vr.$$('#frames .zone')).length === 3, 'zones floutées visibles sur les images clés');
  // Ajuster : clavier (déplacer, redimensionner), ajouter, retirer
  const z0 = vr.locator('[data-zone="0-0"]');
  const before0 = await z0.boundingBox();
  await z0.focus();
  await vr.keyboard.press('ArrowRight');
  await vr.keyboard.press('Shift+ArrowDown');
  const after0 = await z0.boundingBox();
  ok(after0.x > before0.x && after0.height > before0.height, 'zone déplacée et redimensionnée au clavier');
  await vr.getByRole('button', { name: /Ajouter une zone · Pause 2/ }).click();
  ok((await vr.$$('#frames .zone')).length === 4, 'zone ajoutée');
  await vr.getByRole('button', { name: 'Retirer la zone 2 de l’image 1' }).click();
  ok((await vr.$$('#frames .zone')).length === 3, 'zone retirée');
  await vr.waitForFunction(() => document.querySelector('video').readyState >= 1);
  await shot(vr, 'l21-03-verification', true);
  await vr.click('#send');
  await vr.waitForURL(/22222222-2222-2222-2222-222222222222(\/|%2F)edit/, { timeout: 15000 }).catch(() => {});
  ok(/22222222/.test(vr.url()), 'après envoi : ouverture de l’éditeur');
  log = await getLog();
  const tus = log.filter((l) => l.u.startsWith('/storage/v1/upload/resumable') && l.tus);
  const tmeta = tus[0]?.tus.meta ?? {};
  ok(
    tus.length >= 1 && tmeta.bucketName === 'videos' && tus[0].tus.auth,
    'vidéo envoyée par reprise (TUS) dans le bucket videos',
  );
  ok(
    new RegExp(`^${WS}/22222222-2222-2222-2222-222222222222/[0-9a-f-]{36}\\.webm$`).test(
      tmeta.objectName ?? '',
    ),
    'chemin de la vidéo conforme',
  );
  ok(tmeta.contentType === 'video/webm', 'type video/webm');
  const stepPost = log.filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps')).pop();
  const step = stepPost && JSON.parse(stepPost.body);
  ok(
    step?.kind === 'video' &&
      step.video_path === tmeta.objectName &&
      Math.abs(step.video_duration_ms - 12008) < 100,
    'étape vidéo créée',
  );
  ok(
    step?.video.pauses.length === 3 && step.video.pauses[0].title === 'Créer un projet',
    'pauses-étapes proposées',
  );
  ok(Object.keys(step?.video.frames ?? {}).length === 3, 'images des pauses téléversées (zones incrustées)');
  ok(step?.video.autoplayMuted === true && step.video.hasVoice === false, 'lecture muette, sans voix');
  const after = await popup.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('fd-video', 1);
        r.onsuccess = () => {
          const g = r.result.transaction('video').objectStore('video').get('current');
          g.onsuccess = () => res(!!g.result);
        };
      }),
  );
  ok(!after, 'enregistrement local effacé après envoi');

  // Supprimer l'enregistrement : rien n'est envoyé
  await seed(false);
  const before = log.length;
  await vr.goto(`chrome-extension://${extId}/video-review.html`);
  await vr.waitForSelector('#frames li');
  // Vrai bouton, confirmation dans la page : « Annuler » rend le focus au bouton
  await vr.focus('#delete');
  await vr.keyboard.press('Enter');
  ok(await vr.isVisible('#confirm'), 'supprimer : confirmation demandée');
  await shot(vr, 'l21-01-supprimer', true);
  await vr.click('#confirm-no');
  ok(await vr.evaluate(() => document.activeElement?.id === 'delete'), 'annuler : focus rendu au bouton');
  await vr.click('#delete');
  const closed = vr.waitForEvent('close').catch(() => null);
  await vr.click('#confirm-yes');
  await closed;
  const log2 = await getLog();
  ok(
    !log2.slice(before).some((l) => l.u.startsWith('/storage/') || l.u.startsWith('/rest/v1/demos')),
    'supprimer n’envoie rien',
  );

  await ctx.close();
  for (const [c, l] of results) console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (results.some(([c]) => !c)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
