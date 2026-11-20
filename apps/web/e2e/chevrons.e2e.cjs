/**
 * Demande client (régression récurrente) : sur toutes les pages de l'app, du lecteur et du centre, le chevron
 * de chaque liste déroulante (select) et de chaque bouton de menu déroulant est à 12 px au moins du bord
 * droit, et le texte ne passe pas sous le chevron. Un select au chevron natif (appearance auto) échoue.
 * Données fictives (pages de a11y.e2e.cjs).
 * Usage : app web (:5173) et player (:5174) lancés, puis `node e2e/chevrons.e2e.cjs [filtre…]`.
 */
const { chromium } = require('playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');

const MIN = 12;

/** Mesures dans la page : écart chevron ↔ bord droit (px) et place réservée au texte. */
function measure(min) {
  const out = [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const label = (el) =>
    (
      el.getAttribute('aria-label') ||
      el.id ||
      (el.labels && el.labels[0] && el.labels[0].textContent) ||
      el.textContent ||
      el.className
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 50);
  for (const s of document.querySelectorAll('select')) {
    if (s.multiple || s.size > 1 || !visible(s)) continue;
    const cs = getComputedStyle(s);
    const r = s.getBoundingClientRect();
    const border = parseFloat(cs.borderRightWidth) || 0;
    const pad = parseFloat(cs.paddingRight) || 0;
    const drawn = s.parentElement && s.parentElement.querySelector(':scope > .fd-select-wrap__chevron');
    let gap;
    let size;
    let why = '';
    if (drawn) {
      const c = drawn.getBoundingClientRect();
      gap = r.right - c.right;
      size = c.width;
    } else if (cs.appearance !== 'none') {
      why = 'chevron natif';
    } else if (!/url\(/.test(cs.backgroundImage)) {
      why = 'pas de chevron';
    } else {
      // « right 12px » se calcule en « calc(100% - 12px) » ; la zone de fond s'arrête à la bordure
      const x = cs.backgroundPositionX;
      const m = /calc\(100% - ([\d.]+)px\)/.exec(x) || /right ([\d.]+)px/.exec(x);
      gap = m ? Number(m[1]) + border : x === '100%' ? border : NaN;
      size = parseFloat(cs.backgroundSize) || 16;
      if (Number.isNaN(gap)) why = `position ${x}`;
    }
    if (!why && gap < min) why = `${Math.round(gap)} px du bord`;
    else if (!why && pad + border < gap + size) why = `texte sous le chevron (padding ${pad} px)`;
    out.push({ kind: 'select', name: label(s), gap: why ? null : Math.round(gap), why });
  }
  for (const btn of document.querySelectorAll('[aria-haspopup]:not(select), [role="combobox"]:not(select)')) {
    if (!visible(btn)) continue;
    const svgs = btn.querySelectorAll('svg.lucide-chevron-down, svg.lucide-chevrons-up-down');
    const c = svgs[svgs.length - 1];
    if (!c || !visible(c)) continue;
    // Bouton icône sans cadre propre (dans une puce) : on mesure jusqu'au bord du contrôle visible
    let edge = btn;
    const boxed = (el) => {
      const s = getComputedStyle(el);
      return (
        !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) ||
        parseFloat(s.borderRightWidth) > 0 ||
        s.boxShadow !== 'none'
      );
    };
    for (let i = 0, el = btn; i < 3 && btn.getBoundingClientRect().width <= 32 && !boxed(edge); i++) {
      el = el.parentElement;
      if (el && boxed(el)) edge = el;
    }
    const gap = edge.getBoundingClientRect().right - c.getBoundingClientRect().right;
    out.push({
      kind: 'menu',
      name: label(btn),
      gap: Math.round(gap),
      why: gap < min ? `${Math.round(gap)} px du bord` : '',
    });
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
  let measured = 0;
  let bad = 0;
  const check = (p) => p.evaluate(measure, MIN);
  for (const s of pages) {
    let m;
    try {
      m = s.kind === 'app' ? await appPage(b, s, 'light', check) : await playerPage(b, s, 'light', check);
    } catch (e) {
      console.log(`NOT OK - ${s.name} : mesure impossible (${e.message.split('\n')[0]})`);
      process.exitCode = 1;
      continue;
    }
    measured += m.length;
    const ko = m.filter((x) => x.why);
    bad += ko.length;
    console.log(`${ko.length ? 'NOT OK' : 'ok'} - ${s.name} : ${m.length} liste(s) ou menu(s)`);
    for (const x of ko) console.log(`    ${x.kind} « ${x.name} » : ${x.why}`);
  }
  await b.close();
  console.log(
    `\n${bad} chevron(s) à moins de ${MIN} px ou mal placés, sur ${measured} mesurés (${pages.length} pages)`,
  );
  if (bad) process.exitCode = 1;
})();
