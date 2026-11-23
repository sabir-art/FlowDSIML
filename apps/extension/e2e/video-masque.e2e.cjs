/**
 * Vidéo : qualité du masquage en direct (retours du client, 23/11). Le masque est porté par le contenu de
 * la page : il suit le défilement sans retard (une donnée hors de la fenêtre est déjà masquée quand elle
 * arrive à l'écran), ne recouvre pas un panneau ouvert par-dessus, et « Assistant IA » n'est plus pris
 * pour un nom. Page fictive /masque de mock-supabase.cjs. Usage : comme video.e2e.cjs.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 1280, height: 720 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const results = [];
  const ok = (cond, label) => results.push([!!cond, label]);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto('http://localhost:54400/masque');
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  await popup.evaluate(
    (id) =>
      chrome.scripting.executeScript({ target: { tabId: id }, files: ['/content-scripts/videobar.js'] }),
    tabId,
  );
  await page.bringToFront();
  await page.waitForSelector('#haut[data-fd-masked]');
  const blurred = (sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e.hasAttribute('data-fd-masked') && getComputedStyle(e).filter.includes('blur');
    }, sel);

  // 1. Défilement : ce qui est hors de la fenêtre est déjà masqué
  ok(await blurred('#haut'), 'donnée visible : masquée dans la page (flou porté par l’élément)');
  ok(
    (await page.evaluate(() => document.querySelector('#fin').getBoundingClientRect().top > innerHeight)) &&
      (await blurred('#bas')) &&
      (await blurred('#fin')),
    'données hors de la fenêtre : déjà masquées avant d’arriver à l’écran',
  );
  // Saut immédiat en bas de page : dans la même tâche que le défilement, la donnée est masquée
  const atOnce = await page.evaluate(() => {
    scrollTo(0, document.documentElement.scrollHeight);
    const e = document.querySelector('#fin');
    const r = e.getBoundingClientRect();
    return r.top < innerHeight && getComputedStyle(e).filter.includes('blur');
  });
  ok(atOnce, 'défilement rapide : la donnée arrive à l’écran déjà masquée, sans image de retard');
  ok(
    (await page.evaluate(() => document.querySelectorAll('[data-fd-ui]:not(style)').length)) === 1,
    'plus de calque de rectangles posé au-dessus de la fenêtre (seule la barre d’enregistrement)',
  );
  await page.evaluate(() => scrollTo(0, 0));

  // 2. Nom au milieu d'un long texte : seule sa portion est couverte, pas tout le paragraphe
  const inline = await page.evaluate(() => {
    const h = CSS.highlights.get('fd-mask');
    const texts = h ? [...h].map((r) => r.toString()) : [];
    return { texts, parent: document.querySelector('#long').hasAttribute('data-fd-masked') };
  });
  ok(
    inline.texts.length === 1 && inline.texts[0].length === 'Camille MARTIN'.length && !inline.parent,
    `nom dans un long texte : seule sa portion est couverte (${inline.texts.length} portion)`,
  );

  // 3. Faux positif : « Assistant IA » n'est pas un nom
  ok(!(await blurred('#assistant')), '« Assistant IA » n’est pas masqué');

  // 4. Panneau ouvert par-dessus une donnée masquée : il reste net et rien ne le recouvre
  await page.click('#ouvrir');
  await page.waitForSelector('#panneau');
  const panel = await page.evaluate(() => {
    const d = document.querySelector('#haut').getBoundingClientRect();
    const top = document.elementFromPoint(d.left + 5, d.top + d.height / 2);
    const p = document.querySelector('#panneau');
    return {
      over: top === p,
      net: getComputedStyle(p).filter === 'none' && !p.closest('[data-fd-masked]'),
      under: getComputedStyle(document.querySelector('#haut')).filter.includes('blur'),
    };
  });
  ok(
    panel.over && panel.net && panel.under,
    'panneau ouvert par-dessus : il reste net, la donnée reste masquée dessous',
  );

  // 5. Nouveau contenu : masqué dès son arrivée ; fin de l'enregistrement : la page est rendue intacte
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.id = 'neuf';
    p.textContent = 'Tél. 07 98 76 54 32';
    document.body.prepend(p);
  });
  await page.waitForSelector('#neuf[data-fd-masked]');
  ok(true, 'contenu ajouté pendant l’enregistrement : masqué à son arrivée');
  await popup.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'fd:recorder-stop' }), tabId);
  await page.waitForFunction(() => !document.querySelector('[data-fd-masked]'));
  ok(
    await page.evaluate(
      () =>
        !CSS.highlights.has('fd-mask') && getComputedStyle(document.querySelector('#haut')).filter === 'none',
    ),
    'fin de l’enregistrement : plus aucun masque dans la page',
  );
  await ctx.close();
  for (const [c, l] of results) console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (results.some(([c]) => !c)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
