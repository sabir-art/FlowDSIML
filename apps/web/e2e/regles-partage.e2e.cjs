/**
 * L27-06 à L27-08 et L27-10 : règles de partage (Paramètres > Sécurité), liens non conformes,
 * effet dans Partager (mode interdit visible et expliqué, durée maximale, publication réservée),
 * exports désactivés, plan inférieur à Enterprise. Données fictives (« Acme », .example).
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/regles-partage.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch({
    // Champs date et heure au format français (locale du processus)
    args: ['--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' },
  });
  const ctx = await themedContext(b, {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
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
  t.profiles[0].full_name = 'Alice Exemple';
  // Deux démos publiées : l'une en lien public sans mot de passe, l'autre avec un mot de passe
  t.demos[0].status = 'published';
  if (t.demos[1]) t.demos[1].status = 'published';
  t.demo_access.push({
    demo_id: t.demos[1]?.id ?? DEMO,
    workspace_id: 'ws-1',
    mode: 'link',
    ask_email: false,
    expires_at: null,
    password: 'motdepasse-fictif',
    password_changed_at: '2026-11-10T10:00:00Z',
  });
  await install(page, state);
  const shot = async (name) => {
    if (!SHOTS) return;
    for (const x of await page.locator('.toast-close').all()) await x.click().catch(() => {});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };

  // ===== L48-A : règles de partage ouvertes à toutes les offres =====
  await page.goto(`${APP}/#/settings/security`);
  const card = page.getByRole('region', { name: /Règles de partage/ });
  await card.waitFor();
  ok((await card.getByText('Enterprise', { exact: true }).count()) === 0, 'L48-A : plus de badge Enterprise');
  ok(
    (await card.getByRole('link', { name: 'Voir les plans' }).count()) === 0,
    'L48-A : plus de « Voir les plans »',
  );
  await page.locator('.fd-page-header').getByRole('button', { name: 'Enregistrer' }).waitFor();
  ok(true, 'L48-A : offre Free, règles modifiables par un admin');
  await shot('l27-10-regles-plan');

  // ===== L27-06 : Enterprise, administrateur =====
  t.workspaces[0].plan_code = 'enterprise';
  await page.reload();
  await card.waitFor();
  // Lot 1 : un seul « Enregistrer », dans la barre de page
  const save = page.locator('.fd-page-header').getByRole('button', { name: 'Enregistrer' });
  await save.waitFor();
  ok(await save.isDisabled(), 'Enregistrer inactif sans changement');
  ok(
    (await card.getByRole('checkbox', { name: /Sur invitation/ }).isChecked()) &&
      (await card.locator('.check.is-soon').count()) === 0,
    'L39 : Invitation et Domaine e-mail autorisables (plus de « Bientôt »)',
  );
  ok((await card.locator('fieldset legend').count()) >= 2, 'groupes en fieldset / legend');
  await card.getByRole('checkbox', { name: 'Toute personne avec le lien' }).uncheck();
  await card.getByRole('checkbox', { name: 'Avec un mot de passe' }).uncheck();
  // L39 : quatre modes ; on les décoche tous pour vérifier la règle « au moins un mode »
  await card.getByRole('checkbox', { name: /Sur invitation/ }).uncheck();
  await card.getByRole('checkbox', { name: /Par domaine e-mail/ }).uncheck();
  ok(
    (await card.getByRole('alert').innerText()) === 'Gardez au moins un mode d’accès.' &&
      (await save.isDisabled()),
    'au moins un mode',
  );
  await card.getByRole('checkbox', { name: 'Avec un mot de passe' }).check();
  await card.getByRole('checkbox', { name: /Sur invitation/ }).check();
  await card.getByRole('checkbox', { name: /Par domaine e-mail/ }).check();
  // Select maison (COMP-01) : ouverture, puis choix de l'option
  await card.getByRole('combobox', { name: 'Durée maximale des liens' }).click();
  await page.getByRole('option', { name: '30 jours' }).click();
  await card.getByRole('radio', { name: 'Administrateurs et propriétaires seulement' }).check();
  await card
    .getByRole('switch', { name: /Exports hors de/ })
    .first()
    .uncheck();
  ok(!(await save.isDisabled()), 'Enregistrer actif dès qu’une valeur change');
  await shot('l27-06-regles-partage');

  // ===== L27-07 : liens existants non conformes =====
  await save.click();
  const dlg = page.getByRole('dialog', { name: /liens? ne respecte/ });
  await dlg.waitFor();
  const title = sp(await dlg.getByRole('heading').innerText());
  ok(/^\d+ liens? ne respectent? pas ces règles$/.test(title), `titre (${title})`);
  ok((await dlg.getByRole('listitem').count()) >= 1, 'liste des liens (5 au plus)');
  ok(/Toute personne avec le lien/.test(await dlg.innerText()), 'type de lien affiché');
  ok(
    /Ces démos ne seront plus accessibles tant qu’un mot de passe n’est pas défini\./.test(
      await dlg.innerText(),
    ),
    'démos bloquées annoncées',
  );
  ok(
    await dlg.getByRole('radio', { name: /mettre en conformité/ }).isChecked(),
    'choix par défaut : conformité',
  );
  await shot('l27-07-liens-non-conformes');
  await dlg.getByRole('button', { name: 'Enregistrer les règles' }).click();
  await dlg.waitFor({ state: 'detached' });
  await page.getByText('Règles de partage enregistrées.').waitFor();
  const call = state.shareRulesCalls.at(-1);
  ok(
    call.p_fix === true &&
      call.p_max_days === 30 &&
      call.p_publish_role === 'admin' &&
      call.p_exports === false &&
      [...call.p_modes].sort().join() === 'domain,invite,password',
    'règles envoyées (conformité, 30 jours, admins, sans exports)',
  );
  ok(
    t.demo_access.some((x) => x.locked_by_rules),
    'démo sans mot de passe bloquée',
  );

  // Démos : badge « Accès à régler »
  await page.goto(`${APP}/#/`);
  await page.locator('text=Accès à régler >> visible=true').first().waitFor();
  ok(true, 'liste des démos : « Accès à régler »');

  // ===== L27-08 : Partager, administrateur (lien vers les règles) =====
  await page.goto(`${APP}/#/demos/${DEMO}/share?tab=access`);
  const linkOpt = page.getByRole('radio', { name: /Toute personne avec le lien/ });
  await linkOpt.waitFor();
  ok(
    (await page.getByRole('link', { name: 'Voir les règles' }).count()) === 1,
    'admin : « Voir les règles »',
  );

  // ===== L27-08 : éditeur =====
  t.members[0].role = 'editor';
  await page.reload();
  await page.waitForSelector('#acc-link[aria-disabled="true"]');
  ok(
    (await linkOpt.getAttribute('aria-disabled')) === 'true' &&
      sp(await page.locator(`#${await linkOpt.getAttribute('aria-describedby')}`).innerText()) ===
        'Conservé pour ce lien. Ce mode n’est plus proposé : désactivé par les règles de l’espace.',
    'mode interdit visible, désactivé et expliqué',
  );
  ok(
    (await page.getByRole('link', { name: 'Voir les règles' }).count()) === 0,
    'éditeur : pas de lien vers les règles',
  );
  const expSwitch = page
    .getByRole('checkbox', { name: 'Expiration' })
    .or(page.getByRole('switch', { name: 'Expiration' }))
    .first();
  ok(
    (await expSwitch.isChecked()) && (await expSwitch.getAttribute('aria-disabled')) === 'true',
    '« Jamais » désactivé (expiration obligatoire)',
  );
  ok(
    /Durée maximale fixée par l’espace : 30 jours\./.test(sp(await page.locator('#acc-exp-max').innerText())),
    'durée maximale annoncée',
  );
  await shot('l27-08-partager-regles');

  // Exports désactivés (menu de l'éditeur) et diffusion réservée
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  // L32 : attendre l'éditeur réel (le squelette a aussi un bouton « Publier », inactif)
  await page.locator('main.ed[aria-busy="false"]').waitFor();
  const pub = page.getByRole('button', { name: /Publier/ }).first();
  await pub.waitFor();
  ok(
    (await pub.getAttribute('aria-disabled')) === 'true' &&
      (await pub.getAttribute('title')) ===
        'Seuls les administrateurs et propriétaires publient dans cet espace.',
    'éditeur : « Publier » désactivé avec infobulle',
  );
  ok((await page.getByText('Demander la publication').count()) === 0, 'rien à la place de « Publier »');
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  const exp = page.getByRole('menuitem', { name: 'Exporter' });
  ok(
    (await exp.getAttribute('aria-disabled')) === 'true' &&
      (await exp.getAttribute('title')) === 'Les exports sont désactivés par les règles de l’espace.',
    'menu « Exporter » désactivé et expliqué',
  );
  await page.keyboard.press('Escape');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
