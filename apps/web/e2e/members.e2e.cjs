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
  ok((await page.getByRole('menuitem', { name: /Transférer la propriété/ }).isDisabled()), 'transfert : Bientôt');
  await page.getByRole('menuitem', { name: 'Retirer du workspace' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Retirer le membre' }).click();
  await page.waitForTimeout(400);
  ok(!state.tables.members.some((m) => m.user_id === 'u-5'), 'membre retiré');

  await page.getByRole('link', { name: 'Marque' }).click();
  await page.waitForSelector('.st-soon');
  ok(true, 'onglet Marque : Bientôt');
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
