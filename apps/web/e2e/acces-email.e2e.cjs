/**
 * Test e2e L39 (086, 088) : accès « Sur invitation » et « Par domaine e-mail ». Données fictives, aucun
 * envoi réel (le faux backend note les demandes d'envoi dans state.accessEmails).
 *  - App : invités (modale, envoi, plafond, lien copié, retrait), domaines (pastilles, refus), règles.
 *  - Lecteur : écrans L11-09 à 11 et L11-13, retour d'un lien (jeton lu une fois, effacé de l'adresse,
 *    seul l'accès est gardé), domaine refusé, lien d'accès expiré.
 * Usage : node e2e/acces-email.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed, PUBLIC_PLAYER } = require('./fake-supabase.cjs');
const { seedExport } = require('./export-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function published() {
  const s = seed();
  seedExport(s, { steps: 3 });
  const v = s.tables.demo_versions.find((x) => x.id === s.tables.demos[0].current_version_id);
  s.tables.demos[0].updated_at = v.published_at;
  const body = Buffer.from(JSON.stringify(v.manifest));
  s.storage[`published/${DEMO}/latest.json`] = { data: body, type: 'application/json' };
  return s;
}

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const newPage = async (viewport = { width: 1440, height: 900 }) => {
    const ctx = await b.newContext({
      viewport,
      locale: 'fr-FR',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };
  const axe = async (page, sel) =>
    (await new AxeBuilder({ page }).include(sel).withTags(TAGS).analyze()).violations.map((v) => v.id);

  // ===== App : sur invitation =====
  const state = published();
  {
    const page = await newPage();
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=access`);
    const invite = page.getByRole('radio', { name: /Sur invitation/ });
    await invite.waitFor();
    ok(!(await invite.isDisabled()), 'invitation : carte disponible (plus de « Bientôt »)');
    await invite.check();
    await page.getByRole('button', { name: 'Inviter des personnes' }).click();
    const dlg = page.getByRole('dialog', { name: 'Inviter des personnes' });
    await dlg.waitFor();
    await dlg.getByLabel('Adresses e-mail').fill('camille@nord.example, pas-une-adresse');
    await dlg.getByRole('button', { name: /^Inviter/ }).click();
    ok(
      // Guillemets français : espace fine insécable (U+202F), comme dans l'app
      (await dlg.getByRole('alert').textContent()).includes('«\u202fpas-une-adresse\u202f»'),
      'modale : adresse invalide signalée',
    );
    ok(
      (await dlg.getByRole('checkbox', { name: /Envoyer l’invitation par e-mail/ }).isChecked()) === true,
      'admin : envoi par e-mail coché',
    );
    state.accessLimit = 1;
    await dlg.getByLabel('Adresses e-mail').fill('Camille@nord.example\nsami@nord.example');
    ok(
      (await dlg.getByRole('button', { name: 'Inviter 2 personnes' }).count()) === 1,
      'modale : libellé compté « Inviter 2 personnes »',
    );
    ok((await axe(page, '[role=dialog]')).length === 0, 'modale : axe sans violation');
    await dlg.getByRole('button', { name: 'Inviter 2 personnes' }).click();
    await dlg.waitFor({ state: 'detached' });
    await page.waitForTimeout(400);
    ok(
      state.tables.demo_access_invites
        .map((i) => i.email)
        .sort()
        .join() === 'camille@nord.example,sami@nord.example',
      'invités enregistrés, adresses normalisées',
    );
    ok(
      state.tables.demo_access.find((a) => a.demo_id === DEMO)?.mode === 'invite',
      'mode « Sur invitation » appliqué au premier invité',
    );
    ok(
      state.accessEmails.length === 1 && state.accessEmails[0].action === 'invite',
      'envoi par access-email (1 envoyé, 1 en attente : plafond)',
    );
    ok(
      (await page.locator('.toasts .toast-text').allTextContents()).some((x) => /en attente/.test(x)),
      'plafond : invitation en attente annoncée',
    );
    const rows = page.locator('.l11-inv-table tbody tr');
    ok(
      (await rows.count()) === 2 && (await page.getByText('2 personnes invitées').count()) === 1,
      'tableau des invités et compteur',
    );
    // Copier un lien d'accès (aucun envoi)
    await page.getByRole('button', { name: 'Actions pour sami@nord.example' }).click();
    await page.getByRole('menuitem', { name: 'Copier un lien d’accès' }).click();
    await page.waitForTimeout(300);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    ok(
      copied.includes(`?acces=${DEMO}`) && state.accessEmails.length === 1,
      'lien d’accès copié, sans envoi',
    );
    // Retirer
    await page.getByRole('button', { name: 'Actions pour sami@nord.example' }).click();
    await page.getByRole('menuitem', { name: 'Retirer l’accès' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer l’accès' }).click();
    await page.waitForTimeout(300);
    ok(state.tables.demo_access_invites.length === 1, 'invité retiré');
    ok((await axe(page, '#sh-panel-access')).length === 0, 'onglet Accès (invitation) : axe sans violation');
    await page.context().close();
  }

  // ===== Lecteur : invitation =====
  {
    const page = await newPage({ width: 390, height: 844 });
    await install(page, state);
    await page.goto(`${PUBLIC_PLAYER}/#/d/${DEMO}`);
    await page.getByRole('heading', { name: 'Accès sur invitation' }).waitFor();
    ok(true, 'L11-09 : écran « Accès sur invitation »');
    await page.getByLabel('Adresse e-mail').fill('inconnu@nord.example');
    await page.getByRole('button', { name: 'Recevoir mon lien d’accès' }).click();
    await page.getByRole('heading', { name: 'Vérifiez votre boîte mail' }).waitFor();
    ok(
      (await page.getByRole('status').first().textContent()).includes('inconnu@nord.example'),
      'L11-10 : même réponse, adresse autorisée ou non',
    );
    ok(
      await page.getByRole('button', { name: /Renvoyer le lien dans/ }).isDisabled(),
      'L11-10 : « Renvoyer » désactivé 60 s',
    );
    ok((await axe(page, 'body')).length === 0, 'L11-10 : axe sans violation');
    await page.getByRole('button', { name: 'Changer d’adresse' }).click();
    ok(await page.getByLabel('Adresse e-mail').isVisible(), '« Changer d’adresse » revient au formulaire');
    await page.context().close();
  }
  {
    // Retour d'un lien : jeton lu une fois, effacé de l'adresse, démo ouverte, accès gardé
    const page = await newPage();
    await install(page, state);
    await page.goto(
      `${PUBLIC_PLAYER}/?acces=${DEMO}#access_token=fake-token:camille@nord.example&type=magiclink`,
    );
    await page.locator('.p-img, .p-text-step, .p-step').first().waitFor({ timeout: 15000 });
    ok(
      !page.url().includes('access_token') && page.url().endsWith(`#/d/${DEMO}`),
      'retour du lien : jeton effacé de l’adresse',
    );
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    ok(
      !stored.includes('fake-token') && /grant-mail-/.test(stored),
      'seul l’accès est gardé, jamais le jeton',
    );
    ok(!!state.tables.demo_access_invites[0].opened_at, 'invité : « A ouvert la démo »');
    await page.reload();
    await page.locator('.p-img, .p-text-step, .p-step').first().waitFor({ timeout: 15000 });
    ok(state.accessTokensSeen.length === 1, 'rechargement : accès réutilisé, sans nouveau jeton');
    await page.context().close();
  }
  {
    // Lien expiré ou déjà utilisé (erreur dans le fragment)
    const page = await newPage();
    await install(page, state);
    await page.goto(`${PUBLIC_PLAYER}/?acces=${DEMO}#error=access_denied&error_code=otp_expired`);
    await page.getByRole('heading', { name: 'Ce lien d’accès a expiré' }).waitFor();
    ok(!page.url().includes('error_code'), 'L11-13 : lien expiré, adresse nettoyée');
    await page.getByRole('button', { name: 'Recevoir un nouveau lien' }).click();
    ok(
      await page.getByLabel('Adresse e-mail').isVisible(),
      'L11-13 : « Recevoir un nouveau lien » ouvre le formulaire',
    );
    await page.context().close();
  }

  // ===== App : par domaine e-mail =====
  {
    const page = await newPage();
    await install(page, state);
    await page.goto(`${APP}/#/demos/${DEMO}/share?tab=access`);
    await page.getByRole('radio', { name: /Par domaine e-mail/ }).check();
    const field = page.getByLabel('Domaines autorisés');
    await field.fill('gmail.com');
    await field.press('Enter');
    ok(
      /messageries grand public/.test(await page.locator('#acc-dom-err').textContent()),
      'domaine grand public refusé',
    );
    await field.fill('@Mission-Locale.example');
    await field.press('Enter');
    await page.waitForTimeout(300);
    const acc = state.tables.demo_access.find((a) => a.demo_id === DEMO);
    ok(
      acc.domains.join() === 'mission-locale.example' && acc.mode === 'domain',
      'domaine ajouté (nettoyé), mode appliqué',
    );
    ok(
      (await page.locator('.l11-chip').textContent()).includes('@mission-locale.example'),
      'pastille « @domaine »',
    );
    ok((await axe(page, '#sh-panel-access')).length === 0, 'onglet Accès (domaine) : axe sans violation');
    await page.context().close();
  }

  // ===== Lecteur : domaine =====
  {
    const page = await newPage();
    await install(page, state);
    await page.goto(`${PUBLIC_PLAYER}/#/d/${DEMO}`);
    await page.getByRole('heading', { name: 'Réservé au réseau' }).waitFor();
    ok(
      (await page.locator('.p-gate .p-sub').textContent()).includes('@mission-locale.example'),
      'L11-11 : domaines autorisés affichés',
    );
    const n = state.accessEmails.length;
    await page.getByLabel('Adresse e-mail professionnelle').fill('lea@ailleurs.example');
    await page.getByRole('button', { name: 'Recevoir mon lien d’accès' }).click();
    ok(
      (await page.getByRole('alert').textContent()).includes('n’appartient pas à un domaine autorisé') &&
        state.accessEmails.length === n,
      'L11-11 : domaine refusé, aucune demande envoyée',
    );
    await page.getByLabel('Adresse e-mail professionnelle').fill('lea@mission-locale.example');
    await page.getByRole('button', { name: 'Recevoir mon lien d’accès' }).click();
    await page.getByRole('heading', { name: 'Vérifiez votre boîte mail' }).waitFor();
    ok(state.accessEmails.at(-1)?.email === 'lea@mission-locale.example', 'domaine autorisé : lien demandé');
    ok((await axe(page, 'body')).length === 0, 'écran domaine : axe sans violation');
    await page.context().close();
  }

  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
