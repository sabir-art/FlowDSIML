/** Test e2e du player (PL2, PL3, PL4, PL6, PL7) sur un manifeste construit pour l'occasion. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));

const manifest = require('./player-ux.manifest.cjs');
const DEMO = manifest.demoId;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  async function open(viewport) {
    const page = await b.newPage({ viewport });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest: manifest }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await page.route('**/assets/a.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await page.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    await page.goto(`${PLAYER}/#/d/${DEMO}`);
    await page.waitForSelector('.p-stage');
    await page.waitForTimeout(900); // fin de l'animation de zoom
    return page;
  }
  const inside = (box, frame) =>
    box.x >= frame.x - 1 &&
    box.y >= frame.y - 1 &&
    box.x + box.width <= frame.x + frame.width + 1 &&
    box.y + box.height <= frame.y + frame.height + 1;

  // Bureau : bulle hors du calque zoomé, taille normale, dans le cadre ; pastille visible
  const page = await open({ width: 1280, height: 800 });
  const stage = await page.locator('.p-stage').boundingBox();
  const tip = page.locator('.p-stage > .p-tip');
  ok((await tip.count()) === 1, 'PL2 : la bulle est hors du calque zoomé');
  ok(inside(await tip.boundingBox(), stage), 'PL2 : la bulle reste dans le cadre');
  ok(
    (await tip.evaluate((el) => getComputedStyle(el).fontSize)) ===
      (await page.locator('.p-top').evaluate((el) => getComputedStyle(el).fontSize)) ||
      !(await tip.evaluate((el) => !!el.closest('.p-zoom'))),
    'PL2 : texte de la bulle à taille normale',
  );
  ok(inside(await page.locator('.p-beacon').first().boundingBox(), stage), 'PL2 : la pastille reste visible');
  const tipText = await tip.textContent();
  ok(tipText.includes('Merci !') && !/Merci\s{2,}/.test(tipText), 'PL3 : variable vide sans double espace');
  // PL2b : l'image zoomée couvre tout le cadre (aucune bande vide)
  const img = await page.locator('.p-img').boundingBox();
  ok(
    img.x <= stage.x + 0.5 &&
      img.y <= stage.y + 0.5 &&
      img.x + img.width >= stage.x + stage.width - 0.5 &&
      img.y + img.height >= stage.y + stage.height - 0.5,
    'PL2b : l’image zoomée couvre tout le cadre',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/22-player-zoom.png` });
  await page.close();

  // Mobile : pastille visible, titre sur 2 lignes, formulaire bloquant
  const m = await open({ width: 390, height: 844 });
  const mstage = await m.locator('.p-stage').boundingBox();
  ok(
    inside(await m.locator('.p-beacon').first().boundingBox(), mstage),
    'PL2 mobile : la pastille reste visible',
  );
  const title = m.locator('.p-title');
  ok(
    await title.evaluate(
      (el) => el.scrollHeight <= el.clientHeight + 1 && getComputedStyle(el).whiteSpace !== 'nowrap',
    ),
    'PL4 : titre renvoyé à la ligne (2 lignes au plus)',
  );
  ok(
    (await m.locator('.p-top-cta').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)) &&
      (await m.locator('.p-top-cta-icon').evaluate((el) => getComputedStyle(el).display)) !== 'none',
    'PY-7 (remplace PL4) : CTA avec son icône, sans débordement',
  );
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/23-player-mobile-zoom.png` });
  await m.getByRole('button', { name: 'Suivant' }).last().click();
  await m.waitForSelector('.p-form');
  ok((await m.locator('.p-sheet').count()) === 0, 'PL6 : la bulle est retirée pendant le formulaire');
  ok(
    await m.locator('.p-controls').evaluate((el) => el.inert === true),
    'PL6 : navigation inactive pendant le formulaire',
  );
  const box = await m.locator('.p-consent input').boundingBox();
  const row = await m.locator('.p-consent').boundingBox();
  ok(Math.round(box.width) === 20 && Math.round(box.height) === 20, 'PL7 : case de consentement de 20 px');
  ok(row.height >= 44, 'PL7 : ligne cliquable de 44 px au moins');
  await m.locator('.p-consent span').click();
  ok(await m.locator('.p-consent input').isChecked(), 'PL7 : clic sur le libellé coche la case');
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/24-player-formulaire-mobile.png` });
  await m.close();

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
