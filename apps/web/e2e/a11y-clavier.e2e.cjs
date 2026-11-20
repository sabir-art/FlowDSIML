/**
 * L24 : contrôles d'accessibilité que l'audit axe ne couvre pas (RGAA 7, 10, 12, 13) :
 * lien d'évitement, focus visible, piège et retour du focus des modales, zone des messages,
 * animations réduites, zoom 200 % sans défilement horizontal, lecteur au clavier et annoncé.
 * Usage : app web (:5173) et player (:5174) lancés, puis `node e2e/a11y-clavier.e2e.cjs`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const { seedPathTables, learnersFixture } = require('./learners-data.cjs');
const { centerFixture, seedCenterTables } = require('./center-data.cjs');
const { seedExport } = require('./export-data.cjs');

const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  async function app(
    route,
    { seed, viewport = { width: 1440, height: 900 }, reduced = false, signedOut = false } = {},
  ) {
    const ctx = await b.newContext({
      viewport,
      locale: 'fr-FR',
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const data = seedMaquette();
    if (seed) seed(data);
    await install(p, { ...data, signedOut });
    await p.goto(`${APP}${route}`);
    await p.waitForTimeout(1200);
    return { p, ctx };
  }

  async function player(path, { viewport = { width: 1440, height: 900 }, reduced = false, center } = {}) {
    const manifest = require('./player-maquette.cjs');
    const ctx = await b.newContext({
      viewport,
      locale: 'fr-FR',
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const json = (r, body) =>
      r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: cors })
        : r.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: cors });
    await p.route('**/functions/v1/**', (r) => json(r, {}));
    await p.route('**/functions/v1/open-demo', (r) => json(r, { status: 'ok', manifest }));
    await p.route('**/functions/v1/open-center', (r) => json(r, center ? center() : {}));
    await p.route('**/rest/v1/rpc/**', (r) => json(r, null));
    await p.route('**/assets/**', (r) =>
      r.fulfill({
        contentType: 'image/png',
        body: fs.readFileSync(`${__dirname}/fixture.png`),
        headers: cors,
      }),
    );
    await p.goto(`${PLAYER}/#${path}`);
    await p.waitForTimeout(1200);
    return { p, ctx };
  }

  /** Parcourt la page au clavier et renvoie les éléments focalisés sans indicateur visible. */
  async function tabWalk(p, n) {
    const missing = new Set();
    // L34 (WCAG 2.4.11) : élément focalisé entièrement caché par un autre (barre collante, panneau)
    const obscured = new Set();
    let seen = 0;
    for (let i = 0; i < n; i++) {
      await p.keyboard.press('Tab');
      const r = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const shadow = cs.boxShadow && cs.boxShadow !== 'none';
        // Interrupteurs : l'indicateur est porté par la piste voisine
        const sib = el.nextElementSibling ? getComputedStyle(el.nextElementSibling) : null;
        // Champ dont le cadre parent porte l'indicateur (:focus-within)
        // (contenteditable compris : le champ riche à variables porte l'anneau sur son cadre, jusqu'à 3 niveaux)
        const ring = (s) =>
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
          (s.boxShadow && s.boxShadow !== 'none');
        let parent = false;
        if (el.matches('input, textarea, select, [contenteditable="true"]')) {
          let a = el.parentElement;
          for (let k = 0; a && k < 3 && !parent; k++, a = a.parentElement) parent = ring(getComputedStyle(a));
        }
        const sibling =
          el.matches('input[type=checkbox], input[type=radio]') &&
          sib &&
          ((sib.outlineStyle !== 'none' && parseFloat(sib.outlineWidth) > 0) ||
            (sib.boxShadow && sib.boxShadow !== 'none'));
        const name =
          el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : '') +
          (el.className && typeof el.className === 'string'
            ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
            : '') +
          ` « ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)} »`;
        // Focus non masqué : au moins un des 5 points de la boîte touche l'élément (ou un parent, un enfant)
        const box = el.getBoundingClientRect();
        let hidden = false;
        if (box.width > 2 && box.height > 2) {
          hidden = true;
          for (const [fx, fy] of [
            [0.5, 0.5],
            [0.2, 0.2],
            [0.8, 0.2],
            [0.2, 0.8],
            [0.8, 0.8],
          ]) {
            const x = box.left + box.width * fx;
            const y = box.top + box.height * fy;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit && (hit === el || el.contains(hit) || hit.contains(el))) {
              hidden = false;
              break;
            }
          }
        }
        return { visible: outline || shadow || sibling || parent, hidden, name };
      });
      if (!r) continue;
      seen++;
      if (!r.visible) missing.add(r.name);
      if (r.hidden) obscured.add(r.name);
    }
    return { seen, missing: [...missing], obscured: [...obscured] };
  }

  // 1. Lien d'évitement
  {
    const { p, ctx } = await app('/#/');
    await p.keyboard.press('Tab');
    ok(
      await p.evaluate(() => document.activeElement?.classList.contains('skip-link')),
      'Évitement : premier arrêt du clavier',
    );
    await p.keyboard.press('Enter');
    await p.waitForTimeout(200);
    ok(
      await p.evaluate(() => !!document.activeElement?.closest('main, #main')),
      'Évitement : Entrée amène le focus dans le contenu principal',
    );
    await ctx.close();
  }

  // 1 bis. Titre de page et focus au changement d'écran (A11Y-01, A11Y-02)
  {
    const { p, ctx } = await app('/#/');
    ok(
      (await p.title()) === 'Démos · TutoClick',
      `A11Y-01 : titre « Démos · TutoClick » (${await p.title()})`,
    );
    await p.getByRole('link', { name: 'Analytics' }).first().click();
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({
      title: document.title,
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent,
    }));
    ok(
      / · TutoClick$/.test(r.title) && r.title !== 'Démos · TutoClick',
      `A11Y-01 : titre mis à jour (${r.title})`,
    );
    ok(
      r.tag === 'H1',
      `A11Y-02 : focus sur le h1 du nouvel écran (${r.tag} « ${(r.text || '').trim().slice(0, 30)} »)`,
    );
    await ctx.close();
    const e = await app(`/#/demos/${DEMO}/edit`);
    await e.p.waitForTimeout(600);
    ok(
      /Créer|Démo|démo/.test(await e.p.title()) && / · TutoClick$/.test(await e.p.title()),
      `A11Y-01 : titre de l’éditeur avec la démo (${await e.p.title()})`,
    );
    await e.ctx.close();
  }

  // 1 ter. Références ARIA et identifiants (A11Y-08, A11Y-09)
  for (const [name, route, seed] of [
    ['Démos', '/#/'],
    ['Éditeur', `/#/demos/${DEMO}/edit`],
    ['Partager', `/#/demos/${DEMO}/share`],
    ['Analytics', '/#/analytics'],
    [
      'Apprenants',
      '/#/learners',
      (d) => {
        seedPathTables(d.tables, d.tables.workspaces[0].id);
        d.learners = learnersFixture().progress;
      },
    ],
    ['Centre (réglages)', '/#/center', (d) => seedCenterTables(d)],
  ]) {
    const { p, ctx } = await app(route, { seed });
    const r = await p.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
      const broken = [];
      for (const attr of [
        'aria-controls',
        'aria-labelledby',
        'aria-describedby',
        'aria-owns',
        'aria-activedescendant',
      ])
        for (const el of document.querySelectorAll(`[${attr}]`))
          for (const ref of el.getAttribute(attr).split(/\s+/).filter(Boolean))
            if (!document.getElementById(ref)) broken.push(`${attr}→${ref}`);
      return { dup, broken: [...new Set(broken)] };
    });
    ok(
      r.dup.length === 0,
      `A11Y-08 : identifiants uniques : ${name}${r.dup.length ? ` → ${r.dup.join(', ')}` : ''}`,
    );
    ok(
      r.broken.length === 0,
      `A11Y-09 : références ARIA valides : ${name}${r.broken.length ? ` → ${r.broken.join(', ')}` : ''}`,
    );
    await ctx.close();
  }

  // 2. Focus visible sur les pages principales
  for (const [name, route, seed] of [
    ['Démos', '/#/'],
    ['Éditeur', `/#/demos/${DEMO}/edit`],
    ['Partager', `/#/demos/${DEMO}/share`],
    ['Analytics', '/#/analytics'],
    [
      'Apprenants',
      '/#/learners',
      (d) => {
        seedPathTables(d.tables, d.tables.workspaces[0].id);
        d.learners = learnersFixture().progress;
      },
    ],
    ['Centre (réglages)', '/#/center', (d) => seedCenterTables(d)],
    ['Membres', '/#/settings/members'],
  ]) {
    const { p, ctx } = await app(route, { seed });
    const r = await tabWalk(p, 45);
    ok(
      r.seen > 10 && r.missing.length === 0,
      `Focus visible : ${name} (${r.seen} arrêts)${r.missing.length ? ` → ${r.missing.join(' | ')}` : ''}`,
    );
    ok(
      r.obscured.length === 0,
      `Focus non masqué (2.4.11) : ${name}${r.obscured.length ? ` → ${r.obscured.join(' | ')}` : ''}`,
    );
    await ctx.close();
  }
  for (const [name, path, center] of [
    ['Lecteur', `/d/${DEMO}`],
    ['Centre', '/c/ml-exemple?l=jeton-alex-0001', () => centerFixture()],
  ]) {
    const { p, ctx } = await player(path, { center });
    const r = await tabWalk(p, 30);
    ok(
      r.seen > 3 && r.missing.length === 0,
      `Focus visible : ${name} (${r.seen} arrêts)${r.missing.length ? ` → ${r.missing.join(' | ')}` : ''}`,
    );
    ok(
      r.obscured.length === 0,
      `Focus non masqué (2.4.11) : ${name}${r.obscured.length ? ` → ${r.obscured.join(' | ')}` : ''}`,
    );
    await ctx.close();
  }

  // 3. Modales : piège du focus et retour au bouton d'origine
  {
    const { p, ctx } = await app('/#/', { seed: (d) => seedExport(d) });
    const opener = p.getByRole('button', { name: 'Nouvelle démo' }).first();
    await opener.focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector('dialog[open]');
    let inside = true;
    for (let i = 0; i < 20; i++) {
      await p.keyboard.press('Tab');
      if (!(await p.evaluate(() => !!document.activeElement?.closest('dialog[open]')))) inside = false;
    }
    ok(inside, 'Modale « Nouvelle démo » : le focus reste dans la modale');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    ok(
      await p.evaluate(() => document.activeElement?.textContent?.includes('Nouvelle démo')),
      'Modale « Nouvelle démo » : Échap rend le focus au bouton d’ouverture',
    );
    // Export ouvert depuis le menu « … » : le focus revient au bouton du menu
    const trigger = p.getByRole('button', { name: /Actions.*Créer une fiche usager/ }).first();
    await trigger.focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector('[role=menu]');
    const item = p.getByRole('menuitem', { name: 'Exporter (PDF, GIF)' });
    await item.focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector('dialog.x15-dialog[open]');
    ok(
      await p.evaluate(() => !!document.activeElement?.closest('dialog.x15-dialog')),
      'Modale d’export : le focus entre dans la modale',
    );
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    ok(
      await p.evaluate(() => /Actions/.test(document.activeElement?.getAttribute('aria-label') || '')),
      'Modale d’export : Échap rend le focus au bouton « … » de la carte',
    );
    await ctx.close();
  }

  // 4. Messages (toasts) : zone annoncée présente dès le chargement
  {
    const { p, ctx } = await app('/#/');
    ok(
      (await p.locator('[role=status][aria-live=polite].toasts, .toasts[role=status]').count()) === 1,
      'Toasts : zone role=status aria-live=polite présente avant tout message',
    );
    await ctx.close();
  }

  // 5. Animations réduites : aucune animation en boucle
  for (const [name, go] of [
    ['Démos', () => app('/#/', { reduced: true })],
    ['Lecteur', () => player(`/d/${DEMO}`, { reduced: true })],
    [
      'Centre',
      () => player('/c/ml-exemple?l=jeton-alex-0001', { reduced: true, center: () => centerFixture() }),
    ],
  ]) {
    const { p, ctx } = await go();
    const loops = await p.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => {
          const t = a.effect?.getComputedTiming?.();
          return t && (t.iterations === Infinity || t.activeDuration > 50);
        })
        .map((a) => a.effect?.target?.className || a.animationName || '?'),
    );
    ok(loops.length === 0, `Animations réduites : ${name}${loops.length ? ` → ${loops.join(' | ')}` : ''}`);
    await ctx.close();
  }

  // 6. Zoom 200 % (fenêtre de 720 × 450 pour un écran de 1440 × 900) : pas de défilement horizontal
  const zoom = { width: 720, height: 450 };
  for (const [name, go] of [
    ['Connexion', () => app('/#/login', { viewport: zoom, signedOut: true })],
    ['Démos', () => app('/#/', { viewport: zoom })],
    ['Éditeur', () => app(`/#/demos/${DEMO}/edit`, { viewport: zoom })],
    ['Partager', () => app(`/#/demos/${DEMO}/share`, { viewport: zoom })],
    ['Analytics', () => app('/#/analytics', { viewport: zoom })],
    [
      'Apprenants',
      () =>
        app('/#/learners', {
          viewport: zoom,
          seed: (d) => {
            seedPathTables(d.tables, d.tables.workspaces[0].id);
            d.learners = learnersFixture().progress;
          },
        }),
    ],
    ['Centre (réglages)', () => app('/#/center', { viewport: zoom, seed: (d) => seedCenterTables(d) })],
    ['Plans', () => app('/#/settings/plans', { viewport: zoom })],
    ['Lecteur', () => player(`/d/${DEMO}`, { viewport: zoom })],
    [
      'Centre',
      () => player('/c/ml-exemple?l=jeton-alex-0001', { viewport: zoom, center: () => centerFixture() }),
    ],
  ]) {
    const { p, ctx } = await go();
    const r = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    ok(r.sw <= r.cw + 1, `Zoom 200 % : ${name} sans défilement horizontal (${r.sw} / ${r.cw})`);
    await ctx.close();
  }

  // 7. Lecteur : étape annoncée et navigation au clavier
  {
    const { p, ctx } = await player(`/d/${DEMO}`);
    const live = p.locator('[aria-live=polite][aria-atomic=true]').first();
    ok(/Étape 1 sur \d+/.test(await live.textContent()), 'Lecteur : étape 1 annoncée');
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(400);
    ok(/Étape 2 sur \d+/.test(await live.textContent()), 'Lecteur : → passe à l’étape 2, annoncée');
    await p.keyboard.press('ArrowLeft');
    await p.waitForTimeout(400);
    ok(/Étape 1 sur/.test(await live.textContent()), 'Lecteur : ← revient à l’étape 1');
    let reached = false;
    for (let i = 0; i < 20 && !reached; i++) {
      await p.keyboard.press('Tab');
      reached = await p.evaluate(() =>
        /Suivant|suivante/i.test(
          document.activeElement?.textContent || document.activeElement?.getAttribute('aria-label') || '',
        ),
      );
    }
    ok(reached, 'Lecteur : bouton « Suivant » atteignable à la tabulation');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    ok(/Étape 2 sur/.test(await live.textContent()), 'Lecteur : Entrée sur « Suivant » avance et annonce');
    await ctx.close();
  }

  // 8. Lecteur (audit A11Y-03, 05, 06) : focus après « Suivant » de la bulle, h1 et main, alternative
  {
    const { p, ctx } = await player(`/d/${DEMO}`);
    ok(
      (await p.locator('h1.p-title').count()) === 1 && (await p.locator('main#p-main').count()) === 1,
      'A11Y-05 : h1 (titre de la démo) et main',
    );
    ok(
      /^Capture de l’écran, étape 1 sur \d+/.test(
        (await p.locator('img.p-img').first().getAttribute('alt')) || '',
      ),
      'A11Y-06 : alternative « Capture de l’écran, étape n sur N : titre »',
    );
    const next = p.locator('.p-tip .p-actions button').last();
    if (await next.count()) {
      await next.focus();
      await p.keyboard.press('Enter');
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({
        body: document.activeElement === document.body,
        cls: document.activeElement?.className || '',
      }));
      ok(
        !r.body && /p-tip-title|p-step-h/.test(r.cls),
        `A11Y-03 : après « Suivant » de la bulle, focus sur le titre de l’étape (${r.cls || 'body'})`,
      );
    } else ok(false, 'A11Y-03 : bulle avec bouton « Suivant » introuvable');
    await ctx.close();
  }

  // 9. L34 : parcours complet de l'éditeur au clavier seul (rail, déplacement d'étape, zone du canevas,
  //    champs, onglets, modale des raccourcis et retour du focus)
  {
    const { p, ctx } = await app(`/#/demos/${DEMO}/edit`);
    await p.locator('.ed-title:not(.ed-title--sk)').waitFor();
    const active = () =>
      p.evaluate(() => {
        const el = document.activeElement;
        return {
          step: el?.getAttribute('data-step-index'),
          id: el?.id || '',
          role: el?.getAttribute('role') || '',
          label: el?.getAttribute('aria-label') || '',
          text: (el?.textContent || '').trim().slice(0, 40),
        };
      });
    async function tabTo(pred, max = 120) {
      for (let i = 0; i < max; i++) {
        await p.keyboard.press('Tab');
        if (pred(await active())) return true;
      }
      return false;
    }
    ok(await tabTo((a) => a.step === '0'), 'Éditeur au clavier : rail atteint à la tabulation');
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(150);
    ok((await active()).step === '1', 'Éditeur au clavier : ↓ passe à l’étape 2 dans le rail');
    ok(
      (await p.locator('[data-step-index="1"][aria-current="step"]').count()) === 1,
      'Éditeur au clavier : l’étape 2 est sélectionnée',
    );
    // Titre de l'étape sans son numéro (qui change avec la position)
    const title = async (i) =>
      ((await p.locator(`[data-step-index="${i}"]`).textContent()) || '').replace(/^\s*\d+/, '').trim();
    const before = await title(1);
    await p.keyboard.press(' ');
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(300);
    await p.keyboard.press(' ');
    await p.waitForTimeout(150);
    const moved = await title(2);
    const live = (await p.locator('.rail .sr-only[aria-live]').first().textContent()) || '';
    ok(
      moved === before && /position 3/.test(live),
      `Éditeur au clavier : Espace, ↓, Espace déplace l’étape et l’annonce (« ${live.trim()} »)`,
    );
    // Zone du canevas : sélection (Entrée) puis déplacement aux flèches, champs de position à jour
    await p.locator('[data-step-index="0"]').focus();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(200);
    ok(
      await tabTo((a) => a.role === 'button' && /^Hotspot 1/.test(a.label)),
      'Éditeur au clavier : zone du canevas atteinte à la tabulation',
    );
    await p.keyboard.press('Enter');
    await p.locator('#hs-rect-x').waitFor();
    const x0 = Number(await p.locator('#hs-rect-x').inputValue());
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(150);
    const x1 = Number(await p.locator('#hs-rect-x').inputValue());
    ok(Math.abs(x1 - x0 - 1) < 0.2, `Éditeur au clavier : → déplace la zone de 1 % (${x0} → ${x1})`);
    // Champs du panneau et onglets
    await p.locator('#hs-rect-x').focus();
    await p.keyboard.press('ArrowUp');
    await p.waitForTimeout(100);
    ok(
      Number(await p.locator('#hs-rect-x').inputValue()) === Math.round(x1 + 1),
      'Éditeur au clavier : la position se règle aussi dans le panneau (sans glisser)',
    );
    const tab = p.getByRole('tab', { name: 'Design' });
    await p.getByRole('tab', { name: 'Étape' }).focus();
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(150);
    ok(
      (await tab.getAttribute('aria-selected')) === 'true',
      'Éditeur au clavier : → dans les onglets du panneau ouvre « Design »',
    );
    // Modale des raccourcis : ouverte par « ? », focus dedans, Échap rend le focus
    await p.getByRole('tab', { name: 'Étape' }).focus();
    await p.keyboard.press('Shift+?');
    const dlg = p.locator('[role="dialog"][aria-modal="true"]');
    await dlg.waitFor();
    ok(
      await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')),
      'Éditeur au clavier : « ? » ouvre les raccourcis, focus dans la fenêtre',
    );
    // Tabulation enfermée dans la fenêtre (L34 : fenêtres « aria-modal » comme les <dialog>)
    let escaped = false;
    for (let i = 0; i < 6; i++) {
      await p.keyboard.press('Tab');
      if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) escaped = true;
    }
    ok(!escaped, 'Éditeur au clavier : la tabulation reste dans la fenêtre des raccourcis');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    ok(
      (await dlg.count()) === 0 && (await active()).role === 'tab',
      'Éditeur au clavier : Échap ferme les raccourcis et rend le focus',
    );
    await ctx.close();
  }

  // 10. L34 : lecteur au clavier jusqu'à une fenêtre modale (formulaire de contact, sinon fin de la démo) :
  //     le focus y entre et la tabulation y reste
  {
    const { p, ctx } = await player(`/d/${DEMO}`);
    const modal = p.locator('[role="dialog"][aria-modal="true"]');
    for (let i = 0; i < 40 && !(await modal.count()); i++) {
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(120);
    }
    ok((await modal.count()) === 1, 'Lecteur au clavier : → mène à la fenêtre du formulaire de contact');
    if (await modal.count()) {
      await p.waitForTimeout(200);
      const inside = () => p.evaluate(() => !!document.activeElement?.closest('[aria-modal="true"]'));
      ok(await inside(), 'Lecteur : le focus entre dans la fenêtre');
      let out = false;
      for (let i = 0; i < 10; i++) {
        await p.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
        if (!(await inside())) out = true;
      }
      ok(!out, 'Lecteur : la tabulation reste dans la fenêtre (dans les deux sens)');
    }
    await ctx.close();
  }

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})();
