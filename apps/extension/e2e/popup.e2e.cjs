/**
 * Popup de l'extension, L60 §1 « Que voulez-vous capturer ? », contre un faux Supabase (mock-supabase.cjs).
 *  - 360 px, hauteur du contenu (600 px au plus) ; en-tête (logo, aide, menu ⋯) ; pied (Réglages à gauche,
 *    « Données vérifiées » à droite, 12 px au-dessus et 16 px en bas) ;
 *  - 4 modes en lignes de 64 px (Captures d'écran, HTML, Vidéo, Sandbox) : un clic démarre ;
 *  - dernier mode encadré, avec la touche Entrée, focus à l'ouverture : Entrée le relance ;
 *  - destination en une ligne (« Dans Acme · Nouvelle démo ») et « Changer » ;
 *  - Réglages : taille de l'onglet (Actuelle, 1440, Mobile), nouveaux onglets, micro, flouter, mémorisés ;
 *  - page impossible à capturer : les 4 lignes restent, désactivées ;
 *  - avertissement HTML une seule fois, dans le popup, avec « Compris » ;
 *  - aucun contrôle natif (COMP-01).
 * Usage : voir capture.e2e.cjs. Passe sur les deux builds (avec ou sans l'outil de débogage).
 */
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');
const ui = require('./popup-ui.cjs');

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const SHOTS = process.env.SHOTS_DIR;
const NAMES = 'Captures d’écran | HTML | Vidéo | Sandbox';

(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  for (const theme of ['light', 'dark']) {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
      headless: true,
      locale: 'fr-FR',
      channel: 'chromium',
      colorScheme: theme,
      viewport: { width: 360, height: 600 },
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    });
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = sw.url().split('/')[2];
    const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
    const soon = ![...(manifest.permissions || []), ...(manifest.optional_permissions || [])].includes(
      'debugger',
    );
    const errors = [];
    const tag = theme === 'dark' ? 'sombre' : 'clair';
    const shot = async (p, name) =>
      SHOTS && (await p.screenshot({ path: `${SHOTS}/popup-${name}-${tag}.png` }));

    const popup = await ctx.newPage();
    popup.on('pageerror', (e) => errors.push(e.message));
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForSelector('#login:not([hidden])');
    ok(
      (await popup.locator('#foot-login .btn-primary').innerText()).trim() === 'Se connecter' &&
        (await popup.locator('#open-settings, #logout').evaluateAll((els) => els.every((e) => e.hidden))),
      `${tag} · connexion : bouton primaire dans le pied, menu sans réglages ni déconnexion`,
    );
    ok(
      (await popup.locator('#foot-login').evaluate((f) => getComputedStyle(f).padding)) === '12px 16px 16px',
      `${tag} · pied de la connexion : 12 px au-dessus, 16 px en bas`,
    );
    await shot(popup, 'connexion');
    await popup.fill('#email', 'a@b.c');
    await popup.fill('#password', 'x');
    await popup.click('button[form=login]');
    await popup.waitForSelector('#setup:not([hidden])');

    // Le popup ouvert dans un onglet n'a pas de page à capturer : bandeau d'erreur, 4 lignes désactivées
    await popup.waitForSelector('#error:not([hidden])');
    ok(
      (await popup.locator('#error-title').innerText()) === 'Cette page ne peut pas être capturée' &&
        (await popup.locator('#error').getAttribute('role')) === 'alert',
      `${tag} · page impossible : bandeau role=alert`,
    );
    let m = await ui.modes(popup);
    ok(
      m.map((x) => x.name).join(' | ') === NAMES && m.every((x) => x.disabled),
      `${tag} · page impossible : les 4 lignes restent, désactivées (aria-disabled)`,
    );
    await shot(popup, 'erreur');

    // Titre, modes, accessibilité
    ok(
      (await popup.locator('#modes-t').innerText()) === 'Que voulez-vous capturer ?' &&
        (await popup
          .locator('#modes-t')
          .evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).fontWeight].join(' '))) ===
          '16px 600',
      `${tag} · titre « Que voulez-vous capturer ? » en 16 px demi-gras`,
    );
    ok(
      m.map((x) => x.label).join(' | ') ===
        'Démarrer : Captures d’écran, Une image à chaque clic | Démarrer : HTML, La page rejouée, nette partout | Démarrer : Vidéo, L’onglet filmé, avec votre voix | Démarrer : Sandbox, Des pages libres à explorer',
      `${tag} · nom accessible « Démarrer : {mode}, {phrase} »`,
    );
    const geo = await popup.evaluate(() => {
      const bs = [...document.querySelectorAll('#modes .mode')];
      const r = bs.map((b) => b.getBoundingClientRect());
      return {
        h: r.map((x) => Math.round(x.height)),
        gaps: r.slice(1).map((x, i) => Math.round(x.top - r[i].bottom)),
        radius: getComputedStyle(bs[0]).borderRadius,
        tile: Math.round(bs[0].querySelector('.tile').getBoundingClientRect().width),
        oneLine: bs.every((b) => b.querySelector('small').getClientRects().length === 1),
        list: document.querySelector('#modes').tagName,
      };
    });
    ok(
      geo.h.every((h) => h >= 64) &&
        geo.gaps.every((g) => g === 8) &&
        geo.radius === '12px' &&
        geo.tile === 40 &&
        geo.oneLine &&
        geo.list === 'UL',
      `${tag} · lignes de 64 px au moins, espacées de 8 px, rayon 12, tuile de 40 px (${JSON.stringify(geo)})`,
    );

    // Gabarit : 360 px, hauteur du contenu, pied
    const box = await popup.evaluate(() => {
      const foot = document.querySelector('#foot-setup');
      const cs = getComputedStyle(foot);
      return {
        w: document.body.offsetWidth,
        // Hauteur naturelle : en-tête + corps (contenu entier) + pied visible
        doc: Math.min(
          600,
          [...document.querySelector('.pp').children]
            .filter((e) => !e.hidden)
            .reduce((a, e) => a + (e.classList.contains('ppb') ? e.scrollHeight : e.offsetHeight), 0),
        ),
        pp: document.querySelector('.pp').offsetHeight,
        head: document.querySelector('.pph').offsetHeight,
        scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        native: document.querySelectorAll(
          'select, input[type=checkbox], input[type=radio], input[type=number], input[type=range]',
        ).length,
        foot: [cs.paddingTop, cs.paddingBottom].join(' '),
        left: foot.firstElementChild.textContent.trim(),
        right: foot.lastElementChild.textContent.trim(),
        title: document.querySelector('#title'),
      };
    });
    ok(
      box.w === 360 && box.pp <= 600 && box.head === 56 && Math.abs(box.doc - box.pp) <= 1,
      `${tag} · 360 px, hauteur du contenu (${box.pp} px, contenu ${box.doc} px), en-tête de 56 px`,
    );
    ok(!box.scrollX && box.native === 0, `${tag} · pas de défilement horizontal, aucun contrôle natif`);
    ok(
      box.foot === '12px 16px' && box.left === 'Réglages' && box.right === 'Données vérifiées',
      `${tag} · pied : « Réglages » à gauche, « Données vérifiées » à droite, 12 px / 16 px (${box.foot})`,
    );
    ok(
      !box.title && (await popup.locator('#start').count()) === 0,
      `${tag} · ni champ titre ni « Démarrer »`,
    );

    // Page impossible : ni destination ni aide, le popup tient sans défiler (recette l60-lot-c)
    ok(
      (await popup.locator('#dest-row').isHidden()) && (await popup.locator('#modes-help').isHidden()),
      `${tag} · page impossible : ligne Destination et aide masquées`,
    );

    // Réglages de capture, mémorisés
    await popup.click('#open-prefs');
    ok(
      (await popup.locator('#settings-t').innerText()) === 'Réglages de capture' &&
        (await popup.locator('#size [role=radio]').allInnerTexts()).join(' | ') ===
          'Actuelle | 1440 | Mobile' &&
        (await popup.locator('#size [aria-checked=true]').innerText()) === 'Actuelle',
      `${tag} · réglages : taille de l’onglet Actuelle · 1440 · Mobile, « Actuelle » par défaut`,
    );
    const pref = (k) => popup.evaluate((key) => chrome.storage.local.get(key).then((r) => r[key]), k);
    await popup.locator('#size [data-value="1440x900"]').click();
    await ui.setSwitch(popup, 'follow', true);
    await ui.setSwitch(popup, 'mic', true);
    await ui.setSwitch(popup, 'live-mask', true);
    ok(
      (await pref('fd.tabSize')) === '1440x900' &&
        (await pref('fd.follow')) === true &&
        (await pref('fd.mic')) === true &&
        (await pref('fd.liveMask')) === true,
      `${tag} · réglages mémorisés (taille, nouveaux onglets, micro, flouter)`,
    );
    const mobile = popup.locator('#size [data-value=mobile]');
    ok(
      soon
        ? (await mobile.getAttribute('aria-disabled')) === 'true' &&
            (await mobile.getAttribute('title')) === 'Bientôt'
        : (await mobile.getAttribute('aria-disabled')) === null,
      `${tag} · Mobile ${soon ? 'en « Bientôt » sans l’outil de débogage' : 'disponible avec l’outil de débogage'}`,
    );
    ok(
      (await popup.locator('#settings .pr-k b').allInnerTexts()).join(' | ') ===
        'Rédaction automatique | Apparence | Taille de l’onglet | Suivre les nouveaux onglets | Micro | Flouter en direct | Webcam dans un coin | Cadre par défaut',
      `${tag} · réglages : rédaction automatique, apparence, taille, nouveaux onglets, micro, flouter, webcam, cadre`,
    );
    const col = await popup.evaluate(() =>
      ['#size', '#frame'].map((sel) => {
        const c = document.querySelector(sel).getBoundingClientRect();
        const row = document.querySelector(sel).closest('.pr').getBoundingClientRect();
        const lab = document.querySelector(sel).closest('.pr').querySelector('.pr-k').getBoundingClientRect();
        return c.top >= lab.bottom && Math.round(c.width) === Math.round(row.width - 24);
      }),
    );
    ok(
      col.every(Boolean) &&
        (await popup.locator('#frame-h').innerText()) === 'Cadre au démarrage, modifiable dans la barre.' &&
        (soon ||
          (await popup.locator('#size-h').innerText()) === 'Mobile\u202f: captures d’écran seulement.'),
      `${tag} · taille et cadre sous leur libellé, en pleine largeur, aides courtes (${JSON.stringify(col)})`,
    );
    // L64 §4 : apparence (Système par défaut) ; Sombre ou Clair s'appliquent tout de suite au popup
    ok(
      (await popup.locator('#look [role=radio]').allInnerTexts()).join(' | ') ===
        'Système | Clair | Sombre' &&
        (await popup.locator('#look [aria-checked=true]').getAttribute('data-value')) === 'system' &&
        (await popup.evaluate(() => document.documentElement.getAttribute('data-theme'))) === null,
      `${tag} · apparence : Système · Clair · Sombre, « Système » par défaut`,
    );
    const other = theme === 'dark' ? 'light' : 'dark';
    const bodyBg = () => popup.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const bg0 = await bodyBg();
    await popup.locator(`#look [data-value=${other}]`).click();
    ok(
      (await popup.evaluate(() => document.documentElement.getAttribute('data-theme'))) === other &&
        (await bodyBg()) !== bg0 &&
        (await pref('fd.appearance')) === other,
      `${tag} · apparence « ${other === 'dark' ? 'Sombre' : 'Clair'} » : popup repeint tout de suite, choix mémorisé`,
    );
    await popup.locator('#look [data-value=system]').click();
    await popup.click('#frame');
    await popup.locator('#frame + [role=listbox] [data-value=element]').click();
    ok((await pref('fd.frame')) === 'element', `${tag} · cadre par défaut mémorisé`);
    const hp = await popup.evaluate(() => ({
      pp: document.querySelector('.pp').offsetHeight,
      doc: Math.min(
        600,
        [...document.querySelector('.pp').children]
          .filter((e) => !e.hidden)
          .reduce((a, e) => a + (e.classList.contains('ppb') ? e.scrollHeight : e.offsetHeight), 0),
      ),
    }));
    ok(hp.pp <= 600 && Math.abs(hp.doc - hp.pp) <= 1, `${tag} · réglages : hauteur du contenu (${hp.pp} px)`);
    await shot(popup, 'reglages');
    await popup.click('#settings-back');
    ok(
      (await popup.locator('#setup').isVisible()) &&
        (await popup.evaluate(() => document.activeElement?.id)) === 'open-prefs',
      `${tag} · Retour : les modes, focus sur « Réglages »`,
    );
    // Remise à l'état par défaut pour la suite
    await popup.evaluate(() => chrome.storage.local.set({ 'fd.tabSize': 'current', 'fd.follow': false }));

    // L64 §1 : menu ⋯ (280 px) : espaces (courant coché, lecteur grisé), liens, déconnexion
    const members = (list) =>
      fetch('http://localhost:54400/__members', { method: 'POST', body: JSON.stringify(list) });
    await members([
      { id: '11111111-1111-1111-1111-111111111111', name: 'Acme', role: 'owner', count: 6 },
      { id: '22222222-1111-1111-1111-111111111111', name: 'Beta', role: 'editor', count: 3 },
      { id: '33333333-1111-1111-1111-111111111111', name: 'Gamma', role: 'viewer', count: 12 },
    ]);
    await popup.evaluate(() =>
      chrome.storage.local.set({ 'fd.lastWorkspace': '11111111-1111-1111-1111-111111111111' }),
    );
    await popup.reload();
    await popup.waitForSelector('#setup:not([hidden])');
    await popup.waitForFunction(
      () => document.querySelectorAll('#ws-items [role=menuitemradio]').length === 3,
    );
    await popup.click('#more');
    const menuBox = await popup.locator('#more-menu').evaluate((m) => ({
      w: Math.round(m.getBoundingClientRect().width),
      r: getComputedStyle(m).borderRadius,
    }));
    const spaces = await popup.locator('#ws-items [role=menuitemradio]').evaluateAll((els) =>
      els.map((e) => ({
        name: e.querySelector('.two > span').textContent,
        meta: e.querySelector('small').textContent,
        on: e.getAttribute('aria-checked') === 'true',
        off: e.getAttribute('aria-disabled') === 'true',
        tile: e.querySelector('.wt').textContent,
      })),
    );
    ok(
      menuBox.w === 280 &&
        menuBox.r === '16px' &&
        (await popup.locator('#ws-h').innerText()) === 'Espace de travail' &&
        JSON.stringify(spaces) ===
          JSON.stringify([
            { name: 'Acme', meta: '6 membres · Propriétaire', on: true, off: false, tile: 'A' },
            { name: 'Beta', meta: '3 membres · Éditeur', on: false, off: false, tile: 'B' },
            { name: 'Gamma', meta: 'Lecteur : capture impossible', on: false, off: true, tile: 'G' },
          ]),
      `${tag} · menu ⋯ : 280 px, rayon 16, espaces (courant coché, lecteur grisé) ${JSON.stringify(spaces)}`,
    );
    const items = await popup
      .locator('#more-menu [role=menuitem]')
      .evaluateAll((els) => els.map((e) => (e.querySelector('.two > span') ?? e).textContent.trim()));
    ok(
      items.join(' | ') === 'Ouvrir TutoClick | Réglages de capture | Aide | Se déconnecter' &&
        (await popup.locator('#logout-mail').innerText()) === 'a@b.c' &&
        (await popup.locator('#logout').evaluate((b) => getComputedStyle(b).color)) !==
          (await popup.locator('#open-app').evaluate((b) => getComputedStyle(b).color)),
      `${tag} · menu ⋯ : ${items.join(', ')} ; déconnexion en couleur de danger, avec l’adresse du compte`,
    );
    await shot(popup, 'menu');
    // Changer d'espace : la destination suit
    await popup.locator('#ws-items [data-ws="22222222-1111-1111-1111-111111111111"]').click();
    await popup.waitForFunction(() => /Beta/.test(document.getElementById('dest-text').textContent));
    ok(
      (await popup.locator('#dest-text').innerText()) === 'Dans Beta · Nouvelle démo' &&
        (await popup.locator('#more-menu').isHidden()),
      `${tag} · changer d’espace : « Dans Beta · Nouvelle démo », retour aux modes`,
    );
    // Un espace de lecteur ne se choisit pas
    await popup.click('#more');
    await popup.locator('#ws-items [data-ws="33333333-1111-1111-1111-111111111111"]').click({ force: true });
    ok(
      (await popup.locator('#ws-items [aria-checked=true] .two > span').innerText()) === 'Beta',
      `${tag} · un espace de lecteur ne se choisit pas`,
    );
    await popup.keyboard.press('Escape');
    await members(null);
    await popup.evaluate(() =>
      chrome.storage.local.set({ 'fd.lastWorkspace': '11111111-1111-1111-1111-111111111111' }),
    );
    await popup.reload();
    await popup.waitForSelector('#setup:not([hidden])');

    // Page capturable : un clic démarre, dernier mode mémorisé, Entrée le relance
    const page = await ctx.newPage();
    await page.goto('http://localhost:54400/page');
    const status = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
    const cancel = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:cancel' }));
    const reopen = async () => {
      await page.bringToFront();
      await popup.reload();
      await popup.waitForSelector('#setup:not([hidden])');
      await popup.waitForFunction(() => document.querySelectorAll('#modes .mode').length === 4);
      await popup.waitForTimeout(400);
    };
    const until = async (f) => {
      for (let i = 0; i < 40; i++) {
        if (await f()) return true;
        await popup.waitForTimeout(150);
      }
      return false;
    };
    await reopen();
    m = await ui.modes(popup);
    ok(
      (await popup.locator('#error').isHidden()) &&
        m.every((x) => !x.disabled) &&
        m.every((x) => !x.last) &&
        (await popup.locator('#page-line').innerText()).trim() === 'Sur Page test · localhost:54400' &&
        (await popup.locator('#modes-help').innerText()) === 'Un clic démarre la capture.',
      `${tag} · page capturable : 4 modes actifs, « Sur … · localhost:54400 », pas encore de dernier mode`,
    );
    ok(
      (await popup.evaluate(() => document.activeElement?.dataset.mode)) === 'clicks',
      `${tag} · sans dernier mode : focus sur la première ligne`,
    );
    await popup.keyboard.press('ArrowDown');
    await popup.keyboard.press('ArrowDown');
    const afterDown = await popup.evaluate(() => document.activeElement?.dataset.mode);
    await popup.keyboard.press('ArrowUp');
    ok(
      afterDown === 'video' && (await popup.evaluate(() => document.activeElement?.dataset.mode)) === 'html',
      `${tag} · flèches haut et bas : d’un mode à l’autre`,
    );
    await shot(popup, 'modes');

    // Destination
    ok(
      (await popup.locator('#dest-text').innerText()) === 'Dans Acme · Nouvelle démo' &&
        (await popup.locator('#dest-text b').innerText()) === 'Acme' &&
        (await popup.locator('#dest-change').innerText()) === 'Changer' &&
        (await popup.locator('.dest').evaluate((e) => e.getBoundingClientRect().height)) === 44,
      `${tag} · destination « Dans Acme · Nouvelle démo », 44 px, « Changer »`,
    );
    await popup.click('#dest-change');
    ok(
      (await popup.locator('#dest').isVisible()) &&
        (await popup.locator('#dest-t').innerText()) === 'Destination' &&
        (await popup.locator('#workspace-one').innerText()).trim() === 'Acme' &&
        (await popup.evaluate(() => document.activeElement?.id)) === 'dest-back',
      `${tag} · « Changer » : vue Destination (espace), focus sur Retour`,
    );
    await shot(popup, 'destination');
    await popup.click('#dest-back');
    ok(
      (await popup.locator('#setup').isVisible()) &&
        (await popup.evaluate(() => document.activeElement?.id)) === 'dest-change',
      `${tag} · Retour : les modes, focus sur « Changer »`,
    );
    // L64 §2 : Destination : Nouvelle démo (arbre des dossiers) ou Ajouter à une démo (recherche, liste)
    await popup.click('#dest-change');
    await popup.waitForFunction(() => document.querySelectorAll('#folders [role=treeitem]').length === 4);
    const tree = await popup.locator('#folders [role=treeitem]').evaluateAll((els) =>
      els.map((e) => ({
        t: e.querySelector('.nm').textContent,
        n: e.querySelector('.ct').textContent,
        lvl: e.getAttribute('aria-level'),
        pad: getComputedStyle(e).paddingLeft,
        h: Math.round(e.getBoundingClientRect().height),
        on: e.getAttribute('aria-selected') === 'true',
      })),
    );
    ok(
      (await popup.locator('#dest-kind [aria-checked=true]').innerText()) === 'Nouvelle démo' &&
        JSON.stringify(tree.map((x) => [x.t, x.n, x.lvl, x.on])) ===
          JSON.stringify([
            ['Toutes les démos', '3', '1', true],
            ['Ventes', '1', '2', false],
            ['Nouveaux clients', '1', '3', false],
            ['Support', '1', '2', false],
          ]) &&
        tree.every((x) => x.h === 36) &&
        parseInt(tree[2].pad) - parseInt(tree[1].pad) === 24 &&
        (await popup.locator('#folders-h').innerText()) ===
          'Le dossier est mémorisé pour les prochaines captures.',
      `${tag} · destination : Nouvelle démo, arbre des dossiers (36 px, sous-dossier décalé de 24 px), « Toutes les démos » par défaut`,
    );
    await popup.locator('#folders [data-folder="f-ventes"]').click();
    await popup.click('#dest-back');
    ok(
      (await popup.locator('#dest-text').innerText()) === 'Dans Acme · Ventes · Nouvelle démo',
      `${tag} · destination « Dans Acme · Ventes · Nouvelle démo »`,
    );
    await popup.reload();
    await popup.waitForFunction(() => /Ventes/.test(document.getElementById('dest-text').textContent));
    ok(true, `${tag} · le dossier choisi est mémorisé après une nouvelle ouverture`);
    await popup.click('#dest-change');
    // Recette UX lot E : l'onglet « Nouvelle démo » n'a que l'arbre, l'aide et la ligne Espace
    ok(
      (await popup.locator('#dest #fill, #dest-view-fill, #fill-field').count()) === 0 &&
        !/Compléter/.test(await popup.locator('#dest').innerText()),
      `${tag} · « Nouvelle démo » : aucune liste « Démo »`,
    );
    await popup.locator('#dest-kind [data-value=append]').click();
    await popup.waitForFunction(() => document.querySelectorAll('#demos [role=option]').length === 4);
    const todo = popup.locator('#demos [role=option]').first();
    ok(
      (await todo.getAttribute('data-demo')) === '33333333-3333-3333-3333-333333333333' &&
        (await todo.locator('.todo').innerText()) === '2 étapes à capturer',
      `${tag} · Ajouter à une démo : la démo à compléter en tête, pastille « 2 étapes à capturer »`,
    );
    ok(
      (await popup.locator('#demos [role=option] small').nth(1).innerText()) === 'Ventes · 4 étapes' &&
        (await popup.locator('#demo-q').evaluate((e) => Math.round(e.getBoundingClientRect().height))) === 40,
      `${tag} · Ajouter à une démo : recherche de 40 px, démos avec « dossier · n étapes »`,
    );
    await popup.fill('#demo-q', 'facture');
    ok((await popup.locator('#demos [role=option]').count()) === 1, `${tag} · la recherche filtre les démos`);
    await popup.locator('#demos [role=option]').first().click();
    ok(
      (await popup.locator('#demos [aria-selected=true]').count()) === 1 &&
        /Les nouvelles étapes s’ajoutent à la fin/.test(await popup.locator('#demos-h').innerText()),
      `${tag} · démo choisie cochée, aide « ajout à la fin »`,
    );
    await shot(popup, 'destination-ajout');
    await popup.click('#dest-back');
    ok(
      (await popup.locator('#dest-text').innerText()) === 'Dans Acme · Créer une facture',
      `${tag} · destination « Dans Acme · Créer une facture »`,
    );
    const vid = popup.locator('#modes [data-mode=video]');
    ok(
      (await vid.getAttribute('aria-disabled')) === 'true' &&
        /Vidéo\s*: nouvelle démo seulement/.test((await vid.innerText()).replace(/[\u202f\u00a0]/g, ' ')),
      `${tag} · démo existante : Vidéo visible, grisée, « Vidéo : nouvelle démo seulement »`,
    );

    // Un clic sur « Captures d'écran » démarre, sans autre décision ; la démo prend le titre de l'onglet
    await popup.locator('#modes [data-mode=clicks]').click();
    ok(
      await until(async () => {
        const s = await status();
        return s.recording && (s.mode ?? 'clicks') === 'clicks';
      }),
      `${tag} · un clic sur « Captures d’écran » démarre la capture`,
    );
    // La barre de capture est sur la page, sans autre décision
    await page.waitForSelector('[data-fd-ui]', { state: 'attached' });
    await page.waitForTimeout(500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/popup-capture-demarree-${tag}.png` });
    const st = await status();
    ok(
      st.appendDemo?.id === '55555555-5555-4555-8555-555555555555' && !st.folderId,
      `${tag} · la capture part vers la démo choisie (étapes ajoutées à la fin)`,
    );
    ok(
      st.title === 'Page test' && (await pref('fd.lastMode')) === 'clicks',
      `${tag} · titre de l’onglet (« ${st.title} »), mode mémorisé`,
    );
    await cancel();

    // Réouverture : « Captures d'écran » encadrée, touche Entrée, focus ; Entrée relance
    await reopen();
    m = await ui.modes(popup);
    const last = popup.locator('#modes .is-last');
    ok(
      m
        .filter((x) => x.last)
        .map((x) => x.mode)
        .join() === 'clicks' &&
        (await last.locator('kbd').innerText()) === 'Entrée' &&
        (await popup.evaluate(() => document.activeElement?.dataset.mode)) === 'clicks' &&
        (await popup.locator('#modes-help').innerText()) ===
          'Un clic démarre la capture. Le mode encadré est votre dernier choix : Entrée le relance.',
      `${tag} · dernier mode encadré, touche « Entrée », focus à l’ouverture`,
    );
    const ring = await last.evaluate((b) => [getComputedStyle(b).borderColor, getComputedStyle(b).boxShadow]);
    ok(
      /inset/.test(ring[1]) && ring[0] !== 'rgba(0, 0, 0, 0)',
      `${tag} · bordure et contour intérieur de marque`,
    );
    await shot(popup, 'dernier-mode');
    await popup.keyboard.press('Enter');
    ok(await until(async () => (await status()).recording), `${tag} · Entrée relance le dernier mode`);
    // L64 §1 : se déconnecter pendant une capture demande une confirmation
    await popup.reload();
    await popup.waitForSelector('#recording:not([hidden])');
    await popup.click('#more');
    await popup.click('#logout');
    ok(
      (await popup.locator('#logout-ask').isVisible()) &&
        (await popup.locator('#logout-q').innerText()) ===
          'Arrêter la capture et se déconnecter\u202f? Les étapes non envoyées sont perdues.' &&
        (await status()).recording,
      `${tag} · se déconnecter pendant une capture : confirmation, la capture continue d’ici là`,
    );
    await popup.click('#logout-no');
    ok(
      (await popup.locator('#logout-ask').isHidden()) && (await status()).recording,
      `${tag} · « Continuer la capture »`,
    );
    await cancel();

    // HTML : avertissement une seule fois, dans le popup, avec « Compris »
    await reopen();
    await popup.locator('#modes [data-mode=html]').click();
    await popup.waitForSelector('#notice:not([hidden])');
    ok(
      (await popup.locator('#notice-text').innerText()).startsWith(
        'Capturez uniquement des logiciels que vous êtes autorisé à reproduire.',
      ) &&
        (await popup.evaluate(() => document.activeElement?.id)) === 'notice-ok' &&
        (await popup.locator('#notice-ok').getAttribute('role')) === 'checkbox' &&
        !(await status()).recording,
      `${tag} · premier choix de HTML : avertissement dans le popup, case « Compris », rien ne démarre`,
    );
    await shot(popup, 'avertissement-html');
    await popup.click('#notice-ok');
    ok(
      await until(async () => {
        const s = await status();
        return s.recording && s.mode === 'html';
      }),
      `${tag} · « Compris » : la capture HTML démarre`,
    );
    ok(
      !(await page.evaluate(() =>
        [...document.querySelectorAll('[data-fd-ui]')].some((h) => h.shadowRoot?.querySelector('.notice')),
      )),
      `${tag} · l’avertissement ne recouvre plus la page`,
    );
    await cancel();
    await reopen();
    await popup.locator('#modes [data-mode=sandbox]').click();
    ok(
      (await until(async () => (await status()).recording)) &&
        (await popup.locator('#notice').isHidden()) &&
        (await pref('fd.htmlKind')) === 'sandbox',
      `${tag} · Sandbox ensuite : plus d’avertissement, capture HTML (sortie Sandbox)`,
    );
    await cancel();
    await page.close();

    ok(errors.length === 0, `${tag} · aucune erreur JS (${errors.join(' | ')})`);
    await ctx.close();
  }
})();
