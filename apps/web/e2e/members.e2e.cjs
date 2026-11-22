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
    links === 13 && soon.length === 2 && soonLinks.length === 1 && soonLinks[0].startsWith('Page publique'),
    `Paramètres : 13 sections dont Page publique en « Bientôt », 2 « Bientôt » sans lien, pas de Domaine (${links} ; ${soon.join(', ')} ; ${soonLinks.join(', ')})`,
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
  ok((await page.locator('text=En attente').count()) === 1, 'badge « En attente »');

  await page.fill('input[type=search]', 'nina');
  ok((await page.locator('table').first().locator('tbody tr').count()) === 1, 'recherche d’un membre');
  await page.fill('input[type=search]', '');
  // L40 : filtre de rôle en menu
  await page.getByRole('button', { name: /^Rôle/ }).click();
  await page.getByRole('menuitem', { name: 'Éditeur' }).click();
  ok((await page.locator('table').first().locator('tbody tr').count()) === 3, 'filtre par rôle');
  await page.getByRole('button', { name: /^Rôle/ }).click();
  await page.getByRole('menuitem', { name: 'Tous les rôles' }).click();

  await page.getByRole('button', { name: 'Inviter des membres' }).click();
  await page.waitForSelector('[role=dialog]');
  // Retour client 21/11 : plus de case à cocher, adresses en puces dans un vrai champ e-mail
  ok((await page.locator('[role=dialog] input[type=checkbox]').count()) === 0, 'aucune case à cocher');
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
  await page.getByRole('button', { name: 'Envoyer les invitations' }).click();
  ok((await page.locator('#inv-email-error').count()) === 1, 'adresse invalide signalée');
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
        ? /^2 membres en plus sur \d+\.$/.test(await seats.textContent())
        : !/siège/.test(await page.locator('[role=dialog]').innerText()),
      `membres ajoutés annoncés sans « sièges » (${limited ? await seats.textContent() : 'sans limite'})`,
    );
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/PRM-04-invitation.png` });
  await page.getByRole('button', { name: 'Envoyer les invitations' }).click();
  await page.getByText('2 invitations envoyées.').first().waitFor();
  ok(state.tables.invitations.length === 3, 'deux invitations créées');
  ok(
    (await page.locator('.inv-results__status.is-sent').allTextContents()).join('|') ===
      'Invitation envoyée|Invitation envoyée' &&
      (await page.getByRole('button', { name: /^Copier le lien de / }).count()) === 2,
    'confirmation : « Invitation envoyée » et « Copier le lien » pour chaque adresse',
  );
  await page.locator('[role=dialog] .modal-foot').getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: 'Actions pour Nina Roux' }).click();
  ok(
    await page.getByRole('menuitem', { name: /Transférer la propriété/ }).isDisabled(),
    'transfert : Bientôt',
  );
  await page.getByRole('menuitem', { name: 'Retirer de l’espace' }).click();
  await page.waitForSelector('dialog[open] .dialog-head');
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
  const pp = page.getByRole('region', { name: /Page publique/ });
  await pp.waitFor();
  ok(
    (await pp.locator('input:disabled').count()) >= 4 && /Bientôt/.test(await pp.innerText()),
    'PRM-07 : page publique toujours « Bientôt »',
  );

  // PRM-08 (variables) : couvert par variables.e2e (L46)

  await page.locator('.st-nav').getByRole('link', { name: 'Profil' }).click();
  await page.waitForSelector('#fn');
  ok(
    (await page.locator('.st-pf .form-sec .intro h2').allTextContents()).join('|') === 'Profil|Préférences',
    'PRM-09 : sections Profil et Préférences',
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
