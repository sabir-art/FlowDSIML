/**
 * EXT-02 §5 : choisir ce qu'on capture à chaque clic, contre un faux Supabase (mock-supabase.cjs).
 *  - barre d'enregistrement : « Capture · n », segmenté « Page / Élément / Zone » (radiogroup), « Terminer » ;
 *    les clics sur la barre ne créent pas d'étape ; le cadre choisi est annoncé ;
 *  - Élément : au survol, le cadre qui sera gardé ; à la vérification, « Élément cliqué et sa marge » ;
 *  - Zone : tracé au clavier (flèches, Maj + flèches, Entrée), zone gardée pour les clics suivants,
 *    clic hors de la zone signalé ; « Redessiner » ;
 *  - vérification : section « Captures · n », cadre modifiable par capture, image entière gardée ;
 *  - envoi : options.crop sur l'étape (recadrage non destructif), hotspot relatif au cadre.
 * Usage : voir capture.e2e.cjs.
 */
const { chromium } = require('playwright');
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
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:54400/page');
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  const status = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const steps = async (n) => {
    // Attente de l'état réel (le service garde la capture de façon asynchrone), 15 s au plus
    const until = Date.now() + 15000;
    let got = (await status()).steps;
    while (got < n && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 100));
      got = (await status()).steps;
    }
    return got;
  };
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({ type: 'fd:start', workspaceId: a.WS, title: 'Cadres', tabId: a.tabId }),
    { tabId, WS },
  );
  await page.bringToFront();
  /** La pastille dit « n étapes » (L60 §2) : la capture est gardée et la barre est revenue. */
  const counted = (n) =>
    page.waitForFunction(
      (n) =>
        new RegExp(`^${n} étapes?$`).test(
          document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.pill').textContent.trim(),
        ),
      n,
    );

  // ===== Barre =====
  const bar = page.getByRole('toolbar', { name: 'Capture en cours' });
  await bar.waitFor();
  const group = page.getByRole('radiogroup', { name: 'Cadre des prochaines captures' });
  const radio = (name) => group.getByRole('radio', { name });
  ok(
    (await group.getByRole('radio').count()) === 3 &&
      (await radio('Page').getAttribute('aria-checked')) === 'true',
    'barre : segmenté « Page / Élément / Zone », « Page » par défaut',
  );
  ok(
    (await bar.locator('.st').innerText()).replace(/\s+/g, ' ').trim() === 'Captures 0 étape' &&
      (await bar.getByRole('button', { name: 'Terminer' }).count()) === 1,
    `barre : « ${(await bar.locator('.st').innerText()).replace(/\s+/g, ' ').trim()} », « Terminer »`,
  );
  const box = await bar.boundingBox();
  ok(
    Math.abs(box.x + box.width / 2 - 720) <= 2 && box.y + box.height <= 900 - 16,
    'barre : pilule centrée en bas',
  );
  // L60 §2 : capsule de 48 px, contrôles de 36 px sur le même centre ; Pause, puis un clic : pas d'étape
  const geo = await page.evaluate(() => {
    const b = document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.bar');
    const r = b.getBoundingClientRect();
    const ctl = [...b.querySelectorAll(':scope > button, .mid > button, .mid > .seg')].filter(
      (e) => e.getClientRects().length,
    );
    return {
      h: Math.round(r.height),
      bottom: Math.round(innerHeight - r.bottom),
      bg: getComputedStyle(b).backgroundColor,
      hs: ctl.map((e) => Math.round(e.getBoundingClientRect().height)),
      centers: ctl.map((e) =>
        Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2),
      ),
      mid: Math.round(r.top + r.height / 2),
    };
  });
  ok(
    geo.h === 48 &&
      geo.bottom === 20 &&
      geo.bg === 'rgb(22, 24, 29)' &&
      geo.hs.every((h) => h === 36) &&
      geo.centers.every((c) => Math.abs(c - geo.mid) <= 1),
    `barre : 48 px, à 20 px du bas, fond #16181d, contrôles de 36 px sur le même centre (${JSON.stringify(geo)})`,
  );
  await bar.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.nm').textContent === 'En pause',
  );
  ok(
    (await bar.locator('.pz').isVisible()) &&
      (await bar.locator('.pz').innerText()) === 'Vos clics ne sont pas capturés' &&
      (await bar.getByRole('button', { name: 'Reprendre' }).count()) === 1 &&
      (await bar.locator('.mid').isHidden()),
    'Pause : « En pause », « Vos clics ne sont pas capturés », « Reprendre »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/barre-pause.png` });
  await page.click('#go');
  await page.waitForTimeout(800);
  ok((await status()).steps === 0, 'Pause : un clic sur la page ne crée pas d’étape');
  await page.keyboard.press('Alt+Shift+P');
  await page.waitForFunction(
    () => document.querySelector('[data-fd-ui]').shadowRoot.querySelector('.nm').textContent === 'Captures',
  );
  ok(!(await status()).paused, 'Alt + Maj + P : la capture reprend');
  await page.waitForTimeout(450);

  // ===== 1. Page =====
  await page.click('#go');
  ok((await steps(1)) === 1, 'Page : un clic crée une capture');
  await counted(1);
  ok(true, 'barre : pastille « 1 étape » après la capture');

  // ===== 2. Élément =====
  await radio('Élément').click();
  ok(
    (await radio('Élément').getAttribute('aria-checked')) === 'true' && (await status()).steps === 1,
    'un clic sur la barre change le cadre et ne crée pas d’étape',
  );
  await page.waitForFunction(() =>
    /Cadre des prochaines captures\s: élément/.test(
      document.querySelector('[data-fd-ui]').shadowRoot.querySelector('[role=status]').textContent,
    ),
  );
  ok(true, 'le cadre choisi est annoncé (« Cadre des prochaines captures : élément »)');
  await page.hover('#go');
  const kept = page.locator('.kept.el');
  await kept.waitFor();
  const kb = await kept.boundingBox();
  const gb = await page.locator('#go').boundingBox();
  ok(
    Math.round(kb.width) >= 480 &&
      Math.round(kb.height) >= 300 &&
      kb.x <= gb.x &&
      kb.y <= gb.y &&
      /Cadre gardé · élément/.test(await kept.innerText()),
    `Élément : cadre pointillé au survol, ${Math.round(kb.width)} × ${Math.round(kb.height)} px, étiquette`,
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cadre-element.png` });
  await page.click('#go');
  ok((await steps(2)) === 2, 'Élément : capture prise');
  // L'anti double-clic ignore un clic à moins de 400 ms du précédent : on attend la barre à jour
  await counted(2);

  // ===== 3. Zone : tracé au clavier =====
  await radio('Zone').click();
  const zone = page.getByRole('application');
  await zone.waitFor();
  ok(
    (await page.getByText('Tracez la zone à garder').isVisible()) &&
      /^Zone à garder, \d+ × \d+ px\./.test(await zone.getAttribute('aria-label')) &&
      (await page.evaluate(
        () => document.querySelector('[data-fd-ui]').shadowRoot.activeElement?.className,
      )) === 'zone',
    'Zone : voile, encart « Tracez la zone à garder », zone focalisée et nommée',
  );
  // Le voile est autour de la zone ; l'intérieur reste transparent : on voit ce qu'on garde
  const veil = await zone.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, shadow: cs.boxShadow, outline: `${cs.outlineWidth} ${cs.outlineColor}` };
  });
  ok(
    veil.bg === 'rgba(0, 0, 0, 0)' &&
      /rgba\(0, 0, 0, 0\.5\)/.test(veil.shadow) &&
      /^2px rgb\(255, 255, 255\)/.test(veil.outline),
    `Zone : intérieur transparent, voile à 50 % autour, contour blanc de 2 px (${veil.bg})`,
  );
  const z0 = await zone.boundingBox();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const z1 = await zone.boundingBox();
  ok(
    Math.round(z1.x - z0.x) === 8 && Math.round(z1.height - z0.height) === 8,
    'Zone : flèches pour déplacer, Maj + flèches pour redimensionner',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cadre-trace.png` });
  await page.click('#go', { force: true });
  ok((await status()).steps === 2, 'pendant le tracé, un clic ne crée pas d’étape');
  await zone.focus();
  await page.keyboard.press('Enter');
  const keptZone = page.locator('.kept.zn');
  await keptZone.waitFor();
  ok(
    /Cadre gardé · zone/.test(await keptZone.innerText()) &&
      (await bar.getByRole('button', { name: 'Redessiner' }).isVisible()) &&
      (await zone.isHidden()),
    'Zone validée : contour « Cadre gardé · zone », « Redessiner » dans la barre',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cadre-zone.png` });
  // La zone par défaut (20 % → 80 % de la largeur, 15 % → 65 % de la hauteur) contient le titre « Fiche usager »
  const inside = page.getByRole('heading', { name: 'Fiche usager' });
  const ib = await inside.boundingBox();
  const zb = await keptZone.boundingBox();
  await page.mouse.click(zb.x + 40, zb.y + 40);
  ok((await steps(3)) === 3, `Zone : clic dans la zone capturé (titre à ${Math.round(ib?.y ?? 0)} px)`);
  // Clic hors de la zone : page entière gardée pour cette étape
  await counted(3);
  await page.mouse.click(zb.x + zb.width + 60, zb.y + zb.height + 60);
  ok((await steps(4)) === 4, 'Zone : clic hors de la zone capturé');
  // « Échap » pendant un nouveau tracé garde l'ancienne zone
  await bar.getByRole('button', { name: 'Redessiner' }).click();
  await zone.waitFor();
  await page.keyboard.press('Escape');
  ok(
    (await zone.isHidden()) && (await radio('Zone').getAttribute('aria-checked')) === 'true',
    '« Redessiner » puis Échap : la zone précédente est gardée',
  );

  // ===== Vérification =====
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/review.html'));
  await bar.getByRole('button', { name: 'Terminer' }).click();
  const review = await reviewP;
  review.on('pageerror', (e) => errors.push(e.message));
  await review.setViewportSize({ width: 1440, height: 900 });
  await review.waitForSelector('#state.is-done');
  const caps = review.locator('#caps');
  await caps.waitFor();
  ok(
    (await review.locator('#caps-title').innerText()) === 'Captures · 4' &&
      /Recadrage/.test(await review.locator('#caps-help').innerText()),
    'vérification : section « Captures · 4 »',
  );
  const natures = await review.locator('.rv-cap__nature').allInnerTexts();
  ok(
    natures.map((t) => t.trim()).join(' | ') ===
      'Page entière | Élément cliqué et sa marge | Zone tracée | Clic hors de la zone : page entière gardée.'.replace(
        'zone :',
        'zone :',
      ),
    `vérification : nature de chaque cadre (${natures.map((t) => t.trim()).join(' | ')})`,
  );
  // Clic sur un bloc plus grand qu'un bouton : son premier titre, jamais des textes collés
  const names = await review.locator('.rv-cap__text b').allInnerTexts();
  ok(
    names[2] === 'Cliquez sur « App de test »' && names.every((n) => !/projetSuivan/.test(n)),
    `titres des étapes lisibles (${names.join(' | ')})`,
  );
  const seg = (n) => review.getByRole('radiogroup', { name: `Cadre de la capture ${n}` });
  const checked = async (n) => seg(n).locator('[aria-checked=true]').getAttribute('aria-label');
  ok(
    (await checked(1)) === 'Page' && (await checked(2)) === 'Élément' && (await checked(3)) === 'Zone',
    'vérification : segmenté du cadre par capture',
  );
  ok(
    (await seg(1).getByRole('radio', { name: 'Zone' }).getAttribute('aria-disabled')) === 'true',
    'capture prise sans zone : « Zone » désactivé, avec sa raison',
  );
  // Vignette : le cadre en primary ; sur la capture 2 il ne couvre pas toute l'image
  const frame2 = await review
    .locator('.rv-cap')
    .nth(1)
    .locator('.rv-cap__thumb i')
    .evaluate((el) => {
      const p = el.parentElement.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { w: r.width / p.width, h: r.height / p.height };
    });
  ok(
    frame2.w < 0.5 && frame2.h < 0.5,
    `vignette : cadre de l’élément (${Math.round(frame2.w * 100)} % de la largeur)`,
  );
  // Section alignée sur les bords du contenu (grille capture et détections), avant le pied fixe
  const edges = await review.evaluate(() => {
    const r = (q) => document.querySelector(q).getBoundingClientRect();
    return { caps: r('#caps'), main: r('#main'), foot: r('.rv-foot'), vh: innerHeight };
  });
  ok(
    Math.abs(edges.caps.left - edges.main.left) <= 1 &&
      Math.abs(edges.caps.right - edges.main.right) <= 1 &&
      edges.caps.top >= edges.main.bottom,
    'vérification : « Captures · n » sous la grille, alignée sur ses bords',
  );
  ok(
    Math.round(edges.foot.bottom) === edges.vh && Math.round(edges.foot.width) === 1440,
    'vérification : le pied reste fixé en bas, sur toute la largeur',
  );
  if (SHOTS) {
    await review.screenshot({ path: `${SHOTS}/verification-cadre-haut.png` });
    await review.locator('#caps').scrollIntoViewIfNeeded();
    await review.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await review.screenshot({ path: `${SHOTS}/verification-cadre.png` });
  }
  // Changer le cadre d'une capture avant l'envoi : capture 1 de « Page » à « Élément », au clavier
  await seg(1).getByRole('radio', { name: 'Page' }).focus();
  await review.keyboard.press('ArrowRight');
  ok(
    (await checked(1)) === 'Élément' &&
      (await review.locator('.rv-cap__nature').first().innerText()).trim() === 'Élément cliqué et sa marge' &&
      (await review.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Élément',
    'vérification : le cadre se change au clavier, le focus suit',
  );
  // Capture 4 (hors zone) : repasser en « Page »
  await seg(4).getByRole('radio', { name: 'Page' }).click();
  ok((await checked(4)) === 'Page', 'vérification : capture hors zone remise en « Page »');
  await review.setViewportSize({ width: 390, height: 844 });
  ok(
    await review.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    '390 px : pas de défilement horizontal',
  );
  ok(
    (await seg(2).getByRole('radio', { name: 'Élément' }).locator('span').isHidden()) &&
      (await seg(2).getByRole('radio', { name: 'Élément' }).count()) === 1,
    '390 px : icônes seules, nom accessible conservé',
  );
  const foot = await review.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const f = document.querySelector('.rv-foot');
    const [a, b] = [...f.querySelectorAll('.btn')].map(r);
    const p = r(f.querySelector('.rv-privacy'));
    const last = r(document.querySelector('#caps'));
    window.scrollTo(0, document.documentElement.scrollHeight);
    return {
      bottom: Math.round(r(f).bottom),
      width: Math.round(r(f).width),
      vh: innerHeight,
      above: p.bottom <= a.top + 1,
      sameRow: Math.abs(a.top - b.top) <= 1,
      half: Math.abs(a.width - b.width) <= 2,
      // En bas de page, la dernière ligne de la section reste au-dessus du pied
      clear: r(document.querySelector('#caps')).bottom <= r(f).top + 1,
      capsH: Math.round(last.height),
    };
  });
  ok(
    foot.bottom === foot.vh && foot.width === 390 && foot.above && foot.sameRow && foot.half,
    '390 px : pied fixé en bas sur toute la largeur, phrase au-dessus des deux boutons à 50 %',
  );
  ok(foot.clear, '390 px : en bas de page, le pied ne recouvre pas la section « Captures »');
  if (SHOTS) await review.screenshot({ path: `${SHOTS}/verification-cadre-390.png` });
  await review.setViewportSize({ width: 1440, height: 900 });

  // ===== Envoi : recadrage non destructif, hotspot relatif au cadre =====
  const before = (await (await fetch('http://localhost:54400/__log')).json()).length;
  await review.click('#send');
  await review.waitForURL(/22222222-2222-2222-2222-222222222222/, { timeout: 20000 }).catch(() => {});
  const log = (await (await fetch('http://localhost:54400/__log')).json()).slice(before);
  const posted = (table) =>
    log
      .filter((l) => l.m === 'POST' && l.u.startsWith(`/rest/v1/${table}`) && l.body)
      .flatMap((l) => [JSON.parse(l.body)].flat());
  const sent = posted('steps').sort((a, b) => a.position - b.position);
  const crops = sent.map((s) => s.options?.crop ?? null);
  ok(sent.length === 4, `envoi : 4 étapes (${sent.length})`);
  ok(
    crops[0] && crops[1] && crops[2] && crops[3] === null,
    `envoi : options.crop sur les étapes cadrées, pas sur la page entière (${crops.map((c) => (c ? 'cadre' : 'page')).join(', ')})`,
  );
  const c2 = crops[1];
  // Le cadre se juge sur l'image capturée, en pixels CSS : une barre du navigateur (bandeau de débogage)
  // peut la rendre moins haute que la fenêtre du départ (recette du petit lot UX)
  const k = sent[1] ? 1440 / sent[1].image_width : 1;
  const cw = c2 && Math.round(c2.w * sent[1].image_width * k);
  const ch = c2 && Math.round(c2.h * sent[1].image_height * k);
  ok(c2 && cw === 480 && ch === 300, `envoi : cadre « Élément » de 480 × 300 (${cw} × ${ch})`);
  ok(
    sent.every((s) => s.image_width >= 1440),
    'envoi : l’image reste entière (recadrage non destructif)',
  );
  const hot = posted('hotspots');
  const h2 = hot.find((h) => h.step_id === sent[1]?.id);
  ok(
    h2 && h2.x >= 0 && h2.x + h2.w <= 1.0001 && h2.w > gb.width / 1440 + 0.01,
    `envoi : hotspot relatif au cadre (largeur ${h2 && Math.round(h2.w * 100)} % du cadre)`,
  );
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await ctx.close();
})();
