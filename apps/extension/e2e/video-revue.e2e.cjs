/**
 * EXT-02 §4.4 : écran « Vérifier la vidéo » (faux Supabase, mock-supabase.cjs ; enregistrement fictif déposé
 * dans le stockage de l'extension). Direct désactivé : données proposées masquées, « Démasquer » / « Masquer »,
 * « Pourquoi masqué ? », chronologie, masque ajouté (bouton, glisser, clavier), préparation de la vidéo
 * puis envoi. Direct activé : statut « En direct », pas d'action, envoi sans préparation.
 * Usage : comme video.e2e.cjs. SHOTS_DIR pour les captures, THEME=dark pour le sombre.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { AxeBuilder } = require(
  require.resolve('@axe-core/playwright', { paths: [path.resolve(__dirname, '../../web')] }),
);
const WS = '11111111-1111-1111-1111-111111111111';
const MOCK = 'http://localhost:54400';
(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const start = (await (await fetch(`${MOCK}/__log`)).json()).length;
  const getLog = async () => (await (await fetch(`${MOCK}/__log`)).json()).slice(start);
  const dark = process.env.THEME === 'dark';
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    colorScheme: dark ? 'dark' : 'light',
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const shot = (p, name) =>
    process.env.SHOTS_DIR &&
    p.screenshot({
      path: `${process.env.SHOTS_DIR}/${name}-${dark ? 'sombre' : 'clair'}.png`,
      fullPage: true,
    });
  const results = [];
  const ok = (cond, label) => results.push([!!cond, label]);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('#login button[type=submit]');
  await popup.waitForSelector('#setup:not([hidden])');
  const fixture = fs.readFileSync(path.resolve(__dirname, '../../web/e2e/fixture-video.webm'));
  const R = (x, y, w = 0.2, h = 0.05) => ({ x, y, w, h });
  /** Données fictives repérées pendant l'enregistrement (12 s). */
  const masks = (live) => [
    {
      id: 'name-a1',
      type: 'name',
      excerpt: 'C•••••• M••••••',
      by: 'label',
      label: 'Contact',
      live,
      on: true,
      frames: [
        { t: 1000, rects: [R(0.3, 0.3)] },
        { t: 2500, rects: [R(0.3, 0.2)] },
        { t: 5000, rects: [] },
      ],
    },
    {
      id: 'email-b2',
      type: 'email',
      excerpt: 'c••••@••••.example',
      by: 'pattern',
      live,
      on: true,
      frames: [
        { t: 4000, rects: [R(0.3, 0.4, 0.3)] },
        { t: 9000, rects: [] },
      ],
    },
    {
      id: 'phone-c3',
      type: 'phone',
      excerpt: '06 •• •• •• ••',
      by: 'field',
      label: 'Téléphone',
      live,
      on: true,
      frames: [{ t: 7000, rects: [R(0.5, 0.6)] }],
    },
  ];
  const seed = (live) =>
    popup.evaluate(
      async (a) => {
        const bytes = Uint8Array.from(atob(a.fixture), (c) => c.charCodeAt(0));
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('fd-video', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('video', { keyPath: 'id' });
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const v = {
          id: 'current',
          blob: new Blob([bytes], { type: 'video/webm' }),
          mime: 'video/webm',
          durationMs: 12000,
          marks: [
            { t: 1200, label: 'Ouvrir la fiche', manual: false, zones: [] },
            { t: 6500, label: 'Enregistrer', manual: false, zones: [] },
          ],
          frames: [new Blob(), new Blob()],
          hasVoice: false,
          micDenied: false,
          blurredZones: 3,
          masks: a.masks,
          workspaceId: a.WS,
          title: 'Vidéo fictive',
          device: 'desktop',
          viewport: null,
          url: 'http://localhost:54400/page',
        };
        await new Promise((res, rej) => {
          const t = db.transaction('video', 'readwrite');
          t.objectStore('video').put(v);
          t.oncomplete = res;
          t.onerror = () => rej(t.error);
        });
      },
      { fixture: fixture.toString('base64'), masks: masks(live), WS },
    );
  const errors = [];
  const open = async () => {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 1440, height: 900 });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('dialog', (d) => {
      // Seule la préparation peut déclencher l'avertissement du navigateur à la fermeture
      if (d.type() !== 'beforeunload') errors.push(`fenêtre native : ${d.message()}`);
      void d.accept();
    });
    await p.goto(`chrome-extension://${extId}/video-review.html`);
    await p.locator('#send:not([disabled])').waitFor();
    return p;
  };
  const tus = async () =>
    (await getLog()).filter((l) => l.u.startsWith('/storage/v1/upload/resumable') && l.tus);

  // ================= Direct désactivé =================
  await seed(false);
  const v = await open();
  const rows = v.locator('#list > li.mr');
  const row = (name) => rows.filter({ hasText: name });
  ok(
    (await v.title()) === 'Vérifier la vidéo' && (await v.locator('h1').innerText()) === 'Vérifier la vidéo',
    'titre',
  );
  ok(
    /^TutoClick a repéré 3 données et les masque\. Vérifiez chaque zone : démasquez une erreur, masquez un oubli\. Les masques sont appliqués à l’envoi, rien ne part sans eux\.$/.test(
      await v.locator('#intro').innerText(),
    ),
    'phrase d’introduction (direct désactivé)',
  );
  ok(
    (await rows.locator('.mr-name').allInnerTexts()).join('|') ===
      'Nom · « C•••••• M•••••• »|E-mail · « c••••@••••.example »|Téléphone · « 06 •• •• •• •• »',
    `une ligne par donnée, type et valeur masquée (${(await rows.locator('.mr-name').allInnerTexts()).join(' | ')})`,
  );
  ok(
    (await rows.locator('.tx .mu').allInnerTexts()).join('|') === '0:01 – 0:05|0:04 – 0:09|0:07 – 0:12',
    `passage de chaque donnée (${(await rows.locator('.tx .mu').allInnerTexts()).join(' | ')})`,
  );
  ok(
    (await rows.locator('.st2').allInnerTexts()).every((t) => t.trim() === 'Masqué') &&
      (await v.locator('#count').innerText()) === '3 sur 3' &&
      (await rows.getByRole('button', { name: /^Démasquer/ }).count()) === 3,
    'données proposées masquées : « Masqué », « 3 sur 3 », « Démasquer »',
  );
  const tl = v.getByRole('slider', { name: 'Chronologie des masques' });
  ok(
    (await tl.locator('.seg').count()) === 3 &&
      (await tl.locator('.seg.off').count()) === 0 &&
      (await v.locator('#time').innerText()) === '0:00 / 0:12',
    `chronologie : 3 passages, temps « 0:00 / 0:12 » (${await v.locator('#time').innerText()})`,
  );
  // Colonnes fixes d'une ligne à l'autre
  const xs = await rows.evaluateAll((ls) =>
    ls.map((l) =>
      [...l.children]
        .slice(1, 3)
        .map((c) => Math.round(c.getBoundingClientRect().x))
        .join(','),
    ),
  );
  ok(new Set(xs).size === 1, `statut et action alignés d’une ligne à l’autre (${xs[0]})`);
  const split = await v.evaluate(() => {
    const b = (s) => document.querySelector(s).getBoundingClientRect();
    return { side: Math.round(b('.mside').width), same: Math.abs(b('.mside').y - b('.vplayer').y) < 2 };
  });
  ok(split.side === 440 && split.same, `deux colonnes : lecteur, liste de 440 px (${split.side})`);
  await shot(v, 'video-revue');

  // Cliquer une ligne : la lecture va au passage, la zone est entourée
  await row('E-mail')
    .getByRole('button', { name: /^Aller au passage : E-mail/ })
    .click();
  await v.waitForFunction(() => document.querySelector('#time').textContent.startsWith('0:04'));
  ok(
    (await row('E-mail').evaluate((e) => e.classList.contains('on'))) &&
      (await v.locator('.vmask.is-sel').count()) === 1 &&
      (await tl.getAttribute('aria-valuetext')) === '0:04 sur 0:12',
    'ligne choisie : lecture au passage, zone entourée, chronologie annoncée',
  );
  const sel = await v.locator('.vmask.is-sel').evaluate((e) => {
    const s = getComputedStyle(e);
    return `${s.outlineStyle} ${s.outlineWidth}`;
  });
  ok(sel === 'dashed 2px', `zone choisie entourée d’un pointillé de 2 px (${sel})`);

  // « Pourquoi masqué ? »
  const why = row('Nom ·').getByRole('button', { name: /^Pourquoi masqué \?/ });
  await why.click();
  ok(
    (await row('Nom ·')
      .getByRole('button', { name: /^Pourquoi masqué/ })
      .getAttribute('aria-expanded')) === 'true' &&
      (await v.locator('#list > li.why').innerText()) ===
        'Repéré comme un nom de personne : le texte suit le libellé « Contact ». Si ce n’en est pas un, « Démasquer » rétablit l’image d’origine sur ce passage.',
    `« Pourquoi masqué ? » : raison du repérage et ce qu’on peut faire (${await v.locator('#list > li.why').innerText()})`,
  );
  await shot(v, 'video-pourquoi');
  await row('Nom ·')
    .getByRole('button', { name: /^Pourquoi masqué/ })
    .click();

  // Démasquer, puis masquer de nouveau
  await row('Nom ·')
    .getByRole('button', { name: /^Démasquer : Nom/ })
    .click();
  ok(
    (await row('Nom ·').locator('.st2').innerText()).trim() === 'Non masqué' &&
      (await row('Nom ·')
        .getByRole('button', { name: /^Masquer : Nom/ })
        .count()) === 1 &&
      (await v.locator('#count').innerText()) === '2 sur 3' &&
      (await tl.locator('.seg.off').count()) === 1 &&
      (await v.evaluate(() => document.activeElement?.textContent)) === 'Masquer',
    '« Démasquer » : « Non masqué », « 2 sur 3 », segment en pointillé, focus gardé',
  );
  await shot(v, 'video-demasque');
  await row('Nom ·')
    .getByRole('button', { name: /^Masquer : Nom/ })
    .click();
  ok((await v.locator('#count').innerText()) === '3 sur 3', '« Masquer » remet le masque');
  await row('Téléphone')
    .getByRole('button', { name: /^Démasquer/ })
    .click();

  // Chronologie au clavier
  await tl.focus();
  await v.keyboard.press('Home');
  await v.waitForFunction(() => document.querySelector('#time').textContent.startsWith('0:00'));
  await v.keyboard.press('ArrowRight');
  await v.keyboard.press('ArrowRight');
  await v.waitForFunction(() => document.querySelector('#time').textContent.startsWith('0:02'));
  ok(
    (await tl.getAttribute('aria-valuenow')) === '2',
    'chronologie au clavier : Début, puis → deux fois (0:02)',
  );
  ok((await v.locator('.vmask:not(.is-off)').count()) === 1, 'à 0:02, le masque du nom est sur l’image');

  // Ajouter un masque : bouton, clavier, puis glisser sur l'image
  await v.getByRole('button', { name: 'Ajouter un masque' }).click();
  const m1 = v.getByRole('group', { name: 'Masque : Masque ajouté 1' });
  ok(
    (await rows.count()) === 4 &&
      (await row('Masque ajouté 1').locator('.tx .mu').innerText()) === '0:02 – 0:12' &&
      (await row('Masque ajouté 1').getByRole('button', { name: 'Retirer : Masque ajouté 1' }).count()) ===
        1 &&
      (await v.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ===
        'Masque : Masque ajouté 1',
    'masque ajouté : ligne « Masque ajouté 1 » de l’instant affiché à la fin, « Retirer », focus sur la zone',
  );
  const b0 = await m1.boundingBox();
  await v.keyboard.press('ArrowRight');
  await v.keyboard.press('Shift+ArrowDown');
  const b1 = await v.getByRole('group', { name: 'Masque : Masque ajouté 1' }).boundingBox();
  ok(b1.x > b0.x && b1.height > b0.height, 'masque déplacé (→) et agrandi (Maj + ↓) au clavier');
  const scr = await v.locator('#screen').boundingBox();
  await v.mouse.move(scr.x + scr.width * 0.1, scr.y + scr.height * 0.7);
  await v.mouse.down();
  await v.mouse.move(scr.x + scr.width * 0.3, scr.y + scr.height * 0.8, { steps: 4 });
  await v.mouse.up();
  ok(
    (await rows.count()) === 5 && (await row('Masque ajouté 2').count()) === 1,
    'glisser sur l’image crée « Masque ajouté 2 »',
  );
  await v.getByRole('group', { name: 'Masque : Masque ajouté 2' }).focus();
  await v.keyboard.press('Delete');
  ok((await rows.count()) === 4, 'Suppr retire le masque');
  ok((await v.locator('#count').innerText()) === '3 sur 4', 'compteur : 3 sur 4');

  // Accessibilité, 390 px
  const axe = await new AxeBuilder({ page: v }).analyze();
  const bad = axe.violations.filter((x) => ['serious', 'critical'].includes(x.impact));
  ok(
    bad.length === 0,
    `axe : aucune violation sérieuse (${bad.map((x) => `${x.id} ${x.nodes[0]?.target}`).join(' ; ')})`,
  );
  await v.setViewportSize({ width: 390, height: 844 });
  const mob = await v.evaluate(() => {
    const b = (s) => document.querySelector(s).getBoundingClientRect();
    return {
      stacked: b('.mside').y > b('.vplayer').bottom,
      add: Math.round(b('#add').width) >= Math.round(b('.mside').width) - 34,
      noScroll: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  ok(
    mob.stacked && mob.add && mob.noScroll,
    `390 px : lecteur puis liste, « Ajouter un masque » en pleine largeur (${JSON.stringify(mob)})`,
  );
  await shot(v, 'video-390');
  await v.setViewportSize({ width: 1440, height: 900 });

  // Envoi : préparation (masques incrustés), puis envoi
  await v.evaluate(() => {
    window.__seen = [];
    new MutationObserver(() => {
      const t = document.querySelector('#status')?.textContent ?? '';
      if (t && window.__seen[window.__seen.length - 1] !== t) window.__seen.push(t);
    }).observe(document.querySelector('#status'), { childList: true, subtree: true, characterData: true });
  });
  await v.getByRole('button', { name: 'Envoyer' }).click();
  await v.locator('#status .prog').waitFor();
  ok(
    /^Préparation de la vidéo… \d+\s%$/.test(await v.locator('#status b').innerText()) &&
      (await v.locator('#status').getAttribute('role')) === 'status' &&
      (await v.getByRole('button', { name: 'Envoyer' }).isDisabled()) &&
      (await v.getByRole('button', { name: 'Ajouter un masque' }).isDisabled()),
    `préparation : « ${await v.locator('#status b').innerText()} », barre, boutons désactivés`,
  );
  ok(
    (await v.locator('#status .prog').evaluate((e) => Math.round(e.getBoundingClientRect().height))) === 6,
    'barre de préparation de 6 px',
  );
  await shot(v, 'video-prepa');
  const seenBefore = async () => v.evaluate(() => window.__seen).catch(() => null);
  let seen = [];
  for (let i = 0; i < 240 && !/22222222/.test(v.url()); i++) {
    seen = (await seenBefore()) ?? seen;
    await new Promise((r) => setTimeout(r, 250));
  }
  ok(
    /22222222-2222-2222-2222-222222222222(\/|%2F)edit/.test(v.url()),
    'après envoi : ouverture de l’éditeur',
  );
  ok(
    seen.some((t) => /^Préparation de la vidéo… [1-9]\d?\s%/.test(t)) &&
      seen.some((t) => /^Envoi… \d+\s%/.test(t)),
    `préparation qui avance, puis « Envoi… » (${seen.slice(0, 3).join(' | ')} … ${seen.slice(-2).join(' | ')})`,
  );
  const up1 = await tus();
  const sent1 = up1.reduce((n, l) => n + (l.len || 0), 0);
  ok(
    up1.length >= 1 && up1[0].tus.meta.bucketName === 'videos' && sent1 > 10000 && sent1 !== fixture.length,
    `vidéo ré-encodée avec ses masques, envoyée par reprise (${sent1} octets, brute : ${fixture.length})`,
  );
  const steps = (await getLog())
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps'))
    .map((l) => JSON.parse(l.body));
  ok(
    steps.length === 1 &&
      steps[0].kind === 'video' &&
      steps[0].video.pauses.length === 2 &&
      Object.keys(steps[0].video.frames).length === 2,
    'étape vidéo créée, images des pauses tirées de la vidéo masquée',
  );
  ok(
    !JSON.stringify(steps).includes('excerpt') && !JSON.stringify(steps).includes('name-a1'),
    'les données repérées ne sont pas envoyées',
  );

  // ================= Direct activé =================
  await seed(true);
  const d = await open();
  const drows = d.locator('#list > li.mr');
  ok(
    (await d.locator('#intro').innerText()) ===
      'Les données repérées ont été masquées pendant l’enregistrement : ces masques sont définitifs. Vous pouvez en ajouter avant l’envoi.',
    'direct activé : phrase d’introduction',
  );
  ok(
    (await drows.locator('.st2').allInnerTexts()).every((t) => t.trim() === 'En direct') &&
      (await drows.getByRole('button', { name: /^(Démasquer|Masquer)/ }).count()) === 0 &&
      (await drows.getByRole('button', { name: /^Pourquoi masqué/ }).count()) === 3 &&
      (await d.getByRole('button', { name: 'Ajouter un masque' }).isEnabled()),
    'direct activé : statut « En direct », aucune action, « Pourquoi masqué ? » et « Ajouter un masque » présents',
  );
  await drows
    .first()
    .getByRole('button', { name: /^Pourquoi masqué/ })
    .click();
  ok(
    /Masqué pendant l’enregistrement : ce masque ne peut plus être retiré\.$/.test(
      await d.locator('#list > li.why').innerText(),
    ),
    'direct activé : le « Pourquoi masqué ? » dit que le masque est définitif',
  );
  await shot(d, 'video-direct');
  const before = (await tus()).length;
  await d.getByRole('button', { name: 'Envoyer' }).click();
  await d.waitForURL(/22222222/, { timeout: 30000 }).catch(() => {});
  const up2 = (await tus()).slice(before);
  ok(
    /22222222/.test(d.url()) && up2.reduce((n, l) => n + (l.len || 0), 0) === fixture.length,
    'direct activé : envoi sans préparation, vidéo telle qu’enregistrée',
  );
  ok(errors.length === 0, `aucune erreur ni fenêtre native (${errors.join(' ; ')})`);
  await ctx.close();
  for (const [c, l] of results) console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (results.some(([c]) => !c)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
