/**
 * E-mails P1 (spec emails-notifications-invitations, recette 1 à 4 et 8) : invitations d'équipe par
 * e-mail. Aucun envoi réel : faux transport du faux Supabase (state.inviteEmails), adresses .example.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

function admin(extra = {}) {
  const state = seed();
  state.tables.workspaces[0].name = 'Acme';
  state.tables.workspaces[0].plan_code = 'enterprise';
  state.tables.profiles[0].full_name = 'Olga Exemple';
  return Object.assign(state, extra);
}

async function invite(page, emails) {
  await page.goto(`${APP}/#/settings/members`);
  await page.getByRole('button', { name: 'Inviter des membres' }).click();
  await page.waitForSelector('[role=dialog]');
  await page.fill('#inv-email', emails);
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (state) => {
    const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, state);
    return page;
  };

  // Recette 1 : deux adresses, case cochée par défaut, deux e-mails, toast
  {
    const state = admin();
    const page = await open(state);
    await invite(page, 'marie@acme.example, paul@acme.example');
    const box = page.getByLabel('Envoyer l’invitation par e-mail');
    ok(await box.isChecked(), 'case « Envoyer l’invitation par e-mail » cochée par défaut');
    ok(
      (await page.getByRole('button', { name: 'Envoyer les invitations' }).count()) === 1,
      'bouton « Envoyer les invitations »',
    );
    await box.uncheck();
    ok(
      (await page.getByRole('button', { name: 'Créer les invitations' }).count()) === 1 &&
        (await page.getByText('Envoyez ce lien à la personne invitée.').count()) === 1,
      'case décochée : « Créer les invitations » et l’aide du lien',
    );
    await box.check();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/EML-01-modale.png` });
    await page.getByRole('button', { name: 'Envoyer les invitations' }).click();
    await page.getByText('2 invitations envoyées.').waitFor();
    ok((await page.locator('[role=dialog].modal').count()) === 0, 'modale fermée après l’envoi');
    ok(state.tables.invitations.length === 2, 'deux invitations créées');
    const sent = state.inviteEmails || [];
    ok(
      sent.map((e) => e.email).join(',') === 'marie@acme.example,paul@acme.example',
      'faux transport : deux e-mails',
    );
    ok(
      sent.every(
        (e) =>
          JSON.stringify(e.data) ===
            '{"workspace_name":"Acme","inviter_name":"Olga Exemple","demo_title":""}' &&
          /\?next=%2Finvite%2F[0-9a-f-]{36}$/.test(e.redirectTo),
      ),
      'e-mail : nom de l’espace, nom de l’invitant et lien d’acceptation seulement',
    );
    // « Copier le lien » reste dans la liste des invitations en attente
    await page.getByRole('button', { name: 'Actions pour marie@acme.example' }).click();
    ok(
      (await page.getByRole('menuitem', { name: 'Copier le lien' }).count()) === 1 &&
        (await page.getByRole('menuitem', { name: 'Renvoyer l’invitation' }).isDisabled()),
      'en attente : « Copier le lien » ; déjà envoyée : pas de second envoi',
    );
    await page.close();
  }

  // Recette 2 : 21e invitation dans l'heure, case désactivée avec la raison, invitation créée avec son lien
  {
    const state = admin();
    const at = new Date(Date.now() - 30 * 60_000).toISOString();
    for (let i = 0; i < 20; i++)
      state.tables.invitations.push({
        id: `inv-${i}`,
        workspace_id: 'ws-1',
        email: `lot${i}@acme.example`,
        role: 'viewer',
        token: `tok-${i}`,
        invited_by: state.user.id,
        accepted_at: null,
        sent_at: at,
        created_at: at,
        expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
      });
    const page = await open(state);
    await invite(page, 'sarah@acme.example');
    const box = page.getByLabel('Envoyer l’invitation par e-mail');
    await page.getByText(/20 invitations par heure au plus/).waitFor();
    const reason = await page.locator('#inv-limit').innerText();
    ok((await box.isDisabled()) && !(await box.isChecked()), 'plafond atteint : case désactivée et décochée');
    ok(
      /^20 invitations par heure au plus\. Vous pourrez en envoyer d’autres à \d{2}:\d{2}\. Les liens restent disponibles\.$/.test(
        reason,
      ),
      `raison écrite sous la case (${reason})`,
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/EML-02-plafond.png` });
    await page.getByRole('button', { name: 'Créer les invitations' }).click();
    await page.getByRole('button', { name: 'Copier le lien' }).waitFor();
    ok(
      state.tables.invitations.length === 21 && !(state.inviteEmails || []).length,
      'invitation créée avec son lien, aucun e-mail',
    );
    await page.close();
  }

  // Recettes 3 et 8 : faux transport en échec, puis budget du jour atteint : repli sur le lien
  for (const [label, extra] of [
    ['envoi en échec', { inviteTransport: 'fail' }],
    ['budget de 150 atteint', { emailBudget: 150 }],
  ]) {
    const state = admin(extra);
    const page = await open(state);
    await invite(page, 'marie@acme.example');
    await page.getByRole('button', { name: 'Envoyer les invitations' }).click();
    await page.getByText('L’e-mail n’a pas pu partir. Copiez le lien et envoyez-le vous-même.').waitFor();
    ok(
      state.tables.invitations.length === 1 &&
        (await page.getByRole('button', { name: 'Copier le lien' }).count()) === 1 &&
        (await page.getByText('Envoyez ce lien à la personne invitée.').count()) === 1 &&
        !(state.inviteEmails || []).length,
      `${label} : invitation créée, message de repli et lien à copier`,
    );
    if (SHOTS && extra.inviteTransport) await page.screenshot({ path: `${SHOTS}/EML-03-repli.png` });
    await page.close();
  }

  // Recette 8 : ligne Utilisation « 150 sur 150 », sans jauge
  {
    const state = admin({ emailBudget: 150 });
    const page = await open(state);
    await page.goto(`${APP}/#/settings/usage`);
    const line = page.locator('.us-emails');
    await line.waitFor();
    ok(
      (await line.innerText()) === 'E-mails envoyés aujourd’hui : 150 sur 150' &&
        (await line.evaluate((el) => getComputedStyle(el).fontSize)) === '14px' &&
        (await line.locator('[role=meter]').count()) === 0,
      'Utilisation : « 150 sur 150 », 14 px, sans jauge',
    );
    await page.close();
  }

  // Recette 4 : compte existant, aucun e-mail ; la personne invitée accepte depuis ses notifications
  {
    const state = admin({ existingAccounts: ['paul@acme.example'] });
    const page = await open(state);
    await invite(page, 'paul@acme.example, marie@acme.example');
    const reply = page.waitForResponse((r) => r.url().includes('/functions/v1/invite-email'));
    await page.getByRole('button', { name: 'Envoyer les invitations' }).click();
    const body = await (await reply).json();
    await page.getByText('2 invitations envoyées.').waitFor();
    ok(
      (state.inviteEmails || []).map((e) => e.email).join(',') === 'marie@acme.example',
      'compte existant : aucun e-mail d’invitation (seule la nouvelle adresse en reçoit un)',
    );
    // Confidentialité : même réponse, même message et même budget, l'admin ne sait pas qui a un compte
    ok(
      body.results.every((r) => r.status === 'sent') && state.emailBudget === 2,
      'compte existant et nouvelle adresse : réponse « sent » identique, budget compté pareil',
    );
    await page.close();
  }
  {
    const state = seed();
    state.tables.workspaces.push({ ...state.tables.workspaces[0], id: 'ws-acme', name: 'Acme' });
    state.tables.notifications = [
      {
        id: 'n-inv',
        workspace_id: 'ws-acme',
        user_id: state.user.id,
        kind: 'invite',
        demo_id: null,
        step_id: null,
        comment_id: null,
        alert_id: null,
        actor_id: 'u-olga',
        data: { invitation: 'inv-paul', workspace: 'Acme', actor: 'Olga Exemple' },
        created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
        read_at: null,
      },
    ];
    const page = await open(state);
    await page.goto(`${APP}/#/`);
    await page.getByRole('button', { name: /^Notifications, 1 non lue/ }).click();
    const row = page.locator('.nb-list li', { hasText: 'vous invite à rejoindre' });
    await row.waitFor();
    ok(
      (await row.locator('.nb-text').innerText()).startsWith('Olga Exemple vous invite à rejoindre « Acme »'),
      'notification « Olga Exemple vous invite à rejoindre « Acme » »',
    );
    ok(
      (await row.getByRole('button', { name: 'Accepter' }).count()) === 1 &&
        (await row.getByRole('button', { name: 'Refuser' }).count()) === 1,
      'Accepter et Refuser',
    );
    // Retour UX : « Accepter » d'abord (petit bouton principal), puis « Refuser » en lien discret
    ok(
      (await row.locator('.nb-actions button').allTextContents()).join('|') === 'Accepter|Refuser' &&
        (await row.getByRole('button', { name: 'Accepter' }).getAttribute('class')).includes(
          'fd-btn--primary',
        ) &&
        (await row.getByRole('button', { name: 'Refuser' }).getAttribute('class')).includes('link-button'),
      'Accepter en premier (bouton principal), Refuser en lien',
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/EML-04-notification.png` });
    await row.getByRole('button', { name: 'Accepter' }).click();
    await page.waitForFunction(() => location.hash === '#/');
    await page.waitForTimeout(300);
    ok(
      JSON.stringify(state.invitationAnswers) === '[{"id":"inv-paul","accept":true}]' &&
        state.tables.members.some((m) => m.workspace_id === 'ws-acme' && m.user_id === state.user.id),
      'Accepter : espace rejoint',
    );
    await page.close();
  }

  // Bouton de l'e-mail expiré (1 h) : la personne se connecte avec l'adresse invitée, son compte n'a pas
  // d'espace, la prise en main montre l'invitation en attente
  {
    const state = seed();
    state.tables.members = [];
    state.tables.workspaces.push({ ...state.tables.workspaces[0], id: 'ws-acme', name: 'Acme' });
    state.tables.profiles.push({ id: 'u-olga', full_name: 'Olga Exemple' });
    state.tables.invitations.push({
      id: 'inv-alice',
      workspace_id: 'ws-acme',
      email: state.user.email,
      role: 'editor',
      token: 'tok-alice',
      invited_by: 'u-olga',
      accepted_at: null,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
    });
    const page = await open(state);
    await page.goto(`${APP}/#/`);
    const box = page.getByRole('region', { name: 'Invitations en attente' });
    await box.waitFor();
    ok(
      (await box.innerText()).replace(/\s+/g, ' ').includes('Olga Exemple vous invite à rejoindre « Acme »'),
      'prise en main : invitation en attente retrouvée après connexion',
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/EML-06-prise-en-main.png` });
    await box.getByRole('button', { name: 'Accepter' }).click();
    await page.waitForFunction(() => !location.hash.includes('onboarding'));
    ok(
      state.tables.members.some((m) => m.workspace_id === 'ws-acme' && m.user_id === state.user.id),
      'prise en main : Accepter rejoint l’espace',
    );
    await page.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
