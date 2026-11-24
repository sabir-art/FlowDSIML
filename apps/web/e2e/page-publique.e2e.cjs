/**
 * Paramètres › Page publique (retours client §6.1, maquettes lot1-parametres/page-publique-*) : réglage du
 * catalogue public /c/{adresse}. Activation, adresse, en-tête, démos choisies et ordonnées, pied, refus
 * d'activation, centre de formation à la même adresse. Puis le lecteur : logo de la médiathèque, «\u202fCréé
 * avec TutoClick\u202f» masqué, page coupée. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] [WIDTH=390] node e2e/page-publique.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const WIDTH = Number(process.env.WIDTH || 1440);
const MOBILE = WIDTH < 768;
const D = (n) => `0b5c1f0e-0000-4000-8000-0000000000a${n}`;

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  // Trois démos publiées en accès ouvert, une protégée, un brouillon
  const withDemos = (s) => {
    const base = s.tables.demos[0];
    s.tables.demos = [
      { ...base, id: D(1), title: 'Démo CRM', status: 'published' },
      { ...base, id: D(2), title: 'Saisir une fiche', status: 'published' },
      { ...base, id: D(3), title: 'Facturer un client', status: 'published' },
      { ...base, id: D(4), title: 'Fiches protégées', status: 'published' },
      { ...base, id: D(5), title: 'Brouillon', status: 'draft' },
    ];
    s.tables.demo_access = [{ demo_id: D(4), workspace_id: 'ws-1', mode: 'password' }];
  };
  const open = async (prepare = () => {}) => {
    const ctx = await themedContext(b, {
      viewport: { width: WIDTH, height: MOBILE ? 844 : 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    withDemos(state);
    prepare(state);
    await install(page, state);
    await page.goto(`${BASE}/#/settings/brand/page`);
    await page.getByRole('heading', { name: 'Démos affichées', level: 2 }).waitFor();
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
  const row = (state) => (state.tables.training_centers || []).find((c) => c.workspace_id === 'ws-1');
  const save = (page) => page.getByRole('button', { name: 'Enregistrer', exact: true });
  const sw = (page) => page.getByRole('switch', { name: 'Page publique' });

  // 1. Réglage complet, puis mise en ligne
  {
    const { page, state } = await open();
    ok(
      (await page.locator('.stg-sec h2').allTextContents()).join(' | ') ===
        'Page publique | En-tête | Démos affichées | Pied de page',
      'quatre sections : Page publique, En-tête, Démos affichées, Pied de page',
    );
    ok(
      !(await sw(page).isChecked()) && (await sw(page).isEnabled()) && (await save(page).isDisabled()),
      'page coupée par défaut, interrupteur disponible, rien à enregistrer',
    );
    // À 390 px, l'en-tête ne garde que «\u202fEnregistrer\u202f» (maquette page-publique-*-390)
    if (!MOBILE)
      ok(
        (await page.getByRole('button', { name: 'Voir la page' }).isDisabled()) === true,
        '«\u202fVoir la page\u202f» indisponible tant que la page n’est pas en ligne',
      );
    else
      ok(
        (await page.getByRole('button', { name: 'Voir la page' }).count()) === 0 &&
          (await page.getByRole('button', { name: 'Annuler', exact: true }).count()) === 0,
        '390 : l’en-tête ne garde que «\u202fEnregistrer\u202f»',
      );
    const slug = page.getByLabel('Adresse', { exact: true });
    ok((await slug.inputValue()) === 'acme', 'adresse proposée à partir du nom de l’espace');
    ok(
      (await page.locator('.pp-addr__pre').textContent()).endsWith('/#/c/'),
      'préfixe de l’adresse affiché devant le champ',
    );
    await slug.fill('Mon Adresse!');
    ok((await slug.inputValue()) === 'monadresse', 'adresse : minuscules, chiffres et tirets seulement');
    await slug.fill('a');
    ok(
      (await page.getByText('De 3 à 48 caractères', { exact: false }).isVisible()) &&
        (await page.getByRole('button', { name: 'Copier l’adresse' }).isDisabled()),
      'adresse trop courte : erreur dite, copie indisponible',
    );
    await slug.fill('acme');
    await page.getByRole('button', { name: 'Copier l’adresse' }).click();
    ok(
      /\/#\/c\/acme$/.test(await page.evaluate(() => navigator.clipboard.readText())),
      'copie de l’adresse entière',
    );

    await page.getByLabel('Titre', { exact: true }).fill('Les démos d’Acme');
    await page.getByLabel('Phrase d’accueil').fill('Découvrez nos outils pas à pas, à votre rythme.');
    ok(
      (await page.locator('.pp-count').textContent()).trim() === '47 / 160',
      'compteur de la phrase d’accueil',
    );
    ok(
      (await page.getByLabel('Phrase d’accueil').getAttribute('maxlength')) === '160',
      '160 caractères au plus',
    );
    ok(
      (await page.getByText('Logo de l’espace', { exact: true }).isVisible()) &&
        (await page.getByRole('button', { name: 'Choisir dans la médiathèque' }).count()) === 1,
      'logo : celui de l’espace par défaut, ou la médiathèque',
    );

    // Démos choisies et ordonnées
    ok(
      await page.getByRole('radio', { name: /^Toutes les démos publiées/ }).isChecked(),
      '«\u202fToutes les démos publiées\u202f» par défaut',
    );
    await page.getByRole('radio', { name: /^Démos choisies/ }).check();
    const items = page.locator('.pp-pick li');
    ok(
      (await items.locator('.pp-pick__name').allTextContents()).join(' | ') ===
        'Démo CRM | Saisir une fiche | Facturer un client',
      'liste : les démos publiées en accès ouvert seulement (ni protégée, ni brouillon)',
    );
    ok(
      await page.getByText('Choisissez au moins une démo.').isVisible(),
      'aucune démo choisie : dit sous la liste',
    );
    await page.getByRole('checkbox', { name: 'Afficher Facturer un client' }).check();
    await page.getByRole('checkbox', { name: 'Afficher Démo CRM' }).check();
    await page.getByRole('checkbox', { name: 'Afficher Saisir une fiche' }).check();
    ok(
      (await page
        .getByText('3 démos affichées, dans cet ordre. Glissez la poignée ou utilisez les flèches.')
        .count()) === 1,
      '«\u202f3 démos affichées, dans cet ordre…\u202f»',
    );
    await page.getByRole('button', { name: 'Monter Saisir une fiche' }).click();
    await page.getByRole('button', { name: 'Monter Saisir une fiche' }).click();
    await page.getByRole('checkbox', { name: 'Afficher Démo CRM' }).uncheck();
    ok(
      (await items.locator('.pp-pick__name').allTextContents()).join(' | ') ===
        'Saisir une fiche | Facturer un client | Démo CRM',
      'flèches : ordre changé ; une démo décochée passe sous les démos affichées',
    );
    ok(
      (await page.getByRole('button', { name: 'Monter Saisir une fiche' }).getAttribute('aria-disabled')) ===
        'true' && (await page.getByRole('button', { name: 'Monter Démo CRM' }).count()) === 0,
      'première démo : «\u202fMonter\u202f» désactivé ; pas de flèches sur une démo non affichée',
    );

    // Pied
    const contact = page.getByLabel('Lien de contact');
    await contact.fill('http://acme.example');
    ok(
      (await page
        .getByText('Saisissez une adresse e-mail ou une adresse qui commence par https://.')
        .isVisible()) && (await save(page).isDisabled()),
      'contact : ni e-mail ni https, erreur dite et enregistrement impossible',
    );
    await contact.fill('formation@acme.example');
    await page.getByRole('switch', { name: 'Afficher «\u202fCréé avec TutoClick\u202f»' }).uncheck();
    await sw(page).check();
    await shot(page, 'page-publique');
    ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      'pas de défilement horizontal',
    );
    await save(page).click();
    await page.getByText('Page publique enregistrée. Elle est en ligne.').waitFor();
    const c = row(state);
    ok(
      c.slug === 'acme' &&
        c.public_page_enabled === true &&
        c.public_page.title === 'Les démos d’Acme' &&
        c.public_page.tagline === 'Découvrez nos outils pas à pas, à votre rythme.' &&
        c.public_page.contact === 'formation@acme.example' &&
        c.public_page.madeWith === false &&
        c.public_page.logo === null &&
        JSON.stringify(c.public_page.demos) === JSON.stringify([D(2), D(3)]),
      '«\u202fEnregistrer\u202f» enregistre et met en ligne : réglages et démos choisies dans l’ordre',
    );
    if (!MOBILE) {
      const view = page
        .locator('header, .ph, .page-header')
        .getByRole('link', { name: /^Voir la page/ })
        .first();
      ok(
        /\/#\/c\/acme$/.test(await view.getAttribute('href')) &&
          (await view.getAttribute('target')) === '_blank',
        '«\u202fVoir la page\u202f» ouvre l’adresse dans un nouvel onglet',
      );
    }
    if (MOBILE) {
      const link = page.locator('a.pp-view-m');
      ok(
        (await link.isVisible()) && /\/#\/c\/acme$/.test(await link.getAttribute('href')),
        '390 : «\u202fVoir la page\u202f» sous le champ Adresse',
      );
      await page.getByLabel('Titre', { exact: true }).fill('Titre non enregistré');
      await page.locator('.fd-page-header__mback').click();
      const leave = page.getByRole('dialog', { name: 'Quitter sans enregistrer ?' });
      await leave.waitFor();
      await leave.getByRole('button', { name: 'Annuler' }).click();
      await leave.waitFor({ state: 'detached' });
      ok(
        /#\/settings\/brand\/page$/.test(page.url()),
        '390 : retour avec des modifications, «\u202fQuitter sans enregistrer ?\u202f» ; Annuler reste sur la page',
      );
      await page.getByLabel('Titre', { exact: true }).fill('Les démos d’Acme');
    } else {
      ok(
        !(await page.locator('a.pp-view-m').isVisible()),
        '1440 : «\u202fVoir la page\u202f» reste dans l’en-tête',
      );
    }
    // Coupée de nouveau
    await sw(page).uncheck();
    await save(page).click();
    await page.getByText('Page publique enregistrée. Elle n’est pas visible.').waitFor();
    ok(row(state).public_page_enabled === false, 'interrupteur coupé : page enregistrée, hors ligne');
    // Adresse déjà prise
    state.takenSlugs = ['prise'];
    await slug.fill('prise');
    await save(page).click();
    await page.getByText('Cette adresse est déjà prise. Choisissez-en une autre.').waitFor();
    ok(row(state).slug === 'acme', 'adresse déjà prise : dite sous le champ, rien n’est enregistré');
    if (!MOBILE) {
      await page.getByRole('button', { name: 'Annuler', exact: true }).click();
      ok((await slug.inputValue()) === 'acme', '«\u202fAnnuler\u202f» revient aux réglages enregistrés');
    }
    await page.context().close();
  }

  // 2. Activation refusée : liens publics coupés
  {
    const { page } = await open((s) => {
      s.tables.workspaces[0].public_links_enabled = false;
    });
    const why = page.locator('.pp-refusal');
    ok(
      (await why.textContent()).includes(
        'Impossible de l’activer : les liens publics sont coupés pour l’espace.',
      ) &&
        /#\/settings\/security$/.test(
          await why.getByRole('link', { name: 'Ouvrir Sécurité' }).getAttribute('href'),
        ) &&
        (await sw(page).isDisabled()) &&
        !(await sw(page).isChecked()),
      'liens publics coupés : interrupteur désactivé, motif et lien «\u202fOuvrir Sécurité\u202f»',
    );
    const tone = await why.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--fd-color-text)';
      el.appendChild(probe);
      const text = getComputedStyle(probe).color;
      probe.style.color = 'var(--fd-color-text-muted)';
      const muted = getComputedStyle(probe).color;
      probe.remove();
      return {
        text: getComputedStyle(el).color === text,
        icon: getComputedStyle(el.querySelector('svg')).color === muted,
      };
    });
    ok(
      tone.text && tone.icon,
      'motif de refus : couleur du texte, icône atténuée (ce n’est pas une erreur de saisie)',
    );
    await page.getByLabel('Titre', { exact: true }).fill('Titre');
    ok(await save(page).isEnabled(), 'les autres réglages restent modifiables et enregistrables');
    await shot(page, 'page-publique-refus');
    await page.context().close();
  }

  // 3. Activation refusée : aucune démo publiée en accès ouvert
  {
    const { page } = await open((s) => {
      s.tables.demos.forEach((d) => (d.status = 'draft'));
    });
    const why = page.locator('.pp-refusal');
    ok(
      (await why.textContent()).includes('aucune démo n’est publiée en accès ouvert') &&
        (await why.getByRole('link', { name: 'Voir les démos' }).count()) === 1 &&
        (await sw(page).isDisabled()),
      'aucune démo en accès ouvert : interrupteur désactivé, motif et lien «\u202fVoir les démos\u202f»',
    );
    await shot(page, 'page-publique-sansdemo');
    await page.context().close();
  }

  // 4. Centre de formation en ligne à la même adresse : confirmation, réglages du centre intacts
  {
    const centre = { title: 'Se former chez Acme', paths: [] };
    const { page, state } = await open((s) => {
      s.tables.training_centers = [
        {
          workspace_id: 'ws-1',
          slug: 'acme',
          draft: { ...centre },
          published: { ...centre },
          published_at: '2026-11-01T09:00:00Z',
          access_mode: 'link',
          public_page: {},
          public_page_enabled: false,
        },
      ];
    });
    const banner = page.locator('.pp-banner');
    ok(
      (await banner.getAttribute('role')) === 'status' &&
        (await banner.textContent()).includes(
          'Cette adresse affiche aujourd’hui votre centre de formation «\u202fSe former chez Acme\u202f».',
        ) &&
        (await banner.textContent()).includes(
          'Le centre de formation et ses parcours restent dans Parcours de formation.',
        ),
      'centre de formation en ligne : bandeau d’information',
    );
    await shot(page, 'page-publique-centre');
    await sw(page).check();
    await save(page).click();
    const dlg = page.getByRole('alertdialog', { name: 'Remplacer le centre de formation à cette adresse ?' });
    await dlg.waitFor();
    ok(
      (await dlg.textContent()).includes(
        'Vous pourrez remettre le centre de formation depuis Parcours de formation.',
      ) &&
        (await dlg
          .getByRole('button', { name: 'Remplacer et enregistrer' })
          .evaluate((el) => el.classList.contains('fd-btn--primary'))),
      'confirmation : texte de la maquette, bouton primaire (rien n’est supprimé)',
    );
    const h2 = await dlg.locator('h2').evaluate((el) => ({
      clipped: el.scrollWidth > el.clientWidth + 1,
      nowrap: getComputedStyle(el).whiteSpace === 'nowrap',
    }));
    ok(!h2.clipped && !h2.nowrap, 'titre de la fenêtre : entier, jamais tronqué (MODAL-01)');
    await shot(page, 'page-publique-remplacer');
    await dlg.getByRole('button', { name: 'Annuler' }).click();
    await dlg.waitFor({ state: 'detached' });
    ok(!(state.publicPageSaves || []).length, '«\u202fAnnuler\u202f» : rien n’est enregistré');
    await save(page).click();
    await dlg.getByRole('button', { name: 'Remplacer et enregistrer' }).click();
    await page.getByText('Page publique enregistrée. Elle est en ligne.').waitFor();
    const c = row(state);
    ok(
      c.public_page_enabled === true &&
        state.publicPageSaves.at(-1).replace === true &&
        c.published.title === 'Se former chez Acme' &&
        c.draft.title === 'Se former chez Acme',
      'remplacement confirmé : page en ligne, réglages du centre de formation intacts',
    );
    await page.locator('.pp-banner').waitFor({ state: 'detached' });

    // Parcours de formation : le bandeau dit que la page publique a pris l'adresse, et permet le retour
    await page.goto(`${BASE}/#/center`);
    const notice = page.locator('.pp-banner--act');
    await notice.waitFor();
    ok(
      (await notice.getAttribute('role')) === 'status' &&
        /Votre centre de formation n’est plus affiché à .+\/#\/c\/acme\. La page publique des démos l’a remplacé\./.test(
          await notice.textContent(),
        ),
      'Parcours de formation : bandeau «\u202fVotre centre de formation n’est plus affiché à…\u202f»',
    );
    await shot(page, 'page-publique-parcours');
    await notice.getByRole('button', { name: 'Remettre le centre de formation' }).click();
    const back = page.getByRole('alertdialog', { name: 'Remettre le centre de formation à cette adresse ?' });
    await back.waitFor();
    ok(
      (await back.textContent()).includes(
        'La page publique des démos sera désactivée. Ses réglages sont conservés.',
      ),
      'confirmation du retour : texte de la spec',
    );
    await back.getByRole('button', { name: 'Remettre le centre', exact: true }).click();
    await notice.waitFor({ state: 'detached' });
    const after = row(state);
    ok(
      after.public_page_enabled === false &&
        after.public_page.demos === 'all' &&
        after.published.title === 'Se former chez Acme',
      '«\u202fRemettre le centre\u202f» : page publique coupée, ses réglages et ceux du centre conservés',
    );
    await page.context().close();
  }

  // 5. Rôle editor : rubrique réservée
  {
    const ctx = await themedContext(b, { viewport: { width: WIDTH, height: 900 } });
    const page = await ctx.newPage();
    const state = seed();
    state.tables.members[0].role = 'editor';
    await install(page, state);
    await page.goto(`${BASE}/#/settings/brand/page`);
    await page
      .getByRole('heading', { name: 'La page publique est réservée aux propriétaires et administrateurs.' })
      .waitFor();
    ok((await page.getByRole('switch').count()) === 0, 'rôle editor : aucun réglage');
    await ctx.close();
  }

  // 6. Lecteur : page publique en ligne, puis coupée
  {
    // Le lecteur suit la langue du navigateur
    const ctx = await themedContext(b, { viewport: { width: WIDTH, height: 900 }, locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    let reply = {
      status: 'ok',
      title: 'Les démos d’Acme',
      workspace: 'Acme',
      center: {
        title: 'Les démos d’Acme',
        intro: '',
        brand: null,
        accent: null,
        style: 'workspace',
        logoPath: null,
        logoMedia: 'ws-1/logo-fictif.png',
        help: 'formation@acme.example',
        a11y: 'non_evalue',
        a11yUrl: '',
        privacyUrl: '',
        indexable: false,
        workspace: 'Acme',
        kind: 'demo',
        heroTitle: 'Les démos d’Acme',
        heroSubtitle: 'Découvrez nos outils pas à pas, à votre rythme.',
        cta: null,
        madeWith: false,
      },
      demos: [
        {
          demoId: D(2),
          title: 'Saisir une fiche',
          kind: 'guided',
          steps: 4,
          section: null,
          tags: [],
          cover: null,
        },
        {
          demoId: D(3),
          title: 'Facturer un client',
          kind: 'guided',
          steps: 6,
          section: null,
          tags: [],
          cover: null,
        },
      ],
      visitor: null,
      paths: [],
    };
    await p.route('**/functions/v1/open-center', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) }),
    );
    await p.route('**/storage/v1/object/public/media/**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      }),
    );
    await p.goto(`${PLAYER}/#/c/acme`);
    await p.getByRole('heading', { level: 1, name: 'Les démos d’Acme' }).waitFor();
    ok(
      (await p.getByText('Découvrez nos outils pas à pas, à votre rythme.').count()) === 1,
      'lecteur : titre et phrase d’accueil de la page publique',
    );
    const cards = await p
      .locator('a[href*="#/d/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href').split('/').pop()));
    ok(cards.join(',') === [D(2), D(3)].join(','), 'lecteur : démos dans l’ordre choisi');
    ok(
      /\/storage\/v1\/object\/public\/media\/ws-1\/logo-fictif\.png$/.test(
        await p.locator('.ctr-top img.ctr-logo--img').getAttribute('src'),
      ),
      'lecteur : logo choisi dans la médiathèque',
    );
    const foot = await p.locator('footer.ctr-foot').textContent();
    ok(!/TutoClick/.test(foot), 'lecteur : «\u202fCréé avec TutoClick\u202f» masqué');
    ok(
      (await p.locator('footer.ctr-foot a[href="mailto:formation@acme.example"]').count()) === 1,
      'lecteur : lien de contact par e-mail dans le pied',
    );
    if (SHOTS)
      await p.screenshot({ path: `${SHOTS}/page-publique-lecteur-${WIDTH}${sfx}.png`, fullPage: true });
    // Sans le champ madeWith (catalogue d'avant) : la mention reste
    reply = { ...reply, center: { ...reply.center, madeWith: undefined } };
    await p.reload();
    await p.locator('footer.ctr-foot').waitFor();
    ok(
      /TutoClick/.test(await p.locator('footer.ctr-foot').textContent()),
      'lecteur : sans réglage, la mention reste (rétrocompatible)',
    );
    // Page coupée ou adresse inconnue
    reply = { status: 'not_found' };
    await p.reload();
    await p.getByRole('heading', { level: 1, name: 'Cette page n’est pas disponible' }).waitFor();
    ok(true, 'lecteur : page coupée, «\u202fCette page n’est pas disponible\u202f»');
    await ctx.close();
  }

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
