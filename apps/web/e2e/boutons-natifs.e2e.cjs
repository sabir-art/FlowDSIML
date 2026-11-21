/**
 * Retour client : aucun bouton visible à l'apparence native du navigateur (fond ButtonFace, bordure
 * « outset »), sur toutes les pages de l'app, du lecteur et du centre (pages de a11y.e2e.cjs), plus la
 * fenêtre « Installer l'extension ». Un bouton doit passer par le design system (fd-btn, btn, link-btn…).
 * Usage : app web (:5173) et player (:5174) lancés, puis `node e2e/boutons-natifs.e2e.cjs [filtre…]`.
 */
const { chromium } = require('playwright');
const { APP_PAGES, PLAYER_PAGES, appPage, playerPage } = require('./a11y.e2e.cjs');

/** Dans la page : boutons visibles dont le rendu reste celui du navigateur. */
function natives() {
  const ref = document.createElement('span');
  ref.style.cssText = 'position:absolute;visibility:hidden;background-color:ButtonFace;color:ButtonText';
  document.body.append(ref);
  const face = getComputedStyle(ref).backgroundColor;
  ref.remove();
  const out = [];
  const sel = 'button, input[type="button"], input[type="submit"], input[type="reset"]';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const why = [];
    if (cs.backgroundColor === face) why.push(`fond ButtonFace (${face})`);
    if ([cs.borderTopStyle, cs.borderBottomStyle].includes('outset')) why.push('bordure outset');
    if (!why.length) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || el.value || el.className || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 50);
    out.push({ name, why: why.join(', ') });
  }
  return out;
}

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const pages = [
    ...APP_PAGES.map((s) => ({ ...s, kind: 'app' })),
    {
      name: 'Fenêtre Installer l’extension',
      route: '/#/',
      kind: 'app',
      open: async (p) => {
        await p.locator('.sidebar').getByRole('button', { name: 'Extension' }).click();
        await p.getByRole('dialog', { name: 'Installer l’extension' }).waitFor();
      },
    },
    ...PLAYER_PAGES.map((s) => ({ ...s, kind: 'player' })),
  ].filter((s) => !only.length || only.some((o) => s.name.toLowerCase().includes(o.toLowerCase())));
  let bad = 0;
  const check = (p) => p.evaluate(natives);
  for (const s of pages) {
    let m;
    try {
      m = s.kind === 'app' ? await appPage(b, s, 'light', check) : await playerPage(b, s, 'light', check);
    } catch (e) {
      console.log(`NOT OK - ${s.name} : contrôle impossible (${e.message.split('\n')[0]})`);
      process.exitCode = 1;
      continue;
    }
    bad += m.length;
    console.log(`${m.length ? 'NOT OK' : 'ok'} - ${s.name}`);
    for (const x of m) console.log(`    « ${x.name} » : ${x.why}`);
  }
  await b.close();
  console.log(`\n${bad} bouton(s) à l’apparence native sur ${pages.length} pages`);
  if (bad) process.exitCode = 1;
})();
