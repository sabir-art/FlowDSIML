/**
 * Contrôle CI de SPLIT-01 et NUM-01 (COMP-01 §20 à §22, retour client du 22 novembre).
 * Page d'un webhook avec une ligne choisie (durée de 4 chiffres, statut avec essai), à 1440, 1280, 1180,
 * 1024 et 390 px, en clair et en sombre :
 *  1. pas de chevauchement : deux colonnes, panneau.left − conteneur du tableau.right ≥ 24 ; une colonne,
 *     panneau.top − tableau.bottom ≥ 24 ;
 *  2. pas de débordement : aucune cellule plus large que sa boîte, aucun tableau plus large que son
 *     conteneur sans overflow-x auto ou scroll ; à 1440 et 1280 px, le tableau du webhook ne défile pas à
 *     l'horizontale, même avec une ligne en attente d'un nouvel essai ;
 *  3. en-tête du panneau : titre sur une ligne, 12 px au moins jusqu'au bouton quand ils sont côte à côte ;
 *  4. pastilles en lecture seule : 8 px au moins entre deux voisines, 12 px de padding horizontal ;
 *  5. nombres : aucun texte visible (hors pre et code) avec une espace ordinaire dans un nombre, entre un
 *     nombre et son unité, ou après « sur » ;
 *  6. pre : white-space pre, overflow-x auto.
 * Le contrôle 2 passe aussi sur les autres pages de l'app qui ont un tableau (1440 px).
 * Usage : app web (:5173) lancée, puis `node e2e/separation.e2e.cjs`.
 */
const { chromium } = require('playwright');
const { APP_PAGES, appPage } = require('./a11y.e2e.cjs');

/** Dans la page : cellules et tableaux qui débordent. */
function overflows() {
  const out = [];
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  for (const cell of document.querySelectorAll('th, td')) {
    if (!shown(cell)) continue;
    if (cell.scrollWidth > cell.clientWidth + 1)
      out.push(
        `cellule « ${cell.textContent.trim().slice(0, 30)} » : ${cell.scrollWidth} > ${cell.clientWidth}`,
      );
  }
  for (const table of document.querySelectorAll('table')) {
    if (!shown(table)) continue;
    const box = table.parentElement;
    const over = table.getBoundingClientRect().width - box.getBoundingClientRect().width;
    let scroller = false;
    for (let el = box; el && el !== document.body; el = el.parentElement)
      if (/auto|scroll/.test(getComputedStyle(el).overflowX)) scroller = true;
    if (over > 1 && !scroller) out.push(`tableau plus large que son conteneur de ${Math.round(over)} px`);
  }
  return out;
}

/** Dans la page d'un webhook : contrôles 1 et 3 à 6. */
function webhook() {
  const out = [];
  const r = (el) => el.getBoundingClientRect();
  const box = document.querySelector('.wh-log__table');
  const det = document.querySelector('.wh-det');
  if (!box || !det) return ['journal ou panneau « Envoi sélectionné » absent'];
  // 1. gouttière
  const side = r(det).left >= r(box).right - 1;
  const gap = side ? r(det).left - r(box).right : r(det).top - r(box).bottom;
  if (gap < 24 - 0.5)
    out.push(`gouttière de ${Math.round(gap)} px (${side ? 'côte à côte' : 'empilés'}), 24 attendus`);
  // 3. en-tête du panneau
  const title = det.querySelector('.wh-det__title');
  const btn = det.querySelector('.wh-det__head button');
  const line = parseFloat(getComputedStyle(title).lineHeight) || r(title).height;
  if (r(title).height > line * 1.5)
    out.push(`titre du panneau sur ${Math.round(r(title).height / line)} lignes`);
  if (r(btn).top < r(title).bottom && r(btn).left - r(title).right < 12)
    out.push(`titre et bouton à ${Math.round(r(btn).left - r(title).right)} px, 12 attendus`);
  // 4. pastilles en lecture seule
  const chips = [...document.querySelectorAll('.hc-chip')].filter((c) => !c.querySelector('button'));
  for (const [i, c] of chips.entries()) {
    const cs = getComputedStyle(c);
    if (parseFloat(cs.paddingLeft) < 12 || parseFloat(cs.paddingRight) < 12)
      out.push(`pastille « ${c.textContent.trim()} » : padding de ${cs.paddingLeft} et ${cs.paddingRight}`);
    const next = chips[i + 1];
    if (next && Math.abs(r(next).top - r(c).top) < 2 && r(next).left - r(c).right < 8)
      out.push(`pastilles à ${Math.round(r(next).left - r(c).right)} px l'une de l'autre`);
  }
  // 5. nombres et unités : pas d'espace ordinaire
  const BAD = /\d \d{3}\b|\d (ms|min|s|h|j|Mo|Ko|Go|px|%)(?![\wÀ-ÿ])|sur \d/;
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('pre, code') || !el.getClientRects().length) continue;
    const m = n.nodeValue.match(BAD);
    if (m) out.push(`espace ordinaire dans « ${n.nodeValue.trim().slice(0, 60)} » (${m[0]})`);
  }
  // 2 bis. le tableau du webhook ne défile pas à l'horizontale quand il a la place (1440 et 1280 px)
  if (innerWidth >= 1280 && box.scrollWidth > box.clientWidth + 1)
    out.push(`le tableau défile à l'horizontale (${box.scrollWidth} > ${box.clientWidth})`);
  // 6. blocs de code
  for (const pre of det.querySelectorAll('pre')) {
    const cs = getComputedStyle(pre);
    if (cs.whiteSpace !== 'pre' || cs.overflowX !== 'auto')
      out.push(`pre en white-space ${cs.whiteSpace}, overflow-x ${cs.overflowX}`);
  }
  return out;
}

(async () => {
  const b = await chromium.launch();
  const ok = (c, l, detail = []) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    for (const x of detail) console.log(`    ${x}`);
    if (!c) process.exitCode = 1;
  };
  const base = APP_PAGES.find((s) => s.name === 'Intégrations · détail');
  // Envoi en échec au 2e essai, durée de 4 chiffres ; trois événements pour l'écart entre pastilles
  const seed = (d) => {
    base.seed(d);
    d.tables.webhooks[0].events = ['lead.created', 'demo.published', 'demo.completed'];
    const row = d.tables.webhook_deliveries[1];
    Object.assign(row, {
      status: 'failed',
      attempt: 2,
      duration_ms: 2010,
      response_body: 'Retry-After: 120',
    });
    // En attente d'un nouvel essai : la colonne Durée garde la durée, le délai est dit dans le panneau
    Object.assign(row, {
      status: 'pending',
      next_attempt_at: new Date(Date.now() + 4 * 60_000).toISOString(),
    });
    row.payload = { id: 'evt_fictif', type: 'demo.completed', created_at: '2026-11-22T08:51:02Z', data: {} };
  };
  for (const theme of ['light', 'dark'])
    for (const width of [1440, 1280, 1180, 1024, 390]) {
      let m;
      try {
        m = await appPage(
          b,
          { ...base, seed, viewport: { width, height: width === 390 ? 844 : 900 } },
          theme,
          async (p) => {
            // La ligne en échec est choisie : le panneau montre « 2 010 ms » et « 2 sur 6 »
            await p.locator('.wh-log tbody tr').nth(1).click();
            await p.locator('.wh-det dd', { hasText: 'HTTP 503' }).waitFor();
            return [...(await p.evaluate(webhook)), ...(await p.evaluate(overflows))];
          },
        );
      } catch (e) {
        m = [`contrôle impossible (${e.message.split('\n')[0]})`];
      }
      ok(m.length === 0, `Webhook (${theme}, ${width} px)`, m);
    }

  // Contrôle 2 sur les autres pages à tableau
  for (const s of APP_PAGES.filter((x) => !x.open && !x.viewport && x !== base)) {
    let m;
    try {
      m = await appPage(b, s, 'light', async (p) =>
        (await p.locator('table').count()) ? p.evaluate(overflows) : null,
      );
    } catch (e) {
      m = [`contrôle impossible (${e.message.split('\n')[0]})`];
    }
    if (m) ok(m.length === 0, `Tableaux · ${s.name}`, m);
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
