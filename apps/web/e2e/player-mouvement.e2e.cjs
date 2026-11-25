/**
 * MOTION-01 §3 « Lecteur : changement d'étape » : la capture quittée s'efface en fondu croisé au-dessus de
 * la nouvelle (200 ms, opacité seule) ; la bulle entre en opacité, 4 px plus bas ; rien au premier
 * affichage ni en mouvement réduit. Manifeste construit pour l'occasion (deux captures différentes).
 * Usage : node e2e/player-mouvement.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));

const base = require('./player-ux.manifest.cjs');
// Trois étapes image : la deuxième reprend la première (bulle comprise) avec une autre capture, pour
// contrôler le fondu entre deux captures différentes et l'entrée de la bulle
const [first, last] = base.steps;
const manifest = {
  ...base,
  steps: [
    { ...first, zoom: null },
    {
      ...first,
      id: '0b5c1f0e-0000-4000-8000-0000000000b2',
      zoom: null,
      image: { ...first.image, url: 'assets/b.webp' },
      hotspots: first.hotspots.map((h, k) => ({ ...h, id: `0b5c1f0e-0000-4000-8000-00000000c${k}b2` })),
    },
    last,
  ],
};
const DEMO = manifest.demoId;

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Relevé image par image : capture quittée, capture en place, bulle. */
function sampler() {
  window.__m = { ghost: 0, both: 0, imgs: 1, anim: null, props: [], tip: null, change: false };
  const tick = () => {
    const k = window.__m;
    const g = document.querySelector('.p-img-out');
    k.imgs = Math.max(k.imgs, document.querySelectorAll('.p-img').length);
    if (document.querySelector('.p-stage.is-step-change')) k.change = true;
    if (g) {
      k.ghost++;
      if (document.querySelector('.p-img')) k.both++;
      const a = g.getAnimations()[0];
      if (a) {
        const cs = getComputedStyle(g);
        k.anim = `${cs.animationName} ${cs.animationDuration} ${cs.animationTimingFunction}`;
        k.props = [...new Set(a.effect.getKeyframes().flatMap((f) => Object.keys(f)))].filter(
          (n) => !/^(offset|easing|composite|computedOffset)$/.test(n),
        );
      }
    }
    const tip = document.querySelector('.p-stage.is-step-change > .p-tip');
    if (tip && !k.tip) {
      const cs = getComputedStyle(tip);
      const a = tip.getAnimations()[0];
      k.tip = {
        anim: `${cs.animationName} ${cs.animationDuration}`,
        from: a ? JSON.stringify(a.effect.getKeyframes()[0]) : '',
      };
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const reduced of [false, true]) {
    const ctx = await b.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'fr-FR',
      ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await page.route('**/assets/*.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await page.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    await page.addInitScript(sampler);
    await page.goto(`${PLAYER}/#/d/${DEMO}`);
    await page.locator('.p-stage > .p-tip').waitFor();
    const tag = reduced ? 'mouvement réduit' : 'lecteur';

    // Premier affichage : ni capture en fondu, ni bulle animée
    const first = await page.evaluate(() => ({
      ...window.__m,
      tipAnim: getComputedStyle(document.querySelector('.p-stage > .p-tip')).animationName,
    }));
    ok(
      first.ghost === 0 && !first.change && first.tipAnim === 'none',
      `${tag} : premier affichage sans fondu ni bulle animée`,
    );

    // Étape suivante
    await page.getByRole('button', { name: 'Suivant' }).last().click();
    // La nouvelle capture est en place, la bulle est là et la capture quittée a fini de s'effacer
    await page.waitForFunction(
      () =>
        (document.querySelector('.p-img')?.getAttribute('src') ?? '').includes('b.webp') &&
        !!document.querySelector('.p-stage > .p-tip') &&
        !document.querySelector('.p-img-out'),
      null,
      { timeout: 15000 },
    );
    const k = await page.evaluate(() => window.__m);
    if (reduced) {
      ok(k.ghost === 0, `${tag} : la capture change sans fondu`);
      ok(!k.change, `${tag} : la bulle apparaît sans mouvement`);
    } else {
      ok(
        k.ghost >= 2 && k.both >= 2,
        `lecteur : la capture quittée reste au-dessus de la nouvelle (${k.both} image(s))`,
      );
      ok(
        k.anim === 'p-img-out 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' && k.props.join() === 'opacity',
        `lecteur : fondu de 200 ms, opacité seule (${k.anim}, ${k.props.join()})`,
      );
      ok(
        k.tip &&
          k.tip.anim === 'p-tip-in 0.2s' &&
          /"opacity":"0"/.test(k.tip.from) &&
          /"translate":"0px 4px"/.test(k.tip.from),
        `lecteur : la bulle entre en opacité, 4 px plus bas, 200 ms (${k.tip?.anim})`,
      );
    }
    ok(k.imgs === 1, `${tag} : une seule capture d’étape dans la page (la capture quittée est décorative)`);
    ok(
      (await page.locator('.p-img-out').count()) === 0 &&
        (await page.locator('.p-img').evaluate((el) => el.getAttribute('src'))).includes('b.webp'),
      `${tag} : à la fin, seule la nouvelle capture reste`,
    );
    await ctx.close();
  }
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
