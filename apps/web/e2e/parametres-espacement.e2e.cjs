/**
 * Retours client 21/11 §3 (recette 8) : 24 px entre deux blocs empilés (description, cartes, tableaux)
 * sur toutes les pages des Paramètres, en clair et en sombre (faux Supabase, données de la maquette).
 */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PAGES = [
  'workspace',
  'members',
  'usage',
  'security',
  'privacy',
  'brand',
  'brand/page',
  'variables',
  'glossary',
  'tags',
  'ai',
  'integrations',
  'integrations/webhooks',
  'profile',
];

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const page = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    await install(page, seedMaquette());
    for (const p of PAGES) {
      await page.goto(`${APP}/#/settings/${p}`);
      await page.waitForSelector('.st-wrap > :not(dialog)');
      await page.waitForTimeout(500);
      // Écarts entre blocs visibles du conteneur (ou de son enveloppe unique)
      const gaps = await page.evaluate(() => {
        const body = document.querySelector('.st-wrap');
        const vis = [...body.children].filter((c) => c.tagName !== 'DIALOG');
        const only = vis.length === 1 ? vis[0] : null;
        const box =
          only && !only.classList.contains('card') && /^(SECTION|DIV)$/.test(only.tagName) ? only : body;
        const k = [...box.children].filter(
          (c) => c.tagName !== 'DIALOG' && c.getBoundingClientRect().height > 0,
        );
        return k
          .slice(1)
          .map((c, i) => Math.round(c.getBoundingClientRect().top - k[i].getBoundingClientRect().bottom));
      });
      ok(
        gaps.every((g) => g === 24),
        `${p} (${scheme}) : 24 px entre les blocs (${gaps.join(', ') || 'un seul bloc'})`,
      );
    }
    await page.close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
