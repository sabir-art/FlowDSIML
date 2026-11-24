/** Test e2e Paramètres › Membres (PRM-01, faux Supabase). */
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seedMaquette();
  await install(page, state);
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  await page.goto(`${APP}/#/settings/members`);
  await page.waitForSelector('.st-nav');
  // NAV-02 : cinq groupes ; « Bientôt » sans lien (Clés d'accès, Notifications) ou avec lien (Page publique,
  // réglages inactifs) ; NAV-03 : fil d'Ariane « Espace › Équipe », la page courante est le h1
  ok(
    (await page.locator('.st-nav__title').allTextContents()).join('|') ===
      'Espace|Marque|Contenu|Connexions|Mon compte',
    'Paramètres : cinq groupes',
  );
  const soon = await page.locator('.st-nav [aria-disabled="true"]').allTextContents();
  const links = await page.locator('.st-nav a.st-nav__item').count();
  const soonLinks = await page.locator('.st-nav a.st-nav__item:has(.st-nav__soon)').allTextContents();
  ok(
    // Notifications et Clés d'accès livrés le 24/11 : ce sont des liens ; « Bientôt » ne reste que sur ce qui n'est pas livré
    links >= 13 &&
      soon.length === 0 &&
      soonLinks.every((x) => x.startsWith('Page publique')) &&
      !(await page.locator('.st-nav').innerText()).includes('Domaine'),
    `Paramètres : sections, « Bientôt » limité à Page publique, pas de Domaine (${links} ; ${soon.join(', ')} ; ${soonLinks.join(', ')})`,
  );
  ok(
    (await page.getByRole('navigation', { name: 'Fil d’Ariane' }).innerText()).replace(/\s+/g, ' ').trim() ===
      'Espace Équipe' &&
      (await page.locator('.fd-crumb h1[aria-current="page"]').textContent()) === 'Équipe' &&
      (await page.getByRole('heading', { level: 1 }).count()) === 1,
    'fil d’Ariane « Espace › Équipe », h1 unique « Équipe »',
  );
  ok(
    (await page.locator('.st-nav a[aria-current="page"]').textContent()) === 'Équipe',
    'entrée « Équipe » active',
  );
  await page.waitForSelector('text=Thomas Bernard');
  ok((await page.locator('tbody tr').count()) >= 6, 'membres et invitation en attente');
  ok(
    (await page.locator('.stg-pill', { hasText: 'Invité' }).count()) === 1 &&
      (await page.locator('.stg-pill', { hasText: 'Actif' }).count()) >= 5,
    'statut en pastille : « Actif » pour les membres, « Invité » pour l’invitation',
  );
  // §11.8 : tableau sans carte, lignes de 56 px, colonnes Nom, E-mail, Rôle, Statut
  {
    const tb = await page.evaluate(() => ({
      cols: [...document.querySelectorAll('.stg-table thead th')].map((th) => th.textContent.trim()),
      rows: [...document.querySelectorAll('.stg-table tbody tr')].map(
        (r) => r.getBoundingClientRect().height,
      ),
      card: !!document.querySelector('.stg-table').closest('.card'),
    }));
    ok(
      tb.cols.slice(0, 4).join('|') === 'Nom|E-mail|Rôle|Statut' && tb.cols[4] === 'Actions' && !tb.card,
      `tableau sans carte, colonnes Nom, E-mail, Rôle, Statut (${tb.cols.join('|')})`,
    );
    ok(
      tb.rows.every((h) => h >= 56),
      `lignes de 56 px au moins (${Math.min(...tb.rows)})`,
    );
  }

  await page.fill('input[type=search]', 'nina');
  ok((await page.locator('table').first().locator('tbody tr').count()) === 1, 'recherche d’un membre');
  await page.fill('input[type=search]', '');
  // §11.8 : Ctrl + K (ou ⌘K) place le focus dans la recherche
  await page.locator('h2', { hasText: 'Membres' }).click();
  await page.keyboard.press('Control+k');
  ok(
    await page.locator('.stg-search input').evaluate((el) => el === document.activeElement),
    'Ctrl + K : focus dans la recherche',
  );
  // §11.8 : « Ce que chaque rôle peut faire » dans un popover d'information de 360 px
  {
    const info = page.locator('.stg-table').getByRole('button', { name: 'Ce que chaque rôle peut faire' });
    await info.click();
    const pop = page.locator('.stg-info-pop');
    await pop.waitFor();
    // Mesure après l'animation d'ouverture (MOTION-01 : mise à l'échelle de 200 ms)
    await pop.evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
    ok(
      (await info.getAttribute('aria-expanded')) === 'true' &&
        Math.round((await pop.boundingBox()).width) === 360 &&
        (await pop.locator('tbody tr').count()) >= 4,
      'popover des rôles : 360 px, tableau des droits, aria-expanded',
    );
    await page.keyboard.press('Escape');
    await pop.waitFor({ state: 'detached' });
    ok(
      (await info.getAttribute('aria-expanded')) === 'false' &&
        (await info.evaluate((el) => el === document.activeElement)),
      'popover des rôles : Échap ferme et rend le focus au bouton',
    );
    ok((await page.locator('.st-perms').count()) === 0, 'le tableau des droits a quitté la page');
  }
  // §11.8 : le rôle se change par le menu « ⋯ » (plus de liste dans la ligne)
  ok(
    (await page.locator('.stg-table select, .stg-table [role=combobox]').count()) === 0,
    'rôle en texte simple',
  );
  await page.getByRole('button', { name: 'Actions pour Nina Roux' }).click();
  ok(
    (await page.getByRole('menuitemradio').allInnerTexts()).join('|') === 'Admin|Éditeur|Lecteur' &&
      (await page.locator('[role="menuitemradio"][aria-checked="true"]').count()) === 1,
    'menu « ⋯ » : Admin, Éditeur, Lecteur en choix exclusifs, rôle courant coché',
  );
  // Nina est Lecteur : on la passe Admin (un vrai changement), le toast le confirme
  ok(
    (await page.getByRole('menuitemradio', { name: 'Lecteur' }).getAttribute('aria-checked')) === 'true',
    'menu « ⋯ » : le rôle courant est coché',
  );
  await page.getByRole('menuitemradio', { name: 'Admin' }).click();
  await page.getByText(/Rôle de Nina Roux\s?: Admin\./).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.stg-table tbody tr')].some(
      (r) => r.textContent.includes('Nina Roux') && r.children[2].textContent.trim() === 'Admin',
    ),
  );
  ok(
    state.tables.members.find((m) => m.user_id === 'u-5')?.role === 'admin',
    'menu « ⋯ » › Modifier le rôle : rôle enregistré',
  );

  await page.getByRole('button', { name: 'Inviter', exact: true }).click();
  const modal = page.locator('dialog.fd-modal[open]');
  await modal.waitFor();
  await modal.evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
  // MODAL-01 : en-tête séparé (tuile de 40 px, titre, Fermer), corps de 24 px, pied teinté à droite
  {
    const m = await modal.evaluate((d) => {
      const r = (s) => d.querySelector(s).getBoundingClientRect();
      const cs = (s) => getComputedStyle(d.querySelector(s));
      return {
        w: Math.round(d.getBoundingClientRect().width),
        tile: [r('.fd-modal__tile').width, r('.fd-modal__tile').height].join('x'),
        title: d.querySelector('.fd-modal__head h2').textContent,
        close: d.querySelector('.fd-modal__close').getAttribute('aria-label'),
        headBorder: cs('.fd-modal__head').borderBottomWidth,
        pad: cs('.fd-modal__body').padding,
        gap: cs('.st-invite__form').rowGap,
        foot: cs('.fd-modal__foot').backgroundColor,
        footAlign: cs('.fd-modal__foot').justifyContent,
        labelled: d.getAttribute('aria-labelledby') === d.querySelector('.fd-modal__head h2').id,
        focus: document.activeElement.id,
      };
    });
    ok(
      m.w === 400 &&
        m.tile === '40x40' &&
        m.title === 'Inviter des membres' &&
        m.close === 'Fermer' &&
        m.headBorder === '1px' &&
        m.pad === '24px' &&
        m.gap === '24px' &&
        m.foot === 'rgb(247, 247, 248)' &&
        m.footAlign === 'flex-end' &&
        m.labelled,
      `MODAL-01 : 400 px, tuile de 40 px, corps et gap de 24 px, pied teinté à droite (${JSON.stringify(m)})`,
    );
    ok(m.focus === 'inv-email', `MODAL-01 : focus sur le premier champ à l’ouverture (${m.focus})`);
  }
  // Rôle : Select maison avec une description par rôle, Propriétaire non proposé
  {
    const role = page.locator('#inv-role');
    await role.focus();
    await page.keyboard.press('Enter');
    const opts = modal.locator('[role=option]');
    await opts.first().waitFor();
    ok(
      (await role.getAttribute('aria-expanded')) === 'true' &&
        (await opts.locator('.fd-opt__label').allTextContents()).join('|') === 'Lecteur|Éditeur|Admin' &&
        (await opts.locator('.fd-opt__desc').count()) === 3,
      'Rôle : Lecteur, Éditeur, Admin avec leur description ; liste rendue dans la modale',
    );
    // Clavier : Flèche bas puis Entrée choisit Admin ; Échap ferme sans changer
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    ok(
      (await role.innerText()).trim() === 'Admin' && (await role.getAttribute('aria-expanded')) === 'false',
      'Select au clavier : Entrée ouvre, Flèche bas et Entrée choisissent, la liste se referme',
    );
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    ok(
      (await role.innerText()).trim() === 'Admin' &&
        (await role.evaluate((el) => el === document.activeElement)) &&
        (await modal.count()) === 1,
      'Select au clavier : Échap ferme sans changer, le focus revient au déclencheur, la modale reste ouverte',
    );
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
  }
  // Retour client 21/11 : plus de case à cocher, adresses en puces dans un vrai champ e-mail
  ok((await modal.locator('input[type=checkbox]').count()) === 0, 'aucune case à cocher');
  const addr = page.locator('#inv-email');
  ok(
    (await addr.evaluate((el) => [el.type, el.name, el.autocomplete, el.inputMode, el.tagName].join('|'))) ===
      'email|email|email|email|INPUT',
    'champ <input type=email name=email autocomplete=email inputmode=email>',
  );
  ok(
    (await page.getByLabel('Adresses e-mail').evaluate((el) => el.id)) === 'inv-email',
    'libellé « Adresses e-mail » relié au champ',
  );
  await addr.fill('pas-un-email');
  await modal.getByRole('button', { name: /^Envoyer/ }).click();
  ok(
    (await page.locator('#inv-email-error').count()) === 1 &&
      (await page.locator('#inv-email-error svg.lucide-circle-alert').count()) === 1,
    'adresse invalide signalée sous le champ, avec l’icône CircleAlert',
  );
  ok(
    (await addr.getAttribute('aria-invalid')) === 'true' &&
      /inv-email-error/.test(await addr.getAttribute('aria-describedby')),
    'champ invalide relié à son message',
  );
  ok(
    (await addr.inputValue()) === 'pas-un-email' &&
      (await addr.evaluate((el) => el === document.activeElement)),
    'saisie invalide gardée dans le champ, qui reprend le focus',
  );
  await addr.fill('');
  // Entrée, puis virgule : chaque adresse devient une puce
  await addr.pressSequentially('sarah@acme.example');
  await addr.press('Enter');
  await addr.pressSequentially('leo@acme.example,');
  ok(
    (await page.locator('.email-chip__text').allTextContents()).join('|') ===
      'sarah@acme.example|leo@acme.example' && (await addr.inputValue()) === '',
    'Entrée et virgule : deux puces, champ vidé',
  );
  // Collage de plusieurs adresses : autant de puces (doublon ignoré)
  await addr.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text', 'nora@acme.example; sarah@acme.example');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  ok((await page.locator('.email-chip').count()) === 3, 'collage : une puce par nouvelle adresse');
  await addr.press('Backspace');
  ok(
    (await page.locator('.email-chip').count()) === 2,
    'Retour arrière sur le champ vide : dernière puce retirée',
  );
  // Retour UX : sans vocabulaire d'abonnement ; « n membres en plus sur {limite} » s'il y a une limite
  {
    const seats = page.locator('.st-seats');
    const limited = (await seats.count()) === 1;
    ok(
      limited
        ? /^2 membres en plus sur\s\d+\.$/.test(await seats.textContent())
        : !/siège/.test(await modal.innerText()),
      `membres ajoutés annoncés sans « sièges » (${limited ? await seats.textContent() : 'sans limite'})`,
    );
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/PRM-04-invitation.png` });
  ok(
    (await modal.locator('.fd-modal__foot button').allTextContents()).join('|') ===
      'Annuler|Envoyer 2 invitations',
    'pied : Annuler, puis « Envoyer 2 invitations »',
  );
  await modal.getByRole('button', { name: 'Envoyer 2 invitations' }).click();
  await page.getByText('2 invitations envoyées.').first().waitFor();
  ok(
    (await modal.locator('.fd-modal__head h2').textContent()) === 'Invitations envoyées' &&
      (await modal.locator('.fd-modal__tile svg.lucide-mail-check').count()) === 1 &&
      (await modal.locator('.fd-modal__foot button').allTextContents()).join('|') === 'Terminé',
    'confirmation dans la même modale : tuile MailCheck, « Invitations envoyées », pied « Terminé »',
  );
  ok(state.tables.invitations.length === 3, 'deux invitations créées');
  ok(
    (await page.locator('.inv-results__status.is-sent').allTextContents()).join('|') ===
      'Invitation envoyée|Invitation envoyée' &&
      (await page.getByRole('button', { name: /^Copier le lien de / }).count()) === 2,
    'confirmation : « Invitation envoyée » et « Copier le lien » pour chaque adresse',
  );
  // Retours client du 24/11 §4 (maquette retours-2411/invitations) : CopyField sous chaque adresse
  {
    const row = modal.locator('.inv-results > li').first();
    const field = row.locator('.fd-copy__input');
    const email = (await row.locator('.inv-results__email').innerText()).trim();
    const btn = row.getByRole('button', { name: `Copier le lien de ${email}`, exact: true });
    const g = await row.evaluate((li) => {
      const input = li.querySelector('.fd-copy__input');
      const b = li.querySelector('.fd-copy__btn');
      const cs = getComputedStyle(input);
      const probe = document.createElement('span');
      probe.style.color = 'var(--fd-color-surface-sunken)';
      document.body.append(probe);
      const sunken = getComputedStyle(probe).color;
      probe.remove();
      const ri = input.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return {
        h: ri.height,
        readOnly: input.readOnly,
        sunken: cs.backgroundColor === sunken,
        font: cs.fontFamily === getComputedStyle(li).fontFamily,
        btn: `${rb.width}x${rb.height}`,
        inside: rb.left >= ri.left && rb.right <= ri.right && rb.top >= ri.top && rb.bottom <= ri.bottom,
        right: Math.round(ri.right - rb.right),
        label: li.querySelector(`label[for="${input.id}"]`)?.textContent,
        status: li.querySelector('.inv-results__status svg')?.getAttribute('class') || '',
      };
    });
    ok(
      g.h === 40 && g.readOnly && g.sunken && g.font && g.btn === '32x32' && g.inside && g.right === 4,
      `CopyField : champ de 40 px en lecture seule sur surface-sunken, bouton de 32 px dans le champ, à droite (${JSON.stringify(g)})`,
    );
    ok(
      g.label === `Lien d’invitation pour ${email}` &&
        /circle-check/.test(g.status) &&
        (await btn.count()) === 1,
      'CopyField : libellé masqué « Lien d’invitation pour … », bouton « Copier le lien de … », état en CircleCheck',
    );
    ok(/#\/invite\//.test(await field.inputValue()), 'CopyField : le champ porte le lien d’invitation');
    await field.click();
    ok(
      await field.evaluate((el) => el.selectionStart === 0 && el.selectionEnd === el.value.length),
      'CopyField : le clic dans le champ sélectionne tout le lien',
    );
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await btn.click();
    const status = row.getByRole('status');
    await status.filter({ hasText: 'Lien copié' }).waitFor();
    ok(
      (await page.evaluate(() => navigator.clipboard.readText())) === (await field.inputValue()) &&
        (await btn.locator('svg.lucide-check').count()) === 1 &&
        (await row.locator('.fd-copy__ok').evaluate((el) => getComputedStyle(el).fontSize)) === '12px',
      'CopyField : lien copié, l’icône devient Check, « Lien copié » annoncé (12 px sous le champ)',
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/invitations-copyfield.png` });
    // La coche revient à Copy d'elle-même (2 s) : on attend l'état, sans délai fixe
    await btn.locator('svg.lucide-copy').waitFor({ timeout: 6000 });
    // Vide, la région d'annonce n'est plus affichée : on la lit par sa classe
    ok(
      (await row.locator('.fd-copy__ok').textContent()).trim() === '',
      'CopyField : après 2 s, retour à l’icône Copy, annonce effacée',
    );
  }
  await modal.locator('.fd-modal__foot').getByRole('button', { name: 'Terminé' }).click();
  await modal.waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'Actions pour Nina Roux' }).click();
  ok(
    await page.getByRole('menuitem', { name: /Transférer la propriété/ }).isDisabled(),
    'transfert : Bientôt',
  );
  await page.getByRole('menuitem', { name: 'Retirer de l’espace' }).click();
  await page.waitForSelector('dialog[open] .fd-modal__head');
  ok(
    /^Retirer Nina Roux \?$/.test((await page.textContent('dialog[open] h2')).replace(/\u202f/g, ' ')) &&
      /Nina perdra l’accès/.test(await page.textContent('dialog[open] .dialog-body')),
    'PRM-05 : titre et texte de la maquette, en-tête / corps / pied',
  );
  await page.locator('dialog[open]').getByRole('button', { name: 'Retirer le membre' }).click();
  await page.waitForTimeout(400);
  ok(!state.tables.members.some((m) => m.user_id === 'u-5'), 'membre retiré');

  // L48-A : la page publique a sa propre entrée (Marque > Page publique), toujours « Bientôt »
  await page.getByRole('link', { name: /^Page publique/ }).click();
  const pp = page.getByRole('region', { name: 'En-tête de la page publique' });
  await pp.waitFor();
  ok(
    (await pp.locator('input:disabled').count()) >= 4 && /Bientôt/.test(await pp.innerText()),
    'PRM-07 : page publique toujours « Bientôt »',
  );

  // PRM-08 (variables) : couvert par variables.e2e (L46)

  await page.locator('.st-nav').getByRole('link', { name: 'Profil' }).click();
  await page.waitForSelector('#fn');
  ok(
    (await page.locator('.st-pf .stg-sec__head h2').allTextContents()).join('|') ===
      'Photo et informations|Préférences',
    'Profil : sections « Photo et informations » et « Préférences »',
  );

  await page.getByRole('link', { name: 'Général' }).click();
  await page.waitForSelector('#ws-name');
  await page.getByRole('button', { name: 'Supprimer l’espace' }).click();
  await page.waitForSelector('dialog[open] .dialog-require');
  ok(
    (await page.locator('dialog[open] .dialog-require b').count()) === 1 &&
      (await page
        .locator('dialog[open]')
        .getByRole('button', { name: 'Supprimer définitivement' })
        .isDisabled()),
    'PRM-06 : saisie du nom en gras, « Supprimer définitivement » bloqué',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/PRM-06.png` });
  await page.keyboard.press('Escape');
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
