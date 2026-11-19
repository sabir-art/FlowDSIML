/**
 * L26-09 à L26-12 : notes de la démo et modification en direct, télécommande sur téléphone (appairage,
 * commandes synchronisées), bilan de fin. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/presentateur-complet.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const state = seed();
  state.remoteCode = '48291307';
  await install(page, state);
  ctx.on('page', (p) => void install(p, state));
  const st = (id) => state.tables.steps.find((s) => s.id === id);
  const demo = () => state.tables.demos.find((d) => d.id === DEMO);
  st('s1').presenter_notes = 'Saluer la salle\nRappeler l’objectif';
  st('s2').presenter_notes = 'Insister : le bouton a changé de place';

  // ===== L26-09 : notes de la démo dans l'éditeur =====
  await page.goto(`${BASE}/#/demos/${DEMO}/edit?tab=settings`);
  const dn = page.locator('#demo-notes');
  await dn.waitFor();
  ok((await dn.getAttribute('maxlength')) === '2000', 'notes de la démo : 2 000 caractères au plus');
  await dn.fill('Introduction : le nouveau logiciel\nQuestions à anticiper : les doublons');
  await page.waitForTimeout(900);
  ok(demo().presenter_notes?.startsWith('Introduction'), 'notes de la démo enregistrées');

  // ===== Lancement avec « Piloter depuis mon téléphone » =====
  await page.getByRole('button', { name: 'Présenter', exact: true }).click();
  const launch = page.getByRole('dialog', { name: /Présenter/ });
  await launch.waitFor();
  await launch.getByRole('radio', { name: /Un seul écran/ }).check();
  const sw = launch.getByRole('switch', { name: /Piloter depuis mon téléphone/ });
  await sw.check();
  await launch.getByRole('button', { name: 'Lancer la présentation' }).click();
  await page.waitForURL(/#\/demos\/.*\/present\?.*remote=1/);

  // ===== L26-10 : appairage =====
  const rd = page.getByRole('dialog', { name: 'Piloter depuis votre téléphone' });
  await rd.waitFor();
  await rd.locator('.rm-code').waitFor();
  ok((await rd.getByRole('img', { name: /QR code/ }).count()) === 1, 'QR code nommé (role="img")');
  ok(sp(await rd.locator('.rm-code').innerText()) === '4829 1307', 'code à 8 chiffres lisible');
  ok(
    (await rd.locator('.rm-code').getAttribute('aria-label')) === 'Code 4 8 2 9 1 3 0 7',
    'code lu chiffre par chiffre',
  );
  ok(/\/t\b/.test(await rd.innerText()), 'adresse courte …/t');
  const status = rd.getByRole('status');
  ok(sp(await status.innerText()) === 'En attente du téléphone…', 'statut « En attente du téléphone… »');
  if (SHOTS) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/l26-10-appairage${sfx}.png` });
  }
  ok(state.remotes.filter((r) => !r.ended).length === 1, 'une seule télécommande ouverte');
  const active = state.remotes.find((r) => !r.ended);
  const qrUrl = `${BASE}/#/t?r=${active.id}&c=48291307`;

  // ===== L26-11 : téléphone =====
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => errors.push(`phone: ${e.message}`));
  await install(phone, state);
  await phone.setViewportSize({ width: 390, height: 844 });
  // Code incorrect saisi à la main
  await phone.goto(`${BASE}/#/t`);
  await phone.getByLabel('Code à 8 chiffres').fill('11112222');
  await phone.getByRole('button', { name: 'Se connecter' }).click();
  await phone.getByRole('alert').waitFor();
  ok(/Code incorrect/.test(await phone.getByRole('alert').innerText()), 'téléphone : code incorrect');
  // QR code
  await phone.goto(qrUrl);
  await phone.reload();
  await phone.getByRole('timer').waitFor();
  await status
    .filter({ hasText: 'Téléphone connecté' })
    .waitFor({ timeout: 8000 })
    .catch(() => undefined);
  ok(
    /Téléphone connecté/.test(
      sp(
        await page
          .locator('.live--phone')
          .innerText()
          .catch(() => ''),
      ),
    ),
    'présentateur : puce « Téléphone connecté »',
  );
  await rd.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  ok(sp(await phone.locator('.rmp-head').innerText()).includes('1 / 3'), 'téléphone : titre et n / N');
  ok(
    sp(await phone.locator('.rmp-notes').innerText()).includes('Introduction'),
    'téléphone : notes de la démo à l’étape 1',
  );
  await phone.getByRole('button', { name: 'Suivante' }).click();
  await page.locator('.pr-count', { hasText: 'Étape 2 sur 3' }).waitFor({ timeout: 5000 });
  ok(true, 'téléphone « Suivante » : la vue présentateur suit');
  await phone.locator('.rmp-head', { hasText: '2 / 3' }).waitFor({ timeout: 5000 });
  ok(
    sp(await phone.locator('.rmp-notes').innerText()).includes('Insister'),
    'téléphone : notes de l’étape 2',
  );
  ok(sp(await phone.locator('.rmp-nextis').innerText()).startsWith('Ensuite'), 'téléphone : « Ensuite : … »');
  const nextBox = await phone.getByRole('button', { name: 'Suivante' }).boundingBox();
  ok(nextBox.height >= 64, 'téléphone : « Suivante » de 64 px au moins');
  if (SHOTS) await phone.screenshot({ path: `${SHOTS}/l26-11-telephone${sfx}.png` });
  await phone.getByRole('button', { name: 'Écran noir' }).click();
  await page.locator('button[aria-pressed="true"]', { hasText: 'Écran noir' }).waitFor({ timeout: 5000 });
  ok(true, 'téléphone « Écran noir » : synchronisé');
  await phone.getByRole('button', { name: 'Écran noir' }).click();

  // ===== L26-09 : onglets et modification en direct (étape 2) =====
  ok(
    (await page.getByRole('tab', { name: 'Étape 2' }).getAttribute('aria-selected')) === 'true',
    'étape 2 : onglet Étape',
  );
  await page.getByRole('button', { name: 'Modifier' }).click();
  const area = page.getByLabel('Notes du présentateur');
  await area.fill('Insister : le bouton a changé de place\nMontrer l’étape 6 pour les doublons');
  await page.keyboard.press('ArrowRight');
  ok(/Étape 2 sur 3/.test(await page.locator('.pr-count').innerText()), 'pendant la saisie : → désactivée');
  await page.waitForTimeout(1200);
  ok(st('s2').presenter_notes.includes('Montrer l’étape 6'), 'modification enregistrée dans la démo');
  ok(
    sp(await page.locator('.pr-saved').innerText()) ===
      'Enregistré dans la démo. Visible seulement par les éditeurs.',
    '« Enregistré dans la démo. Visible seulement par les éditeurs. »',
  );
  await phone.locator('.rmp-notes', { hasText: 'Montrer l’étape 6' }).waitFor({ timeout: 5000 });
  ok(true, 'téléphone : notes modifiées reçues');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l26-09-notes${sfx}.png` });
  await area.focus();
  await page.keyboard.press('Escape');
  await area.waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
  ok(
    (await area.count()) === 0 && (await page.getByRole('dialog').count()) === 0,
    'Échap : quitte la modification sans terminer',
  );
  await page.getByRole('tab', { name: 'Démo' }).click();
  ok(sp(await page.locator('.notes').innerText()).includes('Introduction'), 'onglet Démo : notes de la démo');
  await page.evaluate(() => document.activeElement?.blur?.());

  // ===== L26-12 : Terminer depuis le téléphone (avec confirmation), bilan =====
  await phone.getByRole('button', { name: 'Terminer' }).click();
  await phone
    .getByRole('group', { name: /Terminer la présentation/ })
    .getByRole('button', { name: 'Terminer' })
    .click();
  const rep = page.getByRole('dialog', { name: /Présentation terminée · \d+ min \d\d/ });
  await rep.waitFor({ timeout: 5000 });
  ok(true, 'téléphone « Terminer » : bilan de fin');
  await phone.getByText(/La présentation est terminée/).waitFor({ timeout: 5000 });
  ok(true, 'téléphone : fin annoncée');
  const rows = rep.getByRole('table').getByRole('row');
  ok((await rows.count()) === 4, 'bilan : tableau (en-tête et 3 étapes)');
  ok(/Durée cible : 15 min/.test(sp(await rep.innerText())), 'bilan : durée cible');
  ok(/gardé que pour vous, 30 jours/.test(sp(await rep.innerText())), 'bilan : conservation 30 jours');
  ok(
    /Notes modifiées pendant la présentation : 1 étape/.test(sp(await rep.innerText())),
    'bilan : 1 étape modifiée',
  );
  ok((await rep.locator('.rp-row.is-long').count()) === 1, 'bilan : étape la plus longue');
  await page.waitForTimeout(400);
  const saved = state.tables.present_reports?.[0];
  ok(
    saved && saved.notes_changed === 1 && saved.steps.length === 3 && saved.target_min === 15,
    'bilan enregistré',
  );
  ok(
    !(state.calls || []).some((c) => /track_events|functions\/v1\/track/.test(c.path)),
    'aucune vue comptée',
  );
  const bg = (n) =>
    rep.getByRole('button', { name: n, exact: true }).evaluate((e) => getComputedStyle(e).backgroundColor);
  ok(
    (await bg('Retour à l’éditeur')) !== (await bg('Fermer')),
    'bilan : « Retour à l’éditeur » en bouton principal',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l26-12-bilan${sfx}.png` });
  await rep.getByRole('button', { name: 'Retour à l’éditeur' }).click();
  await page.waitForFunction(() => location.hash.endsWith('/edit'));
  ok(true, 'bilan : retour à l’éditeur');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
