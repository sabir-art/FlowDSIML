/**
 * L28-07 / L28-08 : Mon profil > Mes données. Export .zip téléchargé tout de suite (contenu vérifié),
 * suppression du compte bloquée pour le seul propriétaire d'un espace avec d'autres membres, puis
 * confirmation (adresse e-mail, mot de passe, case) avec l'espace solo annoncé, déconnexion et message.
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/mes-donnees.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const { unzipSync, strFromU8 } = require('fflate');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const CAMILLE = '00000000-0000-4000-8000-0000000000c1';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const t = state.tables;
  state.passwordSession = true;
  t.members.push({ workspace_id: 'ws-1', user_id: CAMILLE, role: 'editor', created_at: '2026-01-02' });
  await install(page, state);
  await page.goto(`${APP}/#/settings/profile`);
  const card = page.locator('.st-mydata');
  await card.waitFor();
  ok(
    /Un fichier \.zip avec vos données personnelles : profil, espaces et rôles, commentaires, notifications, préférences et confirmations de publication\./.test(
      sp(await card.innerText()),
    ),
    'texte : contenu exact de l’export',
  );
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    card.getByRole('button', { name: 'Télécharger mes données (.zip)' }).click(),
  ]);
  await card
    .getByRole('status')
    .getByText('Fichier téléchargé. Il n’est pas conservé sur nos serveurs.')
    .waitFor();
  ok(true, 'après le téléchargement : « Fichier téléchargé. Il n’est pas conservé sur nos serveurs. »');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await card.screenshot({ path: `${SHOTS}/l28-07-mes-donnees${sfx}.png` });
  }
  ok(
    /^mes-donnees-\d{4}-\d{2}-\d{2}\.zip$/.test(dl.suggestedFilename()),
    `nom du fichier (${dl.suggestedFilename()})`,
  );
  const files = unzipSync(fs.readFileSync(await dl.path()));
  const names = Object.keys(files).sort();
  ok(
    names.join() ===
      [
        'LISEZMOI.txt',
        'commentaires.json',
        'confirmations-de-publication.json',
        'espaces-et-roles.json',
        'notifications.json',
        'preferences.json',
        'profil.json',
      ].join(),
    'zip : un JSON par catégorie + LISEZMOI.txt',
  );
  ok(/profil\.json\s:/.test(strFromU8(files['LISEZMOI.txt'])), 'LISEZMOI décrit chaque fichier');
  ok(JSON.parse(strFromU8(files['profil.json'])).email === state.user.email, 'profil exporté');

  // Seule propriétaire d'un espace avec d'autres membres : bloquée
  await card.getByRole('button', { name: 'Supprimer mon compte' }).click();
  const blocked = page.getByRole('dialog', { name: 'Transférez d’abord vos espaces' });
  await blocked.waitFor();
  ok(
    /Acme/.test(await blocked.innerText()) &&
      (await blocked.getByRole('button', { name: 'Changer le propriétaire' }).count()) === 1,
    'blocage : espace listé avec « Changer le propriétaire »',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await blocked.screenshot({ path: `${SHOTS}/l28-08-bloque${sfx}.png` });
  }
  await blocked.getByRole('button', { name: 'Fermer' }).click();

  // Seule membre : l'espace est supprimé avec le compte
  t.members.splice(
    t.members.findIndex((m) => m.user_id === CAMILLE),
    1,
  );

  // Compte sans mot de passe, connexion de plus de 5 minutes : reconnexion d'abord
  state.hasPassword = false;
  state.recentAuth = false;
  await card.getByRole('button', { name: 'Supprimer mon compte' }).click();
  const dlgR = page.getByRole('dialog', { name: 'Supprimer votre compte ?' });
  await dlgR.waitFor();
  ok(
    /Pour votre sécurité, reconnectez-vous avant de supprimer votre compte\./.test(await dlgR.innerText()) &&
      (await dlgR.getByRole('button', { name: 'Me reconnecter' }).count()) === 1 &&
      (await dlgR.getByLabel('Mot de passe actuel').count()) === 0 &&
      (await dlgR.getByRole('textbox').count()) === 0 &&
      (await dlgR.getByRole('button', { name: 'Supprimer mon compte' }).isDisabled()),
    'connexion ancienne : « Me reconnecter », pas de mot de passe, suppression inactive',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await dlgR.screenshot({ path: `${SHOTS}/l28-08-reconnexion${sfx}.png` });
  }
  await dlgR.getByRole('button', { name: 'Annuler' }).click();
  state.hasPassword = true;
  state.recentAuth = true;
  await card.getByRole('button', { name: 'Supprimer mon compte' }).click();
  const dlg = page.getByRole('dialog', { name: 'Supprimer votre compte ?' });
  await dlg.waitFor();
  const text = sp(await dlg.innerText());
  ok(
    /Vos commentaires restent dans les démos, signés « Ancien membre »\./.test(text) &&
      /L’espace « Acme » et ses \d+ démos seront supprimés\./.test(text),
    'confirmation : commentaires gardés, espace solo annoncé',
  );
  const del = dlg.getByRole('button', { name: 'Supprimer mon compte' });
  ok(await del.isDisabled(), 'bouton inactif tant que rien n’est rempli');
  const mail = dlg.getByLabel('Saisissez votre adresse e-mail pour confirmer');
  ok(/Adresse du compte\s:\s/.test(await dlg.innerText()), 'adresse du compte en aide');
  await mail.fill('autre@acme.example');
  await dlg.getByLabel('Mot de passe actuel').fill('Correct-Horse-9');
  ok(await del.isDisabled(), 'case non cochée : toujours inactif');
  await dlg.getByRole('checkbox', { name: /Je comprends que cette action est définitive/ }).check();
  ok(!(await del.isDisabled()), 'tout rempli : actif');
  await del.click();
  await dlg.getByRole('alert').getByText('L’adresse ne correspond pas à votre compte.').waitFor();
  ok(!state.accountDeleted, 'adresse différente : « L’adresse ne correspond pas à votre compte. »');
  await mail.fill(state.user.email);
  ok((await dlg.getByRole('alert').count()) === 0, 'erreur effacée dès que l’adresse change');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await dlg.screenshot({ path: `${SHOTS}/l28-08-confirmation${sfx}.png` });
  }
  await del.click();
  await page.waitForURL(/#\/login/);
  await page.getByText('Votre compte a été supprimé.').waitFor();
  ok(
    state.accountDeleted?.email?.toLowerCase() === state.user.email,
    'compte supprimé, déconnexion, message sur la connexion',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
