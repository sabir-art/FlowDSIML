/**
 * L64 §3 : rédaction automatique. Faux serveur (mock-supabase.cjs) et faux fournisseur, page /propre
 * sans donnée personnelle.
 *  - aucun nom de fournisseur ni de modèle dans les textes de l'extension ;
 *  - réglage en tête des Réglages (encadré, interrupteur, aide), mémorisé ; désactivé et visible quand
 *    l'espace n'autorise pas l'IA ;
 *  - pendant la capture : « Rédaction… » puis « Texte proposé : « … » » dans la carte ; un échec retire la
 *    ligne sans message ;
 *  - seuls le libellé du clic et le titre de la page partent vers l'IA (jamais d'image) ;
 *  - à l'envoi : titre et texte proposés, étape marquée aiText (repère « IA » et « Généré par IA, à vérifier » dans l’éditeur).
 * Usage : comme capture.e2e.cjs (WXT_APP_URL=http://localhost:54400), puis node e2e/redaction.e2e.cjs.
 */
const { chromium } = require('playwright');
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
const MOCK = 'http://localhost:54400';
const setAi = (v) => fetch(`${MOCK}/__ai`, { method: 'POST', body: JSON.stringify(v) });
const journal = async () => (await fetch(`${MOCK}/__log`)).json();

(async () => {
  // Textes de l'extension : aucun nom de fournisseur ni de modèle
  const dir = path.resolve(__dirname, '..');
  const texts = [
    'lib/i18n.ts',
    ...fs
      .readdirSync(path.join(dir, 'lib'))
      .filter((f) => /Strings\.ts$/.test(f))
      .map((f) => `lib/${f}`),
    ...fs
      .readdirSync(path.join(dir, 'entrypoints'))
      .map((d) => `entrypoints/${d}/index.html`)
      .filter((f) => fs.existsSync(path.join(dir, f))),
  ];
  const named = texts.filter((f) =>
    /\b(anthropic|openai|claude|chatgpt|elevenlabs)\b/i.test(fs.readFileSync(path.join(dir, f), 'utf8')),
  );
  ok(
    named.length === 0,
    `aucun nom de fournisseur dans les textes (${texts.length} fichiers ; ${named.join(', ')})`,
  );

  await setAi({ enabled: true, fail: false });
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
  const until = async (f, ms = 10000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await f()) return true;
      await new Promise((r) => setTimeout(r, 120));
    }
    return false;
  };
  const page = await ctx.newPage();
  await page.goto(`${MOCK}/propre`);
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  await popup.waitForTimeout(600);

  // Réglage : encadré en tête des Réglages, aide, mémorisé
  await popup.click('#open-prefs');
  const first = await popup.evaluate(() => {
    const box = document.querySelector('#settings .ai-box');
    return {
      first: box?.previousElementSibling?.classList.contains('sub-head'),
      radius: box && getComputedStyle(box).borderRadius,
      bg: box && getComputedStyle(box).backgroundColor,
    };
  });
  ok(
    first.first &&
      first.radius === '12px' &&
      (await popup.locator('#auto-draft-l').innerText()) === 'Rédaction automatique' &&
      (await popup.locator('#auto-draft-h').innerText()).startsWith('L’IA de TutoClick rédige le titre') &&
      (await popup.locator('#auto-draft').getAttribute('aria-checked')) === 'false',
    'Réglages : « Rédaction automatique » en tête, encadré (rayon 12), aide, désactivée par défaut',
  );
  await popup.click('#auto-draft');
  ok(
    (await popup.evaluate(() => chrome.storage.local.get('fd.autoDraft')))['fd.autoDraft'] === true,
    'réglage mémorisé',
  );
  ok(
    /quota IA de l’espace \(1 crédit par étape\)/.test(await popup.locator('#settings').innerText()),
    'mention du quota sous les réglages',
  );
  if (SHOTS) await popup.screenshot({ path: `${SHOTS}/redaction-reglage.png` });

  // Espace sans IA : l'encadré reste, l'interrupteur est désactivé, la raison est dite
  await setAi({ enabled: false });
  await popup.reload();
  await popup.waitForSelector('#setup:not([hidden])');
  await popup.click('#open-prefs');
  await popup.waitForFunction(
    () => document.getElementById('auto-draft').getAttribute('aria-disabled') === 'true',
  );
  ok(
    (await popup.locator('.ai-box').isVisible()) &&
      (await popup.locator('#auto-draft-h').innerText()) === 'Désactivé par l’espace' &&
      (await popup.locator('#auto-draft').getAttribute('aria-checked')) === 'false',
    'espace sans IA : encadré visible, interrupteur désactivé, « Désactivé par l’espace »',
  );
  await setAi({ enabled: true, delay: 900 });

  // Capture avec la rédaction automatique
  const status = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const tabId = await popup.evaluate(
    async (u) => (await chrome.tabs.query({ url: `${u}/propre*` }))[0].id,
    MOCK,
  );
  const from = (await journal()).length;
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: 'Projets',
        tabId: a.tabId,
        mode: 'clicks',
        autoDraft: true,
      }),
    { tabId, WS },
  );
  await page.bringToFront();
  await page.locator('[data-fd-ui]').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(600);
  const seen = [];
  const watch = setInterval(async () => {
    const t = await page
      .evaluate(() => {
        const a = document.querySelector('[data-fd-ui]')?.shadowRoot?.querySelector('.card .ai');
        return a && !a.hidden ? a.textContent : null;
      })
      .catch(() => null);
    if (t && seen[seen.length - 1] !== t) seen.push(t);
  }, 50);
  await page.click('#nouveau');
  await until(() => seen.some((t) => t.startsWith('Texte proposé')), 5000);
  clearInterval(watch);
  ok(seen[0] === 'Rédaction…', `carte : « Rédaction… » en attendant (${seen.join(' → ')})`);
  ok(
    seen.some((t) => t === 'Texte proposé : « Cliquez sur « Nouveau projet » pour continuer. »'),
    'carte : « Texte proposé : « … » »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/redaction-carte.png` });
  const calls = (await journal()).slice(from).filter((l) => l.u.startsWith('/functions/v1/ai'));
  const sent = calls[0] ? JSON.parse(calls[0].body) : null;
  ok(
    calls.length === 1 &&
      sent.task === 'step_draft' &&
      JSON.stringify(Object.keys(sent.input).sort()) === JSON.stringify(['label', 'page']) &&
      sent.input.label === 'Nouveau projet' &&
      !/data:image|base64/.test(calls[0].body) &&
      calls[0].len < 1000,
    `vers l’IA : seulement le libellé et le titre de la page, aucune image (${calls[0]?.body})`,
  );

  // Échec du fournisseur : la ligne disparaît, sans message
  await setAi({ fail: true });
  await page.waitForTimeout(500);
  await page.click('#filtrer');
  ok(await until(async () => (await status()).steps === 2), 'deuxième étape capturée');
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const c = document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.card');
    return { ai: c.querySelector('.ai').hidden, text: c.textContent };
  });
  ok(
    after.ai && !/erreur|échec/i.test(after.text),
    'échec : la ligne du texte proposé disparaît, sans message',
  );
  // Recette UX lot E : sans réponse en 4 s, la ligne disparaît ; l'étape garde le libellé du clic, sans repère IA
  await setAi({ enabled: true, delay: 6000 });
  await page.waitForTimeout(500);
  const t0 = Date.now();
  await page.click('#nouveau');
  ok(await until(async () => (await status()).steps === 3), 'troisième étape capturée');
  // La carte reste avec « Rédaction… » au-delà de ses 2 s, tant que la réponse est attendue
  await page.waitForTimeout(2500);
  const wait = await page.evaluate(() => {
    const c = document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.card');
    return !c.hidden && c.querySelector('.ai').textContent === 'Rédaction…';
  });
  const gone = await until(
    () =>
      page.evaluate(
        () => document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.card .ai').hidden,
      ),
    8000,
  );
  ok(
    gone && Date.now() - t0 < 7000 && wait,
    `sans réponse en 4 s : « Rédaction… » reste affiché, puis la ligne disparaît sans message (${Date.now() - t0} ms)`,
  );
  await setAi({ fail: false });

  // Envoi : titre et texte proposés, étape marquée « aiText » ; l'autre garde le libellé du clic
  const app = await ctx.newPage();
  await app.goto(`${MOCK}/#/demos`);
  await page.bringToFront();
  const before = (await journal()).length;
  await page.evaluate(() => document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.fin').click());
  await until(() => /#\/demos\/22222222-2222-2222-2222-222222222222\/edit/.test(app.url()), 20000);
  const log = (await journal()).slice(before);
  const steps = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps'))
    .map((l) => JSON.parse(l.body));
  const hots = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/hotspots'))
    .map((l) => JSON.parse(l.body));
  ok(
    steps.length === 3 &&
      steps[0].title === 'Ouvrir Nouveau projet' &&
      steps[0].options?.aiText === true &&
      hots[0]?.body === 'Cliquez sur « Nouveau projet » pour continuer.' &&
      !steps[1].options?.aiText &&
      hots[1]?.title === 'Cliquez sur « Filtrer »' &&
      !steps[2]?.options?.aiText &&
      hots[2]?.title === 'Cliquez sur « Nouveau projet »',
    `envoi : étape 1 avec le titre et le texte proposés (aiText), étapes 2 (échec) et 3 (délai) avec le libellé du clic, sans repère (${JSON.stringify(steps.map((s) => [s.title, !!s.options?.aiText]))})`,
  );
  await setAi({ enabled: true, fail: false });
  await ctx.close();
})();
