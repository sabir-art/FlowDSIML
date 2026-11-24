/**
 * Retours client du 24/11 §1 : panneau Image de l'éditeur. Capture de l'étape (« Remplacer… » : importer,
 * médiathèque, recadrer), images ajoutées par-dessus la capture : ajout (import, médiathèque, dépôt),
 * déplacement à la souris et au clavier, proportions, opacité, coins, ombre, texte alternatif obligatoire
 * (liste de vérification), masquer, ordre, dupliquer, supprimer avec « Annuler », toutes les étapes,
 * flou au-dessus, incrustation à la publication (le manifeste ne garde que la place et le texte
 * alternatif). Données fictives. Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/image-calques.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const ARROW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">' +
  '<path d="M180 80 C 120 80, 80 60, 36 22" fill="none" stroke="#e5484d" stroke-width="10"/></svg>';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const until = async (fn, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await fn()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return !!(await fn());
  };
  const near = (a, e, tol = 0.006) => Math.abs(a - e) <= tol;
  const state = seed();
  const st = (id) => state.tables.steps.find((s) => s.id === id);
  const imgs = (id = 's1') => st(id).options?.images || [];
  // Un masque plein sur l'étape : il doit rester au-dessus des images ajoutées
  st('s1').blurs = [{ x: 0.05, y: 0.05, w: 0.2, h: 0.1, style: 'solid', color: '#2A2F3A', intensity: 12 }];
  state.mediaFiles = { 'fleche.svg': Buffer.from(ARROW) };
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  const closeToasts = async () => {
    for (const x of await page.locator('.toasts button[aria-label="Fermer"]').all())
      await x.click().catch(() => {});
  };

  // ===== Panneau : capture de l'étape, état vide =====
  await page.locator('.ed-rail button[data-tool="image"]').click();
  const panel = page.locator('.ed-tool[data-tool-panel="image"]');
  await panel.waitFor();
  const cap = panel.getByRole('region', { name: 'Capture de l’étape' });
  ok(
    /Capture/.test(await cap.innerText()) && /1\s100\u00a0×\u00a0750/.test(await cap.innerText()),
    `capture : nom et taille (${(await cap.innerText()).replace(/\s+/g, ' ')})`,
  );
  const added = panel.locator('section[aria-labelledby="imgp-list"]');
  ok(
    (await added.innerText()).includes(
      'Ajoutez un logo, une flèche ou une illustration par-dessus la capture.',
    ) && (await added.locator('#imgp-list').textContent()).trim() === 'Images ajoutées',
    'aucune image : encart d’explication, titre sans compteur',
  );
  ok(
    (await page.locator('.canvas-hint').textContent()).trim() ===
      'Déposez une image sur la capture pour l’ajouter.',
    'sous le canevas : « Déposez une image sur la capture pour l’ajouter. »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/image-vide${sfx}-1440.png` });

  // « Remplacer… » : trois entrées
  await cap.getByRole('button', { name: 'Remplacer…' }).click();
  const menu = page.getByRole('menu');
  await menu.waitFor();
  ok(
    (await menu.getByRole('menuitem').allTextContents()).map((s) => s.trim()).join('|') ===
      'Importer…|Choisir dans la médiathèque|Recadrer',
    '« Remplacer… » : Importer…, Choisir dans la médiathèque, Recadrer',
  );
  await page.keyboard.press('Escape');

  // ===== Ajout par import : le fichier entre dans la médiathèque, l'image est posée au centre =====
  await added.getByRole('button', { name: 'Ajouter une image' }).click();
  ok(
    (await page.getByRole('menu').getByRole('menuitem').allTextContents()).map((s) => s.trim()).join('|') ===
      'Importer…|Choisir dans la médiathèque',
    '« Ajouter une image » : Importer… ou Choisir dans la médiathèque',
  );
  await page.keyboard.press('Escape');
  await page.locator('#imgp-file').setInputFiles({
    name: 'fleche.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(ARROW),
  });
  ok(await until(() => imgs().length === 1), 'import : une image ajoutée sur l’étape');
  const first = () => imgs()[0];
  ok(
    (state.tables.media_files || []).some((m) => m.name === 'fleche.svg' && m.kind === 'image'),
    'le fichier importé entre dans la médiathèque, catégorie Image',
  );
  ok(
    /^ws-1\/[0-9a-f-]{36}\/img-[0-9a-f]{8}\.webp$/.test(first().path) &&
      !!state.storage[`captures/${first().path}`],
    'SVG converti en image, copié dans les captures de la démo',
  );
  ok(
    near(first().w, 0.3) &&
      near(first().x, 0.35) &&
      near(first().y + first().h / 2, 0.5) &&
      near(first().ratio, 2, 0.01),
    `posée au centre, à 30 % de la largeur (${JSON.stringify(first())})`,
  );
  const layer = (i = 0) => page.locator('#canvas .canvas-layer').nth(i);
  await layer().waitFor();
  ok(
    (await layer().getAttribute('aria-pressed')) === 'true' &&
      (await layer().locator('.canvas-layer__h').count()) === 8,
    'image choisie sur le canevas : 8 poignées',
  );
  ok(
    (await added.locator('.imgp-row.is-on').count()) === 1 &&
      (await added.locator('#imgp-list').textContent()).trim() === 'Images ajoutées · 1',
    'liste : rangée choisie, compteur « · 1 »',
  );
  ok(
    (await page.locator('.canvas-hint').textContent()).trim() === 'Image sélectionnée : fleche.svg.',
    'sous le canevas : « Image sélectionnée : fleche.svg. »',
  );
  ok(
    (await panel.locator('.imgp-svg').textContent()) ===
      'Converti en image à la pose. L’original reste dans la médiathèque.',
    'SVG : « Converti en image à la pose. L’original reste dans la médiathèque. »',
  );
  // Flou au-dessus : la zone masquée vient après l'image dans le cadre
  ok(
    await page.evaluate(() => {
      const l = document.querySelector('#canvas .canvas-layer');
      const m = document.querySelector('#canvas .canvas-blur');
      return !!(l.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING);
    }),
    'canevas : les zones de flou passent au-dessus des images ajoutées',
  );

  // ===== Souris : déplacer, redimensionner en gardant les proportions =====
  const frame = async () => page.locator('#canvas .canvas-frame').boundingBox();
  {
    const f = await frame();
    const before = { ...first() };
    const lb = await layer().boundingBox();
    await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
    await page.mouse.down();
    await page.mouse.move(lb.x + lb.width / 2 + f.width * 0.1, lb.y + lb.height / 2 + f.height * 0.05, {
      steps: 6,
    });
    await page.mouse.up();
    ok(
      await until(() => near(first().x, before.x + 0.1) && near(first().y, before.y + 0.05)),
      `souris : déplacée de 10 % et 5 % (${first().x}, ${first().y})`,
    );
    const hb = await layer().locator('.canvas-layer__h--se').boundingBox();
    const k = first().w / first().h;
    await page.mouse.move(hb.x + 6, hb.y + 6);
    await page.mouse.down();
    await page.mouse.move(hb.x + 6 - f.width * 0.1, hb.y + 6, { steps: 6 });
    await page.mouse.up();
    ok(
      (await until(() => near(first().w, 0.2, 0.01))) && near(first().w / first().h, k, 0.02),
      `poignée de coin : largeur réduite, proportions gardées (${first().w} × ${first().h})`,
    );
  }

  // ===== Clavier : flèches, Maj, Alt =====
  await layer().focus();
  {
    const b0 = { ...first() };
    await page.keyboard.press('ArrowRight');
    ok(await until(() => near(first().x, b0.x + 0.01, 0.001)), 'flèche : 1 %');
    await page.keyboard.press('Shift+ArrowUp');
    ok(await until(() => near(first().y, b0.y - 0.1, 0.001)), 'Maj + flèche : 10 %');
    await page.keyboard.press('Alt+ArrowRight');
    ok(
      (await until(() => near(first().w, b0.w + 0.01, 0.001))) &&
        near(first().w / first().h, b0.w / b0.h, 0.02),
      'Alt + flèche : redimensionne, proportions gardées',
    );
    ok(
      st('s1').position === 0 && (await page.locator('.steplist [aria-current="true"]').count()) <= 1,
      'les flèches ne changent pas d’étape',
    );
  }

  // ===== Réglages =====
  const set = panel.locator('.imgp-set');
  ok(
    (await set.getByRole('spinbutton').count()) === 4 &&
      (await set.getByRole('group', { name: 'Position et taille' }).count()) === 1,
    'Position et taille : Gauche, Haut, Largeur, Hauteur en %',
  );
  // Proportions désactivées : la largeur change seule
  const keep = set.getByRole('switch', { name: 'Conserver les proportions' });
  ok(await keep.isChecked(), '« Conserver les proportions » activé par défaut');
  await keep.click({ force: true });
  ok(await until(() => first().keep === false), 'proportions libérées');
  {
    const h0 = first().h;
    await set.getByLabel('Largeur').fill('40');
    ok(
      (await until(() => near(first().w, 0.4, 0.001))) && near(first().h, h0, 0.001),
      'largeur saisie : la hauteur ne suit plus',
    );
  }
  await keep.click({ force: true });
  await until(() => first().keep === undefined);
  // Opacité : curseur de 10 à 100 par pas de 5
  const slider = set.getByRole('slider', { name: /Opacité/ });
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  ok(
    (await until(() => first().opacity === 90)) &&
      /Opacité\s·\s90\s%/.test(await set.locator('#imgp-op').textContent()) &&
      (await layer()
        .locator('img')
        .evaluate((el) => getComputedStyle(el).opacity)) === '0.9',
    'opacité : 90 % (libellé, canevas)',
  );
  await page.keyboard.press('Home');
  ok(await until(() => first().opacity === 10), 'opacité : 10 % au minimum');
  await page.keyboard.press('End');
  await until(() => first().opacity === undefined);
  // Coins et ombre
  await set.getByRole('radio', { name: 'Arrondis' }).click();
  ok(
    (await until(() => first().rounded === true)) &&
      (await layer()
        .locator('img')
        .evaluate((el) => getComputedStyle(el).borderTopLeftRadius)) !== '0px',
    'coins arrondis',
  );
  const shadow = set.getByRole('switch', { name: 'Ombre' });
  ok(!(await shadow.isChecked()), 'ombre désactivée par défaut');
  await shadow.click({ force: true });
  ok(
    (await until(() => first().shadow === true)) &&
      /drop-shadow/.test(
        await layer()
          .locator('img')
          .evaluate((el) => getComputedStyle(el).filter),
      ),
    'ombre activée',
  );

  // ===== Texte alternatif obligatoire : liste de vérification de la publication =====
  ok(
    (await set.getByLabel('Texte alternatif').getAttribute('aria-required')) === 'true' &&
      (await set.locator('#imgp-alt-help').count()) === 1,
    'texte alternatif : champ obligatoire, aide tant qu’il est vide',
  );
  const openPublish = async () => {
    await page.getByRole('button', { name: 'Publier', exact: true }).click();
    const d = page.locator('dialog.gdpr-dialog[open]');
    await d.waitFor();
    return d;
  };
  {
    const d = await openPublish();
    ok(
      /Étape 1 : .*image sans texte alternatif/.test((await d.innerText()).replace(/\s+/g, ' ')),
      'publication : « image sans texte alternatif » dans la liste « À compléter »',
    );
    await page.keyboard.press('Escape');
    await d.waitFor({ state: 'hidden' });
  }
  await added.locator('.imgp-row__main').first().click();
  await set.getByLabel('Texte alternatif').fill('Flèche vers le bouton');
  ok(
    (await until(() => first().alt === 'Flèche vers le bouton')) &&
      (await set.locator('#imgp-alt-help').count()) === 0 &&
      (await added.locator('.imgp-row__name').first().textContent()) === 'Flèche vers le bouton',
    'texte alternatif saisi : il nomme l’image dans la liste',
  );
  {
    const d = await openPublish();
    ok(!/image sans texte alternatif/.test(await d.innerText()), 'publication : plus de remarque');
    await page.keyboard.press('Escape');
    await d.waitFor({ state: 'hidden' });
  }
  await added.locator('.imgp-row__main').first().click();
  await set.getByRole('checkbox', { name: /Image décorative/ }).check({ force: true });
  ok(
    (await until(() => first().decorative === true)) &&
      (await set.getByLabel('Texte alternatif').count()) === 0,
    '« Image décorative » : remplace le champ',
  );
  await set.getByRole('checkbox', { name: /Image décorative/ }).uncheck({ force: true });
  await until(() => first().decorative === undefined);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/image-calque${sfx}-1440.png` });

  // Accessibilité du panneau et du canevas
  {
    const axe = await new AxeBuilder({ page }).include('.ed-tool').include('#canvas').analyze();
    ok(
      axe.violations.length === 0,
      `axe : aucune violation (${axe.violations.map((v) => `${v.id} ${v.nodes[0]?.target}`).join(' ; ')})`,
    );
  }

  // ===== Deuxième image, par la médiathèque =====
  await added.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Choisir dans la médiathèque' }).click();
  {
    const lib = page.getByRole('dialog').filter({ hasText: 'fleche.svg' });
    await lib.waitFor();
    ok(
      /Image ajoutée sur l’étape/.test(await lib.innerText()),
      'médiathèque : la fenêtre dit où ira le fichier',
    );
    await lib.getByRole('radio', { name: 'fleche.svg', exact: true }).click({ force: true });
    await lib.getByRole('button', { name: /^Utiliser/ }).click();
  }
  ok(await until(() => imgs().length === 2), 'médiathèque : deuxième image ajoutée');
  const rows = () => added.locator('.imgp-row__name').allTextContents();
  ok(
    (await rows()).join('|') === 'fleche.svg|Flèche vers le bouton',
    `liste du dessus vers le dessous (${(await rows()).join(' | ')})`,
  );
  // Cliquer une rangée choisit l'image dans le canevas
  await added.locator('.imgp-row__main').nth(1).click();
  ok(
    await until(async () => (await layer(0).getAttribute('aria-pressed')) === 'true'),
    'rangée cliquée : image choisie dans le canevas',
  );
  // Ordre : « Descendre » l'image du dessus
  await added.getByRole('button', { name: 'Actions pour «\u202ffleche.svg\u202f»' }).click();
  ok(
    (await page.getByRole('menu').getByRole('menuitem').allTextContents()).map((s) => s.trim()).join('|') ===
      'Monter|Descendre|Dupliquer|Supprimer',
    'menu ⋯ : Monter, Descendre, Dupliquer, Supprimer',
  );
  await page.getByRole('menuitem', { name: 'Descendre' }).click();
  ok(
    await until(() => imgs()[0].name === 'fleche.svg' && !imgs()[0].alt),
    '« Descendre » : l’image passe dessous',
  );
  // Masquer
  const eye = added.getByRole('button', { name: 'Masquer «\u202ffleche.svg\u202f»' });
  await eye.click();
  ok(
    (await until(() => imgs()[0].hidden === true)) &&
      (await eye.getAttribute('aria-pressed')) === 'true' &&
      (await page.locator('#canvas .canvas-layer').count()) === 1,
    'œil : image masquée (aria-pressed), retirée du canevas',
  );
  // Dupliquer
  await added.getByRole('button', { name: 'Actions pour «\u202fFlèche vers le bouton\u202f»' }).click();
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click();
  ok(await until(() => imgs().length === 3), 'dupliquer : une image de plus');
  // Supprimer au clavier : toast « Image retirée » avec « Annuler »
  await page.locator('#canvas .canvas-layer[aria-pressed="true"]').focus();
  await page.keyboard.press('Delete');
  ok(await until(() => imgs().length === 2), 'Suppr : image retirée');
  const toast = page.locator('.toasts').getByText('Image retirée');
  await toast.waitFor();
  await page.locator('.toasts').getByRole('button', { name: 'Annuler' }).click();
  ok(await until(() => imgs().length === 3), 'toast « Image retirée » : « Annuler » la remet');
  await closeToasts();
  // Supprimer par l'en-tête des réglages
  await added.locator('.imgp-row__main').first().click();
  await set.getByRole('button', { name: 'Supprimer l’image' }).click();
  ok(await until(() => imgs().length === 2), '« Supprimer l’image » (réglages)');
  await closeToasts();
  // Échap désélectionne
  await added.locator('.imgp-row__main').first().click();
  await page.locator('#canvas .canvas-layer[aria-pressed="true"]').focus();
  await page.keyboard.press('Escape');
  ok(
    await until(async () => (await panel.locator('.imgp-set').count()) === 0),
    'Échap : image désélectionnée',
  );

  // ===== Toutes les étapes =====
  await added.locator('.imgp-row__main').first().click();
  const all = set.getByRole('switch', { name: 'Appliquer à toutes les étapes' });
  await all.click({ force: true });
  ok(
    await until(
      () => imgs('s2').length === 1 && !!imgs('s2')[0].group && imgs('s2')[0].alt === 'Flèche vers le bouton',
    ),
    'toutes les étapes : copie posée sur l’étape 2',
  );
  await set.getByRole('radio', { name: 'Droits' }).click();
  ok(await until(() => !imgs('s2')[0].rounded), 'un réglage de l’image suit sur sa copie');
  await all.click({ force: true });
  ok(await until(() => imgs('s2').length === 0), 'interrupteur éteint : copie retirée');

  // ===== Dépôt d'un fichier sur la capture : le voile dit ce qui va se passer =====
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'logo-acme.png', { type: 'image/png' }));
    document
      .querySelector('#canvas')
      .dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  ok(
    (await page.locator('#canvas .stage-drop').textContent()).trim() === 'Déposer pour ajouter une image',
    'voile de dépôt, outil Image ouvert : « Déposer pour ajouter une image »',
  );
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'logo-acme.png', { type: 'image/png' }));
    const target = document.querySelector('#canvas');
    for (const type of ['dragover', 'drop'])
      target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  ok(
    await until(() => imgs().length === 3 && imgs().at(-1).name === 'logo-acme.png'),
    'fichier déposé sur la capture (outil ouvert) : image ajoutée, la capture reste',
  );
  await closeToasts();

  // ===== Rendu incrusté : image sous le masque, recadrage pris en compte =====
  const burn = await page.evaluate(async () => {
    const { burnStep } = await import('/src/lib/publish.ts');
    const mk = (w, h, color) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      return c;
    };
    const src = await new Promise((r) => mk(1000, 500, '#ffffff').toBlob(r, 'image/png'));
    const red = mk(40, 40, '#ff0000');
    const read = async (opts) => {
      const out = await burnStep(src, opts);
      const bmp = await createImageBitmap(out);
      const k = document.createElement('canvas');
      k.width = bmp.width;
      k.height = bmp.height;
      const g = k.getContext('2d');
      g.drawImage(bmp, 0, 0);
      return (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
    };
    const layers = [{ image: red, x: 0.5, y: 0.5, w: 0.2, h: 0.2 }];
    const plain = await read({ layers });
    const masked = await read({
      layers,
      blurs: [{ x: 0.5, y: 0.5, w: 0.1, h: 0.2, style: 'solid', color: '#0000FF', intensity: 12 }],
    });
    const cropped = await read({ layers, crop: { x: 0.5, y: 0, w: 0.5, h: 1 } });
    const half = await read({ layers: [{ ...layers[0], opacity: 50 }] });
    return {
      inLayer: plain(600, 300),
      outside: plain(300, 300),
      underMask: masked(520, 300),
      besideMask: masked(680, 300),
      // cadre = moitié droite : l'image est à 50 % du cadre, soit x = 750 à 850 dans l'image entière
      cropIn: cropped(800, 300),
      cropOut: cropped(600, 300),
      half: half(600, 300),
    };
  });
  const isRed = (p) => p[0] > 220 && p[1] < 40 && p[2] < 40;
  const isWhite = (p) => p.every((v) => v > 235);
  ok(isRed(burn.inLayer) && isWhite(burn.outside), 'incrustation : l’image est dessinée à sa place');
  ok(
    burn.underMask[2] > 200 && burn.underMask[0] < 40 && isRed(burn.besideMask),
    'incrustation : le masque couvre l’image ajoutée',
  );
  ok(isRed(burn.cropIn) && isWhite(burn.cropOut), 'incrustation : position relative au cadre recadré');
  ok(burn.half[0] > 220 && burn.half[1] > 100 && burn.half[1] < 160, 'incrustation : opacité à 50 %');

  // ===== Publication : image incrustée, manifeste sans chemin =====
  {
    const d = await openPublish();
    await d.getByLabel(/J’ai relu|J'ai relu/).check();
    await d.getByLabel(/fictives ou floutées/).check();
    await d.getByRole('button', { name: 'Publier en public' }).click();
    await page.waitForURL(/share\?published=1/, { timeout: 20000 });
    const manifest = JSON.parse(state.storage[`published/${DEMO}/latest.json`].data.toString());
    const s1 = manifest.steps.find((s) => s.id === 's1');
    const file = state.storage[`published/${DEMO}/${s1.image.url}`];
    ok(!!file && file.type === 'image/webp', `capture publiée refaite avec ses images (${s1.image.url})`);
    const pub = s1.options?.images || [];
    ok(
      pub.length === 1 &&
        pub[0].alt === 'Flèche vers le bouton' &&
        Object.keys(pub[0]).sort().join(',') === 'alt,h,w,x,y',
      `manifeste : place et texte alternatif des images informatives seulement (${JSON.stringify(pub)})`,
    );
    ok(
      !/img-[0-9a-f]{8}\.|fleche\.svg|logo-acme/.test(JSON.stringify(manifest)),
      'manifeste : aucun chemin ni nom de fichier',
    );
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
