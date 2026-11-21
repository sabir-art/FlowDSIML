/**
 * E-mails P2 (spec emails-notifications-invitations, recettes 7 et 9, côté app) : option « Recevoir aussi
 * par e-mail », « Bientôt » sans BREVO_API_KEY, désinscription sans connexion, lien « Ouvrir les
 * notifications ». Aucun envoi réel (faux Supabase) ; le regroupement et l'envoi sont testés en base
 * (email_digest.test.sql) et dans la fonction (notify-email/lib_test.ts, faux serveur Brevo).
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const TOK = 'a'.repeat(48);

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};

async function prefsOf(page) {
  await page.goto(`${APP}/#/`);
  await page
    .getByRole('button', { name: /^Notifications/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Préférences' }).click();
  const prefs = page.getByRole('dialog', { name: 'Préférences de notification' });
  await prefs.waitFor();
  return prefs;
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

  // Recette 9 : sans la clé, l'option reste « Bientôt », désactivée
  {
    const page = await open(seed());
    const prefs = await prefsOf(page);
    const sw = prefs.getByRole('switch', { name: /Recevoir aussi par e-mail/ });
    ok(
      (await sw.isDisabled()) && /Bientôt/.test(await prefs.innerText()),
      'sans BREVO_API_KEY : « Bientôt », désactivée',
    );
    // Règle X4 : « Bientôt » en texte gris, sans point d'état (aussi pour « Résumé quotidien »)
    ok((await prefs.locator('.fd-status').count()) === 0, '« Bientôt » sans point d’état');
    await page.close();
  }

  // Avec la clé : interrupteur actif, désactivé par défaut, aide, choix enregistré
  {
    const state = seed();
    state.brevoKey = true;
    const page = await open(state);
    const prefs = await prefsOf(page);
    const sw = prefs.getByRole('switch', { name: /Recevoir aussi par e-mail/ });
    await prefs.getByText('Un e-mail au plus par heure').waitFor();
    ok(
      !(await sw.isDisabled()) && !(await sw.isChecked()),
      'avec la clé : option active, désactivée par défaut',
    );
    ok(
      (await prefs.innerText()).includes(
        'Un e-mail au plus par heure, qui regroupe vos notifications non lues. Lien de désinscription dans chaque e-mail.',
      ),
      'aide sous l’option',
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/EML-05-option.png` });
    await sw.check();
    await page.waitForTimeout(300);
    ok(
      (state.tables.notification_settings || []).find((x) => x.user_id === state.user.id)?.email === true,
      'option enregistrée (table propre à l’utilisateur)',
    );
    await page.close();
  }

  // « Ouvrir les notifications » du résumé : #/?notifications=1 ouvre le panneau
  {
    const page = await open(seed());
    await page.goto(`${APP}/#/?notifications=1`);
    await page.getByRole('dialog', { name: 'Notifications' }).waitFor();
    ok(!page.url().includes('notifications=1'), 'lien du résumé : panneau ouvert, adresse nettoyée');
    await page.close();
  }

  // Recette 7 : désinscription sans connexion
  {
    const state = seed();
    state.session = null;
    state.unsubTokens = { [TOK]: state.user.id };
    state.tables.notification_settings = [{ user_id: state.user.id, prefs: {}, email: true }];
    const page = await open(state);
    await page.goto(`${APP}/#/unsubscribe/${TOK}`);
    await page.getByText('Vous ne recevrez plus de notifications par e-mail.').waitFor();
    ok(
      (await page.locator('main, body').first().innerText()).includes(
        'Vous ne recevrez plus de notifications par e-mail. Pour les réactiver, ouvrez TutoClick, cliquez sur la cloche des notifications, puis sur « Préférences ».',
      ) && state.tables.notification_settings[0].email === false,
      'désinscription : option désactivée, confirmation affichée',
    );
    // Retour UX : 8 px sous le titre, 24 px entre le texte et le bouton
    const gaps = await page.evaluate(() => {
      const h = document.querySelector('.auth-form h1').getBoundingClientRect();
      const p = document.querySelector('.unsub-msg p').getBoundingClientRect();
      const btn = document.querySelector('.auth-form a.fd-btn').getBoundingClientRect();
      return [Math.round(p.top - h.bottom), Math.round(btn.top - p.bottom)];
    });
    ok(gaps[0] === 8 && gaps[1] === 24, `espacements titre-texte et texte-bouton (${gaps.join(', ')} px)`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/EML-07-desinscription.png` });
    await page.goto(`${APP}/#/unsubscribe/${'b'.repeat(48)}`);
    await page.getByText('Ce lien n’est plus valable.', { exact: false }).waitFor();
    ok(true, 'jeton inconnu : message d’erreur');
    await page.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
