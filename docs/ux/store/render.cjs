/** Rend chaque section de fiche-store.html en PNG à sa taille exacte. Usage : node render.cjs (depuis docs/ux/store). */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'fiche-store.html'));
  await p.evaluate(() => document.fonts.ready);
  const out = { 'capture-1': 'capture-1-1280x800.png', 'capture-2': 'capture-2-1280x800.png', 'capture-3': 'capture-3-1280x800.png', 'capture-4': 'capture-4-1280x800.png', 'capture-5': 'capture-5-1280x800.png', vignette: 'vignette-440x280.png', icone: 'icone-128.png' };
  for (const [id, file] of Object.entries(out)) {
    // L'icône doit garder ses 16 px de marge transparente : pas de fond de page derrière elle.
    if (id === 'icone') await p.evaluate(() => { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; });
    await p.locator('#' + id).screenshot({ path: path.join(__dirname, file), omitBackground: id === 'icone' });
  }
  await b.close();
})();
