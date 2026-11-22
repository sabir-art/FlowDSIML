/**
 * Retours client 21/11 §1 : les commentaires dans un panneau sous le canevas (spec
 * docs/ux/specs/retours-client-21-11.md §1). Faux Supabase, données fictives.
 *  - replié : barre de 40 px, « Commentaires », badge, chevron, « Étape n » ; plus d'outil dans le rail ;
 *  - déplié : 320 px par défaut, largeur du canevas inchangée, canevas recadré (« Ajuster ») ;
 *  - poignée role=separator : flèches de 16 px, Début et Fin (200 px, 50 % de la fenêtre) ; arbitrage UX 37f2d68 ;
 *  - barre filetée en bas, liste dans la largeur du panneau, 8 px sous la barre ; Échap dans le champ vide ferme ;
 *  - badge : rien sans commentaire ouvert, surface-sunken si tout est lu, primary si un non lu, « 99+ » ;
 *  - état retenu (fd.comments.dock), sauf ouverture par un lien ; Alt + C ; focus ; mouvement réduit ;
 *  - zoom 100 % : le hotspot sélectionné et sa bulle restent à 16 px au moins du panneau ;
 *  - sous 1 024 px : écran étroit inchangé (pas de panneau).
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { pick } = require('./_select.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const EDIT = `${APP}/#/demos/${DEMO}/edit`;

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const at = (min) => new Date(Date.UTC(2026, 10, 17, 9, min)).toISOString();
const comment = (id, author, min, extra = {}) => ({
  id,
  step_id: 's1',
  demo_id: DEMO,
  workspace_id: 'ws-1',
  author_id: author,
  body: `Remarque ${id}`,
  created_at: at(min),
  updated_at: at(min),
  resolved_at: null,
  resolved_by: null,
  ...extra,
});

/** n commentaires de Bob sur l'étape 1 ; lus jusqu'à `seenMin` (null : jamais ouvert). */
function state(n, seenMin = null) {
  const s = seed();
  s.extraMembers = [{ user_id: 'u-bob', email: 'bob@example.test', full_name: 'Bob', role: 'editor' }];
  s.tables.step_comments = Array.from({ length: n }, (_, i) => comment(`c${i}`, 'u-bob', i % 60));
  s.seenAt = seenMin === null ? null : at(seenMin);
  return s;
}

async function open(b, st, { viewport = { width: 1440, height: 900 }, url = EDIT, reduced = false } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  if (st.seenAt)
    await ctx.addInitScript((seen) => {
      if (!localStorage.getItem('fd.editor.comments.seen'))
        localStorage.setItem('fd.editor.comments.seen', JSON.stringify({ s1: seen }));
    }, st.seenAt);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await install(page, st);
  await page.goto(url);
  await page
    .locator(viewport.width < 1024 ? '.editor-narrow, main' : '.cm-dock__toggle')
    .first()
    .waitFor();
  await page.waitForTimeout(500);
  return page;
}
const box = (p, sel) => p.locator(sel).first().boundingBox();
const badge = (p) =>
  p.evaluate(() => {
    const el = document.querySelector('.cm-dock__badge');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      text: el.textContent,
      unread: el.classList.contains('is-unread'),
      h: el.offsetHeight,
      bg: cs.backgroundColor,
    };
  });

(async () => {
  const b = await chromium.launch();

  // ===== Replié, puis déplié =====
  {
    const p = await open(b, state(3, 59));
    const bar = await box(p, '.cm-dock');
    const toggle = p.locator('.cm-dock__toggle');
    ok(Math.round(bar.height) === 40, `replié : barre de 40 px (${bar.height})`);
    ok(
      (await p.locator('.ed-rail [data-tool="comments"]').count()) === 0,
      'plus d’outil Commentaires dans le rail',
    );
    ok(
      (await toggle.getAttribute('aria-expanded')) === 'false' &&
        (await toggle.getAttribute('aria-controls')) === 'cm-dock-body' &&
        (await toggle.getAttribute('aria-keyshortcuts')) === 'Alt+C',
      'bouton : aria-expanded, aria-controls, Alt+C',
    );
    ok((await p.locator('.cm-dock__step').innerText()) === 'Étape 1', '« Étape 1 » à droite');
    const stage0 = await box(p, '.stage');
    const frame0 = await box(p, '.stage-inner > .frame');
    await toggle.click();
    await p.waitForTimeout(400);
    const dock = await box(p, '.cm-dock');
    ok(Math.round(dock.height) === 320, `déplié : 320 px par défaut (${dock.height})`);
    ok(Math.abs((await box(p, '.stage')).width - stage0.width) < 1, 'la largeur du canevas ne change pas');
    const frame1 = await box(p, '.stage-inner > .frame');
    ok(
      frame1.y + frame1.height <= dock.y && frame1.width < frame0.width,
      `canevas recadré au-dessus du panneau (cadre ${Math.round(frame0.width)} → ${Math.round(frame1.width)} px)`,
    );
    ok(
      await p.evaluate(() => document.activeElement?.closest('.cm-compose') !== null),
      'à l’ouverture, focus dans le champ de saisie',
    );
    const scrolled = await p.evaluate(() => document.querySelector('main').scrollTop);
    ok(scrolled === 0, `la page ne défile pas à l’ouverture (main.scrollTop = ${scrolled})`);
    const field = await box(p, '.cm-compose');
    ok(field.y + field.height <= dock.y + dock.height + 1, 'champ de saisie collé en bas du panneau');
    // §18.6 (retour client 21/11) : 16 px autour du composeur (bas, gauche, droite, filet au-dessus)
    const pad = await p.evaluate(() => {
      const d = document.querySelector('.cm-dock').getBoundingClientRect();
      const c = document.querySelector('.cm-dock .cm-compose .fd-composer').getBoundingClientRect();
      const cmp = document.querySelector('.cm-dock .cm-compose');
      // sous le filet du haut
      const top = cmp.getBoundingClientRect().top + cmp.clientTop;
      return {
        bottom: Math.round(d.bottom - c.bottom),
        left: Math.round(c.left - d.left),
        right: Math.round(d.right - c.right),
        top: Math.round(c.top - top),
      };
    });
    ok(
      pad.bottom === 16 && pad.left === 16 && pad.right === 16 && pad.top === 16,
      `16 px autour du composeur (${JSON.stringify(pad)})`,
    );
    ok(
      (await p.locator('.cm-dock').evaluate((el) => el.scrollWidth - el.clientWidth)) <= 1,
      'aucun débordement horizontal (§18.7)',
    );
    // Recette UX : filet sous la barre, liste dans la largeur du panneau, 8 px sous la barre
    const sep = await p.evaluate(() => {
      const bar = document.querySelector('.cm-dock__bar');
      const list = document.querySelector('.cm-dock .cm-list');
      const scroll = document.querySelector('.cm-dock .cm-scroll');
      const l = list.getBoundingClientRect();
      const sc = scroll.getBoundingClientRect();
      return {
        border: getComputedStyle(bar).borderBottomWidth,
        pad: getComputedStyle(list).paddingTop,
        inside: l.left >= sc.left - 0.5 && l.right <= sc.right + 0.5,
        over: list.scrollWidth - list.clientWidth,
      };
    });
    ok(
      sep.border === '1px' && sep.pad === '8px',
      `filet de 1 px sous la barre, liste à 8 px (${sep.border}, ${sep.pad})`,
    );
    ok(sep.inside && sep.over <= 1, 'liste dans la largeur du panneau (rien de rogné à droite)');

    // Poignée au clavier
    const handle = p.locator('.cm-dock__handle');
    const attrs = async () =>
      handle.evaluate((el) => ({
        role: el.getAttribute('role'),
        o: el.getAttribute('aria-orientation'),
        now: Number(el.getAttribute('aria-valuenow')),
        min: Number(el.getAttribute('aria-valuemin')),
        max: Number(el.getAttribute('aria-valuemax')),
        h: el.parentElement.getBoundingClientRect().height,
        col: window.innerHeight,
      }));
    const a0 = await attrs();
    ok(
      a0.role === 'separator' && a0.o === 'horizontal' && a0.now === 320 && a0.min === 200,
      'poignée : separator horizontal, valuenow 320, valuemin 200',
    );
    ok(a0.max === Math.floor(a0.col / 2), `valuemax = 50 % de la fenêtre (${a0.max} / ${a0.col})`);
    await handle.focus();
    await p.keyboard.press('ArrowUp');
    ok((await attrs()).now === 336, 'flèche haut : +16 px');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    ok((await attrs()).now === 304, 'flèche bas : -16 px');
    await p.keyboard.press('Home');
    ok((await attrs()).now === 200, 'Début : 200 px');
    await p.keyboard.press('End');
    await p.waitForTimeout(300);
    const aEnd = await attrs();
    ok(aEnd.now === aEnd.max && Math.abs(aEnd.h - aEnd.max) < 1, `Fin : 50 % de la fenêtre (${aEnd.h} px)`);
    // Glisser
    const hb = await handle.boundingBox();
    await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await p.mouse.down();
    await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 100, { steps: 5 });
    await p.mouse.up();
    const dragged = (await attrs()).now;
    ok(Math.abs(dragged - (aEnd.max - 100)) <= 2, `poignée glissée de 100 px (${dragged})`);

    // État retenu
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('fd.comments.dock')));
    ok(saved.open === true && saved.height === dragged, `état retenu : ${JSON.stringify(saved)}`);
    await p.reload();
    await p.locator('.cm-dock.is-open .cm').waitFor();
    ok(
      Math.round((await box(p, '.cm-dock')).height) === dragged,
      'après rechargement : déplié, même hauteur',
    );

    // Échap dans le champ vide ferme, focus rendu au bouton (Mac compris : pas de raccourci Option)
    await p.locator('.cm-compose textarea').focus();
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    ok(
      (await toggle.getAttribute('aria-expanded')) === 'false' &&
        (await p.evaluate(() => document.activeElement?.classList.contains('cm-dock__toggle'))),
      'Échap dans le champ vide ferme, focus sur le bouton',
    );
    await toggle.click();
    await p.locator('.cm-dock.is-open .cm').waitFor();
    await p.locator('.cm-compose textarea').fill('Brouillon');
    await p.keyboard.press('Escape');
    ok(
      (await toggle.getAttribute('aria-expanded')) === 'true',
      'Échap avec un brouillon : le panneau reste ouvert',
    );
    await p.locator('.cm-compose textarea').fill('');
    // Alt + C ferme (depuis le champ), focus rendu au bouton
    await p.locator('.cm-compose textarea').focus();
    await p.keyboard.press('Alt+KeyC');
    await p.waitForTimeout(300);
    ok(
      (await toggle.getAttribute('aria-expanded')) === 'false' &&
        (await p.evaluate(() => document.activeElement?.classList.contains('cm-dock__toggle'))),
      'Alt + C ferme, focus sur le bouton',
    );
    await p
      .locator('body')
      .click({ position: { x: 5, y: 5 } })
      .catch(() => {});
    await p.keyboard.press('Alt+KeyC');
    await p.waitForTimeout(300);
    ok((await toggle.getAttribute('aria-expanded')) === 'true', 'Alt + C ouvre');
    ok(p.errors.length === 0, `aucune erreur JS (${p.errors.join(' | ')})`);
    await p.context().close();
  }

  // ===== Badge =====
  {
    let p = await open(b, state(0));
    ok((await badge(p)) === null, 'sans commentaire ouvert : pas de badge');
    ok(
      (await p.locator('.cm-dock__toggle').getAttribute('aria-label')) === 'Commentaires, aucun ouvert',
      'nom accessible « Commentaires, aucun ouvert »',
    );
    await p.context().close();

    p = await open(b, state(3, 59));
    let bd = await badge(p);
    ok(bd.text === '3' && !bd.unread && bd.h === 18, `tout lu : « 3 », surface-sunken, 18 px (${bd.bg})`);
    ok(
      (await p.locator('.cm-dock__toggle').getAttribute('aria-label')) === 'Commentaires, 3 ouverts',
      'nom accessible « Commentaires, 3 ouverts »',
    );
    await p.context().close();

    p = await open(b, state(3, 0));
    bd = await badge(p);
    ok(bd.text === '3' && bd.unread, `un non lu : fond primary (${bd.bg})`);
    ok(
      (await p.locator('.cm-dock__toggle').getAttribute('aria-label')) ===
        'Commentaires, 3 ouverts, dont 2 non lus',
      'nom accessible « Commentaires, 3 ouverts, dont 2 non lus »',
    );
    // L'ouverture marque comme lus
    await p.locator('.cm-dock__toggle').click();
    await p.waitForTimeout(400);
    await p.locator('.cm-dock__toggle').click();
    await p.waitForTimeout(200);
    ok(!(await badge(p)).unread, 'après lecture, le badge repasse en surface-sunken');
    await p.context().close();

    const many = state(120, 59);
    many.tables.step_comments.push(comment('cr', 'u-bob', 1, { resolved_at: at(2), resolved_by: 'u-bob' }));
    p = await open(b, many);
    ok((await badge(p)).text === '99+', 'au-delà de 99 : « 99+ » (résolus non comptés)');
    await p.context().close();
  }

  // ===== Lien vers un commentaire : ouvert sans changer l'état retenu =====
  {
    const p = await open(b, state(3, 59), { url: `${EDIT}?outil=commentaires` });
    await p.locator('.cm-dock.is-open .cm').waitFor();
    ok(
      (await p.evaluate(() => localStorage.getItem('fd.comments.dock'))) === null,
      '?outil=commentaires : déplié, état retenu inchangé',
    );
    await p.context().close();
  }

  // ===== Mouvement réduit : pas d'animation de hauteur =====
  {
    const p = await open(b, state(0), { reduced: true });
    const tr = await p.locator('.cm-dock').evaluate((el) => getComputedStyle(el).transitionDuration);
    // La règle globale de mouvement réduit ramène les durées à 0,00001 s
    ok(parseFloat(tr) < 0.01, `prefers-reduced-motion : pas d’animation de hauteur (${tr})`);
    await p.context().close();
  }

  // ===== Zoom 100 % : la sélection reste visible au-dessus du panneau =====
  {
    const p = await open(b, state(0), { viewport: { width: 1280, height: 800 } });
    await pick(p.locator('.stage-zoom'), '100');
    await p.locator('.canvas-hotspot').first().click();
    await p.waitForTimeout(300);
    await p.locator('.cm-dock__toggle').click();
    await p.waitForTimeout(400);
    await p.locator('.cm-dock__handle').focus();
    await p.keyboard.press('End');
    await p.waitForTimeout(400);
    const gap = await p.evaluate(() => {
      const dock = document.querySelector('.cm-dock').getBoundingClientRect().top;
      const sel = [...document.querySelectorAll('.canvas-hotspot.selected, .canvas-tip')];
      return Math.round(dock - Math.max(...sel.map((s) => s.getBoundingClientRect().bottom)));
    });
    ok(gap >= 16, `hotspot et bulle à ${gap} px du panneau (≥ 16)`);
    await p.context().close();
  }

  // ===== Écran étroit : comportement inchangé =====
  {
    const p = await open(b, state(1, 59), { viewport: { width: 390, height: 844 } });
    ok((await p.locator('.cm-dock').count()) === 0, 'sous 1 024 px : pas de panneau sous le canevas');
    await p.context().close();
  }

  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
