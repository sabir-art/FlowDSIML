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
  ok(/Téléchargement immédiat\./.test(await card.innerText()), 'téléchargement immédiat (rien de conservé)');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await card.screenshot({ path: `${SHOTS}/l28-07-mes-donnees${sfx}.png` });
  }
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    card.getByRole('button', { name: 'Préparer l’export' }).click(),
  ]);
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
  ok(/profil\.json :/.test(strFromU8(files['LISEZMOI.txt'])), 'LISEZMOI décrit chaque fichier');
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
  await dlg.getByLabel('Votre adresse e-mail').fill(state.user.email);
  await dlg.getByLabel('Mot de passe actuel').fill('Correct-Horse-9');
  ok(await del.isDisabled(), 'case non cochée : toujours inactif');
  await dlg.getByRole('checkbox', { name: /Je comprends que cette action est définitive/ }).check();
  ok(!(await del.isDisabled()), 'tout rempli : actif');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await dlg.screenshot({ path: `${SHOTS}/l28-08-confirmation${sfx}.png` });
  }
  await del.click();
  await page.waitForURL(/#\/login/);
  await page.getByText('Votre compte a été supprimé.').waitFor();
  ok(
    state.accountDeleted?.email === state.user.email,
    'compte supprimé, déconnexion, message sur la connexion',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
