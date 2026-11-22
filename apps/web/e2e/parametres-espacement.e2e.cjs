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

/** Pages déjà refaites selon le gabarit du §11 (une entrée par page livrée du lot 1). */
const REFAITES = [
  'workspace',
  'profile',
  'members',
  'variables',
  'usage',
  'privacy',
  'security',
  'brand',
  'brand/page',
  'glossary',
  'tags',
  'ai',
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
        // Une section du gabarit (« stg-sec ») est un bloc : on ne mesure pas son intérieur
        const box =
          only &&
          !only.classList.contains('card') &&
          !only.classList.contains('stg-sec') &&
          /^(SECTION|DIV)$/.test(only.tagName)
            ? only
            : body;
        // Le bandeau d'information de tête (« stg-banner », note de lecture seule) est à 24 px de la
        // première section (maquettes du lot 1) : il n'entre pas dans la mesure entre sections
        const k = [...box.children].filter(
          (c) =>
            c.tagName !== 'DIALOG' &&
            c.getAttribute('role') !== 'note' &&
            c.getBoundingClientRect().height > 0,
        );
        return k
          .slice(1)
          .map((c, i) => Math.round(c.getBoundingClientRect().top - k[i].getBoundingClientRect().bottom));
      });
      // Pages passées au gabarit du §11 (lot 1) : 32 px entre deux sections ; les autres : 24 px
      const want = REFAITES.includes(p) ? 32 : 24;
      ok(
        gaps.every((g) => g === want),
        `${p} (${scheme}) : ${want} px entre les blocs (${gaps.join(', ') || 'un seul bloc'})`,
      );
    }
    await page.close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
