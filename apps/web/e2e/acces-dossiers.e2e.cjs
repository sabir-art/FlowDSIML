/**
 * L27-09 : accès par dossier (menu ⋯ du dossier > « Accès »), cadenas du dossier restreint, confirmation
 * avant de déplacer une démo, plan inférieur à Enterprise. Le filtrage serveur est testé en pgTAP
 * (acces_dossiers.test.sql). Données fictives (« Acme », .example).
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/acces-dossiers.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const { pick } = require('./_select.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const CAMILLE = '00000000-0000-4000-8000-0000000000c1';
const JULES = '00000000-0000-4000-8000-0000000000c2';
const FOLDER = '00000000-0000-4000-8000-0000000000f1';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch();
  // L48-A : sous 1 024 px, le filtre « Dossier » reste dans la barre (la colonne est testée par l48a-dossiers)
  const ctx = await themedContext(b, { viewport: { width: 1000, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const t = state.tables;
  t.profiles[0].full_name = 'Alice Exemple';
  t.members.push(
    { workspace_id: 'ws-1', user_id: CAMILLE, role: 'editor', created_at: '2026-01-02' },
    { workspace_id: 'ws-1', user_id: JULES, role: 'viewer', created_at: '2026-01-03' },
  );
  state.memberDirectory = {
    [CAMILLE]: { full_name: 'Camille Fictive', email: 'camille@acme.example' },
    [JULES]: { full_name: 'Jules Exemple', email: 'jules@acme.example' },
  };
  t.folders.push({
    id: FOLDER,
    workspace_id: 'ws-1',
    name: 'RH',
    parent_id: null,
    restricted: false,
    created_at: '2026-01-01',
  });
  await install(page, state);
  const shot = async (name) => {
    if (!SHOTS) return;
    for (const x of await page.locator('.toast-close').all()) await x.click().catch(() => {});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };
  // Lot 2 : sous 1 024 px, les dossiers sont dans un tiroir ouvert depuis la barre mobile
  const drawer = page.getByRole('dialog', { name: 'Dossiers' });
  const openFolder = async (name) => {
    await page.getByRole('button', { name: 'Dossiers', exact: true }).click();
    await drawer.getByRole('link', { name }).click();
    await drawer.waitFor({ state: 'detached' });
  };

  // ===== Administrateur (fonction ouverte à toutes les offres depuis L48-A) =====
  await page.goto(`${APP}/#/`);
  await openFolder(/^RH/);
  await page.getByRole('button', { name: 'Accès au dossier' }).click();
  const dlg = page.getByRole('dialog', { name: 'Accès au dossier « RH »' });
  await dlg.waitFor();
  ok(await dlg.getByRole('radio', { name: 'Tout l’espace' }).isChecked(), 'par défaut : tout l’espace');
  await dlg.getByRole('radio', { name: 'Membres choisis' }).check();
  const alice = dlg.getByRole('checkbox', { name: /Alice/ });
  ok(
    (await alice.isChecked()) && (await alice.getAttribute('aria-disabled')) === 'true',
    'propriétaire : toujours coché et désactivé',
  );
  ok(
    /Accès toujours ouvert aux administrateurs\./.test(await dlg.innerText()),
    'explication pour les administrateurs',
  );
  await dlg.getByRole('searchbox', { name: 'Rechercher un membre' }).fill('cam');
  ok((await dlg.getByRole('listitem').count()) === 1, 'recherche dans les membres');
  await dlg.getByRole('checkbox', { name: /Camille Fictive/ }).check();
  await dlg.getByRole('searchbox', { name: 'Rechercher un membre' }).fill('');
  ok(
    /Les liens déjà partagés restent valables\. Pour les couper, changez l’accès de chaque démo dans Partager\./.test(
      await dlg.innerText(),
    ),
    'les liens partagés restent valables (annoncé)',
  );
  ok((await dlg.locator('fieldset legend').count()) >= 2, 'groupes en fieldset / legend');
  await shot('l27-09-acces-dossier');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await dlg.waitFor({ state: 'detached' });
  await page.getByText('Accès au dossier enregistré.').waitFor();
  const call = state.folderAccessCalls.at(-1);
  ok(
    call.p_restricted === true && call.p_users.join() === CAMILLE,
    'enregistré : dossier restreint à Camille',
  );

  // Cadenas et infobulle
  await page.getByRole('button', { name: 'Dossiers', exact: true }).click();
  const lock = drawer.getByRole('img', { name: 'Dossier restreint' });
  await lock.waitFor();
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'detached' });
  ok(
    sp(await page.locator('.demos-list-count').innerText()) === 'Visible par 2 membres.',
    'cadenas dans le tiroir, « Visible par 2 membres. » sous le titre du dossier',
  );

  // Déplacer une démo dans le dossier restreint : confirmation
  await openFolder(/^Toutes les démos/);
  const card = page.locator('.demo-card').first();
  await card
    .getByRole('button', { name: /Actions|Plus/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: /Déplacer/ }).click();
  await pick(page.getByRole('combobox', { name: /Déplacer/ }), FOLDER);
  const confirm = page.getByRole('dialog').filter({ hasText: 'ne sera plus visible' });
  await confirm.waitFor();
  ok(
    /Cette démo ne sera plus visible pour 1 membre\./.test(sp(await confirm.innerText())),
    'confirmation avant déplacement',
  );
  await confirm.getByRole('button', { name: 'Déplacer' }).click();
  await page.waitForTimeout(400);
  ok(
    t.demos.some((d) => d.folder_id === FOLDER),
    'démo déplacée après confirmation',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
