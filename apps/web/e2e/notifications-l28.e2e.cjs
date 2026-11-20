/**
 * L28-06 : notifications. Commentaire supprimé (« Ce commentaire a été supprimé. »), menu ⋯ « Couper les
 * notifications de cette démo », liste des démos coupées avec « Réactiver ». Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/notifications-l28.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const MARIE = '0b5c1f0e-0000-4000-8000-0000000000b1';
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch({
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const page = await (
    await themedContext(b, {
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    })
  ).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const me = state.user.id;
  state.tables.members.push({ workspace_id: 'ws-1', user_id: MARIE, role: 'editor', created_at: ago(9000) });
  state.memberDirectory = { [MARIE]: { full_name: 'Marie Durand', email: 'marie@acme.example' } };
  state.tables.step_comments = [];
  state.tables.notification_mutes = [];
  state.tables.notifications = [
    {
      id: 'n1',
      workspace_id: 'ws-1',
      user_id: me,
      kind: 'comment',
      demo_id: DEMO,
      step_id: 's1',
      comment_id: null,
      actor_id: MARIE,
      created_at: ago(30),
      read_at: null,
    },
  ];
  await install(page, state);
  await page.goto(`${BASE}/#/`);
  await page.locator('.nb-bell').click();
  const dlg = page.getByRole('dialog', { name: 'Notifications' });
  await dlg.waitFor();
  const row = dlg.locator('.nb-list li').first();
  await row.waitFor();
  ok(
    /Ce commentaire a été supprimé\./.test(sp(await row.innerText())),
    'commentaire supprimé : notification lisible',
  );
  ok(
    !/comment=/.test((await row.locator('a.nb-cover').getAttribute('href')) || ''),
    'lien vers l’étape, sans fil supprimé',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await dlg.screenshot({ path: `${SHOTS}/l28-06-notif-supprime${sfx}.png` });
  }

  // Menu ⋯ : couper la démo
  await row.getByRole('button', { name: /Actions pour la notification/ }).click();
  await page.getByRole('menuitem', { name: 'Couper les notifications de cette démo' }).click();
  await page.getByText(/Notifications coupées pour « .+ »\. Les mentions restent signalées\./).waitFor();
  ok(
    state.tables.notification_mutes.length === 1 && state.tables.notification_mutes[0].demo_id === DEMO,
    'démo coupée enregistrée',
  );
  ok(
    (await row.getByRole('button', { name: /Actions pour la notification/ }).count()) === 0,
    'menu retiré une fois coupée',
  );

  // Préférences : liste des démos coupées, Réactiver
  await dlg.getByRole('button', { name: 'Préférences' }).click();
  const prefs = page.getByRole('dialog', { name: 'Préférences de notification' });
  await prefs.waitFor();
  const muted = prefs.locator('.nb-muted li');
  await muted.first().waitFor();
  ok((await muted.count()) === 1, 'préférences : démo coupée listée');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await prefs.screenshot({ path: `${SHOTS}/l28-06-preferences${sfx}.png` });
  }
  await muted
    .first()
    .getByRole('button', { name: /Réactiver/ })
    .click();
  await prefs.getByText('Aucune démo coupée.').waitFor();
  ok(state.tables.notification_mutes.length === 0, 'Réactiver : démo de nouveau suivie');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
