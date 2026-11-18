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
  ok((await page.locator('.snav .snav-item').count()) === 6, 'navigation interne : 6 sections');
  await page.waitForSelector('text=Thomas Bernard');
  ok((await page.locator('tbody tr').count()) >= 6, 'membres et invitation en attente');
  ok((await page.locator('text=En attente').count()) === 1, 'badge « En attente »');

  await page.fill('input[type=search]', 'nina');
  ok((await page.locator('table').first().locator('tbody tr').count()) === 1, 'recherche d’un membre');
  await page.fill('input[type=search]', '');
  await page.getByLabel('Filtrer par rôle').selectOption('editor');
  ok((await page.locator('table').first().locator('tbody tr').count()) === 3, 'filtre par rôle');
  await page.getByLabel('Filtrer par rôle').selectOption('');

  await page.getByRole('button', { name: 'Inviter des membres' }).click();
  await page.waitForSelector('[role=dialog]');
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
  await page.getByRole('menuitem', { name: 'Retirer du workspace' }).click();
  await page.waitForSelector('dialog[open] .dialog-head');
  ok(
    /^Retirer Nina Roux \?$/.test((await page.textContent('dialog[open] h2')).replace(/\u202f/g, ' ')) &&
      /Nina perdra l’accès/.test(await page.textContent('dialog[open] .dialog-body')),
    'PRM-05 : titre et texte de la maquette, en-tête / corps / pied',
  );
  await page.locator('dialog[open]').getByRole('button', { name: 'Retirer le membre' }).click();
  await page.waitForTimeout(400);
  ok(!state.tables.members.some((m) => m.user_id === 'u-5'), 'membre retiré');

  await page.getByRole('link', { name: 'Marque' }).click();
  await page.waitForSelector('.st-brand-note');
  ok(
    (await page.locator('.st-brand input:disabled').count()) >= 4,
    'PRM-07 : onglet Marque désactivé (Bientôt)',
  );

  await page.getByRole('link', { name: 'Variables' }).click();
  await page.getByRole('button', { name: 'Nouvelle variable' }).click();
  await page.fill('#var-key', 'first_name');
  await page.getByRole('button', { name: 'Créer la variable' }).click();
  ok(/existe déjà/.test(await page.textContent('.modal')), 'PRM-08 : nom de variable déjà pris refusé');
  await page.fill('#var-key', 'job_title');
  await page.fill('#var-def', 'votre poste');
  await page.getByRole('button', { name: 'Créer la variable' }).click();
  await page.waitForSelector('.st-vars td >> text={{job_title}}');
  await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  ok(
    state.tables.variables.some((v) => v.key === 'job_title' && v.default_value === 'votre poste'),
    'PRM-08 : variable créée dans le workspace',
  );

  await page.getByRole('link', { name: 'Mon profil' }).click();
  await page.waitForSelector('#fn');
  ok(
    (await page.locator('.st-pf .form-sec .intro h2').allTextContents()).join('|') === 'Profil|Préférences',
    'PRM-09 : sections Profil et Préférences',
  );

  await page.getByRole('link', { name: 'Général' }).click();
  await page.waitForSelector('#ws-name');
  await page.getByRole('button', { name: 'Supprimer le workspace' }).click();
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
