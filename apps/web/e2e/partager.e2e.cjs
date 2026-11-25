/**
 * Retours du 24/11 (2e série) §1 : Partager en fenêtre, au-dessus de la démo. Ouverture depuis la barre
 * de chaque vue, depuis la carte d'une démo et par l'adresse (?share=…) ; focus piégé puis rendu au
 * bouton ; chaque mode ; pastille d'accès présente partout sauf dans Accès, mise à jour après
 * « Enregistrer » ; copie du lien ; export ; démo non publiée ; 390 px (liste des modes, puis le mode,
 * retour) sans défilement horizontal ; axe. Données fictives.
 * Usage : [THEME=dark] [WIDTH=390] [SHOTS_DIR=…] node e2e/partager.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const WIDTH = Number(process.env.WIDTH || 1440);
const MOBILE = WIDTH < 640;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (path, prepare = () => {}) => {
    const ctx = await themedContext(b, {
      viewport: { width: WIDTH, height: MOBILE ? 844 : 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    const demo = state.tables.demos.find((d) => d.id === DEMO);
    // Démo publiée par défaut
    demo.status = 'published';
    demo.current_version_id = 'v-1';
    state.tables.demo_versions.push({
      id: 'v-1',
      demo_id: DEMO,
      number: 1,
      manifest: { steps: [] },
      published_at: '2026-11-24T10:12:00Z',
      public_ack: null,
    });
    prepare(state, demo);
    await install(page, state);
    await page.goto(`${APP}/#${path}`);
    return { page, state };
  };
  const dlg = (page) => page.locator('dialog.shd-dialog[open]');
  const mode = async (page, name) => {
    // À 390 px : retour à la liste des modes, puis le mode s'ouvre à sa place
    if (MOBILE && (await page.locator('.shd.is-menu').count()) === 0) {
      await dlg(page).locator('.shd-back').click();
      await page.locator('.shd.is-menu').waitFor();
    }
    await dlg(page).locator('.shd-nav').getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(
      (n) =>
        !document.querySelector('.shd.is-menu') && document.querySelector('#shd-mode')?.textContent === n,
      name,
    );
  };
  const noScroll = (page) =>
    page.evaluate(() => {
      const body = document.querySelector('.shd-body');
      return (
        document.documentElement.scrollWidth <= window.innerWidth &&
        (!body || body.scrollWidth <= body.clientWidth)
      );
    });
  const settle = (page) =>
    page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== 'running'),
    );
  const shot = async (page, name) => {
    if (!SHOTS) return;
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}-${WIDTH}.png` });
  };
  const axe = async (page, name) => {
    const r = await new AxeBuilder({ page }).include('dialog.shd-dialog').analyze();
    const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(
      bad.length === 0,
      `${name} : axe sans violation (${bad.map((v) => `${v.id} ${v.nodes[0]?.target}`).join(' ; ')})`,
    );
  };

  // ===== Ouverture depuis la barre de chaque vue, focus piégé puis rendu =====
  {
    const { page } = await open(`/demos/${DEMO}/analytics`);
    for (const view of ['analytics', 'leads', 'visitors']) {
      await page.goto(`${APP}/#/demos/${DEMO}/${view}`);
      const btn = page.locator('.dv-bar [data-share-open]');
      await btn.waitFor();
      await btn.click();
      await dlg(page).waitFor();
      ok(
        new RegExp(`/demos/${DEMO}/${view}\\?share=${MOBILE ? 'menu' : 'lien'}$`).test(page.url()),
        `${view} : « Partager » ouvre la fenêtre sur la vue (${page.url().split('#')[1]})`,
      );
      ok(
        await page.evaluate(() => !!document.activeElement?.closest('dialog.shd-dialog')),
        `${view} : le focus est dans la fenêtre`,
      );
      await page.keyboard.press('Escape');
      await dlg(page).waitFor({ state: 'detached' });
      ok(
        !/share=/.test(page.url()) &&
          (await page.evaluate(() => document.activeElement?.hasAttribute('data-share-open'))),
        `${view} : Échap ferme, le focus revient à « Partager »`,
      );
    }
    // Focus piégé : Tab ne sort pas de la fenêtre
    await page.locator('.dv-bar [data-share-open]').click();
    await dlg(page).waitFor();
    let inside = true;
    for (let i = 0; i < 25 && inside; i++) {
      await page.keyboard.press('Tab');
      inside = await page.evaluate(
        () =>
          !!document.activeElement?.closest('dialog.shd-dialog') || document.activeElement === document.body,
      );
    }
    ok(inside, 'focus piégé dans la fenêtre (25 tabulations)');
    // Fermeture par la croix
    await dlg(page)
      .locator(MOBILE ? '.shd-close--side' : '.shd-top .shd-close')
      .click();
    await dlg(page).waitFor({ state: 'detached' });
    ok(true, 'la croix ferme la fenêtre');
    await page.context().close();
  }

  // ===== Depuis l'éditeur et depuis la carte d'une démo ; ancienne adresse redirigée =====
  if (!MOBILE) {
    const { page } = await open(`/demos/${DEMO}/edit`);
    await page.locator('.ed-bar [data-share-open]').click();
    await dlg(page).waitFor();
    ok(/\/edit\?share=lien$/.test(page.url()), 'éditeur : « Partager » ouvre la fenêtre (?share=lien)');
    await page.keyboard.press('Escape');
    await dlg(page).waitFor({ state: 'detached' });
    await page.goto(`${APP}/#/`);
    const card = page.locator('.demo-card, .dm-card, article').filter({ hasText: 'Démo CRM' }).first();
    await card.waitFor();
    await card
      .getByRole('button', { name: /Actions|Plus/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Partager' }).click();
    await dlg(page).waitFor();
    ok(/\/edit\?share=lien$/.test(page.url()), 'carte d’une démo : menu ⋯ › Partager ouvre la fenêtre');
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=access`);
    await page.waitForFunction(() => /\/edit\?share=acces$/.test(location.hash));
    await dlg(page).waitFor();
    ok(true, 'ancienne adresse /share?tab=access : redirigée vers ?share=acces');
    await page.context().close();
  }

  // ===== Les modes, la pastille d'accès, la copie =====
  {
    const { page, state } = await open(`/demos/${DEMO}/analytics?share=${MOBILE ? 'menu' : 'lien'}`);
    await dlg(page).waitFor();
    const d = dlg(page);
    // La date de publication arrive avec la démo : on attend l'en-tête complet
    await d.locator('.shd-head p', { hasText: /^Publiée le / }).waitFor();
    ok(
      (await d.locator('#shd-title').textContent()) === 'Partager «\u202fDémo CRM\u202f»' &&
        (await d.locator('#shd-title').evaluate((el) => el.getBoundingClientRect().height)) < 24 &&
        /^Publiée le 24 nov\.$/.test(await d.locator('.shd-head p').textContent()),
      `en-tête : titre sur une ligne, « Publiée le 24 nov. » sans l’année (${await d.locator('.shd-head p').textContent()})`,
    );
    const names = (await d.locator('.shd-nav__item').allTextContents()).map((x) => x.trim());
    ok(
      names.join('|') === 'Lien|Intégrer|Liens personnalisés|Page de la démo|Accès|Exporter',
      `modes : ${names.join(', ')}`,
    );
    if (MOBILE) {
      ok(
        (await d.locator('.shd-main').isHidden()) && (await noScroll(page)),
        '390 : la liste des modes d’abord',
      );
      await shot(page, 'partager-menu');
    }
    await mode(page, 'Lien');
    if (!MOBILE)
      ok(
        (await d.locator('.shd-nav__item[aria-current="page"]').textContent()).trim() === 'Lien',
        'mode courant : aria-current',
      );
    const pill = d.locator('.shd-access');
    ok(
      (await pill.locator('.shd-access__txt').textContent()) === 'Toute personne avec le lien' &&
        (await pill.getByRole('button', { name: 'Modifier' }).count()) === 1,
      `Lien : pastille d’accès « Toute personne avec le lien » + « Modifier » (${JSON.stringify(await pill.innerText())})`,
    );
    ok((await d.locator('.shd-banner').count()) === 0, 'démo publiée : pas de bandeau');
    ok(
      (await d.locator('#sh-panel-link').getByRole('checkbox').count()) === 0 &&
        (await d.locator('#sh-panel-link').getByRole('switch').count()) === 0 &&
        !names.includes('Formation'),
      'Lien : plus d’interrupteur « Accès public » ; plus de mode Formation (il est dans Diffuser)',
    );
    // Copie du lien
    const link = await d.locator('#sh-pub').inputValue();
    const lien = d.locator('#sh-panel-link');
    await lien.getByRole('button', { name: 'Copier le lien', exact: true }).click();
    await lien.locator('.fd-copy__ok', { hasText: 'Copié' }).waitFor();
    if (MOBILE) {
      const pill = await d.locator('.shd-access').boundingBox();
      ok(
        pill.x >= 16 && pill.x + pill.width <= WIDTH - 16,
        `390 : la pastille d’accès garde 16 px de marge (${Math.round(pill.x)} → ${Math.round(pill.x + pill.width)})`,
      );
    }
    ok(
      (await page.evaluate(() => navigator.clipboard.readText())) === link && /\/d\/|\/l\//.test(link),
      'Lien : « Copier » met le lien public dans le presse-papiers',
    );
    // §1.3 : mode sobre. Ouvrir, trois façons de transmettre, deux lignes repliées, aucun encadré
    const openBtn = lien.getByRole('link', { name: 'Ouvrir la démo dans un nouvel onglet' });
    ok(
      (await openBtn.getAttribute('href')) === link && (await openBtn.getAttribute('target')) === '_blank',
      'Lien : bouton icône « Ouvrir » vers le lien public, nouvel onglet',
    );
    const acts = lien.getByRole('group', { name: 'Partager ailleurs' });
    ok(
      (await acts.locator('.fd-btn--icon').count()) === 3 &&
        (
          (await acts.getByRole('link', { name: 'Envoyer par e-mail' }).getAttribute('href')) || ''
        ).startsWith('mailto:?subject='),
      'Lien : trois boutons icône (e-mail, message, QR code)',
    );
    await acts.getByRole('button', { name: 'Copier un message prêt à envoyer' }).click();
    const msg = await page.evaluate(() => navigator.clipboard.readText());
    ok(msg.includes(link) && msg.startsWith('Bonjour'), `Lien : message prêt à envoyer copié (${msg})`);
    // Retour UX : la copie se confirme sur place (« Copié », région polie), jamais par un toast
    ok(
      (await acts.getByRole('status').textContent()) === 'Copié' &&
        (await page.locator('.toast').count()) === 0,
      'Lien : copies confirmées sur place par « Copié », aucun toast',
    );
    ok(
      (await d.getByRole('link', { name: 'modifications non publiées' }).count()) === 0,
      'fenêtre sobre : pas de lien « modifications non publiées »',
    );
    const qrBtn = acts.getByRole('button', { name: 'Afficher le QR code' });
    ok((await qrBtn.getAttribute('aria-expanded')) === 'false', 'Lien : QR code masqué par défaut');
    await qrBtn.click();
    await lien.locator('.shl-qr svg').waitFor();
    ok(
      (await qrBtn.getAttribute('aria-expanded')) === 'true' &&
        /QR code du lien/.test((await lien.locator('.shl-qr svg').getAttribute('aria-label')) || ''),
      'Lien : QR code affiché, nommé',
    );
    await shot(page, 'partager-lien-qr');
    await qrBtn.click();
    const folds = lien.locator('.shd-fold__head');
    ok(
      (await folds.count()) === 2 &&
        (await folds.allTextContents()).join('|') === 'Adresse personnalisée|Paramètres d’URL' &&
        (await folds.evaluateAll((l) => l.every((b) => b.getAttribute('aria-expanded') === 'false'))) &&
        (await lien.locator('#sh-slug').count()) === 0,
      'Lien : deux lignes repliées « Adresse personnalisée », « Paramètres d’URL »',
    );
    await folds.nth(1).click();
    ok(
      (await lien.getByRole('region', { name: /paramètres/i }).count()) === 1 &&
        (await folds.nth(1).getAttribute('aria-expanded')) === 'true',
      'Lien : « Paramètres d’URL » se déplie',
    );
    await folds.nth(1).click();
    ok((await lien.locator('.fd-note, .sh-note').count()) === 0, 'Lien : aucun encadré d’explication');
    ok(await noScroll(page), 'Lien : pas de défilement horizontal');
    await shot(page, 'partager-lien');
    await axe(page, 'Lien');

    for (const m of ['Intégrer', 'Liens personnalisés', 'Page de la démo', 'Exporter']) {
      await mode(page, m);
      ok((await d.locator('.shd-access').count()) === 1, `${m} : pastille d’accès présente`);
      ok(await noScroll(page), `${m} : pas de défilement horizontal`);
      await axe(page, m);
      if (m === 'Page de la démo') {
        // §1.3 : interrupteur seul tant que la page est désactivée ; puis adresse, champs, « Plus de réglages »
        const pg = d.locator('#sh-panel-page');
        const on = pg.getByRole('switch', { name: 'Activer la page de la démo' });
        await on.waitFor();
        ok(
          !(await on.isChecked()) &&
            (await pg.locator('.alert').count()) === 0 &&
            (await pg.getByRole('button', { name: 'Enregistrer' }).count()) === 0,
          'Page de la démo : désactivée, l’interrupteur seul, aucun encadré',
        );
        await on.check({ force: true });
        await pg.getByLabel('Titre', { exact: true }).waitFor();
        ok(state.tables.demo_pages?.[0]?.enabled === true, 'Page de la démo : activation enregistrée');
        const addr = await pg.getByRole('textbox', { name: 'Adresse de la page' }).inputValue();
        ok(
          /#\/p\//.test(addr) &&
            (await pg
              .getByRole('link', { name: 'Ouvrir la page de la démo dans un nouvel onglet' })
              .getAttribute('href')) === addr,
          'Page de la démo : adresse à copier + icône « Ouvrir »',
        );
        ok(
          (await pg.getByLabel('Titre', { exact: true }).getAttribute('maxlength')) === '70' &&
            (await pg.getByLabel('Description').getAttribute('maxlength')) === '200' &&
            (await pg.getByRole('radiogroup', { name: 'Style' }).getByRole('radio').allInnerTexts()).join(
              '|',
            ) === 'Démo|Clair|Sombre',
          'Page de la démo : Titre (70), Description (200), Style Démo · Clair · Sombre',
        );
        const more = pg.getByRole('button', { name: 'Plus de réglages', exact: true });
        ok(
          (await more.getAttribute('aria-expanded')) === 'false' &&
            (await pg.getByRole('switch').count()) === 1,
          'Page de la démo : « Plus de réglages » repliée',
        );
        await more.click();
        ok(
          (await pg.getByRole('switch', { name: /Proposer d’autres démos/ }).count()) === 1 &&
            (await pg.getByRole('switch', { name: /Indexation par les moteurs de recherche/ }).count()) === 1,
          'Page de la démo : Autres démos et Indexation dans « Plus de réglages »',
        );
        await pg.getByLabel('Titre', { exact: true }).fill('Découvrir le CRM');
        await pg.getByRole('switch', { name: /Proposer d’autres démos/ }).check({ force: true });
        ok(
          (await pg.getByRole('button', { name: 'Enregistrer' }).count()) === 1,
          'Page de la démo : un seul « Enregistrer »',
        );
        await pg.getByRole('button', { name: 'Enregistrer' }).click();
        await page.getByText('Page de la démo enregistrée.').waitFor();
        ok(
          state.tables.demo_pages[0].title === 'Découvrir le CRM' &&
            state.tables.demo_pages[0].related === true,
          'Page de la démo : titre et « Autres démos » enregistrés ensemble',
        );
        ok(await noScroll(page), 'Page de la démo : pas de défilement horizontal (réglages ouverts)');
        await shot(page, 'partager-page');
        await axe(page, 'Page de la démo (active)');
      }
      if (m === 'Liens personnalisés') {
        // §1.3 : « Créer un lien » et « Importer (CSV) » en bas ; pas de phrase d'aide ni de boutons en tête
        const perso = d.locator('#sh-panel-perso');
        ok(
          (await perso.locator('.shp-foot > .fd-btn').allInnerTexts()).map((x) => x.trim()).join('|') ===
            'Créer un lien|Importer (CSV)' && (await perso.locator('.sh-perso-head').count()) === 0,
          'Liens personnalisés : « Créer un lien » et « Importer (CSV) » sous la liste',
        );
        if ((await perso.locator('table.sh-links tbody tr').count()) > 0) {
          const q = perso.getByRole('searchbox', { name: 'Rechercher un lien' });
          await q.fill('zzz-aucun');
          ok(
            (await perso.getByRole('status').textContent()) === 'Aucun lien ne correspond à la recherche.',
            'Liens personnalisés : recherche sans résultat annoncée',
          );
          await q.fill('');
          ok(
            (await perso.locator('table.sh-links thead th').allTextContents()).slice(0, 3).join('|') ===
              'Destinataire|Créé le|Vues',
            'Liens personnalisés : colonnes Destinataire, Créé le, Vues',
          );
        }
        await shot(page, 'partager-liens');
      }
      if (m === 'Intégrer') {
        // §1.3 : trois formats en cartes radio, code qui passe à la ligne, « Copier le code », aperçu
        const emb = d.locator('#sh-panel-embed');
        const cards = emb.getByRole('radiogroup', { name: 'Format d’intégration' }).getByRole('radio');
        ok(
          (await cards.allInnerTexts()).join('|') ===
            'Encadré dans la page|Bouton qui ouvre la démo|Plein écran' &&
            (await cards.nth(0).getAttribute('aria-checked')) === 'true',
          'Intégrer : cartes radio Encadré · Bouton · Plein écran, Encadré choisi',
        );
        const pre = emb.locator('pre.she-code');
        ok(
          /<iframe/.test(await pre.innerText()) &&
            (await pre.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)),
          'Intégrer : le code passe à la ligne (pas de défilement dans le bloc)',
        );
        await cards.nth(0).focus();
        await page.keyboard.press('ArrowRight');
        ok(
          (await cards.nth(1).getAttribute('aria-checked')) === 'true' &&
            /popup\.js/.test(await pre.innerText()),
          'Intégrer : flèche droite → « Bouton », code bouton + script',
        );
        await cards.nth(2).click();
        ok(
          /position:fixed/.test(await pre.innerText()),
          'Intégrer : « Plein écran », iframe sur toute la page',
        );
        ok(
          ((await emb.locator('.she-prev').getAttribute('aria-label')) || '').startsWith('Aperçu') &&
            (await emb.locator('.she-prev--full').count()) === 1,
          'Intégrer : aperçu du format choisi',
        );
        await cards.nth(0).click();
        // Encadré : taille automatique ou fixe (gardée par démo), « Démarrer au clic » en gris « Bientôt »
        const sizes = emb.getByRole('radiogroup', { name: 'Taille' });
        ok(
          (await sizes.getByRole('radio', { name: 'Automatique' }).getAttribute('aria-checked')) === 'true' &&
            (await emb.locator('.she-soon').innerText()).includes('Bientôt') &&
            (await emb.locator('.she-soon').getAttribute('aria-disabled')) === 'true',
          'Intégrer : taille Automatique par défaut ; « Démarrer au clic » en gris, « Bientôt »',
        );
        await sizes.getByRole('radio', { name: 'Fixe' }).click();
        await emb.getByLabel('Largeur').fill('800');
        await emb.getByLabel('Hauteur').fill('500');
        ok(
          /width="800" height="500"/.test(await pre.innerText()),
          'Intégrer : taille fixe, largeur et hauteur dans le code',
        );
        await mode(page, 'Lien');
        await mode(page, 'Intégrer');
        ok(
          (await sizes.getByRole('radio', { name: 'Fixe' }).getAttribute('aria-checked')) === 'true' &&
            (await emb.getByLabel('Largeur').inputValue()) === '800',
          'Intégrer : une intégration en taille fixe se rouvre sur « Fixe » avec ses valeurs',
        );
        await sizes.getByRole('radio', { name: 'Automatique' }).click();
        await cards.nth(2).click();
        ok(
          (await emb.locator('.she-size').count()) === 0,
          'Intégrer : la taille ne vaut que pour « Encadré »',
        );
        await cards.nth(0).click();
        await emb.getByRole('button', { name: 'Copier le code' }).click();
        await emb.getByRole('button', { name: 'Copié', exact: true }).waitFor();
        ok(
          (await page.locator('.toast').count()) === 0,
          'Intégrer : copie confirmée sur le bouton, aucun toast',
        );
        ok(
          (await page.evaluate(() => navigator.clipboard.readText())).includes('<iframe'),
          'Intégrer : « Copier le code » met le code dans le presse-papiers',
        );
        const folds = emb.locator('.shd-fold__head');
        ok(
          (await folds.allTextContents()).join('|') === 'Adapter à un outil|Sites autorisés' &&
            (await folds.evaluateAll((l) => l.every((b) => b.getAttribute('aria-expanded') === 'false'))) &&
            (await emb.locator('.alert').count()) === 0,
          'Intégrer : réglages rares repliés, aucun encadré',
        );
        await shot(page, 'partager-integrer');
      }
    }
    // Exporter : trois fichiers en cartes radio, un seul « Exporter » avec la mise en garde à sa gauche
    const exp = d.locator('#sh-panel-export');
    const files = exp.getByRole('radiogroup', { name: 'Fichier à exporter' }).getByRole('radio');
    ok(
      (await files.allInnerTexts()).map((x) => x.trim()).join('|') === 'PDF|GIF|Vidéo MP4' &&
        (await files.nth(0).getAttribute('aria-checked')) === 'true',
      'Exporter : cartes radio PDF · GIF · Vidéo MP4, PDF choisi',
    );
    const go = exp.getByRole('button', { name: 'Exporter', exact: true });
    const help = exp.locator('.shx-foot .help');
    const [hb, gb] = [await help.boundingBox(), await go.boundingBox()];
    ok(
      (await exp.getByRole('button').count()) === 1 &&
        (await help.textContent()) === 'Le fichier n’est pas protégé par l’accès.' &&
        (MOBILE || hb.x + hb.width <= gb.x),
      'Exporter : un seul bouton « Exporter », « Le fichier n’est pas protégé par l’accès. » à sa gauche',
    );
    await shot(page, 'partager-exporter');
    await files.nth(2).click();
    await go.click();
    await page.locator('dialog.x15-dialog[open]').waitFor();
    // Le choix du fichier est rendu dès que la fenêtre d'export a chargé la démo : on attend cet état
    const picked = await page
      .waitForFunction(
        () => {
          const x = document.querySelector('dialog.x15-dialog[open]');
          if (!x) return false;
          if (x.classList.contains('x15-small')) return 'erreur';
          const r = x.querySelector('input[type="radio"][value="mp4"]');
          return r ? (r.checked ? 'mp4' : 'autre') : false;
        },
        null,
        { timeout: 30000 },
      )
      .then((h) => h.jsonValue());
    ok(picked === 'mp4', `Exporter : la fenêtre d’export s’ouvre sur le fichier choisi (${picked})`);
    await page.keyboard.press('Escape');
    await page.locator('dialog.x15-dialog').waitFor({ state: 'detached' });
    ok((await dlg(page).count()) === 1, 'Échap ferme l’export, pas la fenêtre Partager');

    // Accès : pas de pastille ; un mot de passe enregistré met la pastille à jour partout
    await d.locator('.shd-access').getByRole('button', { name: 'Modifier' }).click();
    await page.waitForFunction(() => document.querySelector('#shd-mode')?.textContent === 'Accès');
    ok(/share=acces$/.test(page.url()), '« Modifier » ouvre le mode Accès');
    ok((await d.locator('.shd-access').count()) === 0, 'Accès : pas de pastille d’accès');
    ok(
      (await d.locator('.shd-scope').textContent()) ===
        'Vaut pour le lien, l’intégration, les liens personnalisés et la page de la démo.',
      'Accès : « Vaut pour le lien, l’intégration, les liens personnalisés et la page de la démo. »',
    );
    await d.getByRole('radio', { name: /Avec un mot de passe/ }).check({ force: true });
    await d.locator('input[type="password"]').first().fill('Fictif-2026!');
    await shot(page, 'partager-acces');
    await axe(page, 'Accès');
    await d.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
    await page.waitForFunction(() => true);
    for (let i = 0; i < 50 && state.tables.demo_access[0]?.mode !== 'password'; i++)
      await page.waitForTimeout(100);
    ok(state.tables.demo_access[0]?.mode === 'password', 'Accès : mot de passe enregistré');
    await mode(page, 'Lien');
    await page.waitForFunction(
      () => document.querySelector('.shd-access__txt')?.textContent === 'Avec un mot de passe',
    );
    ok(true, 'pastille d’accès mise à jour : « Avec un mot de passe »');
    await mode(page, 'Intégrer');
    ok(
      (await d.locator('.shd-access__txt').textContent()) === 'Avec un mot de passe',
      'la même pastille dans chaque mode',
    );
    if (MOBILE) {
      await d.locator('.shd-back').click();
      await d.locator('.shd.is-menu').waitFor();
      ok(/share=menu$/.test(page.url()), '390 : « ← » revient à la liste des modes');
    }
    await page.context().close();
  }

  // ===== « Retirer la publication… » : dans le menu ⋯ de la barre de démo, avec confirmation =====
  if (!MOBILE) {
    const { page, state } = await open(`/demos/${DEMO}/edit`);
    const demo = state.tables.demos.find((x) => x.id === DEMO);
    await page.locator('.ed-bar').getByRole('button', { name: 'Plus d’options' }).click();
    const item = page.getByRole('menuitem', { name: 'Retirer la publication…' });
    await item.waitFor();
    const last = (await page.getByRole('menuitem').allTextContents()).map((x) => x.trim()).at(-1);
    ok(
      last === 'Retirer la publication…',
      `menu ⋯ de la barre : « Retirer la publication… » en bas (${last})`,
    );
    await item.click();
    const confirm = page.getByRole('dialog', { name: 'Retirer la publication de «\u202fDémo CRM\u202f» ?' });
    await confirm.waitFor();
    ok(
      (await confirm.textContent()).includes(
        'Le lien, l’intégration et les liens personnalisés cesseront de fonctionner. Vous pourrez republier à tout moment.',
      ),
      'confirmation : ce qui cesse de fonctionner, republication possible',
    );
    await confirm.getByRole('button', { name: 'Annuler' }).click();
    ok(demo.status === 'published', '« Annuler » : la démo reste publiée');
    await page.locator('.ed-bar').getByRole('button', { name: 'Plus d’options' }).click();
    await page.getByRole('menuitem', { name: 'Retirer la publication…' }).click();
    await page
      .getByRole('dialog', { name: /^Retirer la publication de/ })
      .getByRole('button', { name: 'Retirer la publication' })
      .click();
    for (let i = 0; i < 60 && demo.status === 'published'; i++) await page.waitForTimeout(100);
    ok(demo.status !== 'published', 'publication retirée');
    await page.locator('.ed-bar [data-share-open]').click();
    await dlg(page).locator('.shd-banner').waitFor();
    ok(true, 'Partager affiche alors le bandeau « Publiez la démo pour activer le lien. »');
    // Diffuser : les parcours de formation en première section
    await page.keyboard.press('Escape');
    await page.goto(`${APP}/#/demos/${DEMO}/distribute`);
    await page.locator('dialog.dif-dialog[open]').getByRole('tab').first().waitFor();
    const tabs = await page.locator('dialog.dif-dialog[open]').getByRole('tab').allTextContents();
    ok(
      tabs[0]?.trim() === 'Parcours de formation',
      `Diffuser : « Parcours de formation » en premier (${tabs.map((x) => x.trim()).join(', ')})`,
    );
    await page.context().close();
  }

  // ===== « Afficher sur la page publique » : case du menu ⋯ (barre de démo, carte), catalogue de l'espace =====
  if (!MOBILE) {
    const { page, state } = await open(`/demos/${DEMO}/analytics`, (st) => {
      st.tables.training_centers = [
        {
          workspace_id: 'ws-1',
          slug: 'acme',
          draft: {},
          published: null,
          public_page: {},
          public_page_enabled: true,
        },
      ];
    });
    const centre = () => state.tables.training_centers[0];
    const more = page.locator('.dv-bar').getByRole('button', { name: 'Plus d’options' });
    await more.click();
    const box = page.getByRole('menuitemcheckbox', { name: 'Afficher sur la page publique' });
    await box.waitFor();
    ok(
      (await box.getAttribute('aria-checked')) === 'true',
      'page publique « toutes les démos » : case cochée',
    );
    await box.click();
    for (let i = 0; i < 50 && !Array.isArray(centre().public_page.demos); i++) await page.waitForTimeout(100);
    ok(
      Array.isArray(centre().public_page.demos) && !centre().public_page.demos.includes(DEMO),
      'décocher : la démo est retirée de la liste de la page publique',
    );
    await page.locator('.toasts').getByText('n’est plus sur la page publique').waitFor();
    await more.click();
    await page
      .getByRole('menuitemcheckbox', { name: 'Afficher sur la page publique', checked: false })
      .click();
    for (let i = 0; i < 50 && !centre().public_page.demos.includes(DEMO); i++) await page.waitForTimeout(100);
    ok(centre().public_page.demos.includes(DEMO), 'cocher : la démo revient sur la page publique');
    // Accès restreint : entrée indisponible, avec la raison
    state.tables.demo_access = [{ demo_id: DEMO, workspace_id: 'ws-1', mode: 'password' }];
    await page.reload();
    await page.locator('.dv-bar').getByRole('button', { name: 'Plus d’options' }).click();
    const off = page.getByRole('menuitemcheckbox', { name: 'Afficher sur la page publique' });
    await off.waitFor();
    ok(
      (await off.getAttribute('aria-disabled')) === 'true' &&
        (await off.getAttribute('title')) ===
          'Accès restreint : la démo ne peut pas être sur la page publique',
      'accès restreint : entrée désactivée, « Accès restreint : la démo ne peut pas être sur la page publique »',
    );
    await page.keyboard.press('Escape');
    // Carte d'une démo : même entrée
    state.tables.demo_access = [];
    await page.goto(`${APP}/#/`);
    const card = page.locator('.demo-card, .dm-card, article').filter({ hasText: 'Démo CRM' }).first();
    await card.waitFor();
    await card
      .getByRole('button', { name: /Actions|Plus/ })
      .first()
      .click();
    ok(
      (await page.getByRole('menuitemcheckbox', { name: 'Afficher sur la page publique' }).count()) === 1,
      'carte d’une démo : « Afficher sur la page publique » dans le menu ⋯',
    );
    await page.context().close();
  }

  // ===== Démo non publiée =====
  {
    const { page } = await open(`/demos/${DEMO}/analytics?share=lien`, (state, demo) => {
      demo.status = 'draft';
      demo.current_version_id = null;
      state.tables.demo_versions.length = 0;
    });
    const d = dlg(page);
    await d.locator('.shd-banner').waitFor();
    ok(
      (await d.locator('.shd-banner').getAttribute('role')) === 'status' &&
        (await d.locator('.shd-banner span').textContent()) === 'Publiez la démo pour activer le lien.' &&
        (await d.locator('.shd-banner').getByRole('button', { name: 'Publier' }).count()) === 1,
      'non publiée : bandeau « Publiez la démo pour activer le lien. » + « Publier »',
    );
    ok(
      (await d.locator('.shd-head p').textContent()) === 'Pas encore publiée',
      'en-tête : « Pas encore publiée »',
    );
    ok(
      (await d.locator('#sh-pub').isDisabled()) &&
        (await d.getByRole('link', { name: 'Ouvrir la démo dans un nouvel onglet' }).count()) === 0,
      'non publiée : le lien est grisé, « Ouvrir » indisponible',
    );
    const off = await d
      .locator('.shl-acts .fd-btn--icon')
      .evaluateAll((l) =>
        l.map(
          (b) =>
            b.tagName === 'BUTTON' &&
            b.getAttribute('aria-disabled') === 'true' &&
            (b.title || b.dataset.tipTitle) === 'Publiez la démo d’abord' &&
            Number(getComputedStyle(b).opacity) < 1,
        ),
      );
    ok(
      off.length === 3 && off.every(Boolean),
      'non publiée : e-mail, message et QR code désactivés, grisés, avec la raison',
    );
    ok((await d.locator('.shd-access').count()) === 1, 'non publiée : l’accès se règle déjà');
    await shot(page, 'partager-nonpubliee');
    await axe(page, 'Non publiée');
    await d.locator('.shd-banner').getByRole('button', { name: 'Publier' }).click();
    await page.waitForFunction((id) => location.hash.startsWith(`#/demos/${id}/edit`), DEMO);
    ok(true, '« Publier » du bandeau mène à la publication, dans l’éditeur');
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
