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
    ok((await eyes.count()) === 2, `${tag} : un œil par champ, nom fixe « Afficher le mot de passe »`);
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

    // Œil : affiche, garde le focus et le curseur ; indépendant de l'autre champ
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
      (await cf.getAttribute('type')) === 'password' &&
        (await eyes.nth(1).getAttribute('aria-pressed')) === 'false',
      `${tag} : l’œil de la confirmation est indépendant`,
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
    await cp.waitFor();
    await np.focus();
    ok(
      (await page.locator('#np-rules li').count()) === 5 &&
        (await page.getByRole('button', { name: 'Afficher le mot de passe' }).count()) === 3,
      'Profil : « Mot de passe actuel », œil sur les trois champs, règles dès le focus',
    );
    // L'œil garde le curseur ici aussi
    await np.pressSequentially(VALIDE);
    await np.evaluate((e) => e.setSelectionRange(4, 4));
    await page.getByRole('button', { name: 'Afficher le mot de passe' }).nth(1).click();
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
    const save = page.getByRole('button', { name: 'Mettre à jour le mot de passe' });

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
    ok(
      (await np.inputValue()) === '' && (await cp.inputValue()) === '',
      'Profil : mot de passe mis à jour, champs vidés',
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
    await page.locator('#np').pressSequentially(VALIDE);
    await page.locator('#np2').pressSequentially(VALIDE);
    await set.click();
    await page.getByText('Mot de passe mis à jour').first().waitFor();
    ok(
      state.passwordUpdates === 1 && state.lastUpdateHadCurrent === false,
      'Compte sans mot de passe : mot de passe défini, aucun mot de passe actuel demandé',
    );
    // Le compte a maintenant un mot de passe : le champ apparaît pour la prochaine fois
    await page.locator('#cp').waitFor();
    ok(
      (await page.getByRole('button', { name: 'Mettre à jour le mot de passe' }).count()) === 1,
      'Compte sans mot de passe : une fois défini, « Mot de passe actuel » est demandé',
    );
    await page.close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
