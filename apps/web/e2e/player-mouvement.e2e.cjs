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
  // ===== MOTION-01 §6 : le zoom d'une étape : pastille et bulle suivent par translate, jamais left/top =====
  for (const reduced of [false, true]) {
    const ctx = await b.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'fr-FR',
      ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const zoomed = {
      ...manifest,
      steps: [{ ...first, zoom: { x: 0.2, y: 0.5, scale: 1.6, transition: 'smooth', keep: false } }, last],
    };
    await page.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest: zoomed }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await page.route('**/assets/*.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await page.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    // Relevé dès le premier rendu : animations posées sur la pastille et la bulle, transitions CSS
    await page.addInitScript(() => {
      window.__z = { beacon: null, tip: null, css: [] };
      const tick = () => {
        for (const [k, q] of [
          ['beacon', '.p-stage > .p-beacon'],
          ['tip', '.p-stage > .p-tip'],
        ]) {
          const el = document.querySelector(q);
          if (!el) continue;
          const cs = getComputedStyle(el);
          if (/left|top|all/.test(cs.transitionProperty) && parseFloat(cs.transitionDuration) > 0.001)
            window.__z.css.push(`${k}: ${cs.transitionProperty} ${cs.transitionDuration}`);
          const a = el.getAnimations().find((x) => !x.animationName && x.effect.getKeyframes()[0]?.translate);
          if (a && !window.__z[k]) {
            const tm = a.effect.getTiming();
            window.__z[k] = {
              from: a.effect.getKeyframes()[0].translate,
              props: [...new Set(a.effect.getKeyframes().flatMap((f) => Object.keys(f)))].filter(
                (n) => !/^(offset|easing|composite|computedOffset)$/.test(n),
              ),
              duration: tm.duration,
              easing: tm.easing,
            };
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(`${PLAYER}/#/d/${DEMO}`);
    await page.locator('.p-stage > .p-tip').waitFor();
    await page.waitForFunction(() => /scale\(1\.6\)/.test(document.querySelector('.p-zoom').style.transform));
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.p-stage > .p-beacon, .p-stage > .p-tip')].every(
        (el) => !el.getAnimations().some((x) => !x.animationName),
      ),
    );
    const z = await page.evaluate(() => window.__z);
    const tag = reduced ? 'mouvement réduit, zoom' : 'zoom';
    ok(
      z.css.length === 0,
      `${tag} : aucune transition de left/top sur la pastille ni la bulle (${z.css[0] ?? ''})`,
    );
    if (reduced) {
      ok(!z.beacon && !z.tip, `${tag} : pastille et bulle placées sans mouvement`);
    } else {
      for (const k of ['beacon', 'tip']) {
        const a = z[k];
        ok(
          !!a &&
            a.duration === 600 &&
            a.easing === 'cubic-bezier(0.2, 0.7, 0.2, 1)' &&
            a.props.join() === 'translate' &&
            a.from !== '0px 0px',
          `zoom : ${k === 'beacon' ? 'la pastille' : 'la bulle'} suit par translate seul, 600 ms (${a?.from}, ${a?.props.join()})`,
        );
      }
    }
    // Barre de progression : remplissage pleine largeur déplacé par transform
    const bar = await page.evaluate(() => {
      const track = document.querySelector('.p-progress');
      const fill = track.firstElementChild;
      const cs = getComputedStyle(fill);
      return {
        full: Math.abs(fill.offsetWidth - track.clientWidth) <= 1,
        prop: cs.transitionProperty,
        shown: (fill.getBoundingClientRect().right - track.getBoundingClientRect().left) / track.clientWidth,
        now: track.getAttribute('aria-valuenow'),
      };
    });
    ok(
      bar.full && bar.prop === 'transform' && Math.abs(bar.shown - 0.5) < 0.03 && bar.now === '1',
      `${tag} : barre de progression en transform, à moitié pour l’étape 1 sur 2 (${Math.round(bar.shown * 100)} %)`,
    );
    await ctx.close();
  }
  // ===== MOTION-01 §6 : zone du projecteur pendant un zoom : masquée, puis fondu de 120 ms, sans échelle =====
  for (const reduced of [false, true]) {
    const ctx = await b.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'fr-FR',
      ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const spot = {
      ...manifest,
      steps: [
        {
          ...first,
          zoom: { x: 0.2, y: 0.5, scale: 1.6, transition: 'smooth', keep: false },
          hotspots: first.hotspots.map((h) => ({ ...h, style: 'spotlight' })),
        },
        last,
      ],
    };
    await page.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest: spot }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await page.route('**/assets/*.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await page.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    await page.addInitScript(() => {
      window.__s = { anim: null, css: [], hidden: 0, frames: 0 };
      const tick = () => {
        const el = document.querySelector('.p-stage > .p-spotlight');
        if (el) {
          const cs = getComputedStyle(el);
          if (
            /left|top|width|height|all/.test(cs.transitionProperty) &&
            parseFloat(cs.transitionDuration) > 0.001
          )
            window.__s.css.push(`${cs.transitionProperty} ${cs.transitionDuration}`);
          const a = el.getAnimations().find((x) => !x.animationName);
          if (a) {
            window.__s.frames++;
            if (parseFloat(cs.opacity) === 0) window.__s.hidden++;
            if (!window.__s.anim) {
              const kf = a.effect.getKeyframes();
              window.__s.anim = {
                props: [...new Set(kf.flatMap((f) => Object.keys(f)))].filter(
                  (n) => !/^(offset|easing|composite|computedOffset)$/.test(n),
                ),
                duration: a.effect.getTiming().duration,
                hold: kf[1]?.computedOffset,
              };
            }
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(`${PLAYER}/#/d/${DEMO}`);
    await page.locator('.p-stage > .p-spotlight').waitFor({ state: 'attached' });
    await page.waitForFunction(() => /scale\(1\.6\)/.test(document.querySelector('.p-zoom').style.transform));
    await page.waitForFunction(() => {
      const el = document.querySelector('.p-stage > .p-spotlight');
      return !el.getAnimations().some((x) => !x.animationName) && getComputedStyle(el).opacity === '1';
    });
    const z = await page.evaluate(() => window.__s);
    const tag = reduced ? 'mouvement réduit, projecteur' : 'projecteur';
    ok(
      z.css.length === 0,
      `${tag} : aucune transition de position ni de taille sur la zone (${z.css[0] ?? ''})`,
    );
    if (reduced) ok(!z.anim, `${tag} : la zone est en place sans mouvement`);
    else
      ok(
        !!z.anim &&
          z.anim.props.join() === 'opacity' &&
          z.anim.duration === 720 &&
          Math.abs(z.anim.hold - 600 / 720) < 0.001 &&
          z.hidden >= 2,
        `projecteur : masquée pendant les 600 ms du zoom, puis fondu de 120 ms, opacité seule (${z.anim?.props.join()}, ${z.anim?.duration} ms, ${z.hidden} image(s) masquée(s))`,
      );
    await ctx.close();
  }
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
