/**
 * Contrôle CI des espacements (composants.md §18.6, retours client du 21 novembre) sur les routes de
 * a11y.e2e.cjs (app et lecteur), en clair et en sombre, à 1440 et 390 px.
 *
 * Mesure (styles calculés, getBoundingClientRect) : pour chaque paire de frères consécutifs visibles d'un
 * même conteneur (hauteur et largeur > 0, hors position absolute ou fixed, hors texte en ligne), l'écart
 * entre les bords qui se font face. Règles :
 *  - 8 px au moins entre deux frères empilés ou côte à côte (jamais collés) ;
 *  - 24 px entre deux cartes empilées (.card, .fd-card, article) ;
 * Exceptions (non mesurées) :
 *  - data-gap-exempt (justifié dans le code) : sur un conteneur, pour ses enfants directs ; sur un
 *    élément, pour lui comme voisin ;
 *  - contenu d'un contrôle (bouton, lien, champ, libellé, onglet, option) ou d'une pastille (étiquette,
 *    statut, badge) : l'icône et son texte ;
 *  - lignes d'un tableau, et lignes séparées par un filet ou par un padding vertical de 8 px au moins ;
 *  - aide sous son champ (6 px admis, §18.6), libellé au-dessus de son champ (4 px au moins) ;
 *  - lignes de texte empilées (nom et rôle, fil d'Ariane et titre) : typographie.
 * Bord mesuré : celui qui se voit. Une boîte sans fond, ni bordure, ni ombre ne compte que par son
 * contenu (son padding transparent n'éloigne rien à l'œil).
 *  - éléments qui se chevauchent (superpositions voulues).
 * ALIGN-01 (COMP-01 §13) : sur les pages des Paramètres et le détail d'un webhook, à 1440 et 1024 px, le
 * bord droit du dernier contrôle de chaque ligne de réglage est celui du filet, à ±1 px ; de même pour
 * les boutons d'en-tête de section. Exemptées : les listes de choix (radios, cases, pastilles).
 * Usage : app web (:5173) et lecteur (:5174) lancés, puis `node e2e/espacements.e2e.cjs [filtre…]`.
 * Sortie : chaque écart fautif, avec la route, les sélecteurs des deux éléments et la valeur.
 */
const { chromium } = require('playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');

const MIN = 8;
const CARDS = 24;

/** Dans la page : paires de frères sous le minimum. */
function gaps({ min, cards }) {
  const out = [];
  const INLINE = new Set(['inline', 'contents', 'none', 'table-cell', 'table-row', 'table-row-group']);
  const CONTROL =
    'button, a, label, summary, select, textarea, input, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="switch"], [role="link"], .tg, .fd-status, .badge';
  const sel = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = [...el.classList]
      .slice(0, 2)
      .map((c) => `.${c}`)
      .join('');
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) parts.unshift(sel(e));
    return parts.join(' > ');
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (
      INLINE.has(cs.display) ||
      cs.visibility === 'hidden' ||
      cs.position === 'absolute' ||
      cs.position === 'fixed'
    )
      return false;
    if (
      el.classList.contains('sr-only') ||
      (el.getAttribute('aria-hidden') === 'true' && el.tagName === 'svg')
    )
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isCard = (el) => el.matches('.card, .fd-card, article');
  /** Boîte visible au repos : fond, bordure ou ombre (sinon, seul son contenu se voit). */
  /** Couleur visible (alpha > 0). */
  const seen = (c) => !!c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
  const sides = ['Top', 'Right', 'Bottom', 'Left'];
  const boxed = (el, cs) =>
    seen(cs.backgroundColor) ||
    cs.backgroundImage !== 'none' ||
    // Bordure ou ombre transparentes (réservées pour le survol, le focus) : invisibles au repos
    sides.some((k) => px(cs[`border${k}Width`]) > 0 && seen(cs[`border${k}Color`])) ||
    (cs.boxShadow !== 'none' && !/^rgba\([^)]*,\s*0\)/.test(cs.boxShadow)) ||
    el.matches('img, svg, canvas, video, iframe, input, select, textarea, hr');
  /**
   * Bord visuel : la boîte si elle se voit, sinon l'enveloppe de ce qui se voit dedans (texte, et bord
   * visuel des enfants, récursivement). Rien de visible : la boîte elle-même.
   */
  const visualRect = (el, cs, depth = 0) => {
    if (boxed(el, cs) || depth > 6) return el.getBoundingClientRect();
    const rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        rects.push(...[...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0));
      } else if (n.nodeType === 1) {
        const c = n;
        const ccs = getComputedStyle(c);
        if (ccs.display === 'none' || ccs.visibility === 'hidden' || c.classList.contains('sr-only'))
          continue;
        const r = c.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Filets décoratifs (connecteurs entre étapes, traits de 3 px au plus) : pas du contenu
        if (c.getAttribute('aria-hidden') === 'true' && Math.min(r.width, r.height) <= 3) continue;
        if (ccs.position === 'absolute' || ccs.position === 'fixed') continue;
        rects.push(visualRect(c, ccs, depth + 1));
      }
    }
    if (!rects.length) return el.getBoundingClientRect();
    const u = {
      top: Math.min(...rects.map((r) => r.top)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
    };
    // Contenu rogné (overflow hidden, points de suspension) : seul ce qui reste dans la boîte se voit
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const box = el.getBoundingClientRect();
      if (cs.overflowX !== 'visible') {
        u.left = Math.max(u.left, box.left);
        u.right = Math.min(u.right, box.right);
      }
      if (cs.overflowY !== 'visible') {
        u.top = Math.max(u.top, box.top);
        u.bottom = Math.min(u.bottom, box.bottom);
      }
    }
    return u;
  };
  /** Feuille de texte : que du texte (et des éléments en ligne), pas de boîte à elle. */
  const textLeaf = (el, cs) =>
    !boxed(el, cs) &&
    [...el.children].every((c) => c.tagName === 'svg' || getComputedStyle(c).display.startsWith('inline')) &&
    el.textContent.trim().length > 0;
  const px = (v) => parseFloat(v) || 0;
  for (const parent of document.querySelectorAll('body *')) {
    // data-gap-exempt sur un conteneur : ses enfants directs seulement (pas toute la descendance)
    if (parent.hasAttribute('data-gap-exempt') || parent.closest(CONTROL)) continue;
    if (parent.matches('tr, thead, tbody, table, svg, ul.fd-tabs, [role="tablist"], [role="radiogroup"]'))
      continue;
    const pcs = getComputedStyle(parent);
    if (pcs.display === 'none' || pcs.visibility === 'hidden') continue;
    const kids = [...parent.children].filter((c) => !c.hasAttribute('data-gap-exempt') && visible(c));
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1];
      const b = kids[i];
      const ca = getComputedStyle(a);
      const cb = getComputedStyle(b);
      // Lignes de texte empilées (nom et rôle, fil d'Ariane et titre…) : typographie, pas espacement
      if (textLeaf(a, ca) && textLeaf(b, cb)) continue;
      const ra = visualRect(a, ca);
      const rb = visualRect(b, cb);
      let gap;
      let axis;
      if (rb.top >= ra.bottom - 0.5) {
        gap = rb.top - ra.bottom;
        axis = 'vertical';
      } else if (rb.left >= ra.right - 0.5 || ra.left >= rb.right - 0.5) {
        gap = rb.left >= ra.right - 0.5 ? rb.left - ra.right : ra.left - rb.right;
        axis = 'horizontal';
      } else continue; // chevauchement : superposition voulue
      gap = Math.round(gap);
      // Zones séparées par un filet (colonnes de l'éditeur, lignes d'une liste à filets)
      if (axis === 'horizontal') {
        const leftEl = rb.left >= ra.right - 0.5 ? ca : cb;
        const rightEl = leftEl === ca ? cb : ca;
        if (
          (px(leftEl.borderRightWidth) > 0 && seen(leftEl.borderRightColor)) ||
          (px(rightEl.borderLeftWidth) > 0 && seen(rightEl.borderLeftColor))
        )
          continue;
      }
      if (axis === 'vertical') {
        // Lignes à filet, ou à padding vertical de 8 px au moins de part et d'autre
        if (
          (px(ca.borderBottomWidth) > 0 && seen(ca.borderBottomColor)) ||
          (px(cb.borderTopWidth) > 0 && seen(cb.borderTopColor))
        )
          continue;
        if (px(ca.paddingBottom) >= 8 && px(cb.paddingTop) >= 8 && ca.backgroundColor === cb.backgroundColor)
          continue;
        // Aide sous son champ : 6 px admis (§18.6)
        if (b.matches('.help, .fd-help, .error-msg, .fd-error, small, .ok-line') && gap >= 4) continue;
        // Libellé au-dessus de son champ : même groupe (4 px au moins)
        if (a.matches('label, .fd-label, .t-label, legend') && gap >= 4) continue;
        // Titre puis sa ligne de texte (sous-titre, mention) : typographie
        if (
          (a.matches('h1, h2, h3, h4, h5, h6') || a.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6)')) &&
          textLeaf(b, cb)
        )
          continue;
      }
      const need = axis === 'vertical' && isCard(a) && isCard(b) ? cards : min;
      if (gap < need) out.push({ a: path(a), b: sel(b), gap, need, axis });
    }
  }
  return out;
}

/** Dans la page (ALIGN-01) : lignes de réglage dont le dernier contrôle ne finit pas sur le filet. */
function aligns() {
  const out = [];
  const CONTROLS =
    'input:not([type=radio], [type=checkbox], [type=file], [type=hidden]), textarea, button:not(.segmented button), a.fd-btn, [role="combobox"], .fd-switch, .segmented, .stg-meter, .stg-group, .pv-value, .us-val, pre, [data-align-zone]';
  const CHOICE = 'input[type=radio], input[type=checkbox], [role="radio"], [role="checkbox"]';
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.position !== 'absolute';
  };
  const right = (list) => Math.max(...list.map((el) => el.getBoundingClientRect().right));
  const label = (el) => (el.querySelector('.stg-lab, legend, h2')?.textContent || '').trim().slice(0, 40);
  for (const row of document.querySelectorAll('.stg-row')) {
    const ctl = row.querySelector(':scope > .stg-ctl');
    if (!ctl || !shown(ctl) || ctl.closest('[data-align-exempt]')) continue;
    // Listes de choix : des contenus, elles commencent au début de la colonne
    const controls = [...ctl.querySelectorAll(CONTROLS)].filter(
      // Une zone de dépôt compte par son cadre : ses boutons sont son contenu
      (el) =>
        shown(el) &&
        !el.closest('label')?.querySelector(CHOICE) &&
        !el.matches('.fd-switch *, [data-align-zone] *'),
    );
    if (!controls.length) continue;
    const d = Math.round((row.getBoundingClientRect().right - right(controls)) * 10) / 10;
    if (Math.abs(d) > 1) out.push(`ligne « ${label(row)} » : le contrôle finit à ${d} px du filet`);
  }
  for (const head of document.querySelectorAll('.stg-sec__head')) {
    // Un segmenté compte par son cadre (ses segments sont en retrait de 3 px)
    const btns = [...head.querySelectorAll('button:not(.segmented button), a.fd-btn, .segmented')].filter(
      shown,
    );
    if (!btns.length) continue;
    const d = Math.round((head.getBoundingClientRect().right - right(btns)) * 10) / 10;
    if (Math.abs(d) > 1) out.push(`en-tête « ${label(head)} » : le bouton finit à ${d} px du filet`);
  }
  return out;
}

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const pages = [
    ...APP_PAGES.map((s) => ({ ...s, kind: 'app' })),
    ...PLAYER_PAGES.map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));
  let bad = 0;
  const check = (p) => p.evaluate(gaps, { min: MIN, cards: CARDS });
  // THEMES=light / WIDTHS=1440 : relance locale réduite
  const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number);
  const themes = (process.env.THEMES || 'light,dark').split(',');
  for (const width of widths)
    for (const theme of themes)
      for (const s of pages) {
        // Sous 1 024 px, l'éditeur et ses sous-routes (Diffuser) passent en écran étroit : leurs panneaux
        // et modales n'existent pas ; route déjà mesurée à sa propre largeur
        if (width === 390 && s.open && /\/demos\/[^/]+\/(edit|distribute)\b/.test(s.route)) continue;
        if (width === 390 && s.viewport) continue;
        // Ouverture par la colonne Dossiers, absente sous 1 024 px
        if (width === 390 && s.name === 'Démos · accès au dossier') continue;
        const page = { ...s, viewport: width === 390 ? { width: 390, height: 844 } : s.viewport };
        let m;
        try {
          m =
            s.kind === 'app' ? await appPage(b, page, theme, check) : await playerPage(b, page, theme, check);
        } catch (e) {
          console.log(
            `NOT OK - ${s.name} (${theme}, ${width}) : contrôle impossible (${e.message.split('\n')[0]})`,
          );
          process.exitCode = 1;
          continue;
        }
        bad += m.length;
        console.log(`${m.length ? 'NOT OK' : 'ok'} - ${s.name} (${theme}, ${width} px)`);
        for (const x of m) console.log(`    ${x.a} | ${x.b} : ${x.gap} px (${x.axis}, ${x.need} attendus)`);
      }
  // ===== ALIGN-01 : un seul bord droit par ligne de réglage (Paramètres, détail d'un webhook) =====
  let off = 0;
  for (const width of [1440, 1024])
    for (const s of pages.filter((x) => x.kind === 'app' && /#\/settings\//.test(x.route) && !x.viewport)) {
      let m;
      try {
        m = await appPage(b, { ...s, viewport: { width, height: 900 } }, 'light', (p) => p.evaluate(aligns));
      } catch (e) {
        m = [`contrôle impossible (${e.message.split('\n')[0]})`];
      }
      off += m.length;
      console.log(`${m.length ? 'NOT OK' : 'ok'} - ALIGN-01 · ${s.name} (${width} px)`);
      for (const x of m) console.log(`    ${x}`);
    }
  console.log(`${off} ligne(s) de réglage hors du filet`);
  if (off) process.exitCode = 1;
  await b.close();
  console.log(
    `\n${bad} écart(s) sous le minimum sur ${pages.length} routes × ${themes.length} thème(s) × ${widths.length} largeur(s)`,
  );
  if (bad) process.exitCode = 1;
})();
