/**
 * /media : la Médiathèque (retours client §3.1, §3.2, §3.4 ; maquettes retours-2411/media-page, media-menu,
 * media-import). Entrée de navigation, médiathèque vide, import avec catégorie déduite et toast « Changer »,
 * filtres avec compteurs, recherche, menu d'une carte (renommer, catégorie, démos, supprimer), rôle lecteur.
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] [WIDTH=390] node e2e/media-page.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const WIDTH = Number(process.env.WIDTH || 1440);
const MOBILE = WIDTH < 768;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  // Images fictives dessinées dans le navigateur : logo transparent carré, visuel opaque large
  const png = async (w, h, transparent, type = 'image/png') => {
    const p = await (await b.newContext()).newPage();
    const data = await p.evaluate(
      ([w, h, transparent, type]) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d');
        if (!transparent) {
          x.fillStyle = '#e8eef5';
          x.fillRect(0, 0, w, h);
        }
        x.fillStyle = '#1f6f5c';
        x.beginPath();
        x.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, Math.PI * 2);
        x.fill();
        return c.toDataURL(type).split(',')[1];
      },
      [w, h, transparent, type],
    );
    await p.context().close();
    return Buffer.from(data, 'base64');
  };
  const logoPng = await png(256, 256, true);
  const photoPng = await png(1600, 600, false);
  // WebP transparent et carré : accepté, et rangé avec les logos comme un PNG
  const logoWebp = await png(256, 256, true, 'image/webp');
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
  );

  const open = async (prepare = () => {}) => {
    const ctx = await themedContext(b, { viewport: { width: WIDTH, height: MOBILE ? 844 : 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    state.mediaFiles = {
      'logo-acme-blanc.png': logoPng,
      'bandeau-formation.png': photoPng,
      'pictogramme.svg': svg,
    };
    prepare(state);
    await install(page, state);
    await page.goto(`${BASE}/#/media`);
    await page.getByRole('heading', { level: 1, name: 'Médiathèque' }).waitFor();
    return { page, state };
  };
  const shot = async (page, name) => {
    if (!SHOTS) return;
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
    );
    await page.screenshot({ path: `${SHOTS}/${name}-${WIDTH}${sfx}.png`, fullPage: true });
  };
  const send = (page, name, buffer, type) =>
    page.locator('#media-page-file').setInputFiles({ name, mimeType: type, buffer });
  const cards = (page) => page.locator('.mp-card');
  const card = (page, name) => page.locator('.mp-card', { hasText: name });

  // 1. Vide, imports, filtres, menu
  {
    const { page, state } = await open();
    if (!MOBILE) {
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      const order = await nav.getByRole('link').allTextContents();
      const i = order.findIndex((x) => x.trim() === 'Médiathèque');
      ok(
        i > 0 &&
          order[i - 1].trim() === 'Parcours de formation' &&
          order[i + 1].trim() === 'Analytics' &&
          (await nav.getByRole('link', { name: 'Médiathèque' }).locator('svg.lucide-images').count()) === 1,
        'navigation : « Médiathèque » (icône Images) entre Parcours de formation et Analytics',
      );
    }
    ok(
      (await page.getByText('Importer votre premier fichier').count()) === 1 &&
        (await page.getByRole('radiogroup', { name: 'Catégorie' }).count()) === 0 &&
        (await page.getByRole('searchbox').count()) === 0,
      'médiathèque vide : seulement la zone d’import, ni recherche ni filtres',
    );
    await shot(page, 'media-vide');

    // PNG transparent et carré : rangé avec les logos, le toast dit pourquoi
    await send(page, 'logo-acme-blanc.png', logoPng, 'image/png');
    await card(page, 'logo-acme-blanc.png').waitFor();
    const toast = page.locator('.toast').last();
    ok(
      sp(await toast.locator('.toast-text').textContent()) === '« logo-acme-blanc.png » importé dans Logos' &&
        sp(await toast.locator('.toast-detail').textContent()) ===
          'Fond transparent et format carré : rangé avec les logos.' &&
        (await toast.locator('.toast-text').evaluate((el) => getComputedStyle(el).fontWeight)) === '600',
      'toast d’import sur deux lignes : « importé dans Logos » en gras, la raison dessous',
    );
    {
      // Mesure après l'animation d'apparition (elle met le toast à l'échelle)
      await toast.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
      const w = (await toast.boundingBox()).width;
      // Sous 600 px : toute la largeur visible moins 32 px (la barre de défilement n'en fait pas partie)
      const visible = await page.evaluate(() => document.documentElement.clientWidth);
      ok(
        MOBILE ? Math.abs(w - (visible - 32)) <= 1 : w <= 420 && w > 300,
        `toast : largeur ${Math.round(w)} px`,
      );
    }
    // Aperçu : le fichier entier, sans rognage
    const fit = await card(page, 'logo-acme-blanc.png')
      .locator('.mp-thumb img')
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const z = el.parentElement.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          contain: cs.objectFit === 'contain',
          pad: cs.paddingTop,
          inside: r.bottom <= z.bottom + 0.5 && r.top >= z.top - 0.5,
          h: Math.round(z.height),
        };
      });
    ok(
      fit.contain && fit.pad === '12px' && fit.inside && fit.h === 112,
      `aperçu de 112 px : fichier entier (contain), 12 px de marge (${JSON.stringify(fit)})`,
    );
    ok(state.tables.media_files[0].kind === 'logo', 'catégorie déduite envoyée : logo');
    await shot(page, 'media-import');
    // « Changer » ouvre le menu de la carte, où se trouve la catégorie
    await toast.getByRole('button', { name: 'Changer' }).click();
    const menu = page.getByRole('menu');
    await menu.waitFor();
    // MOTION-01 : le menu s'ouvre de 96 % à 100 % ; les mesures se font une fois l'animation finie
    await menu.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((x) => x.finished)));
    ok(
      (await menu.getByRole('menuitemradio', { name: 'Logo' }).getAttribute('aria-checked')) === 'true' &&
        (await menu.getByRole('menuitemradio', { name: 'Image' }).getAttribute('aria-checked')) === 'false',
      '« Changer » ouvre le menu de la carte : Catégorie, Logo coché',
    );
    {
      const logoItem = menu.getByRole('menuitemradio', { name: 'Logo' });
      const imageItem = menu.getByRole('menuitemradio', { name: 'Image' });
      const x = async (l) => (await l.locator('.menu-item__icon').boundingBox()).x;
      // CHOIX-01 : icône de la catégorie en tête (alignée sur les autres entrées), coche À DROITE de la
      // catégorie actuelle, aucune colonne vide
      const endX = async (l) => (await l.locator('.menu-item__end').boundingBox()).x;
      const iconX = async (l) => (await l.locator('.menu-item__icon').boundingBox()).x;
      ok(
        (await logoItem.locator('.menu-item__end svg.lucide-check').count()) === 1 &&
          (await imageItem.locator('.menu-item__end').count()) === 0 &&
          (await menu.locator('.menu-blank, .mp-blank').count()) === 0 &&
          (await endX(logoItem)) > (await iconX(logoItem)) + 40 &&
          Math.abs((await x(logoItem)) - (await x(imageItem))) < 1 &&
          Math.abs((await x(logoItem)) - (await x(menu.getByRole('menuitem', { name: 'Renommer' })))) < 1,
        'CHOIX-01 : icône de catégorie alignée sur les autres entrées, coche à droite de la catégorie actuelle',
      );
    }
    ok(
      sp((await menu.getByRole('menuitem').allTextContents()).join(' | ')) ===
        'Renommer | Télécharger | Voir les démos qui l’utilisent | Supprimer',
      'menu : Renommer, Catégorie, Télécharger, Voir les démos qui l’utilisent, Supprimer',
    );
    await shot(page, 'media-menu');
    await menu.getByRole('menuitemradio', { name: 'Image' }).click();
    await card(page, 'logo-acme-blanc.png').getByText('Image · Non utilisé').waitFor();
    ok(state.tables.media_files[0].kind === 'image', 'catégorie changée : Image');

    // Grand visuel opaque : image ; SVG : logo
    await send(page, 'bandeau-formation.png', photoPng, 'image/png');
    await card(page, 'bandeau-formation.png').waitFor();
    await send(page, 'pictogramme.svg', svg, 'image/svg+xml');
    await card(page, 'pictogramme.svg').waitFor();
    const kindOf = (n) => state.tables.media_files.find((f) => f.name === n).kind;
    ok(
      kindOf('bandeau-formation.png') === 'image' && kindOf('pictogramme.svg') === 'logo',
      'visuel opaque et large : image ; SVG : logo',
    );
    state.mediaFiles['logo-acme.webp'] = logoWebp;
    await send(page, 'logo-acme.webp', logoWebp, 'image/webp');
    await card(page, 'logo-acme.webp').waitFor();
    ok(
      logoWebp.subarray(0, 4).toString('latin1') === 'RIFF' &&
        logoWebp.subarray(8, 12).toString('latin1') === 'WEBP' &&
        kindOf('logo-acme.webp') === 'logo' &&
        state.tables.media_files.find((f) => f.name === 'logo-acme.webp').mime === 'image/webp',
      'WebP transparent et carré : accepté, rangé avec les logos',
    );
    ok(
      /PNG, JPEG, WebP, SVG ou WOFF2, 5 Mo au plus\. La catégorie est déduite, vous pouvez la changer\./.test(
        sp(await page.locator('.mp-zone').textContent()),
      ),
      'aide de la zone d’import : les types réellement acceptés, WebP compris',
    );
    // Import depuis un filtre : la catégorie du filtre l'emporte
    await page.getByRole('radio', { name: /^Images/ }).click();
    state.mediaFiles['logo-bis.png'] = logoPng;
    await send(page, 'logo-bis.png', logoPng, 'image/png');
    await card(page, 'logo-bis.png').waitFor();
    ok(kindOf('logo-bis.png') === 'image', 'import depuis le filtre Images : rangé avec les images');
    await page.getByRole('radio', { name: /^Tout/ }).click();

    // Filtres avec compteurs, occupation, recherche
    const group = page.getByRole('radiogroup', { name: 'Catégorie' });
    ok(
      sp((await group.getByRole('radio').allTextContents()).join(' | ')) ===
        'Tout 5 | Logos 2 | Images 3 | Polices 0',
      'filtres Tout, Logos, Images, Polices avec leurs compteurs',
    );
    ok(/ sur 500 Mo$/.test(sp(await page.locator('.mp-quota').textContent())), 'occupation « … sur 500 Mo »');
    await group.getByRole('radio', { name: /^Logos/ }).click();
    ok((await cards(page).count()) === 2, 'filtre Logos : deux fichiers');
    await group.getByRole('radio', { name: /^Tout/ }).click();
    await page.getByRole('searchbox').fill('bandeau');
    ok((await cards(page).count()) === 1, 'recherche par nom');
    await page.getByRole('searchbox').fill('introuvable');
    await page.getByText('Aucun fichier ne correspond.').waitFor();
    await page.getByRole('button', { name: 'Effacer la recherche' }).click();
    ok(
      (await page.getByRole('searchbox').inputValue()) === '' && (await cards(page).count()) === 5,
      'recherche sans résultat : « Effacer la recherche » la vide',
    );

    // Les toasts des imports s'empilent en bas de l'écran (sur toute la largeur à 390 px) : on les ferme
    // comme le ferait la personne avant d'agir sur une carte qu'ils recouvrent
    for (let n = await page.locator('.toast').count(); n > 0; n--)
      await page.locator('.toast').first().getByRole('button', { name: 'Fermer' }).click();
    await page.locator('.toast').first().waitFor({ state: 'detached' });
    // Renommer
    await page.getByRole('button', { name: 'Actions pour bandeau-formation.png' }).click();
    await page.getByRole('menuitem', { name: 'Renommer' }).click();
    const ren = page.getByRole('dialog', { name: 'Renommer le fichier' });
    await ren.getByLabel('Nom').fill('Bandeau de la formation');
    await ren.getByRole('button', { name: 'Enregistrer' }).click();
    await card(page, 'Bandeau de la formation').waitFor();
    ok(kindOf('Bandeau de la formation') === 'image', 'fichier renommé');

    // Démos qui l'utilisent
    const used = state.tables.media_files.find((f) => f.name === 'pictogramme.svg');
    state.tables.demos.find((d) => d.id === DEMO).settings = {
      theme: { logoUrl: `https://x.example/${used.path}` },
    };
    await page.reload();
    await card(page, 'pictogramme.svg').getByText('Logo · Utilisé dans 1 démo').waitFor();
    await page.getByRole('button', { name: 'Actions pour pictogramme.svg' }).click();
    await page.getByRole('menuitem', { name: 'Voir les démos qui l’utilisent' }).click();
    const dlg = page.getByRole('dialog', { name: 'Démos qui utilisent « pictogramme.svg »' });
    await dlg.waitFor();
    ok(
      (await dlg.getByRole('link').count()) === 1 &&
        new RegExp(`/demos/${DEMO}/edit$`).test(await dlg.getByRole('link').getAttribute('href')),
      '« Voir les démos qui l’utilisent » : la démo, avec son lien',
    );
    await dlg.getByRole('button', { name: 'Fermer' }).last().click();
    ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      'pas de défilement horizontal',
    );
    await shot(page, 'media-page');

    // Supprimer un fichier utilisé : la confirmation annonce l'emplacement vidé
    await page.getByRole('button', { name: 'Actions pour pictogramme.svg' }).click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();
    const del = page.getByRole('dialog', { name: 'Supprimer « pictogramme.svg » ?' });
    await del.waitFor();
    ok(
      sp(await del.textContent()).includes(
        'Ce fichier est utilisé dans 1 démo. Cet emplacement restera vide.',
      ),
      'suppression : la confirmation annonce l’emplacement vidé',
    );
    await del.getByRole('button', { name: 'Supprimer' }).click();
    await card(page, 'pictogramme.svg').waitFor({ state: 'detached' });
    ok(!state.tables.media_files.some((f) => f.name === 'pictogramme.svg'), 'fichier supprimé');
    await page.context().close();
  }

  // 2. Rôle lecteur : consultation seule
  {
    const { page } = await open((s) => {
      s.tables.members[0].role = 'viewer';
      s.tables.media_files = [
        {
          id: 'm-1',
          workspace_id: 'ws-1',
          kind: 'font',
          name: 'Inter-Regular.woff2',
          path: 'ws-1/inter.woff2',
          mime: 'font/woff2',
          size_bytes: 40000,
          created_at: '2026-11-01T09:00:00Z',
        },
      ];
    });
    await card(page, 'Inter-Regular.woff2').getByText('Police · Non utilisé').waitFor();
    ok(
      (await page.locator('#media-page-file').count()) === 0 &&
        (await page.getByRole('button', { name: /^Actions pour/ }).count()) === 0,
      'rôle lecteur : ni import ni menu',
    );
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
