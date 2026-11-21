/**
 * Bug client du 21/11 : un panneau ne défile jamais horizontalement (au trackpad, le contenu glissait sur
 * le côté). Sur toutes les routes de a11y.e2e.cjs (app et lecteur), en clair, à 1440 et 390 px, et sur
 * chaque outil du rail de l'éditeur, chaque conteneur qui défile verticalement (overflow-y auto ou scroll)
 * et la page elle-même vérifient scrollWidth <= clientWidth.
 * Hors contrôle : les défilements horizontaux voulus (overflow-x auto ou scroll avec overflow-y caché :
 * barres d'onglets, carrousels), les tableaux (.table-wrap), le canevas de l'éditeur (zoom) et tout
 * élément marqué data-scroll-x (à justifier dans le code).
 * Sortie : le conteneur fautif, son débordement et l'enfant le plus large qui en est la cause.
 */
const { chromium } = require('playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');

const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

/** Dans la page : conteneurs défilants plus larges que leur zone visible. */
function overflows() {
  const out = [];
  const sel = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList]
      .slice(0, 2)
      .map((c) => `.${c}`)
      .join('')}`;
  const allowed = (el) =>
    el.closest('.table-wrap, [data-scroll-x], .editor-center, .stage-inner, .fd-player-scope, iframe');
  const culprit = (el) => {
    const right = el.getBoundingClientRect().left + el.clientWidth;
    let worst = null;
    for (const d of el.querySelectorAll('*')) {
      const r = d.getBoundingClientRect();
      if (r.width === 0) continue;
      const over = Math.max(r.right - right, d.scrollWidth - d.clientWidth);
      if (over > 1 && (!worst || over > worst.over)) worst = { over: Math.round(over), el: d };
    }
    return worst ? `${sel(worst.el)} (+${worst.over} px)` : 'aucun enfant visible';
  };
  const doc = document.scrollingElement;
  if (doc.scrollWidth > doc.clientWidth + 1)
    out.push({ c: 'page', over: doc.scrollWidth - doc.clientWidth, why: culprit(document.body) });
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (!/auto|scroll/.test(cs.overflowY) || allowed(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
    if (el.scrollWidth > el.clientWidth + 1)
      out.push({ c: sel(el), over: el.scrollWidth - el.clientWidth, why: culprit(el) });
  }
  return out;
}

/** Outils du rail de l'éditeur, actifs. */
async function editorTools(p) {
  return p.$$eval('.ed-rail button[data-tool]', (bs) =>
    bs.filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true').map((b) => b.dataset.tool),
  );
}

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const pages = [
    ...APP_PAGES.map((s) => ({ ...s, kind: 'app' })),
    ...PLAYER_PAGES.map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));
  let bad = 0;
  const report = (name, m) => {
    bad += m.length;
    console.log(`${m.length ? 'NOT OK' : 'ok'} - ${name}`);
    for (const x of m) console.log(`    ${x.c} : +${x.over} px, cause ${x.why}`);
  };
  const check = (p) => p.evaluate(overflows);
  for (const width of [1440, 390])
    for (const s of pages) {
      const page = { ...s, viewport: width === 390 ? { width: 390, height: 844 } : s.viewport };
      try {
        const m =
          s.kind === 'app'
            ? await appPage(b, page, 'light', check)
            : await playerPage(b, page, 'light', check);
        report(`${s.name} (${width} px)`, m);
      } catch (e) {
        console.log(`NOT OK - ${s.name} (${width} px) : contrôle impossible (${e.message.split('\n')[0]})`);
        process.exitCode = 1;
      }
    }
  // Recette 17-18 : panneau du hotspot (bug client), geste horizontal (trackpad, Maj + molette) sans effet
  if (!only.length || only.some((o) => 'éditeur · hotspot'.includes(o.toLowerCase()))) {
    const hs = APP_PAGES.find((x) => x.name === 'Éditeur · hotspot sélectionné');
    await appPage(b, hs, 'light', async (p) => {
      const body = p.locator('.ed-tool__body');
      await body.hover();
      await p.mouse.wheel(400, 0);
      await p.keyboard.down('Shift');
      await p.mouse.wheel(0, 400);
      await p.keyboard.up('Shift');
      await p.waitForTimeout(300);
      const left = await body.evaluate((el) => el.scrollLeft);
      report(
        `Éditeur · hotspot : geste horizontal, scrollLeft = ${left}`,
        left === 0 ? [] : [{ c: '.ed-tool__body', over: left, why: 'défilement horizontal' }],
      );
      return [];
    });
  }
  // Tous les panneaux de l'éditeur : chaque outil du rail, l'un après l'autre
  if (!only.length || only.some((o) => 'éditeur'.includes(o.toLowerCase()))) {
    const editor = { name: 'Éditeur', route: `/#/demos/${DEMO}/edit` };
    await appPage(b, editor, 'light', async (p) => {
      for (const tool of await editorTools(p)) {
        await p.click(`.ed-rail button[data-tool="${tool}"]`);
        await p.waitForTimeout(400);
        report(`Éditeur · outil ${tool} (1440 px)`, await p.evaluate(overflows));
      }
      return [];
    });
  }
  await b.close();
  console.log(`\n${bad} conteneur(s) qui défilent horizontalement`);
  if (bad) process.exitCode = 1;
})();
