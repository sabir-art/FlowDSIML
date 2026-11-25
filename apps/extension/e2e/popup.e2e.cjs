/**
 * Popup de l'extension, variante B (EXT-02 §1.2 et §1.3), contre un faux Supabase (mock-supabase.cjs).
 *  - 360 px, 600 px au plus ; en-tête (logo, aide dans un nouvel onglet, menu ⋯), pied (« Données vérifiées »,
 *    « Démarrer ») ;
 *  - type de capture en liste décrite (Captures, HTML guidée, Sandbox, Vidéo, Format mobile en « Bientôt ») ;
 *  - options repliées et résumées en une ligne ; dépliées, lignes avec aide dépliable (une seule à la fois) ;
 *  - vidéo : Ma voix, Webcam dans un coin, Masquer en direct ;
 *  - erreur « Cette page ne peut pas être capturée » : « Démarrer » désactivé, jamais masqué ;
 *  - aucun contrôle natif (select, case, bouton radio, champ nombre) ; clavier ; réglages de l'extension.
 * Usage : voir capture.e2e.cjs (build sans WXT_DEBUGGER pour « Bientôt »).
 */
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const SHOTS = process.env.SHOTS_DIR;

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
    const soon = !(manifest.optional_permissions || []).includes('debugger');
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
    await popup.waitForSelector('#workspace-field:not([hidden])');

    // Le popup ouvert dans un onglet n'a pas de page à capturer : bandeau d'erreur (§1.3)
    await popup.waitForSelector('#error:not([hidden])');
    ok(
      (await popup.locator('#error-title').innerText()) === 'Cette page ne peut pas être capturée' &&
        /Ouvrez la page à capturer\./.test(await popup.locator('#error-text').innerText()) &&
        (await popup.locator('#error-retry').innerText()) === 'Réessayer' &&
        (await popup.locator('#error').getAttribute('role')) === 'alert',
      `${tag} · erreur : titre, phrase et « Réessayer » dans un bandeau role=alert`,
    );
    ok(
      (await popup.locator('#start').isVisible()) &&
        (await popup.locator('#start').getAttribute('aria-disabled')) === 'true',
      `${tag} · erreur : « Démarrer » désactivé, pas masqué`,
    );
    await shot(popup, 'erreur');

    // Gabarit
    const box = await popup.evaluate(() => ({
      w: document.body.offsetWidth,
      h: document.querySelector('.pp').offsetHeight,
      head: document.querySelector('.pph').offsetHeight,
      scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      native: document.querySelectorAll(
        'select, input[type=checkbox], input[type=radio], input[type=number], input[type=range]',
      ).length,
    }));
    ok(
      box.w === 360 && box.h <= 600 && box.head === 56,
      `${tag} · 360 px, ${box.h} px de haut, en-tête de 56 px`,
    );
    ok(!box.scrollX, `${tag} · pas de défilement horizontal`);
    ok(box.native === 0, `${tag} · aucun contrôle natif (COMP-01)`);
    ok(
      (await popup.locator('#help').getAttribute('target')) === '_blank' &&
        (await popup.locator('#help').getAttribute('aria-label')) === 'Aide (nouvel onglet)',
      `${tag} · « ? » ouvre l’aide dans un nouvel onglet`,
    );
    ok(
      (await popup.locator('label[for=title]').innerText()).replace(/\s+/g, ' ') ===
        'Titre de la démo (facultatif)' &&
        /^Ex\.\s: Créer un projet$/.test(await popup.locator('#title').getAttribute('placeholder')),
      `${tag} · titre facultatif, exemple en indication`,
    );
    ok(
      (await popup.locator('#workspace-one').innerText()).trim() === 'Acme' &&
        (await popup.locator('#workspace').isHidden()),
      `${tag} · un seul espace : le nom seul, sans liste`,
    );
    ok(
      (await popup.locator('.ppf .ok').innerText()).trim() === 'Données vérifiées' &&
        (await popup.locator('#start').innerText()).trim() === 'Démarrer',
      `${tag} · pied : « Données vérifiées » et « Démarrer »`,
    );

    // Type de capture : liste décrite
    const type = popup.locator('#type');
    ok(
      (await type.innerText()).replace(/\s+/g, ' ').trim() === 'Captures Une image à chaque clic' &&
        (await type.getAttribute('aria-haspopup')) === 'listbox' &&
        (await type.getAttribute('aria-expanded')) === 'false',
      `${tag} · type : « Captures », description, liste fermée`,
    );
    await type.click();
    const list = popup.locator('#type + [role=listbox]');
    await list.waitFor();
    const names = await list.locator('[role=option] b').allInnerTexts();
    ok(
      names.join(' | ') === 'Captures | HTML guidée | Sandbox | Vidéo | Format mobile',
      `${tag} · types réels (${names.join(', ')})`,
    );
    ok(
      (await list.locator('[role=option] small').count()) === 5 &&
        (await list.locator('[role=option][aria-selected=true] b').innerText()) === 'Captures',
      `${tag} · chaque type a sa description, « Captures » coché`,
    );
    if (soon) {
      const mobile = list.locator('[data-value=mobile]');
      ok(
        (await mobile.getAttribute('aria-disabled')) === 'true' &&
          (await mobile.locator('.pill').innerText()) === 'Bientôt' &&
          (await mobile.isVisible()),
        `${tag} · Format mobile : grisé, visible, pastille « Bientôt »`,
      );
      await mobile.click({ force: true });
      ok(
        (await type.getAttribute('aria-expanded')) === 'true' && /Captures/.test(await type.innerText()),
        `${tag} · Format mobile ne se choisit pas`,
      );
    }
    await shot(popup, 'types');
    ok(
      (await popup.locator('.pp').evaluate((el) => el.offsetHeight)) <= 600,
      `${tag} · liste ouverte : 600 px au plus`,
    );
    // Clavier : Début, flèches, Entrée ; le focus revient au bouton
    await popup.keyboard.press('Home');
    await popup.keyboard.press('ArrowDown');
    await popup.keyboard.press('ArrowDown');
    await popup.keyboard.press('ArrowDown');
    await popup.keyboard.press('Enter');
    ok(
      /^Vidéo/.test((await type.innerText()).trim()) &&
        (await popup.evaluate(() => document.activeElement?.id)) === 'type' &&
        (await list.isHidden()),
      `${tag} · clavier : flèches et Entrée choisissent « Vidéo », le focus revient au bouton`,
    );

    // Options : repliée et résumée, puis lignes de la vidéo
    const toggle = popup.locator('#opts-toggle');
    ok(
      (await toggle.getAttribute('aria-expanded')) === 'false' &&
        (await popup.locator('#opts-sum').innerText()) === 'Sans voix, sans webcam',
      `${tag} · options repliées, résumé « ${await popup.locator('#opts-sum').innerText()} »`,
    );
    await toggle.click();
    const rows = await popup.locator('#opts-body .rw:not([hidden]) .k').allInnerTexts();
    ok(
      rows.map((r) => r.trim()).join(' | ') === 'Ma voix | Webcam dans un coin | Masquer en direct',
      `${tag} · vidéo : ${rows.map((r) => r.trim()).join(', ')}`,
    );
    const mask = popup.locator('#live-mask');
    ok(
      (await mask.getAttribute('role')) === 'switch' && (await mask.getAttribute('aria-checked')) === 'false',
      `${tag} · « Masquer en direct » : interrupteur, désactivé par défaut`,
    );
    await mask.focus();
    await popup.keyboard.press('Space');
    ok((await mask.getAttribute('aria-checked')) === 'true', `${tag} · interrupteur : Espace bascule`);
    await mask.click();
    await shot(popup, 'video');

    // Retour à « Captures » : taille de l'onglet, nouveaux onglets, aides
    await type.click();
    await list.locator('[data-value=clicks]').click();
    const rows2 = await popup.locator('#opts-body .rw:not([hidden]) .k').allInnerTexts();
    ok(
      rows2.map((r) => r.trim()).join(' | ') ===
        `Taille de l’onglet | Suivre les nouveaux onglets${soon ? ' | Page entière' : ''}`,
      `${tag} · captures : ${rows2.map((r) => r.trim()).join(', ')}`,
    );
    if (soon)
      ok(
        (await popup.locator('#full-row .pill').innerText()) === 'Bientôt' &&
          (await popup.locator('#full-row').getAttribute('aria-disabled')) === 'true',
        `${tag} · « Page entière » : visible, grisée, pastille « Bientôt »`,
      );
    const q1 = popup.locator('button.q[aria-controls=tabsize-h]');
    const q2 = popup.locator('button.q[aria-controls=follow-h]');
    ok(
      /^Aide\s: Taille de l’onglet$/.test(await q1.getAttribute('aria-label')) &&
        (await popup.locator('#tabsize-h').isHidden()),
      `${tag} · aide fermée au départ, bouton nommé`,
    );
    await q1.click();
    ok(
      (await q1.getAttribute('aria-expanded')) === 'true' && (await popup.locator('#tabsize-h').isVisible()),
      `${tag} · aide dépliée sous la ligne`,
    );
    await q2.click();
    ok(
      (await popup.locator('#tabsize-h').isHidden()) &&
        (await popup.locator('#follow-h').isVisible()) &&
        (await q1.getAttribute('aria-expanded')) === 'false',
      `${tag} · une seule aide ouverte à la fois`,
    );
    await q2.click();
    await q1.click();
    await shot(popup, 'options');
    ok(
      (await popup.locator('.pp').evaluate((el) => el.offsetHeight)) <= 600,
      `${tag} · options ouvertes : 600 px au plus`,
    );
    // Taille personnalisée : deux champs texte numériques
    await popup.click('#tabsize');
    await popup.locator('#tabsize + [role=listbox] [data-value=custom]').click();
    ok(
      (await popup.locator('#desk-size').isVisible()) &&
        /800 à 2\s560/.test(await popup.locator('#desk-range').innerText()),
      `${tag} · taille personnalisée : largeur, hauteur et bornes`,
    );
    await popup.fill('#dw', '16a0');
    ok((await popup.inputValue('#dw')) === '160', `${tag} · champ de taille : chiffres seulement`);
    await popup.click('#tabsize');
    await popup.locator('#tabsize + [role=listbox] [data-value=current]').click();
    await popup.click('#follow');
    await toggle.click();
    ok(
      (await popup.locator('#opts-sum').innerText()) === 'Taille actuelle, nouveaux onglets suivis',
      `${tag} · résumé « ${await popup.locator('#opts-sum').innerText()} »`,
    );
    await shot(popup, 'repos');

    // Menu ⋯
    await popup.click('#more');
    const items = await popup.locator('#more-menu [role=menuitem]:not([hidden])').allInnerTexts();
    ok(
      items.map((i) => i.trim()).join(' | ') ===
        'Ouvrir TutoClick | Réglages de l’extension | Se déconnecter' &&
        (await popup.locator('#more').getAttribute('aria-expanded')) === 'true',
      `${tag} · menu ⋯ : ${items.map((i) => i.trim()).join(', ')}`,
    );
    await shot(popup, 'menu');
    await popup.keyboard.press('Escape');
    ok(
      (await popup.locator('#more-menu').isHidden()) &&
        (await popup.evaluate(() => document.activeElement?.id)) === 'more',
      `${tag} · Échap ferme le menu et rend le focus`,
    );
    // Réglages de l'extension : cadre par défaut (EXT-02 §5), mémorisé
    await popup.click('#more');
    await popup.click('#open-settings');
    ok(
      (await popup.locator('#settings').isVisible()) &&
        (await popup.locator('#setup').isHidden()) &&
        /^Page/.test((await popup.locator('#frame').innerText()).trim()),
      `${tag} · réglages : cadre par défaut « Page »`,
    );
    await popup.click('#frame');
    await popup.locator('#frame + [role=listbox] [data-value=element]').click();
    ok(
      (await popup.evaluate(() => chrome.storage.local.get('fd.frame')))['fd.frame'] === 'element',
      `${tag} · réglages : le cadre choisi est mémorisé`,
    );
    await shot(popup, 'reglages');
    await popup.click('#settings-back');
    ok(await popup.locator('#setup').isVisible(), `${tag} · « Retour » revient au formulaire`);

    ok(errors.length === 0, `${tag} · aucune erreur JS (${errors.join(' | ')})`);
    await ctx.close();
  }
})();
