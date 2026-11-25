/**
 * Recette MOTION-01 (docs/ux/specs/motion-01.md §2 et §6) : la scène de l'éditeur suit les panneaux.
 *  - ouverture d'un panneau : la mise en page change d'un coup, la scène (cadre de navigateur et capture)
 *    part de son ancien rectangle (pas de saut) et rejoint le nouveau par `transform` seul, 0,32 s,
 *    cubic-bezier(0.2, 0.8, 0.2, 1) ; à la fin `transform` vaut `none` et `will-change` est retiré ;
 *  - fermeture : mêmes contrôles en sens inverse ; changement de panneau : la scène ne bouge pas ;
 *  - les hotspots gardent leur position relative à la scène, à 1 px près ;
 *  - le panneau entre en glissant (0,32 s) après un geste, jamais au premier affichage ;
 *  - mouvement réduit : la scène n'a jamais de `transform`, durées à 0 s.
 * Les mesures se font image par image dans la page (requestAnimationFrame), sans délai fixe.
 * Faux Supabase, données fictives. Usage : node e2e/mouvement.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

/** Clique un outil du rail (ou « Fermer »), puis relève la scène à chaque image jusqu'à son repos. */
function act(target) {
  const scene = document.querySelector('.stage-inner > .frame');
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  const spot = () => {
    const h = document.querySelector('.canvas-frame .canvas-hotspot');
    const f = document.querySelector('.canvas-frame');
    if (!h || !f) return null;
    const a = h.getBoundingClientRect();
    const b = f.getBoundingClientRect();
    // Position relative à la scène, ramenée à la largeur finale (px)
    return { x: (a.left + a.width / 2 - b.left) / b.width, y: (a.top + a.height / 2 - b.top) / b.height };
  };
  const before = { scene: rect(scene), shot: rect(document.querySelector('.canvas-frame')), spot: spot() };
  const btn =
    target === 'close'
      ? document.querySelector('.ed-tool .ed-tool__head button')
      : document.querySelector(`.ed-rail button[data-tool="${target}"]`);
  btn.click();
  return new Promise((resolve) => {
    const frames = [];
    const t0 = performance.now();
    const tick = () => {
      const cs = getComputedStyle(scene);
      const m = cs.transform === 'none' ? null : new DOMMatrixReadOnly(cs.transform);
      frames.push({
        t: Math.round(performance.now() - t0),
        scale: m ? m.a : null,
        rect: rect(scene),
        duration: cs.transitionDuration,
        easing: cs.transitionTimingFunction,
        property: cs.transitionProperty,
        willChange: cs.willChange,
      });
      const panel = document.querySelector('.ed-tool');
      const moving = scene.style.transform !== '' || (panel && panel.getAnimations().length > 0);
      // Au repos depuis deux images, ou 3 s au plus
      const rest = frames.length > 2 && !moving && frames[frames.length - 2].scale === null;
      if (rest || performance.now() - t0 > 3000) {
        const panelCs = panel ? getComputedStyle(panel) : null;
        resolve({
          before,
          frames,
          after: { scene: rect(scene), shot: rect(document.querySelector('.canvas-frame')), spot: spot() },
          inline: scene.getAttribute('style') || '',
          panel: panelCs && {
            name: panelCs.animationName,
            duration: panelCs.animationDuration,
            easing: panelCs.animationTimingFunction,
          },
        });
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (extra = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', ...extra });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, seed());
    await page.goto(`${APP}/#/demos/${DEMO}/edit`);
    await page.waitForSelector('.canvas-frame img');
    await page.waitForSelector('.canvas-frame .canvas-hotspot');
    return { page, ctx };
  };
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

  // ===== Premier affichage : rien ne bouge =====
  const { page, ctx } = await open();
  ok(
    (await page.evaluate(() => {
      const scene = document.querySelector('.stage-inner > .frame');
      const panel = document.querySelector('.ed-tool');
      return getComputedStyle(scene).transform === 'none' && (!panel || panel.getAnimations().length === 0);
    })) === true,
    'premier affichage : ni scène ni panneau en mouvement',
  );
  // Sans panneau au départ
  if (await page.locator('.ed-tool').count()) {
    await page.evaluate(act, 'close');
    await page.waitForSelector('.ed-tool', { state: 'detached' });
  }

  // ===== Ouverture de « Bouton d'action » =====
  const o = await page.evaluate(act, 'cta');
  const moving = o.frames.filter((f) => f.scale !== null);
  const start = o.before.scene.width / o.after.scene.width;
  ok(
    o.after.shot.width < o.before.shot.width - 50,
    `ouverture : capture de ${Math.round(o.before.shot.width)} à ${Math.round(o.after.shot.width)} px`,
  );
  ok(moving.length >= 2, `ouverture : la scène porte un transform pendant ${moving.length} image(s)`);
  ok(
    moving.length > 0 &&
      near(moving[0].rect.left, o.before.scene.left, 2) &&
      near(moving[0].rect.width, o.before.scene.width, 2) &&
      near(moving[0].rect.top, o.before.scene.top, 2),
    `ouverture : la première image repart de l’ancien rectangle (pas de saut, ${Math.round(moving[0]?.rect.width)} px)`,
  );
  ok(
    moving.every((f) => f.scale <= start + 0.001 && f.scale >= 1 - 0.001) &&
      moving.some((f) => f.scale < start - 0.005 && f.scale > 1.005),
    `ouverture : échelle entre ${start.toFixed(3)} et 1 (${moving
      .map((f) => f.scale.toFixed(2))
      .slice(0, 6)
      .join(', ')}…)`,
  );
  ok(
    moving.slice(1).every((f, i) => f.scale <= moving[i].scale + 0.001),
    'ouverture : l’échelle décroît sans rebond',
  );
  const mid = moving.find((f) => f.duration !== '0s');
  ok(
    mid &&
      mid.duration === '0.32s' &&
      mid.easing === 'cubic-bezier(0.2, 0.8, 0.2, 1)' &&
      mid.property === 'transform' &&
      mid.willChange === 'transform',
    `ouverture : transition de transform seule, ${mid?.duration}, ${mid?.easing}`,
  );
  const last = o.frames[o.frames.length - 1];
  ok(
    last.scale === null && last.willChange === 'auto' && !/transform|transition|will-change/.test(o.inline),
    'ouverture : à la fin, transform none, will-change et transition retirés',
  );
  ok(
    o.before.spot &&
      o.after.spot &&
      near(o.before.spot.x * o.after.shot.width, o.after.spot.x * o.after.shot.width) &&
      near(o.before.spot.y * o.after.shot.height, o.after.spot.y * o.after.shot.height),
    'ouverture : le hotspot garde sa position relative à la scène (1 px)',
  );
  ok(
    o.panel &&
      o.panel.name === 'ed-tool-in' &&
      o.panel.duration === '0.32s' &&
      o.panel.easing === 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    `ouverture : le panneau entre en ${o.panel?.duration}, ${o.panel?.easing}`,
  );

  // ===== Changement de panneau : la scène ne bouge pas =====
  const c = await page.evaluate(act, 'step');
  ok(
    c.frames.every((f) => f.scale === null) && near(c.after.scene.width, c.before.scene.width, 0.5),
    'changement de panneau : aucune animation de la scène',
  );

  // ===== Fermeture =====
  const f = await page.evaluate(act, 'close');
  const fm = f.frames.filter((x) => x.scale !== null);
  const fstart = f.before.scene.width / f.after.scene.width;
  ok(
    f.after.shot.width > f.before.shot.width + 50,
    `fermeture : capture de ${Math.round(f.before.shot.width)} à ${Math.round(f.after.shot.width)} px`,
  );
  ok(
    fm.length >= 2 &&
      near(fm[0].rect.width, f.before.scene.width, 2) &&
      near(fm[0].rect.left, f.before.scene.left, 2),
    'fermeture : la scène repart de l’ancien rectangle',
  );
  ok(
    fm.every((x) => x.scale >= fstart - 0.001 && x.scale <= 1.001) &&
      fm.slice(1).every((x, i) => x.scale >= fm[i].scale - 0.001),
    `fermeture : échelle de ${fstart.toFixed(3)} vers 1, sans rebond`,
  );
  ok(
    f.frames[f.frames.length - 1].scale === null && !/transform|will-change/.test(f.inline),
    'fermeture : à la fin, transform none',
  );
  ok(
    f.before.spot &&
      f.after.spot &&
      near(f.before.spot.x * f.after.shot.width, f.after.spot.x * f.after.shot.width) &&
      near(f.before.spot.y * f.after.shot.height, f.after.spot.y * f.after.shot.height),
    'fermeture : le hotspot garde sa position relative à la scène (1 px)',
  );

  // ===== Interruption : rouvrir pendant le mouvement, sans saut =====
  {
    const r = await page.evaluate(() => {
      const scene = document.querySelector('.stage-inner > .frame');
      const w = () => scene.getBoundingClientRect().width;
      document.querySelector('.ed-rail button[data-tool="cta"]').click();
      return new Promise((resolve) => {
        let n = 0;
        const tick = () => {
          n += 1;
          if (n < 4) return requestAnimationFrame(tick);
          const seen = w();
          document.querySelector('.ed-tool .ed-tool__head button').click();
          requestAnimationFrame(() => resolve({ seen, next: w() }));
        };
        requestAnimationFrame(tick);
      });
    });
    ok(
      Math.abs(r.next - r.seen) < 40,
      `interruption : la scène repart de son état visible (${Math.round(r.seen)} → ${Math.round(r.next)} px)`,
    );
    await page.waitForFunction(() => document.querySelector('.stage-inner > .frame').style.transform === '');
    ok(true, 'interruption : la scène retrouve son repos');
  }
  await ctx.close();

  // ===== Mouvement réduit =====
  {
    const { page: p, ctx: c2 } = await open({ reducedMotion: 'reduce' });
    if (await p.locator('.ed-tool').count()) {
      await p.evaluate(act, 'close');
      await p.waitForSelector('.ed-tool', { state: 'detached' });
    }
    const r = await p.evaluate(act, 'cta');
    ok(
      r.frames.every((x) => x.scale === null),
      'mouvement réduit : la scène n’a jamais de transform',
    );
    ok(
      r.after.shot.width < r.before.shot.width - 50,
      'mouvement réduit : la scène prend sa taille finale tout de suite',
    );
    // Les jetons de durée tombent à 0 ms ; le garde-fou global du mouvement réduit laisse 0,01 ms
    ok(
      r.panel && parseFloat(r.panel.duration) <= 0.001,
      `mouvement réduit : durée du panneau ${r.panel?.duration}`,
    );
    await c2.close();
  }

  // ===== §3 : fenêtres, menus et toasts (liste des démos) =====
  const windows = async (reduced) => {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, seed());
    await page.goto(`${APP}/#/demos`);
    const trigger = page.locator('.demo-card .menu-trigger').first();
    await trigger.waitFor();
    const tag = reduced ? 'mouvement réduit' : 'mouvement';
    const anim = (el) => {
      const cs = getComputedStyle(el);
      // Une animation de 200 ms peut être finie avant la mesure : on lit alors la règle @keyframes.
      let kf = el.getAnimations()[0]?.effect?.getKeyframes?.()[0];
      if (!kf && cs.animationName && cs.animationName !== 'none') {
        for (const sheet of document.styleSheets) {
          let rules;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          for (const r of rules) {
            if (r instanceof CSSKeyframesRule && r.name === cs.animationName) {
              const f = r.findRule('from') || r.findRule('0%');
              if (f) kf = { opacity: f.style.opacity, transform: f.style.transform };
            }
          }
        }
      }
      return {
        name: cs.animationName,
        duration: cs.animationDuration,
        easing: cs.animationTimingFunction,
        from: kf ? `${kf.opacity} ${kf.transform}` : null,
        origin: cs.transformOrigin,
        props: el
          .getAnimations()
          .flatMap((a) =>
            a.effect
              .getKeyframes()
              .flatMap((k) =>
                Object.keys(k).filter((n) => !/^(offset|easing|composite|computedOffset)$/.test(n)),
              ),
          ),
      };
    };
    await trigger.click();
    const menu = page.locator('#fd-portal .menu-list');
    await menu.waitFor();
    const m = await menu.evaluate(anim);
    if (reduced) {
      ok(m.name === 'none' || m.duration === '0s', `${tag} : menu sans animation (${m.name}, ${m.duration})`);
    } else {
      ok(
        m.name === 'fd-pop-in' && m.duration === '0.2s' && m.easing === 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        `menu : ${m.name}, ${m.duration}, ${m.easing}`,
      );
      ok(/^0 scale\(0\.96\)$/.test(m.from || ''), `menu : part de l’opacité 0 et de 96 % (${m.from})`);
      ok(
        m.props.every((n) => n === 'opacity' || n === 'transform'),
        `menu : opacité et transform seulement (${[...new Set(m.props)].join(', ')})`,
      );
    }
    // « Partager » ouvre une fenêtre native
    await menu.getByRole('menuitem', { name: 'Partager' }).click();
    const dialog = page.locator('dialog[open]').first();
    await dialog.waitFor();
    const d = await dialog.evaluate(anim);
    if (reduced) {
      ok(
        d.name === 'none' || d.duration === '0s',
        `${tag} : fenêtre sans animation (${d.name}, ${d.duration})`,
      );
    } else {
      ok(
        d.name === 'fd-modal-in' && d.duration === '0.2s' && d.easing === 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        `fenêtre : ${d.name}, ${d.duration}, ${d.easing}`,
      );
      ok(
        /^0 translateY\(8px\) scale\(0\.98\)$/.test(d.from || ''),
        `fenêtre : part de l’opacité 0, 8 px plus bas, à 98 % (${d.from})`,
      );
      ok(
        d.props.every((n) => n === 'opacity' || n === 'transform'),
        `fenêtre : opacité et transform seulement (${[...new Set(d.props)].join(', ')})`,
      );
      const veil = await dialog.evaluate((el) => {
        const cs = getComputedStyle(el, '::backdrop');
        return `${cs.animationName} ${cs.animationDuration}`;
      });
      ok(veil === 'fd-modal-veil 0.2s', `fenêtre : voile en fondu (${veil})`);
    }
    // Au repos, la fenêtre ne garde aucun transform
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    ok(
      (await dialog.evaluate((el) => getComputedStyle(el).transform)) === 'none',
      `${tag} : fenêtre au repos sans transform`,
    );
    await ctx.close();
  };
  await windows(false);
  await windows(true);

  // ===== §3 : sortie d'une fenêtre (« Nouvelle démo »), 160 ms, opacité et transform =====
  const leave = async (reduced) => {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, seed());
    await page.goto(`${APP}/#/demos`);
    await page
      .getByRole('button', { name: /Nouvelle démo/ })
      .first()
      .click();
    const dialog = page.locator('dialog.fd-modal[open]');
    await dialog.waitFor();
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const r = await page.evaluate(() => {
      const el = document.querySelector('dialog.fd-modal[open]');
      el.querySelector('.fd-modal__close').click();
      const first = {
        open: el.open,
        focusBack: !el.contains(document.activeElement) && document.activeElement !== document.body,
        shown: getComputedStyle(el).display !== 'none',
        box: !!el.querySelector('.fd-modal__box'),
        duration: getComputedStyle(el).transitionDuration.split(',')[0].trim(),
        easing: getComputedStyle(el)
          .transitionTimingFunction.split(/,(?![^(]*\))/)[0]
          .trim(),
        props: getComputedStyle(el).transitionProperty,
      };
      return new Promise((resolve) => {
        const t0 = performance.now();
        const opacities = [];
        let inert = false;
        const tick = () => {
          const cs = getComputedStyle(el);
          opacities.push(Number(cs.opacity));
          if (el.querySelector('.fd-modal__box[inert]')) inert = true;
          const gone = cs.display === 'none' && !el.querySelector('.fd-modal__box');
          if (gone || performance.now() - t0 > 2000) resolve({ first, opacities, gone, inert });
          else requestAnimationFrame(tick);
        };
        tick();
      });
    });
    const tag = reduced ? 'mouvement réduit' : 'sortie';
    ok(r.first.open === false && r.first.focusBack, `${tag} : fenêtre fermée et focus rendu tout de suite`);
    if (reduced) {
      ok(parseFloat(r.first.duration) < 0.001, `${tag} : fermeture sans transition (${r.first.duration})`);
    } else {
      ok(
        r.first.shown && r.first.box && r.inert,
        'sortie : la fenêtre reste affichée avec son contenu, inerte, le temps du fondu',
      );
      ok(
        r.first.duration === '0.16s' &&
          r.first.easing === 'cubic-bezier(0.4, 0, 1, 1)' &&
          r.first.props === 'opacity, transform, overlay, display',
        `sortie : ${r.first.duration}, ${r.first.easing}, ${r.first.props}`,
      );
      ok(
        r.opacities.some((o) => o > 0 && o < 1) &&
          r.opacities.every((o, i) => i === 0 || o <= r.opacities[i - 1] + 0.001),
        'sortie : l’opacité décroît sans rebond',
      );
    }
    ok(r.gone, `${tag} : à la fin, fenêtre masquée et contenu retiré`);
    await ctx.close();
  };
  await leave(false);
  await leave(true);

  // ===== §3 : le soulignement de l'onglet actif glisse d'un onglet à l'autre (Analytics) =====
  const tabs = async (reduced) => {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, seed());
    await page.goto(`${APP}/#/analytics`);
    await page.waitForSelector('.an-tabs2 [role=tab][aria-selected=true]');
    const tag = reduced ? 'mouvement réduit' : 'onglets';
    ok((await page.locator('.fd-tab-glide').count()) === 0, `${tag} : premier affichage sans trait mobile`);
    const r = await page.evaluate(() => {
      const list = document.querySelector('.an-tabs2');
      const all = [...list.querySelectorAll('[role=tab]')];
      const from = all.find((x) => x.getAttribute('aria-selected') === 'true');
      const to = all[all.indexOf(from) + 1];
      const rf = from.getBoundingClientRect();
      const rt = to.getBoundingClientRect();
      to.click();
      return new Promise((resolve) => {
        const frames = [];
        const t0 = performance.now();
        const tick = () => {
          const bar = list.querySelector('.fd-tab-glide');
          if (bar) {
            const a = bar.getAnimations()[0];
            const tm = a?.effect?.getTiming();
            const rb = bar.getBoundingClientRect();
            frames.push({
              left: rb.left,
              width: rb.width,
              props: a ? a.effect.getKeyframes().flatMap((k) => Object.keys(k)) : [],
              duration: tm?.duration,
              easing: tm?.easing,
              selBorder: getComputedStyle(to).borderBottomColor,
            });
          }
          if ((frames.length && !bar) || performance.now() - t0 > 2000) {
            resolve({
              frames,
              from: { left: rf.left, width: rf.width },
              to: { left: rt.left, width: rt.width },
              endBorder: getComputedStyle(to).borderBottomColor,
              left: !!list.querySelector('.fd-tab-glide') || list.hasAttribute('data-tab-gliding'),
            });
          } else requestAnimationFrame(tick);
        };
        tick();
      });
    });
    if (reduced) {
      ok(r.frames.length === 0, `${tag} : l’onglet change sans trait mobile`);
    } else {
      const f = r.frames;
      ok(f.length >= 3, `onglets : un seul trait mobile pendant ${f.length} image(s)`);
      ok(
        f.length > 0 && Math.abs(f[0].left - r.from.left) <= 2 && Math.abs(f[0].width - r.from.width) <= 4,
        `onglets : le trait part de l’ancien onglet (${Math.round(f[0]?.left)} px × ${Math.round(f[0]?.width)}, ${Math.round(r.from.left)} × ${Math.round(r.from.width)} attendus)`,
      );
      ok(
        f.length > 0 && f[0].duration === 200 && f[0].easing === 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        `onglets : 200 ms, ${f[0]?.easing}`,
      );
      ok(
        f.every((x) =>
          x.props.every((n) => n === 'transform' || /^(offset|easing|composite|computedOffset)$/.test(n)),
        ),
        'onglets : transform seul',
      );
      ok(
        f.every((x) => x.selBorder === 'rgba(0, 0, 0, 0)'),
        'onglets : le soulignement propre du nouvel onglet reste masqué pendant le glissement',
      );
      ok(
        !r.left && r.endBorder !== 'rgba(0, 0, 0, 0)',
        'onglets : à la fin, trait retiré et soulignement de l’onglet rétabli',
      );
    }
    await ctx.close();
  };
  await tabs(false);
  await tabs(true);

  // ===== §3 : squelette vers contenu, fondu croisé (page Démos, chargement ralenti) =====
  const skeleton = async (reduced) => {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const data = seed();
    data.homeDelay = 900;
    await install(page, data);
    // Relevé image par image, posé avant le chargement : copie du squelette, contenu, identifiants
    await page.addInitScript(() => {
      window.__sk = {
        ghost: 0,
        both: 0,
        dupIds: 0,
        hidden: true,
        props: [],
        duration: null,
        seenSkeleton: false,
      };
      const tick = () => {
        const g = document.querySelector('.sk-ghost');
        if (document.querySelector('[data-skeleton]')) window.__sk.seenSkeleton = true;
        if (g) {
          const k = window.__sk;
          k.ghost++;
          // Vraies cartes (le squelette a aussi des cartes, sans menu)
          if (document.querySelector('.demo-card .menu-trigger')) k.both++;
          const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
          if (new Set(ids).size !== ids.length) k.dupIds++;
          k.hidden = k.hidden && g.getAttribute('aria-hidden') === 'true' && g.hasAttribute('inert');
          const a = g.getAnimations()[0];
          if (a) {
            k.duration = a.effect.getTiming().duration;
            k.props = [...new Set(a.effect.getKeyframes().flatMap((f) => Object.keys(f)))].filter(
              (n) => !/^(offset|easing|composite|computedOffset)$/.test(n),
            );
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(`${APP}/#/`);
    await page.locator('.demo-card .menu-trigger').first().waitFor();
    await page.waitForFunction(() => !document.querySelector('.sk-ghost'));
    const k = await page.evaluate(() => window.__sk);
    const tag = reduced ? 'mouvement réduit' : 'squelette';
    ok(k.seenSkeleton, `${tag} : le squelette s’est affiché pendant le chargement`);
    if (reduced) ok(k.ghost === 0, `${tag} : le contenu remplace le squelette sans fondu`);
    else {
      ok(
        k.ghost >= 2 && k.both >= 2,
        `squelette : il s’efface au-dessus du contenu déjà affiché (${k.both} image(s))`,
      );
      ok(
        k.duration === 200 && k.props.join() === 'opacity',
        `squelette : fondu de 200 ms, opacité seule (${k.duration} ms, ${k.props.join()})`,
      );
      ok(
        k.hidden && k.dupIds === 0,
        'squelette : copie inerte, masquée aux lecteurs d’écran, sans identifiant en double',
      );
    }
    ok(
      (await page.locator('.sk-ghost, [data-skeleton]').count()) === 0,
      `${tag} : à la fin, plus de squelette`,
    );
    await ctx.close();
  };
  await skeleton(false);
  await skeleton(true);

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
