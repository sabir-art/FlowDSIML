/**
 * L61 : connexion avec un compte dont l'adresse n'est pas encore confirmée. La page ne dit plus « mot de
 * passe incorrect » : elle explique, mentionne les courriers indésirables et propose de renvoyer l'e-mail
 * de confirmation (resend de type signup). Inscription : le message d'envoi mentionne aussi les courriers
 * indésirables. Faux Supabase, aucun envoi réel, données fictives (.example).
 * Usage : APP_URL=… node e2e/connexion-non-confirmee.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (width, patch) => {
    const page = await b.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    const state = seed();
    Object.assign(state, { signedOut: true }, patch);
    await install(page, state);
    return { page, state };
  };
  const login = async (page) => {
    await page.goto(`${APP}/#/login`);
    await page.getByLabel('E-mail professionnel').fill('camille@acme.example');
    await page.locator('#password').fill('MotDePasse-Fictif-42');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  };

  for (const width of [1440, 390]) {
    const { page, state } = await open(width, { unconfirmed: true });
    await login(page);
    const box = page.locator('.auth-unconfirmed');
    await box.waitFor();
    const text = (await box.innerText()).replace(/\s+/g, ' ');
    ok(
      (await box.getAttribute('role')) === 'alert' &&
        text.includes('Confirmez d’abord votre adresse e-mail.') &&
        text.includes('camille@acme.example') &&
        text.includes('courriers indésirables'),
      `${width} px : adresse non confirmée, message clair avec l’adresse et les courriers indésirables`,
    );
    ok(
      (await page.getByText('Adresse e-mail ou mot de passe incorrect.').count()) === 0 &&
        (await page.locator('#login-error').count()) === 0 &&
        (await page.locator('#password').getAttribute('aria-invalid')) !== 'true',
      `${width} px : aucun « mot de passe incorrect », le champ n’est pas marqué en erreur`,
    );
    const again = box.getByRole('button', { name: 'Renvoyer l’e-mail de confirmation' });
    await again.click();
    await box.getByText('E-mail renvoyé.', { exact: false }).waitFor();
    ok(
      (state.resends || []).length === 1 &&
        state.resends[0].type === 'signup' &&
        state.resends[0].email === 'camille@acme.example' &&
        (await box.locator('[role="status"]').innerText()).includes('E-mail renvoyé'),
      `${width} px : « Renvoyer l’e-mail de confirmation » demande un renvoi de type signup, confirmé et annoncé`,
    );
    ok(
      (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
      `${width} px : pas de défilement horizontal`,
    );
    // Plafond d'envoi du fournisseur : dit en clair, sans compter un renvoi
    state.resendLimited = true;
    await again.click();
    await box.locator('.error-msg').waitFor();
    ok(
      state.resends.length === 1 && !/security purposes/i.test(await box.innerText()),
      `${width} px : renvoi refusé (plafond), message traduit (${(await box.locator('.error-msg').innerText()).trim()})`,
    );
    await page.close();
  }

  // Mauvais mot de passe : le message d'identifiants reste celui d'avant
  {
    const { page } = await open(1440, {});
    await login(page);
    await page.getByText('Adresse e-mail ou mot de passe incorrect.').waitFor();
    ok(
      (await page.locator('.auth-unconfirmed').count()) === 0,
      'identifiants refusés : message habituel, sans renvoi d’e-mail',
    );
    await page.close();
  }

  // Inscription : l'écran « Vérifiez votre boîte mail » mentionne les courriers indésirables
  {
    const { page } = await open(1440, {});
    await page.goto(`${APP}/#/signup`);
    await page.getByLabel('Nom complet').fill('Camille Durand');
    await page.getByLabel('E-mail professionnel').fill('camille@acme.example');
    await page.locator('#password').fill('MotDePasse-Fictif-42');
    const consent = page.getByRole('checkbox');
    if (await consent.count()) await consent.first().check();
    await page.getByRole('button', { name: /^Créer/ }).click();
    const sent = page.locator('.auth-sent');
    await sent.waitFor();
    ok(
      /camille@acme\.example/.test(await sent.innerText()) &&
        /courriers indésirables/.test(await sent.innerText()),
      'inscription : « Vérifiez votre boîte mail », avec la mention des courriers indésirables',
    );
    await page.close();
  }

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
