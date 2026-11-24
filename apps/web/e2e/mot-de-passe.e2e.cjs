/**
 * EXT-02 §7 : mot de passe sur Nouveau mot de passe, Inscription et Profil. Œil afficher / masquer intégré
 * au champ, jauge de force, règles de la politique cochées en direct, erreur sous le champ qui dit quoi
 * faire (règle manquante avant l'envoi, refus du serveur ensuite), confirmation. Faux Supabase.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const sp = (s) => s.replace(/\s/g, ' ').trim();
const axe = async (page, label) => {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  ok(bad.length === 0, `axe : ${label} (${bad.map((v) => v.id).join(', ')})`);
};
// Mots de passe fictifs des tests
const SANS_CHIFFRE = 'Acmedemo';
const VALIDE = 'Acmedemo2026!';

(async () => {
  const b = await chromium.launch();

  // ===== Nouveau mot de passe =====
  for (const theme of ['light', 'dark']) {
    const tag = `Nouveau mot de passe (${theme === 'light' ? 'clair' : 'sombre'})`;
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem('fd.theme', t), theme);
    const page = await ctx.newPage();
    const state = seed();
    await install(page, state);
    await page.goto(`${APP}/#/reset-password`);
    const pw = page.locator('#password');
    const cf = page.locator('#confirm');
    await pw.waitFor();
    const eyes = page.getByRole('button', { name: 'Afficher le mot de passe' });
    // EXT-02 §7.1 : l'œil n'apparaît qu'une fois que la personne a tapé dans le champ
    ok((await eyes.count()) === 0, `${tag} : champs vides, aucun œil avant la frappe`);
    ok((await page.locator('#password-rules').count()) === 0, `${tag} : règles masquées avant le focus`);
    ok(
      (await page.locator('.fd-pw-meter').count()) === 0,
      `${tag} : pas de jauge tant que le champ est vide`,
    );

    // Règles visibles dès le focus
    await pw.focus();
    const rules = page.locator('#password-rules li');
    ok(
      (await rules.allInnerTexts()).map(sp).join(' | ') ===
        [
          'Au moins 8 caractères',
          'Au moins une minuscule',
          'Au moins une majuscule',
          'Au moins un chiffre',
          'Au moins un caractère spécial (par ex. ! ? # @)',
        ]
          .map((r) => `${r} : non respectée`)
          .join(' | '),
      `${tag} : les cinq règles de la politique dès le focus, état lisible sans la couleur`,
    );
    ok(
      (await pw.getAttribute('aria-describedby')) === 'password-rules',
      `${tag} : le champ est décrit par la liste`,
    );

    // Saisie : règles cochées en direct, jauge, annonce
    await pw.pressSequentially(SANS_CHIFFRE);
    ok(
      (await page.locator('#password-rules li.is-ok').count()) === 3 &&
        (await page.locator('#password-rules li.is-ok svg.lucide-circle-check').count()) === 3 &&
        (await page.locator('#password-rules li.is-todo svg.lucide-circle').count()) === 2,
      `${tag} : trois règles cochées (icône CircleCheck), deux en attente (Circle)`,
    );
    ok(
      sp(await page.locator('.fd-pw-meter__label').innerText()) === 'Force du mot de passe : Faible' &&
        (await page.locator('.fd-pw-meter__bar .is-on').count()) === 1,
      `${tag} : une règle manque, la jauge reste à « Faible » (1 segment)`,
    );
    await page.getByRole('status').filter({ hasText: 'règles sur 5 respectées' }).waitFor();
    ok(true, `${tag} : « 3 règles sur 5 respectées » annoncé après la frappe`);

    // Œil : apparu avec la frappe ; affiche, garde le focus et le curseur ; indépendant de l'autre champ
    ok(
      (await eyes.count()) === 1 &&
        (await eyes.first().getAttribute('aria-label')) === 'Afficher le mot de passe',
      `${tag} : l’œil apparaît à la frappe, nom fixe « Afficher le mot de passe »`,
    );
    await pw.evaluate((e) => e.setSelectionRange(3, 3));
    await eyes.first().click();
    // La bascule du type peut déplacer le curseur après le rendu : contrôle une image plus tard
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    ok(
      (await pw.getAttribute('type')) === 'text' &&
        (await eyes.first().getAttribute('aria-pressed')) === 'true' &&
        (await page.evaluate(() => document.activeElement?.id)) === 'password' &&
        (await pw.evaluate((e) => e.selectionStart)) === 3,
      `${tag} : l’œil affiche le mot de passe, focus et curseur gardés`,
    );
    // Une sélection est gardée aussi, et le retour au masquage ne déplace rien
    await pw.evaluate((e) => e.setSelectionRange(2, 5));
    await eyes.first().click();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    ok(
      (await pw.getAttribute('type')) === 'password' &&
        (await pw.evaluate((e) => `${e.selectionStart}-${e.selectionEnd}`)) === '2-5',
      `${tag} : sélection gardée quand on remasque`,
    );
    await eyes.first().click();
    ok(
      (await cf.getAttribute('type')) === 'password' && (await eyes.count()) === 1,
      `${tag} : la confirmation, encore vide, reste masquée et sans œil`,
    );
    const eye = await eyes.first().evaluate((e) => {
      const r = e.getBoundingClientRect();
      const g = e.parentElement.getBoundingClientRect();
      const i = e.querySelector('svg').getBoundingClientRect();
      return { w: r.width, h: r.height, icon: i.width, inside: r.right <= g.right && r.left >= g.left };
    });
    ok(
      eye.w === 32 && eye.h === 32 && eye.icon === 16 && eye.inside,
      `${tag} : bouton de 32 px, icône de 16 px, dans le champ`,
    );

    // Confirmation : sa règle apparaît à la frappe
    ok(
      (await page.locator('#confirm-rule').count()) === 0,
      `${tag} : règle de confirmation masquée au départ`,
    );
    await cf.pressSequentially('Acme');
    ok(
      (await eyes.count()) === 2 &&
        (await eyes.nth(1).getAttribute('aria-pressed')) === 'false' &&
        (await pw.getAttribute('type')) === 'password',
      `${tag} : un œil par champ, indépendants ; quitter le premier champ l’a remasqué`,
    );
    ok(
      sp(await page.locator('#confirm-rule li').innerText()) ===
        'Les deux mots de passe sont identiques : non respectée',
      `${tag} : « Les deux mots de passe sont identiques », en attente`,
    );
    await cf.fill(SANS_CHIFFRE);
    ok(
      (await page.locator('#confirm-rule li.is-ok').count()) === 1,
      `${tag} : confirmation identique : cochée`,
    );
    if (theme === 'light') await axe(page, 'Nouveau mot de passe, saisie');

    // Envoi avec une règle manquante : rien n'est envoyé, l'erreur dit quoi faire
    const submit = page.getByRole('button', { name: 'Mettre à jour le mot de passe' });
    ok(!(await submit.isDisabled()), `${tag} : le bouton d’envoi n’est jamais désactivé`);
    await submit.click();
    const err = page.locator('#password-error');
    await err.waitFor();
    ok(
      sp(await err.innerText()) ===
        'Ajoutez au moins un chiffre et un caractère spécial (par ex. ! ? # @).' &&
        (await err.getAttribute('role')) === 'alert' &&
        (await err.locator('svg.lucide-circle-alert').count()) === 1,
      `${tag} : une phrase reprend les règles manquantes, sous le champ (alerte, icône)`,
    );
    ok(
      (await pw.getAttribute('aria-invalid')) === 'true' &&
        (await pw.getAttribute('aria-describedby')) === 'password-error password-rules' &&
        (await page.evaluate(() => document.activeElement?.id)) === 'password',
      `${tag} : champ invalide, décrit par l’erreur, focus rendu au champ`,
    );
    ok(
      (await page.locator('#password-rules li.is-failed svg.lucide-circle-x').count()) === 2,
      `${tag} : les règles manquantes passent en erreur (CircleX)`,
    );
    ok(
      (await pw.getAttribute('type')) === 'password' && (state.passwordUpdates ?? 0) === 0,
      `${tag} : à l’envoi le champ est remasqué ; rien n’a été envoyé au serveur`,
    );
    ok(
      (await page.getByText(/8 caractères minimum|trop faible/).count()) === 0,
      `${tag} : plus de message « 8 caractères minimum »`,
    );
    if (theme === 'light') await axe(page, 'Nouveau mot de passe, erreur');

    // Confirmation différente
    await pw.fill(VALIDE);
    ok(
      /^Force du mot de passe : (Moyen|Bon|Fort)$/.test(
        sp(await page.locator('.fd-pw-meter__label').innerText()),
      ) && (await page.locator('.fd-pw-meter__bar .is-on').count()) >= 2,
      `${tag} : toutes les règles respectées, la jauge dépasse « Faible »`,
    );
    ok((await err.count()) === 0, `${tag} : l’erreur disparaît à la correction`);
    await submit.click();
    await page.locator('#confirm-error').waitFor();
    ok(
      sp(await page.locator('#confirm-error').innerText()) ===
        'Les deux mots de passe ne sont pas identiques.' &&
        (await page.evaluate(() => document.activeElement?.id)) === 'confirm' &&
        (state.passwordUpdates ?? 0) === 0,
      `${tag} : confirmation différente, focus sur la confirmation, rien d’envoyé`,
    );

    // Refus du serveur : identique à l'actuel (cas du client), puis mot de passe trop courant
    await cf.fill(VALIDE);
    state.passwordRefusal = {
      error_code: 'same_password',
      msg: 'New password should be different from the old password.',
    };
    await submit.click();
    await err.waitFor();
    ok(
      sp(await err.innerText()) === 'Choisissez un mot de passe différent de l’actuel.' &&
        state.passwordUpdates === 1,
      `${tag} : refus « identique à l’actuel » dit tel quel, pas « trop faible »`,
    );
    state.passwordRefusal = {
      error_code: 'weak_password',
      msg: 'Password is known to be weak and easy to guess, please choose a different one.',
      weak_password: { reasons: ['pwned'] },
    };
    await submit.click();
    await page.locator('#password-error', { hasText: 'trop courant' }).waitFor();
    ok(
      sp(await err.innerText()) === 'Ce mot de passe est trop courant. Choisissez-en un autre.',
      `${tag} : refus « mot de passe trop courant »`,
    );
    // Accepté : retour à l'app
    state.passwordRefusal = null;
    await submit.click();
    await page.waitForURL((u) => !u.hash.includes('reset-password'));
    ok(state.passwordUpdates === 3, `${tag} : mot de passe accepté, retour à l’app`);
    await ctx.close();
  }

  // ===== 390 px : rien ne déborde =====
  {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    await install(page, seed());
    await page.goto(`${APP}/#/reset-password`);
    await page.locator('#password').pressSequentially(SANS_CHIFFRE);
    await page.getByRole('button', { name: 'Mettre à jour le mot de passe' }).click();
    await page.locator('#password-error').waitFor();
    ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      '390 px : pas de défilement horizontal (saisie et erreur)',
    );
    await page.close();
  }

  // ===== Inscription =====
  {
    // axe demande un contexte créé à la main
    const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const s = seed();
    s.signedOut = true;
    await install(page, s);
    await page.goto(`${APP}/#/signup`);
    const pw = page.locator('#password');
    await pw.waitFor();
    await pw.pressSequentially('abc');
    ok(
      (await page.locator('#password-rules li').count()) === 5 &&
        sp(await page.locator('.fd-pw-meter__label').innerText()) === 'Force du mot de passe : Faible' &&
        (await page.getByRole('button', { name: 'Afficher le mot de passe' }).count()) === 1,
      'Inscription : œil, jauge « Faible » et cinq règles',
    );
    await page.locator('form button[type=submit]').click();
    await page.locator('#password-error').waitFor();
    ok(
      sp(await page.locator('#password-error').innerText()) ===
        'Utilisez au moins 8 caractères. Ajoutez au moins une majuscule, un chiffre et un caractère spécial (par ex. ! ? # @).',
      'Inscription : l’erreur reprend toutes les règles manquantes',
    );
    ok(
      (await page.locator('#password-rules li.is-failed').count()) === 4,
      'Inscription : quatre règles en erreur',
    );
    await axe(page, 'Inscription, erreur de mot de passe');
    await page.close();
  }

  // ===== Profil =====
  {
    // axe demande un contexte créé à la main
    const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const state = seed();
    const ACTUEL = 'Ancien-2025!';
    state.currentPassword = ACTUEL;
    await install(page, state);
    await page.goto(`${APP}/#/settings/profile`);
    const np = page.locator('#np');
    const cp = page.locator('#cp');
    const eyes = page.getByRole('button', { name: 'Afficher le mot de passe' });
    // Sécurité (retour client du 24/11) : aucun champ de mot de passe tant qu'on n'a rien demandé
    const openPw = page.getByRole('button', { name: 'Mettre à jour le mot de passe' });
    await openPw.waitFor();
    ok(
      (await page.locator('#cp, #np, #np2').count()) === 0 &&
        (await page.locator('input[type=password]').count()) === 0,
      'Profil : aucun champ de mot de passe avant « Mettre à jour le mot de passe »',
    );
    await openPw.click();
    await cp.waitFor();
    ok(
      (await cp.inputValue()) === '' &&
        (await np.inputValue()) === '' &&
        (await page.locator('#np2').inputValue()) === '' &&
        (await cp.getAttribute('autocomplete')) === 'current-password' &&
        (await np.getAttribute('autocomplete')) === 'new-password' &&
        (await eyes.count()) === 0,
      'Profil : trois champs vides à l’ouverture, sans œil',
    );
    ok(
      (await page.evaluate(() => document.activeElement?.id)) === 'cp',
      'Profil : focus sur « Mot de passe actuel »',
    );
    await np.focus();
    ok((await page.locator('#np-rules li').count()) === 5, 'Profil : règles dès le focus');
    // L'œil garde le curseur ici aussi
    await np.pressSequentially(VALIDE);
    await np.evaluate((e) => e.setSelectionRange(4, 4));
    await eyes.first().click();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    ok(
      (await np.getAttribute('type')) === 'text' && (await np.evaluate((e) => e.selectionStart)) === 4,
      'Profil : l’œil garde le curseur',
    );
    // ALIGN-01 : les champs finissent sur le filet de la ligne
    const al = await np.evaluate((e) => {
      const g = e.closest('.fd-pw').getBoundingClientRect();
      const r = e.closest('.stg-row').getBoundingClientRect();
      return Math.abs(g.right - r.right);
    });
    ok(al <= 1, `Profil : champ calé sur la fin de la ligne (${al})`);
    await page.locator('#np2').pressSequentially(VALIDE);
    const save = page.getByRole('button', { name: 'Enregistrer le mot de passe' });
    ok(
      (await np.getAttribute('type')) === 'password',
      'Profil : quitter le champ remasque le nouveau mot de passe',
    );

    // Mot de passe actuel : vide, puis incorrect ; rien n'est changé
    await save.click();
    await page.locator('#cp-error').waitFor();
    ok(
      sp(await page.locator('#cp-error').innerText()) === 'Saisissez votre mot de passe actuel.' &&
        (await page.evaluate(() => document.activeElement?.id)) === 'cp' &&
        (await cp.getAttribute('aria-invalid')) === 'true',
      'Profil : mot de passe actuel exigé, focus sur le champ',
    );
    await cp.pressSequentially('Faux-2025!');
    ok((await page.locator('#cp-error').count()) === 0, 'Profil : l’erreur disparaît à la saisie');
    ok(
      (await cp.locator('xpath=..').getByRole('button').count()) === 0 &&
        (await cp.getAttribute('type')) === 'password',
      'Profil : jamais d’œil sur « Mot de passe actuel », même après une frappe',
    );
    await save.click();
    await page.locator('#cp-error').waitFor();
    ok(
      sp(await page.locator('#cp-error').innerText()) === 'Le mot de passe actuel est incorrect.' &&
        (state.passwordUpdates ?? 0) === 0,
      'Profil : mot de passe actuel incorrect, le mot de passe n’est pas changé',
    );
    await axe(page, 'Profil, mot de passe actuel incorrect');

    // Mot de passe actuel correct : la demande part avec lui ; refus du serveur sous le bon champ
    await cp.fill(ACTUEL);
    state.passwordRefusal = {
      error_code: 'same_password',
      msg: 'New password should be different from the old password.',
    };
    await save.click();
    await page.locator('#np-error').waitFor();
    ok(
      sp(await page.locator('#np-error').innerText()) ===
        'Choisissez un mot de passe différent de l’actuel.' &&
        (await page.evaluate(() => document.activeElement?.id)) === 'np' &&
        state.lastUpdateHadCurrent === true,
      'Profil : refus « identique à l’actuel » sous le nouveau mot de passe ; l’actuel accompagne la demande',
    );
    await axe(page, 'Profil, erreur de mot de passe');
    state.passwordRefusal = null;
    await save.click();
    await page.getByText('Mot de passe mis à jour').first().waitFor();
    await cp.waitFor({ state: 'detached' });
    ok(
      (await page.locator('input[type=password], #np, #np2').count()) === 0 && (await openPw.count()) === 1,
      'Profil : mot de passe mis à jour, formulaire refermé et vidé',
    );
    // Rouvert : rien ne reste de la saisie précédente ; « Annuler » vide et referme aussi
    await openPw.click();
    await cp.waitFor();
    ok(
      (await cp.inputValue()) === '' &&
        (await np.inputValue()) === '' &&
        (await page.locator('#np2').inputValue()) === '',
      'Profil : rouvert après l’enregistrement, les trois champs sont vides',
    );
    await np.pressSequentially('Brouillon-1!');
    await cp.pressSequentially('abc');
    await page
      .locator('#pf-sec-pwd')
      .locator('xpath=ancestor::form')
      .getByRole('button', { name: 'Annuler' })
      .click();
    await cp.waitFor({ state: 'detached' });
    await openPw.click();
    await cp.waitFor();
    ok(
      (await cp.inputValue()) === '' && (await np.inputValue()) === '' && (await eyes.count()) === 0,
      'Profil : « Annuler » vide tout ; rien n’est gardé à la réouverture',
    );
    await page.close();
  }

  // ===== Profil d'un compte sans mot de passe (créé avec Google ou par lien e-mail) =====
  {
    const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const state = seed();
    state.hasPassword = false;
    await install(page, state);
    await page.goto(`${APP}/#/settings/profile`);
    const set = page.getByRole('button', { name: 'Définir un mot de passe' });
    await set.waitFor();
    ok(
      (await page.locator('#cp').count()) === 0 &&
        (await page.getByRole('button', { name: 'Mettre à jour le mot de passe' }).count()) === 0,
      'Compte sans mot de passe : « Définir un mot de passe », sans « Mot de passe actuel »',
    );
    await set.click();
    await page.locator('#np').pressSequentially(VALIDE);
    await page.locator('#np2').pressSequentially(VALIDE);
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
    await page.getByText('Mot de passe mis à jour').first().waitFor();
    ok(
      state.passwordUpdates === 1 && state.lastUpdateHadCurrent === false,
      'Compte sans mot de passe : mot de passe défini, aucun mot de passe actuel demandé',
    );
    // Le compte a maintenant un mot de passe : le champ apparaît pour la prochaine fois
    await page.getByRole('button', { name: 'Mettre à jour le mot de passe' }).click();
    await page.locator('#cp').waitFor();
    ok(true, 'Compte sans mot de passe : une fois défini, « Mot de passe actuel » est demandé');
    await page.close();
  }

  // ===== Sécurité : l'œil ne révèle jamais une valeur que la personne n'a pas tapée (EXT-02 §7.1) =====
  for (const where of ['connexion', 'inscription', 'nouveau mot de passe']) {
    const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const s = seed();
    if (where !== 'nouveau mot de passe') s.signedOut = true;
    await install(page, s);
    await page.goto(
      `${APP}/#/${where === 'connexion' ? 'login' : where === 'inscription' ? 'signup' : 'reset-password'}`,
    );
    const pw = page.locator('#password');
    await pw.waitFor();
    const eye = pw.locator('xpath=..').getByRole('button', { name: 'Afficher le mot de passe' });
    const SECRET = 'Enregistre-2024!';
    // Remplissage par le navigateur ou un gestionnaire : la valeur arrive sans frappe
    const autofill = () =>
      pw.evaluate((el, v) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, SECRET);
    ok((await eye.count()) === 0, `${where} : champ vide, pas d’œil`);
    await autofill();
    await page.waitForFunction((v) => document.querySelector('#password').value === v, SECRET);
    ok(
      (await eye.count()) === 0 && (await pw.getAttribute('type')) === 'password',
      `${where} : valeur autoremplie, masquée, sans œil`,
    );
    // Compléter la valeur au clavier ne rend pas l'œil : il faut vider puis ressaisir
    await pw.focus();
    await page.keyboard.press('End');
    await page.keyboard.type('x');
    ok(
      (await eye.count()) === 0 && (await pw.getAttribute('type')) === 'password',
      `${where} : compléter une valeur autoremplie ne rend pas l’œil`,
    );
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.waitForFunction(() => document.querySelector('#password').value === '');
    await page.keyboard.type('Tape-2026!');
    await eye.waitFor();
    await eye.click();
    ok(
      (await pw.getAttribute('type')) === 'text' && (await pw.inputValue()) === 'Tape-2026!',
      `${where} : champ vidé puis ressaisi, l’œil revient et montre la frappe`,
    );
    // Une valeur autoremplie par-dessus une frappe affichée : remasquée aussitôt, œil retiré
    await autofill();
    await page.waitForFunction((v) => document.querySelector('#password').value === v, SECRET);
    ok(
      (await pw.getAttribute('type')) === 'password' && (await eye.count()) === 0,
      `${where} : autoremplissage par-dessus une frappe affichée, remasqué, œil retiré`,
    );
    // Un collage est un geste de la personne
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.waitForFunction(() => document.querySelector('#password').value === '');
    await pw.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Colle-2026!');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await page.keyboard.type('Z');
    await eye.waitFor();
    await eye.click();
    ok((await pw.getAttribute('type')) === 'text', `${where} : saisie de la personne, l’œil fonctionne`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => !document.activeElement?.closest('.fd-pw:has(#password)'));
    ok((await pw.getAttribute('type')) === 'password', `${where} : quitter le champ remasque`);
    await page.close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
