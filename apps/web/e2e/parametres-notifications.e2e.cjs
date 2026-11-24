/**
 * Paramètres › Notifications (retours client §6.3, maquette lot1-parametres/notifs) : un tableau par
 * événement, « Dans l'app » et « Par e-mail », puis les démos coupées. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] [WIDTH=390] node e2e/parametres-notifications.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const WIDTH = Number(process.env.WIDTH || 1440);
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (prepare) => {
    const page = await (
      await themedContext(b, { viewport: { width: WIDTH, height: WIDTH < 768 ? 844 : 900 } })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    prepare(state);
    await install(page, state);
    await page.goto(`${BASE}/#/settings/notifications`);
    await page.getByRole('heading', { name: 'Notifications', level: 2 }).waitFor();
    await page.locator('section[aria-labelledby="nt-title"]:not([aria-busy])').waitFor();
    return { page, state };
  };
  const sw = (page, name) => page.getByRole('switch', { name, exact: true });
  const row = (state) => (state.tables.notification_settings || []).find((x) => x.user_id === state.user.id);
  const shot = async (page, name) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${WIDTH}${sfx}.png`, fullPage: true });
  };

  // 1. Service d'e-mail configuré : tout se règle, chaque choix est enregistré tout de suite
  {
    const { page, state } = await open((s) => {
      s.brevoKey = 'cle-factice';
      s.tables.notification_mutes = [{ demo_id: DEMO, workspace_id: 'ws-1', user_id: s.user.id }];
    });
    const title = state.tables.demos.find((d) => d.id === DEMO).title;
    ok((await page.locator('.nt-table tbody tr').count()) === 6, 'six événements dans le tableau');
    ok(
      (await page.locator('.nt-table thead th').allTextContents()).join('|') ===
        'Événement|Dans l’app|Par e-mail',
      'colonnes « Événement », « Dans l’app », « Par e-mail »',
    );
    ok(
      (await sw(page, 'Mentions, dans l’app').isChecked()) &&
        (await sw(page, 'Mentions, dans l’app').isDisabled()),
      'les mentions restent notifiées dans l’app',
    );
    ok(await sw(page, 'Réponses, dans l’app').isChecked(), 'dans l’app : activé par défaut');
    ok(!(await sw(page, 'Mentions, par e-mail').isChecked()), 'par e-mail : rien n’est activé par défaut');
    ok(
      (await sw(page, 'Nouveaux leads, dans l’app').isDisabled()) &&
        (await sw(page, 'Nouveaux leads, par e-mail').isDisabled()),
      'nouveaux leads : à venir, non réglable',
    );
    await shot(page, 'notifs');

    await sw(page, 'Mentions, par e-mail').check();
    await page.waitForFunction(() => document.querySelector('[aria-label="Mentions, par e-mail"]').checked);
    const until = async (fn) => {
      for (let i = 0; i < 100 && !fn(); i++) await page.evaluate(() => new Promise(requestAnimationFrame));
      return fn();
    };
    ok(
      await until(() => row(state)?.email === true && row(state)?.email_prefs?.mention === true),
      'e-mail des mentions : accord enregistré',
    );
    ok(
      row(state).email_prefs.reply === false && row(state).email_prefs.alert === false,
      'les autres événements restent sans e-mail, écrits explicitement',
    );
    ok(!(await sw(page, 'Réponses, par e-mail').isChecked()), 'un seul interrupteur e-mail activé');

    await sw(page, 'Réponses, par e-mail').check();
    ok(await until(() => row(state).email_prefs.reply === true), 'e-mail des réponses activé');
    await sw(page, 'Réponses, dans l’app').uncheck();
    ok(await until(() => row(state).prefs?.reply === false), 'réponses coupées dans l’app : enregistré');
    ok(
      (await sw(page, 'Réponses, par e-mail').isDisabled()) &&
        !(await sw(page, 'Réponses, par e-mail').isChecked()),
      'coupé dans l’app : l’e-mail est désactivé et décoché',
    );
    await sw(page, 'Mentions, par e-mail').uncheck();
    ok(await until(() => row(state).email === false), 'dernier e-mail décoché : l’accord global est retiré');

    // Démos coupées
    const li = page.locator('.nt-muted li');
    ok((await li.count()) === 1 && (await li.textContent()).includes(title), 'démo coupée listée');
    await page.getByRole('button', { name: `Réactiver les notifications de ${title}` }).click();
    await page.getByText('Aucune démo coupée.').waitFor();
    ok((state.tables.notification_mutes || []).length === 0, '« Réactiver » retire la coupure');
    await page.context().close();
  }

  // 2. Sans service d'e-mail : colonne visible, désactivée, « Bientôt » dans l'en-tête
  {
    const { page } = await open(() => {});
    await page.locator('.nt-table thead .nt-soon').waitFor();
    ok(
      (await page.locator('.nt-table thead th').nth(2).textContent()).includes('Bientôt'),
      'sans service d’e-mail : « Bientôt » dans l’en-tête',
    );
    const all = page.locator('.nt-table tbody td:nth-child(3) input');
    const n = await all.count();
    let disabled = 0;
    for (let i = 0; i < n; i++) if (await all.nth(i).isDisabled()) disabled++;
    ok(n === 6 && disabled === 6, 'sans service d’e-mail : toute la colonne est désactivée');
    ok(await sw(page, 'Réponses, dans l’app').isEnabled(), 'la colonne « Dans l’app » reste réglable');
    ok(
      (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) === true,
      'pas de défilement horizontal',
    );
    await shot(page, 'notifs-sans-email');
    // Entrée de navigation active, plus de réglage factice dans le profil
    await page.goto(`${BASE}/#/settings/profile`);
    await page.locator('#pf-pw-open').waitFor();
    ok((await page.getByText('Résumé hebdomadaire').count()) === 0, 'profil : plus d’interrupteur factice');
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
