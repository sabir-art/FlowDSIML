/**
 * EXT-02 §8 : « Capturer de nouvelles étapes » depuis l'éditeur, de bout en bout avec l'extension
 * construite (faux Supabase). L'« app » est l'origine du faux serveur (WXT_APP_URL) ; 127.0.0.1 est une
 * origine étrangère.
 *  - `fd:ping` : version de l'extension, seulement pour l'origine de l'app ;
 *  - `fd:add-steps` : schéma strict, session de l'extension, démo lisible ; ouvre la page de départ et
 *    démarre la capture, qui vise la démo ;
 *  - barre : pastille de cible ; popup : carte de cible, « Annuler l'ajout » ;
 *  - vérification : « Destination : ajout à … », « Ajouter n étapes » ; aucune démo créée ;
 *  - après l'envoi : étapes créées lues par `fd:add-status`, retour à l'onglet de l'éditeur ;
 *  - une cible vaut pour une capture ; `fd:add-clear` l'efface.
 * Usage : voir external.e2e.cjs (WXT_E2E=1 et WXT_APP_URL=http://localhost:54400).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DEMO = '22222222-2222-4222-8222-222222222222';
const WS = '11111111-1111-1111-1111-111111111111';
const STEP2 = '44444444-4444-4444-8444-444444444442';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const send = (page, m) =>
    page.evaluate(
      ([id, m]) =>
        new Promise((resolve) => {
          if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return resolve('no-channel');
          chrome.runtime.sendMessage(id, m, (r) => resolve(chrome.runtime.lastError ? 'no-response' : r));
        }),
      [extId, m],
    );
  const add = {
    type: 'fd:add-steps',
    v: 1,
    demoId: DEMO,
    workspaceId: WS,
    afterStepId: STEP2,
    url: 'http://localhost:54400/page2',
  };
  const status = (page) => send(page, { type: 'fd:add-status', v: 1, demoId: DEMO });

  ok(manifest.version === '0.3.1', `manifeste : version ${manifest.version}`);
  ok(
    JSON.stringify(manifest.externally_connectable) ===
      JSON.stringify({ matches: ['http://localhost:54400/*'] }),
    'manifeste : canal limité à l’origine de l’app',
  );

  // Origine étrangère : aucun canal, même pour connaître la version
  const foreign = await ctx.newPage();
  await foreign.goto('http://127.0.0.1:54400/page');
  ok((await send(foreign, { type: 'fd:ping', v: 1 })) === 'no-channel', 'origine étrangère : aucun canal');
  await foreign.close();

  // L'éditeur (origine de l'app)
  const editor = await ctx.newPage();
  await editor.goto('http://localhost:54400/page');
  const ping = await send(editor, { type: 'fd:ping', v: 1 });
  ok(
    ping && ping.ok === true && ping.version === '0.3.1',
    `ping : version de l’extension (${JSON.stringify(ping)})`,
  );
  ok(
    Object.keys(ping).sort().join() === 'ok,version',
    'ping : rien d’autre que la version (ni compte ni session)',
  );
  for (const bad of [
    { ...add, jeton: 'x' },
    { ...add, v: 2 },
    { ...add, demoId: 'pas-un-uuid' },
    { ...add, afterStepId: 'x' },
    { ...add, url: 'javascript:alert(1)' },
    { ...add, mode: 'video' },
    { type: 'fd:ping', v: 1, plus: true },
  ]) {
    const r = await send(editor, bad);
    ok(
      r && r.ok === false && r.error === 'schema',
      `message mal formé refusé (${JSON.stringify(bad).slice(0, 70)})`,
    );
  }
  const s0 = await status(editor);
  ok(s0 && s0.ok && s0.state === 'none', 'aucun ajout en cours au départ');
  // Sans session dans l'extension : refusé, aucun onglet ouvert
  const before = ctx.pages().length;
  const r0 = await send(editor, add);
  ok(r0 && r0.ok === false && r0.error === 'signed-out', `sans session : refus (${JSON.stringify(r0)})`);
  ok(ctx.pages().length === before, 'sans session : aucun onglet ouvert');

  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  await editor.bringToFront();

  // Démo que le compte de l'extension ne peut pas lire : refusée
  const rX = await send(editor, { ...add, demoId: '99999999-9999-4999-8999-999999999999' });
  ok(rX && rX.ok === false && rX.error === 'demo', `démo inaccessible : refus (${JSON.stringify(rX)})`);

  // Connecté : la page de départ s'ouvre, la capture démarre et vise la démo
  const opened = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('/page2') });
  const r1 = await send(editor, add);
  const page = await opened;
  ok(r1 && r1.ok === true && r1.started === true, `accepté, capture démarrée (${JSON.stringify(r1)})`);
  const st = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  ok(
    st.recording &&
      (st.mode ?? 'clicks') === 'clicks' &&
      st.addTo?.demoId === DEMO &&
      st.addTo.after?.n === 2,
    'capture d’écran en cours, cible : la démo, après l’étape 2',
  );
  const s1 = await status(editor);
  ok(s1.state === 'recording', `état lu par l’éditeur : ${s1.state}`);
  const rBusy = await send(editor, add);
  ok(rBusy && rBusy.ok === false && rBusy.error === 'busy', 'capture déjà en cours : refus « busy »');

  // Barre : pastille de cible ; le cadre reste disponible
  await page.bringToFront();
  const bar = page.getByRole('toolbar', { name: 'Capture en cours' });
  await bar.waitFor();
  await page.waitForFunction(() =>
    /Démo CRM · après l’étape 2/.test(
      document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.count').textContent,
    ),
  );
  ok(true, 'barre : pastille de cible « Démo CRM · après l’étape 2 »');
  ok(
    (await page
      .getByRole('radiogroup', { name: 'Cadre des prochaines captures' })
      .getByRole('radio')
      .count()) === 3,
    'barre : choix du cadre disponible',
  );
  // Popup ouvert pendant la capture : carte de cible, « Annuler l'ajout »
  await popup.reload();
  await popup.waitForSelector('#recording:not([hidden])');
  ok(
    /Ajout à «\s?Démo CRM\s?» · après l’étape 2/.test(await popup.locator('#target-title').innerText()) &&
      (await popup.locator('#target-after').innerText()) === 'Créer une opportunité' &&
      (await popup.locator('#cancel-label').innerText()) === 'Annuler l’ajout' &&
      (await popup.locator('#setup').isHidden()),
    'popup : carte de cible à la place du formulaire, « Terminer » et « Annuler l’ajout »',
  );
  {
    // Pied du popup : « Annuler l'ajout » part de la gouttière de 16 px, comme le reste
    const left = await popup
      .locator('#cancel-label')
      .evaluate((el) => Math.round(el.getBoundingClientRect().left));
    ok(left === 16, `popup : « Annuler l’ajout » aligné sur la gouttière de 16 px (${left})`);
    ok(
      await popup.evaluate(() => {
        const f = document.getElementById('foot-recording');
        const r = [...f.querySelectorAll('.btn')].map((b) => b.getBoundingClientRect());
        return r.every((x) => x.left >= 16 && x.right <= 344) && f.scrollWidth <= f.clientWidth;
      }),
      'popup : les trois actions du pied tiennent dans la largeur, sans débordement',
    );
    ok(
      (await popup.locator('#count').innerText()).trim() === '0 étape capturée',
      `popup : « 0 étape capturée », au singulier (${(await popup.locator('#count').innerText()).trim()})`,
    );
  }
  if (process.env.SHOTS_DIR) await popup.screenshot({ path: `${process.env.SHOTS_DIR}/popup-ajout.png` });

  // « Revenir à la capture » depuis l'éditeur
  await editor.bringToFront();
  const rF = await send(editor, { type: 'fd:add-focus', v: 1, demoId: DEMO });
  ok(rF && rF.ok === true, '« Revenir à la capture » : onglet de la capture activé');
  await page.bringToFront();
  await page.click('h1');
  await page.waitForFunction(() =>
    /· 1 ·/.test(document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.count').textContent),
  );

  // Vérification : destination, « Ajouter 1 étape »
  const logStart = (await (await fetch('http://localhost:54400/__log')).json()).length;
  const reviewP = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('/review.html') });
  await bar.getByRole('button', { name: 'Terminer' }).click();
  const review = await reviewP;
  await review.waitForSelector('#state.is-done');
  const dest = (await review.locator('#subtitle').innerText()).replace(/\s+/g, ' ');
  ok(
    /^Destination : ajout à « Démo CRM », après l’étape 2 · Créer une opportunité$/.test(dest),
    `vérification : ${dest}`,
  );
  ok(
    (await review.locator('#send-text').innerText()).trim() === 'Ajouter 1 étape',
    'vérification : « Ajouter 1 étape »',
  );
  ok((await status(editor)).state === 'review', 'état lu par l’éditeur : review');
  if (process.env.SHOTS_DIR)
    await review.screenshot({ path: `${process.env.SHOTS_DIR}/verification-ajout.png` });
  const closed = review.waitForEvent('close');
  await review.click('#send');
  await closed;
  ok(true, 'après l’envoi : la vérification se ferme');
  ok(
    await editor.evaluate(() => document.visibilityState === 'visible'),
    'après l’envoi : l’extension rend la main à l’onglet de l’éditeur',
  );
  const log = (await (await fetch('http://localhost:54400/__log')).json()).slice(logStart);
  const posts = log.filter((l) => l.m === 'POST');
  const steps = posts
    .filter((l) => l.u.startsWith('/rest/v1/steps') && l.body)
    .flatMap((l) => [JSON.parse(l.body)].flat());
  ok(!posts.some((l) => l.u.startsWith('/rest/v1/demos')), 'aucune démo créée');
  ok(
    steps.length === 1 && steps[0].demo_id === DEMO && steps[0].position === 8,
    `étape ajoutée à la démo, en fin de liste (position ${steps[0]?.position})`,
  );
  const s2 = await status(editor);
  ok(
    s2.state === 'sent' && s2.stepIds.length === 1 && s2.stepIds[0] === steps[0]?.id,
    'état lu par l’éditeur : étapes envoyées, avec leurs identifiants',
  );
  // L'éditeur accuse réception : la cible ne vaut que pour une capture
  await send(editor, { type: 'fd:add-clear', v: 1, demoId: DEMO });
  ok((await status(editor)).state === 'none', 'cible effacée après l’insertion');
  const after = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  ok(!after.recording && !after.addTo, 'plus de capture ni de cible dans l’extension');

  // « Annuler l'ajout » pendant une capture : capture annulée, cible effacée
  const opened2 = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('/page2') });
  await send(editor, { ...add, afterStepId: null });
  await opened2;
  ok((await status(editor)).state === 'recording', 'seconde demande (« Au début ») : capture en cours');
  await send(editor, { type: 'fd:add-clear', v: 1, demoId: DEMO });
  const end = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  ok(
    !end.recording && (await status(editor)).state === 'none',
    '« Annuler l’ajout » : capture annulée, cible effacée',
  );

  // ===== Capture HTML ajoutée à la démo (extension 0.3.1) : « mode: html » =====
  const opened3 = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('/page2') });
  const rH = await send(editor, { ...add, mode: 'html' });
  const hpage = await opened3;
  ok(rH && rH.ok === true && rH.started === true, `capture HTML acceptée (${JSON.stringify(rH)})`);
  const stH = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  ok(
    stH.recording && stH.mode === 'html' && stH.addTo?.demoId === DEMO,
    'capture HTML en cours, cible : la démo',
  );
  // La page de départ est copiée dès l'injection de la barre
  {
    const until = Date.now() + 15000;
    let n = 0;
    while (n < 1 && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 150));
      n = (await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }))).steps;
    }
    ok(n >= 1, `capture HTML : page de départ copiée (${n})`);
  }
  await hpage.waitForFunction(() =>
    /Démo CRM · après l’étape 2/.test(
      document.querySelector('[data-fd-ui]')?.shadowRoot?.querySelector('.n')?.textContent ?? '',
    ),
  );
  ok(true, 'capture HTML : la barre porte la pastille de cible « Démo CRM · après l’étape 2 »');
  await hpage.bringToFront();
  const logH = (await (await fetch('http://localhost:54400/__log')).json()).length;
  const hreviewP = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('/html-review.html') });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const hreview = await hreviewP;
  await hreview.waitForSelector('#send:not([disabled])');
  const destH = (await hreview.locator('#kline').innerText()).replace(/\s+/g, ' ').trim();
  ok(
    /^Destination : ajout à « Démo CRM », après l’étape 2 · Créer une opportunité$/.test(destH) &&
      !(await hreview.isVisible('#kind')) &&
      !(await hreview.isVisible('#vt')),
    `vérification HTML : ${destH}, sans titre ni choix du type`,
  );
  ok(
    (await hreview.locator('#send').innerText()).trim() === 'Ajouter 1 étape',
    `vérification HTML : « ${(await hreview.locator('#send').innerText()).trim()} »`,
  );
  ok((await status(editor)).state === 'review', 'capture HTML : état lu par l’éditeur, review');
  const closedH = hreview.waitForEvent('close');
  await hreview.click('#send');
  await closedH;
  const postsH = (await (await fetch('http://localhost:54400/__log')).json())
    .slice(logH)
    .filter((l) => l.m === 'POST');
  const stepsH = postsH
    .filter((l) => l.u.startsWith('/rest/v1/steps') && l.body)
    .flatMap((l) => [JSON.parse(l.body)].flat());
  ok(!postsH.some((l) => l.u.startsWith('/rest/v1/demos')), 'capture HTML : aucune démo créée');
  ok(
    stepsH.length === 1 && stepsH[0].kind === 'html' && stepsH[0].demo_id === DEMO,
    `capture HTML : étape de type html ajoutée à la démo (${stepsH.map((x) => x.kind).join()})`,
  );
  const sH = await status(editor);
  ok(
    sH.state === 'sent' && sH.stepIds.length === 1 && sH.stepIds[0] === stepsH[0]?.id,
    'capture HTML : étapes envoyées lues par l’éditeur, avec leurs identifiants',
  );
  ok(
    await editor.evaluate(() => document.visibilityState === 'visible'),
    'capture HTML : retour à l’onglet de l’éditeur',
  );
  await send(editor, { type: 'fd:add-clear', v: 1, demoId: DEMO });
  ok((await status(editor)).state === 'none', 'capture HTML : cible effacée après l’insertion');
  await ctx.close();
})();
