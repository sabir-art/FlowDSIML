/**
 * Retours client 21/11 §2 et §7 (recettes 7 et 14) : colonne Dossiers de Démos et du Sandbox, du haut
 * au bas de la fenêtre, liste qui défile à l'intérieur avec 30 dossiers, « Nouveau dossier » et
 * « Archivées » toujours visibles ; rail de 48 px et tiroir de 280 px par-dessus le contenu de 1 024 à
 * 1 279 px ; aucune colonne sous 1 024 px. Faux Supabase, données de la maquette.
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
        const rail = await page.locator('.fcol').boundingBox();
        ok(
          rail.width === 48 && rail.y === 0 && rail.y + rail.height === 900,
          `${tag} : rail de 48 px, pleine hauteur`,
        );
        const left = (await page.locator('.demos-main').boundingBox()).x;
        await page.getByRole('button', { name: 'Afficher les dossiers' }).click();
        const drawer = await page.locator('.fcol--drawer').boundingBox();
        ok(
          drawer.width === 280 && (await page.locator('.demos-main').boundingBox()).x === left,
          `${tag} : tiroir de 280 px par-dessus, le contenu ne bouge pas`,
        );
        // Recette UX : le tiroir passe au-dessus de tout le contenu (indicateurs, recherche, cloche)
        const covered = await page.evaluate(() => {
          const r = document.querySelector('.fcol--drawer').getBoundingClientRect();
          const out = [];
          for (let y = 8; y < r.bottom; y += 24)
            for (const x of [r.left + 60, r.left + 140, r.right - 8]) {
              const e = document.elementFromPoint(x, y);
              if (e && !e.closest('.fcol--drawer'))
                out.push(`${e.tagName.toLowerCase()}.${e.className} (${x}, ${y})`);
            }
          return out;
        });
        ok(
          covered.length === 0,
          `${tag} : tiroir au-dessus du contenu${covered.length ? ` (${covered.slice(0, 3).join(' ; ')})` : ''}`,
        );
        await page.keyboard.press('Escape');
        ok((await page.locator('.fcol--drawer').count()) === 0, `${tag} : Échap ferme le tiroir`);
        // Recette UX (scénario exact) : clic souris, puis Échap aussitôt, sans placer le focus
        await page.waitForTimeout(100);
        await page.getByRole('button', { name: 'Afficher les dossiers' }).click();
        const onOpen = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
        ok(
          onOpen === 'Masquer les dossiers',
          `${tag} : à l’ouverture, focus sur « Masquer les dossiers » (${onOpen})`,
        );
        await page.waitForTimeout(800); // délai d'ouverture des infobulles dépassé, pointeur toujours dessus
        ok(
          (await page.locator('.fd-tooltip').count()) === 0,
          `${tag} : pas d’infobulle sur le bouton cliqué`,
        );
        await page.keyboard.press('Escape');
        ok((await page.locator('.fcol--drawer').count()) === 0, `${tag} : un seul Échap ferme le tiroir`);
        await page.waitForTimeout(100);
        const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
        ok(
          focused === 'Afficher les dossiers',
          `${tag} : focus rendu à « Afficher les dossiers » (${focused})`,
        );
        await page.close();
        continue;
      }
      // Recette UX : tri naturel (Dossier 2 avant Dossier 10)
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
