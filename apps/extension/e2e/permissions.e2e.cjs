/**
 * EXT-STORE : build publié (sans WXT_E2E), sans accès aux sites dans le manifeste. Au clic sur « Démarrer »,
 * le popup montre l'encart d'explication avant toute demande de Chrome ; « Pas maintenant » démarre la capture
 * sur la seule page de départ et le dit sous le type. Aucune autorisation n'est demandée à l'ouverture.
 * Usage :
 *   node e2e/mock-supabase.cjs &
 *   WXT_SUPABASE_URL=http://localhost:54400 WXT_SUPABASE_ANON_KEY=anon pnpm build
 *   node e2e/permissions.e2e.cjs
 */
const { chromium } = require('playwright');
const ui = require('./popup-ui.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${m}`);
  if (!c) failed++;
};

(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  ok(!manifest.host_permissions, 'manifeste : aucun accès obligatoire aux sites');
  ok(
    JSON.stringify(manifest.optional_host_permissions) === JSON.stringify(['<all_urls>']),
    'manifeste : accès aux sites facultatif',
  );
  ok(
    manifest.name === 'TutoClick Capture' && manifest.description.length <= 132,
    'manifeste : nom et résumé',
  );
  ok(!manifest.permissions.includes('debugger'), 'manifeste : pas de debugger (option B)');

  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  ok((await popup.locator('#workspace-l').innerText()) === 'Espace', 'popup : « Espace »');
  ok(
    (await popup.locator('#perm').isHidden()) && (await popup.locator('#start').isVisible()),
    'rien demandé à l’ouverture',
  );

  // Option B : Format mobile visible, désactivé, « Bientôt » ; page entière en « Bientôt »
  await popup.click('#type');
  const mobile = popup.locator('#type + [role=listbox] [data-value=mobile]');
  ok(
    (await mobile.getAttribute('aria-disabled')) === 'true' &&
      (await mobile.locator('.pill').innerText()) === 'Bientôt' &&
      (await mobile.locator('small').innerText()) ===
        'Pas encore disponible dans cette version de l’extension.',
    'Format mobile : visible, désactivé, « Bientôt »',
  );
  // « Bientôt » à droite du nom ; l'aide tient sur 2 lignes au plus
  const [nameBox, soonBox, helpBox] = await Promise.all(
    ['b', '.pill', 'small'].map((s) => mobile.locator(s).boundingBox()),
  );
  ok(
    soonBox.x > nameBox.x + nameBox.width && helpBox.height < 40,
    `« Bientôt » à droite du nom, aide sur 2 lignes au plus (${Math.round(helpBox.height)} px)`,
  );
  await popup.keyboard.press('Escape');
  await ui.openOptions(popup);
  const full = popup.locator('#full-row');
  ok(
    (await full.locator('.k').innerText()).trim() === 'Page entière' &&
      (await full.locator('.pill').innerText()) === 'Bientôt' &&
      (await full.isVisible()),
    'page entière : ligne visible, « Bientôt »',
  );
  ok(
    (await popup.locator('#tabsize-h').innerText()).startsWith(
      'La fenêtre est redimensionnée le temps de la capture',
    ),
    'taille de l’onglet : par la fenêtre',
  );
  await ui.pick(popup, 'type', 'html');
  // Comme dans le vrai popup, l'onglet actif est la page à capturer (sinon « Démarrer » est désactivé)
  const target = await ctx.newPage();
  await target.goto('http://localhost:54400/page');
  await target.bringToFront();
  await popup.evaluate(() => document.getElementById('error-retry').click());
  await popup.waitForSelector('#start[aria-disabled=false]');
  await popup.click('#start');
  await popup.locator('#perm').waitFor();
  ok(await popup.locator('#start').isHidden(), 'encart à la place de « Démarrer »');
  ok(
    (await popup.locator('#perm-t').innerText()) === 'Une autorisation de Chrome est nécessaire' &&
      /accéder aux pages que vous parcourez/.test(await popup.locator('#perm-why').innerText()),
    'encart : titre et raison (accès aux sites)',
  );
  const gaps = await popup.locator('#perm').evaluate((el) => {
    const k = [...el.children].filter((c) => c.getBoundingClientRect().height > 0);
    let min = Infinity;
    for (let i = 1; i < k.length; i++)
      min = Math.min(min, k[i].getBoundingClientRect().top - k[i - 1].getBoundingClientRect().bottom);
    return Math.round(min);
  });
  ok(gaps >= 16, `encart : 16 px entre les blocs (${gaps})`);
  const native = await popup
    .locator('#perm button')
    .evaluateAll(
      (bs) =>
        bs.filter(
          (b) =>
            /outset|inset/.test(getComputedStyle(b).borderTopStyle) ||
            getComputedStyle(b).backgroundColor === 'rgb(239, 239, 239)',
        ).length,
    );
  ok(native === 0, 'encart : aucun bouton natif');
  await popup.click('#perm-later');
  await popup.locator('#perm-denied:not([hidden])').waitFor();
  ok(
    (await popup.locator('#perm-denied-text').innerText()) ===
      'La capture reste sur la page ouverte au démarrage.' && (await popup.locator('#start').isVisible()),
    '« Pas maintenant » : la capture reste sur la page de départ, explication sous le type',
  );
  await ctx.close();
  console.log(failed ? `${failed} échec(s)` : 'tout est vert');
  process.exitCode = failed ? 1 : 0;
})();
