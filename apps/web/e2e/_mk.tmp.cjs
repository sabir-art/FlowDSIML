const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const f of process.argv.slice(2)) {
    await p.goto('file://' + path.resolve(__dirname, '../../../docs/ux/maquettes/' + f + '.html'));
    await p.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      document.querySelector('.mock-nav')?.remove();
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${process.env.SHOTS_DIR}/mk-${f}.png` });
  }
  await b.close();
})();
