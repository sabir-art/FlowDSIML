const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const f of process.argv.slice(2)) {
    await p.goto('file://' + path.resolve(__dirname, '../../../docs/ux/maquettes/refonte/' + f));
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${process.env.SHOTS_DIR}/rf-${f.replace(/[^a-z0-9]/gi, '_')}.png` });
  }
  await b.close();
})();
