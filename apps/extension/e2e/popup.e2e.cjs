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
        'Taille de l’onglet | Suivre les nouveaux onglets | Micro | Flouter en direct | Webcam dans un coin | Cadre par défaut',
      `${tag} · réglages : taille, nouveaux onglets, micro, flouter, webcam, cadre`,
    );
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

    // Menu ⋯
    await popup.click('#more');
    const items = await popup.locator('#more-menu [role=menuitem]:not([hidden])').allInnerTexts();
    ok(
      items.map((i) => i.trim()).join(' | ') === 'Ouvrir TutoClick | Réglages de capture | Se déconnecter',
      `${tag} · menu ⋯ : ${items.map((i) => i.trim()).join(', ')}`,
    );
    await popup.keyboard.press('Escape');

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

    // Un clic sur « Captures d'écran » démarre, sans autre décision ; la démo prend le titre de l'onglet
    await popup.locator('#modes [data-mode=clicks]').click();
    ok(
      await until(async () => {
        const s = await status();
        return s.recording && (s.mode ?? 'clicks') === 'clicks';
      }),
      `${tag} · un clic sur « Captures d’écran » démarre la capture`,
    );
    const st = await status();
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
