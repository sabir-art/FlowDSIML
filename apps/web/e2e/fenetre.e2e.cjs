/**
 * EXT-02 §6.1 : étape « Fenêtre » (image + texte). Éditeur : entrée du menu « Ajouter une étape »,
 * « Affichage » à trois valeurs, image (import, texte alternatif, retrait), aperçu dans le canevas.
 * Lecteur : fenêtre sur la capture voilée, focus piégé, Échap ferme sans avancer, « Rouvrir la fenêtre »,
 * 390 px, sans image, première étape. Données fictives.
 * Usage : [THEME=dark] [SHOTS_DIR=…] node e2e/fenetre.e2e.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'not ok'} - ${l}`);
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
  const axe = async (page, sel, label) => {
    await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'));
    const r = await new AxeBuilder({ page }).include(sel).withTags(TAGS).analyze();
    ok(r.violations.length === 0, `axe, ${label} (${r.violations.map((v) => v.id).join(', ')})`);
  };

  // ===== Éditeur =====
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.locator('[data-step-index="0"]').click();
  const before = state.tables.steps.filter((s) => s.demo_id === DEMO).length;
  await page.locator('.rail-foot').getByRole('button', { name: 'Ajouter une étape' }).click();
  await page.getByRole('menuitem', { name: 'Fenêtre', exact: true }).click();
  const win = () =>
    state.tables.steps.find(
      (s) => s.demo_id === DEMO && s.kind === 'text' && s.options?.display === 'window',
    );
  ok(
    await until(() => state.tables.steps.filter((s) => s.demo_id === DEMO).length === before + 1 && !!win()),
    '« Ajouter une étape » → « Fenêtre » : étape de texte, affichage « window »',
  );
  ok(win().position === 1 && win().title === 'Fenêtre', 'placée après l’étape courante, titre « Fenêtre »');
  const canvas = page.locator('.canvas-window');
  await canvas.waitFor();
  ok(
    (await canvas.evaluate((el) => el.classList.contains('canvas-window--text'))) &&
      (await canvas.evaluate((el) => el.getBoundingClientRect().width)) <= 480,
    'canevas : sans image, fenêtre de 480 px au plus',
  );
  ok(
    /Étape 2 sur \d+/.test(await canvas.textContent()) &&
      /Échap pour fermer/.test(await canvas.textContent()) &&
      /Précédent/.test(await canvas.textContent()) &&
      /Suivant/.test(await canvas.textContent()),
    'canevas : « Étape 2 sur n », « Échap pour fermer », « Précédent », « Suivant »',
  );
  ok(
    (await page.locator('.rail-li').nth(1).locator('svg.lucide-app-window').count()) >= 1,
    'liste des étapes : icône « Fenêtre »',
  );

  await openTool(page, 'step');
  const seg = page.getByRole('group', { name: 'Affichage' });
  await seg.waitFor();
  ok(
    (await seg.getByRole('button').allTextContents()).join('|') === 'Plein écran|Pop-up|Fenêtre' &&
      (await seg.getByRole('button', { name: 'Fenêtre' }).getAttribute('aria-pressed')) === 'true',
    'panneau : « Affichage » à trois valeurs, « Fenêtre » choisi',
  );
  const block = page.locator('.win-img');
  ok(
    (await block.getByRole('button', { name: 'Importer…' }).count()) === 1 &&
      /PNG, JPEG ou WebP, 5 Mo au plus\. Ou déposez le fichier sur ce bloc\./.test(await block.textContent()),
    'panneau : image en zone étroite (« Importer… » et aide)',
  );
  await axe(page, '.win-img', 'panneau sans image');
  ok(
    (await page.getByText('Question à choix').count()) === 0,
    'panneau : pas de « Question à choix » pour une fenêtre',
  );

  // Fichier refusé, puis image acceptée
  const input = block.locator('input[type=file]');
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await page.getByText('PNG, JPEG ou WebP', { exact: false }).first().waitFor();
  ok(!win().image_path, 'un fichier qui n’est pas une image est refusé');
  await input.setInputFiles({ name: 'schema.png', mimeType: 'image/png', buffer: png });
  ok(await until(() => !!win().image_path), 'image importée dans l’étape');
  ok(
    new RegExp(`^${win().workspace_id}/${DEMO}/`).test(win().image_path) && win().image_width > 0,
    'image rangée dans le dossier de l’espace, avec sa taille',
  );
  await block.locator('.win-img__thumb img').waitFor();
  await canvas.locator('.canvas-window__img img').waitFor();
  ok(
    Math.round(
      await canvas.locator('.canvas-window__img').evaluate((el) => el.getBoundingClientRect().width),
    ) === 280,
    'canevas : image à gauche, 280 px',
  );
  const alt = page.getByLabel('Texte alternatif');
  ok(
    (await page.getByText('Laissez vide si l’image est décorative.').count()) === 1,
    'panneau : « Texte alternatif » et son aide',
  );
  await alt.fill('Schéma de la base de données');
  ok(
    await until(() => win().options?.imageAlt === 'Schéma de la base de données'),
    'texte alternatif enregistré',
  );
  await page.getByLabel('Libellé du bouton').fill('Continuer');
  ok(await until(() => win().options?.buttonLabel === 'Continuer'), 'libellé du bouton enregistré');
  await canvas.getByText('Continuer').waitFor();
  // Colonne étroite : boutons sur une ligne à droite, « Échap pour fermer » dessous en 12 px
  const cf = await canvas.locator('.canvas-window__foot').evaluate((el) => {
    const b = [...el.querySelectorAll('.p-btn')].map((x) => x.getBoundingClientRect());
    const h = el.querySelector('.canvas-window__mu');
    const hr = h.getBoundingClientRect();
    return {
      oneLine: Math.round(b[0].top) === Math.round(b[1].top),
      right: Math.round(b[1].right) === Math.round(el.getBoundingClientRect().right),
      below: hr.top >= b[0].bottom,
      size: getComputedStyle(h).fontSize,
      stacked: el.classList.contains('is-stacked'),
    };
  });
  ok(
    cf.oneLine && cf.right && (!cf.stacked || (cf.below && cf.size === '12px')),
    `canevas : boutons sur une ligne à droite${cf.stacked ? ', « Échap pour fermer » dessous en 12 px' : ''}`,
  );
  await axe(page, '.win-img', 'panneau avec image');
  await axe(page, '.canvas-window', 'canevas');
  ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'éditeur : pas de défilement horizontal',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/fenetre-editeur${sfx}.png` });

  await block.getByRole('button', { name: 'Plus d’actions sur l’image' }).click();
  ok(
    (await page.getByRole('menuitem').allTextContents()).join('|') === 'Remplacer…|Retirer',
    'menu ⋯ : « Remplacer… » et « Retirer »',
  );
  await page.getByRole('menuitem', { name: 'Retirer' }).click();
  ok(await until(() => win().image_path === null), '« Retirer » : l’étape n’a plus d’image');
  await page.locator('.canvas-window--text').waitFor();
  ok((await page.getByLabel('Texte alternatif').count()) === 0, 'sans image : pas de texte alternatif');
  await ctx.close();

  // ===== Lecteur =====
  const PID = '0b5c1f0e-0000-4000-8000-0000000000d1';
  const manifest = (first) => ({
    schemaVersion: 1,
    demoId: PID,
    versionId: '0b5c1f0e-0000-4000-8000-0000000000d9',
    workspaceId: 'w',
    title: 'Mettre les données en qualité',
    locale: 'fr',
    publishedAt: '2026-11-19T10:00:00Z',
    theme: {},
    steps: [
      ...(first
        ? []
        : [
            {
              id: 'f1',
              kind: 'image',
              title: 'Accueil',
              image: { url: 'assets/fond.png', width: 1280, height: 800 },
              hotspots: [],
            },
          ]),
      {
        id: 'f2',
        kind: 'text',
        title: 'Préparer la mise en qualité des données',
        body: 'Avant d’importer vos fiches, vérifiez que chaque contact a un e-mail et un service.',
        image: { url: 'assets/fenetre.png', width: 560, height: 480 },
        options: { display: 'window', imageAlt: 'Schéma de la base', buttonLabel: '' },
      },
      {
        id: 'f3',
        kind: 'text',
        title: 'Sans image',
        body: 'Une fenêtre de texte seul.',
        options: { display: 'window' },
      },
      { id: 'f4', kind: 'text', title: 'Fin', body: 'Merci.' },
    ],
  });
  for (const width of [1280, 390]) {
    const pc = await themedContext(b, { viewport: { width, height: 800 }, locale: 'fr-FR' });
    const pl = await pc.newPage();
    pl.on('pageerror', (e) => errors.push(`lecteur: ${e.message}`));
    let m = manifest(false);
    await pl.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest: m }),
      }),
    );
    await pl.route('**/assets/*.png', (r) =>
      r.fulfill({ contentType: 'image/png', headers: cors, body: png }),
    );
    await pl.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, headers: cors, body: '{}' }));
    await pl.goto(`${PLAYER}/#/d/${PID}`);
    const tag = `[lecteur ${width}]`;
    await pl.locator('.p-img').first().waitFor();
    await pl.getByRole('button', { name: 'Étape suivante' }).click();
    const dlg = pl.getByRole('dialog', { name: 'Préparer la mise en qualité des données' });
    await dlg.waitFor();
    ok((await dlg.getAttribute('aria-modal')) === 'true', `${tag} role=dialog avec titre, modale`);
    const box = await dlg.boundingBox();
    ok(box.width <= 680 && box.width <= width - 32 + 1, `${tag} 680 px au plus (${Math.round(box.width)})`);
    ok((await dlg.evaluate((el) => getComputedStyle(el).borderRadius)) === '16px', `${tag} rayon de 16 px`);
    const veil = await pl.locator('.p-dim').evaluate((el) => getComputedStyle(el).backgroundColor);
    ok(/rgba\(10, 12, 16, 0\.45\)/.test(veil), `${tag} capture voilée, noir à 45 %`);
    ok(
      (await pl.locator('.p-stage.is-backdrop .p-zoom').evaluate((el) => getComputedStyle(el).filter)) ===
        'none',
      `${tag} capture voilée, pas floutée`,
    );
    const img = dlg.locator('.p-dwin__img');
    const ib = await img.boundingBox();
    const tb = await dlg.locator('.p-dwin__body').boundingBox();
    if (width >= 640)
      ok(
        Math.round(ib.width) === 280 && ib.height >= 240 && ib.x < tb.x,
        `${tag} image à gauche, 280 px, 240 px de haut au moins`,
      );
    else
      ok(
        Math.round(ib.height) === 160 && ib.y < tb.y && Math.round(ib.width) === Math.round(box.width),
        `${tag} image en haut, 160 px`,
      );
    ok(
      (await img.locator('img').getAttribute('alt')) === 'Schéma de la base' &&
        (await img.locator('img').evaluate((el) => getComputedStyle(el).objectFit)) === 'cover',
      `${tag} image en « cover » avec son texte alternatif`,
    );
    ok((await dlg.locator('.p-dwin__count').textContent()) === 'Étape 2 sur 4', `${tag} « Étape 2 sur 4 »`);
    ok(
      (await dlg.locator('h2').evaluate((el) => getComputedStyle(el).fontSize)) === '22px',
      `${tag} titre de 22 px`,
    );
    const btns = await dlg.locator('.p-dwin__btns .p-btn').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { y: Math.round(r.top), w: Math.round(r.width), r: Math.round(r.right), t: el.textContent };
      }),
    );
    const footRight = Math.round(
      await dlg.locator('.p-dwin__foot').evaluate((el) => el.getBoundingClientRect().right),
    );
    ok(
      btns.length === 2 && btns[0].y === btns[1].y && btns[1].t === 'Suivant' && btns[1].r === footRight,
      `${tag} boutons sur une ligne, calés à droite, « Suivant » en dernier`,
    );
    if (width < 640)
      ok(
        (await dlg.locator('.p-dwin__hint').isVisible()) === false && Math.abs(btns[0].w - btns[1].w) <= 1,
        `${tag} mobile : pas de « Échap pour fermer », boutons à largeur égale sur toute la ligne`,
      );
    if (width >= 640) {
      const ys = await dlg
        .locator('.p-dwin__foot > *')
        .evaluateAll((els) =>
          els.map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)),
        );
      ok(new Set(ys).size === 1, `${tag} pied sur une seule ligne`);
    }
    ok(
      (width < 640 || (await dlg.locator('.p-dwin__hint').textContent()) === 'Échap pour fermer') &&
        (await dlg.getByRole('button').allTextContents()).join('|') === 'Précédent|Suivant',
      `${tag} pied : « Précédent », « Suivant »${width < 640 ? '' : ' et « Échap pour fermer »'}`,
    );
    ok(
      await until(() => pl.evaluate(() => document.activeElement?.textContent === 'Suivant')),
      `${tag} le focus entre dans la fenêtre, sur « Suivant »`,
    );
    // Focus piégé : Tab et Maj + Tab restent dans la fenêtre
    const inside = () => pl.evaluate(() => !!document.activeElement?.closest('.p-dwin'));
    await pl.keyboard.press('Tab');
    const a = await inside();
    await pl.keyboard.press('Tab');
    const c = await inside();
    await pl.keyboard.press('Tab');
    const d = await inside();
    await pl.keyboard.press('Shift+Tab');
    await pl.keyboard.press('Shift+Tab');
    await pl.keyboard.press('Shift+Tab');
    ok(a && c && d && (await inside()), `${tag} focus piégé dans la fenêtre (Tab et Maj + Tab)`);
    await axe(pl, '.p-root', `${tag} fenêtre ouverte`);
    ok(
      await pl.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${tag} pas de défilement horizontal`,
    );
    if (SHOTS) await pl.screenshot({ path: `${SHOTS}/fenetre-lecteur${sfx}-${width}.png` });

    // Échap ferme, sans avancer
    await pl.keyboard.press('Escape');
    await dlg.waitFor({ state: 'hidden' });
    const pill = pl.getByRole('button', { name: 'Rouvrir la fenêtre' });
    await pill.waitFor();
    ok((await pl.locator('.p-count').textContent()) === '2 / 4', `${tag} Échap ne vaut pas « Suivant »`);
    ok((await pl.locator('.p-dim').isVisible()) === false, `${tag} fermée : la capture n’est plus voilée`);
    const pb = await pill.boundingBox();
    const nb = await pl.getByRole('button', { name: 'Étape suivante' }).boundingBox();
    ok(
      Math.round(pb.height) === 36 &&
        pb.x + pb.width <= nb.x &&
        (await pill.locator('svg.lucide-app-window').count()) === 1,
      `${tag} pilule « Rouvrir la fenêtre » de 36 px, à gauche de « Suivant »`,
    );
    ok(
      await until(() => pl.evaluate(() => document.activeElement?.classList.contains('p-dwin-reopen'))),
      `${tag} le focus va sur la pilule`,
    );
    await axe(pl, '.p-root', `${tag} fenêtre fermée`);
    if (SHOTS) await pl.screenshot({ path: `${SHOTS}/fenetre-fermee${sfx}-${width}.png` });
    await pill.click();
    await dlg.waitFor();
    ok((await pill.count()) === 0, `${tag} « Rouvrir la fenêtre » rouvre, la pilule disparaît`);
    ok(
      await pl.locator('.p-controls').evaluate((el) => el.inert === true),
      `${tag} fenêtre ouverte : la barre du lecteur est inerte`,
    );

    // Sans image : 480 px au plus, texte seul
    await dlg.getByRole('button', { name: 'Suivant' }).click();
    const plain = pl.getByRole('dialog', { name: 'Sans image' });
    await plain.waitFor();
    ok(
      (await plain.boundingBox()).width <= 480 && (await plain.locator('img').count()) === 0,
      `${tag} sans image : 480 px au plus, pas de fond teinté ni d’icône`,
    );
    await plain.getByRole('button', { name: 'Précédent' }).click();
    await dlg.waitFor();
    ok(true, `${tag} « Précédent » revient à l’étape d’avant`);

    // Première étape de la démo : fond uni, sans voile
    m = manifest(true);
    await pl.goto('about:blank');
    await pl.goto(`${PLAYER}/#/d/${PID}`);
    await dlg.waitFor();
    ok(
      (await pl.locator('.p-dwin-plain').count()) === 1 && (await pl.locator('.p-dim').count()) === 0,
      `${tag} première étape : fond uni, sans voile`,
    );
    ok(
      (await dlg.getByRole('button').allTextContents()).join('|') === 'Suivant',
      `${tag} première étape : pas de « Précédent »`,
    );
    await pc.close();
  }
  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})();
