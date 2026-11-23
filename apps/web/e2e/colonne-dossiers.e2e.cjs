/**
 * Retours client 21/11 §2 et §7 (recettes 7 et 14) : colonne Dossiers de Démos et du Sandbox, du haut
 * au bas de la fenêtre, liste qui défile à l'intérieur avec 30 dossiers, « Nouveau dossier » et
 * « Archivées » toujours visibles ; de 1 024 à 1 279 px, colonne repliée par défaut, dépliée par sa
 * poignée (COL-02) ; aucune colonne sous 1 024 px. Faux Supabase, données de la maquette.
 */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

function seed() {
  const s = seedMaquette();
  const base = s.tables.folders[0];
  for (let i = 1; i <= 27; i++) s.tables.folders.push({ ...base, id: `f-extra-${i}`, name: `Dossier ${i}` });
  return s;
}

(async () => {
  const b = await chromium.launch();
  for (const [name, route] of [
    ['Démos', '/#/'],
    ['Sandbox', '/#/sandbox'],
  ])
    for (const width of [1440, 1280, 1024, 390]) {
      const page = await b.newPage({ viewport: { width, height: 900 } });
      await install(page, seed());
      await page.goto(`${APP}${route}`);
      await page.waitForTimeout(1200);
      const tag = `${name} ${width} px`;
      if (width < 1024) {
        ok((await page.locator('.fcol').count()) === 0, `${tag} : pas de colonne`);
        await page.close();
        continue;
      }
      if (width === 1024) {
        // COL-02 : sous 1 280 px, la colonne est repliée tant que la personne n'a rien choisi ; la
        // demi-pastille la déplie et elle pousse le contenu (plus de rail ni de tiroir par-dessus)
        const slot = page.locator('.fcol-slot');
        ok((await slot.boundingBox()).width === 0, `${tag} : colonne repliée par défaut`);
        const left = (await page.locator('.demos-main').boundingBox()).x;
        await page.getByRole('button', { name: 'Déplier les dossiers' }).click();
        await page.waitForFunction(
          () => document.querySelector('.fcol-slot').getBoundingClientRect().width === 232,
        );
        ok(
          (await page.locator('.demos-main').boundingBox()).x === left + 232,
          `${tag} : dépliée, la colonne de 232 px pousse le contenu`,
        );
        ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${tag} : pas de défilement horizontal`,
        );
      }
      // Recette UX : tri naturel (Dossier 2 avant Dossier 10)
      // Les dossiers arrivent après la colonne : on attend le dernier avant de lire l'ordre
      await page.locator('.fcol__row', { hasText: 'Dossier 27' }).waitFor({ state: 'attached' });
      const names = await page.locator('.fcol__row').allInnerTexts();
      const n = (x) => names.findIndex((t) => t.split('\n')[0].trim() === x);
      ok(
        n('Dossier 2') >= 0 && n('Dossier 2') < n('Dossier 10'),
        `${tag} : tri naturel (Dossier 2 avant Dossier 10)`,
      );
      const col = await page.locator('.fcol').boundingBox();
      ok(
        col.y === 0 && col.y + col.height === 900,
        `${tag} : du haut au bas de la fenêtre (${col.y} à ${col.y + col.height})`,
      );
      const scroll = await page.locator('.fcol__scroll').evaluate((e) => [e.scrollHeight, e.clientHeight]);
      const foot = await page.locator('.fcol__foot').boundingBox();
      ok(
        scroll[0] > scroll[1] && foot.y + foot.height <= 900,
        `${tag} : 30 dossiers, la liste défile à l'intérieur, « Archivées » visible`,
      );
      // La page défile : la colonne reste collée
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(300);
      const stuck = await page.locator('.fcol').boundingBox();
      ok(stuck.y === 0 && stuck.y + stuck.height === 900, `${tag} : colonne collante au défilement`);
      await page.close();
    }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
