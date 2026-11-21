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
  await page.waitForSelector('.snav');
  // L48-A §4 : cinq groupes, « Bientôt » à sa place (sans lien), fil d'Ariane, h1 = nom de la section
  ok(
    (await page.locator('.snav .grp').allTextContents()).join('|') ===
      'Espace|Marque|Contenu|Connexions|Mon compte',
    'Paramètres : cinq groupes',
  );
  const soon = await page.locator('.snav .snav-item--soon').allTextContents();
  const links = await page.locator('.snav a.snav-item').count();
  ok(
    // L52 : « Étiquettes » est une section active ; restent « Bientôt » : Domaine, Clés d'accès, Notifications
    links === 13 && soon.length === 3,
    `Paramètres : 13 sections et 3 « Bientôt » (${links} ; ${soon.join(', ')})`,
  );
  ok(
    (await page.getByRole('navigation', { name: 'Fil d’Ariane' }).innerText()).replace(/\s+/g, ' ').trim() ===
      'Paramètres Espace Équipe' &&
      (await page.locator('.st-crumb [aria-current="page"]').textContent()) === 'Équipe' &&
      (await page.getByRole('heading', { level: 1 }).textContent()) === 'Équipe',
    'fil d’Ariane « Paramètres > Espace > Équipe » et titre « Équipe »',
  );
  ok((await page.locator('.snav a.is-active').textContent()) === 'Équipe', 'entrée « Équipe » active');
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
  // E-mails P1 : case décochée, l'invitation reste un lien à transmettre (couvert par invitations-email.e2e)
  await page.getByLabel('Envoyer l’invitation par e-mail').uncheck();
  await page.fill('#inv-email', 'pas-un-email');
  await page.getByRole('button', { name: 'Créer les invitations' }).click();
  ok((await page.locator('#inv-email-error').count()) === 1, 'adresse invalide signalée');
  await page.fill('#inv-email', 'sarah@acme.example, leo@acme.example');
  ok((await page.locator('.st-seats').textContent()).includes('2 sièges'), 'sièges utilisés annoncés');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/PRM-04-invitation.png` });
  await page.getByRole('button', { name: 'Créer les invitations' }).click();
  await page.waitForSelector('text=Copier le lien');
  ok(state.tables.invitations.length === 3, 'deux invitations créées');
  await page.getByRole('button', { name: 'Fermer' }).last().click();

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
  await page.getByRole('link', { name: 'Page publique' }).click();
  const pp = page.getByRole('region', { name: /Page publique/ });
  await pp.waitFor();
  ok(
    (await pp.locator('input:disabled').count()) >= 4 && /Bientôt/.test(await pp.innerText()),
    'PRM-07 : page publique toujours « Bientôt »',
  );

  // PRM-08 (variables) : couvert par variables.e2e (L46)

  await page.locator('.snav').getByRole('link', { name: 'Profil' }).click();
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
