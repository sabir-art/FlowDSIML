/**
 * Test e2e F7 (lecteur) : étape vidéo (coupe, pause-étape, sous-titres, son, curseur) et démo mobile
 * (cadre de téléphone, feuille du bas, feuille en haut si le hotspot est bas). Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/video-player.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');
const webm = fs.readFileSync(path.join(__dirname, 'fixture-video.webm'));
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));
/** L21-05 / 06 : vraie capture mobile fictive (390 × 844), générée par le test (domaines .example). */
const MOBILE_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;width:390px;height:844px;font:15px/1.4 system-ui,sans-serif;color:#1c1917;background:#f5f5f4}
  header{height:72px;display:flex;align-items:center;gap:12px;padding:0 16px;background:#1f2a44;color:#fff}
  #menu{width:44px;height:44px;border-radius:10px;border:0;background:#2e3b5c;display:grid;place-items:center}
  #menu i{display:block;width:20px;height:2px;background:#fff;box-shadow:0 6px #fff,0 -6px #fff}
  header b{font-size:17px}header span{margin-left:auto;font-size:12px;opacity:.85}
  main{padding:18px 16px}h1{font-size:22px;margin:0 0 14px}
  .f{display:block;margin-bottom:12px}.f small{display:block;color:#57534e;margin-bottom:4px}
  .f div{height:44px;border:1px solid #d6d3d1;border-radius:10px;background:#fff;padding:11px 12px}
  #ok{position:absolute;left:16px;right:16px;top:760px;height:52px;border:0;border-radius:12px;background:#4f46e5;color:#fff;font:600 16px system-ui}
</style></head><body><header><button id="menu" aria-label="Menu"><i></i></button><b>ExampleCRM</b><span>alice@acme.example</span></header>
<main><h1>Nouvelle fiche</h1>
<label class="f"><small>Nom</small><div>Martin</div></label>
<label class="f"><small>Prénom</small><div>Camille</div></label>
<label class="f"><small>Courriel</small><div>camille.martin@acme.example</div></label>
<label class="f"><small>Téléphone</small><div>01 23 45 67 89</div></label>
<label class="f"><small>Structure</small><div>Équipe Nord</div></label>
</main><button id="ok">Enregistrer la fiche</button></body></html>`;
let mobilePng = png;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const N = ' ';
const base = (id, extra) => ({
  schemaVersion: 1,
  demoId: id,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000b9',
  workspaceId: 'w',
  title: 'Saisir une fiche',
  locale: 'fr',
  publishedAt: '2026-11-19T10:00:00Z',
  theme: {},
  ...extra,
});
const VID = '0b5c1f0e-0000-4000-8000-0000000000b1';
const MOB = '0b5c1f0e-0000-4000-8000-0000000000b2';
const manifests = {
  [VID]: base(VID, {
    steps: [
      {
        id: 'v1',
        kind: 'video',
        title: 'Saisie de la fiche',
        video: {
          url: 'assets/v.webm',
          durationMs: 12000,
          cuts: [{ from: 2000, to: 4000 }],
          pauses: [
            { id: 'p1', t: 5000, title: 'Le formulaire', body: 'Remplissez les champs obligatoires.' },
          ],
          captions: [{ from: 0, to: 6000, text: 'Ouvrez la fiche de l’usager.' }],
          hasVoice: true,
          autoplayMuted: true,
        },
      },
      { id: 'v2', kind: 'text', title: 'Merci', body: '' },
    ],
  }),
  [MOB]: base(MOB, {
    device: 'mobile',
    viewport: { w: 390, h: 844 },
    steps: [
      {
        id: 'm1',
        kind: 'image',
        image: { url: 'assets/m.png', width: 390, height: 844 },
        hotspots: [
          {
            id: 'h1',
            x: 16 / 390,
            y: 14 / 844,
            w: 44 / 390,
            h: 44 / 844,
            title: 'Ouvrez le menu',
            placement: 'auto',
            action: { type: 'next' },
          },
        ],
      },
      {
        id: 'm2',
        kind: 'image',
        image: { url: 'assets/m.png', width: 390, height: 844 },
        hotspots: [
          {
            id: 'h2',
            x: 16 / 390,
            y: 760 / 844,
            w: 358 / 390,
            h: 52 / 844,
            title: 'Validez',
            placement: 'auto',
            action: { type: 'next' },
          },
        ],
      },
    ],
  }),
};

(async () => {
  const b = await chromium.launch();
  {
    const mp = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await mp.setContent(MOBILE_PAGE);
    mobilePng = await mp.screenshot();
    await mp.context().close();
  }
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (id, vp) => {
    const p = await (await themedContext(b, { viewport: vp, locale: 'fr-FR' })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          status: 'ok',
          manifest: manifests[JSON.parse(r.request().postData()).demoId] ?? manifests[id],
        }),
      }),
    );
    // Comme le stockage : requêtes partielles (Range) pour pouvoir se déplacer dans la vidéo
    await p.route('**/assets/v.webm', (r) => {
      const m = /bytes=(\d+)-(\d*)/.exec(r.request().headers()['range'] || '');
      if (!m)
        return r.fulfill({ contentType: 'video/webm', headers: { 'accept-ranges': 'bytes' }, body: webm });
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : webm.length - 1;
      return r.fulfill({
        status: 206,
        contentType: 'video/webm',
        headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${webm.length}` },
        body: webm.subarray(start, end + 1),
      });
    });
    await p.route('**/assets/m.png', (r) => r.fulfill({ contentType: 'image/png', body: mobilePng }));
    await p.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
    await p.goto(`${PLAYER}/#/d/${id}`);
    return p;
  };

  // ===== Vidéo =====
  const p = await open(VID, { width: 1280, height: 860 });
  await p.waitForSelector('.p-video video');
  ok((await p.locator('video').evaluate((v) => v.muted)) === true, 'départ sans son');
  ok((await p.getByRole('button', { name: 'Activer le son' }).count()) >= 1, 'bouton « Activer le son »');
  ok(
    (await p.getByRole('button', { name: 'Sous-titres' }).getAttribute('aria-pressed')) === 'true',
    'sous-titres activés (voix)',
  );
  const slider = p.getByRole('slider', { name: 'Position dans la vidéo' });
  ok((await slider.getAttribute('aria-valuemax')) === '10000', 'durée après coupe (10 s)');
  ok((await p.locator('.p-video__mark').count()) === 1, 'pause marquée sur la barre');
  await p.locator('video').evaluate((v) => v.play());
  await p.getByRole('dialog', { name: 'Le formulaire' }).waitFor({ timeout: 15000 });
  ok(true, 'arrêt et bulle à la pause-étape');
  ok((await p.getByText('Pause 1 sur 1').count()) === 1, '« Pause 1 sur 1 »');
  ok(
    await p.evaluate(() => document.activeElement?.classList.contains('p-video__bubble')),
    'focus sur la bulle',
  );
  ok(
    (await p.locator('.p-video__cc').textContent()) === 'Ouvrez la fiche de l’usager.',
    'sous-titre affiché',
  );
  const t = await p.locator('video').evaluate((v) => v.currentTime);
  ok(t >= 4.9 && t < 5.6, 'coupe sautée (temps de la pause dans la vidéo d’origine)');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l21-04-video${sfx}.png` });
  await p.getByRole('button', { name: 'Continuer' }).click();
  await p.getByRole('button', { name: 'Sous-titres' }).click();
  ok((await p.locator('.p-video__cc').count()) === 0, 'sous-titres masqués');
  ok(
    (await slider.getAttribute('aria-valuetext')).replace(/\s/g, ' ').includes(`sur 0:10`),
    'curseur : valeur en minutes et secondes',
  );
  await p.getByRole('button', { name: 'Activer le son' }).first().click();
  ok((await p.locator('video').evaluate((v) => v.muted)) === false, 'son activé');

  // ===== Mobile : cadre (grand écran) =====
  const m = await open(MOB, { width: 1440, height: 900 });
  await m.waitForSelector('.p-root.is-framed');
  const box = await m.locator('.p-root').boundingBox();
  ok(box.height > box.width * 1.8, 'cadre de téléphone (portrait)');
  ok((await m.locator('.p-sheet').count()) === 1, 'bulle en feuille');
  ok(
    !(await m.locator('.p-sheet').getAttribute('class')).includes('p-sheet--top'),
    'hotspot haut : feuille en bas',
  );
  ok(
    (await m.getByRole('button', { name: `Touchez${N}: Ouvrez le menu` }).count()) === 1,
    '« Touchez » pour une démo mobile',
  );
  const bb = await m.locator('.p-beacon').boundingBox();
  ok(bb.width >= 44 && bb.height >= 44, 'zone tactile de 44 px');
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/l21-05-mobile${sfx}.png` });
  await m
    .locator('.p-sheet')
    .getByRole('button', { name: /Suivant/ })
    .click();
  await m.waitForTimeout(400);
  ok(
    (await m.locator('.p-sheet').getAttribute('class')).includes('p-sheet--top'),
    'hotspot bas : feuille en haut',
  );
  const sheet = await m.locator('.p-sheet').boundingBox();
  const beacon = await m.locator('.p-beacon').boundingBox();
  ok(sheet.y + sheet.height < beacon.y, 'la feuille ne cache pas le hotspot');
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/l21-06-mobile-haut${sfx}.png` });

  // ===== Mobile : vrai téléphone (sans cadre) =====
  const ph = await open(MOB, { width: 390, height: 844 });
  await ph.waitForSelector('.p-root.is-mobile');
  ok((await ph.locator('.p-root.is-framed').count()) === 0, 'vrai téléphone : plein écran, sans cadre');

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
