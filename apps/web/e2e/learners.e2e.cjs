/** L13 : suivi des apprenants (liste, filtres, fiche, vue par formation, export CSV, suppression RGPD). */
const fs = require('fs');
const { chromium } = require('playwright');
const { install } = require('./fake-supabase.cjs');
const { learnersFixture } = require('./learners-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = await install(page);
  const f = learnersFixture();
  state.learners = f.progress;
  state.learnerDetail = f.detail;
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };

  await page.goto(`${APP}/#/`);
  await page.getByRole('link', { name: 'Apprenants' }).click();
  await page.waitForSelector('.l13-table');
  ok((await page.getByRole('heading', { level: 1 }).textContent()) === 'Apprenants', 'L13-01 : entrée Formation › Apprenants');
  ok((await page.locator('.page-head__sub').textContent()).includes('41 apprenants · 3 formations'), 'L13-01 : sous-titre compté');
  ok((await page.locator('.l13-table tbody tr').count()) === 41, 'L13-01 : une ligne par apprenant identifié');
  const kpi = await page.locator('.fd-kpi__value').allTextContents();
  ok(kpi.length === 4 && kpi[0] === '25' && kpi[2] === '8', 'L13-01 : KPI Terminé et À relancer calculés');

  // Filtre Statut par la puce, gardé dans l'URL
  await page.getByRole('button', { name: 'Changer le filtre Statut' }).click();
  await page.getByRole('menuitem', { name: 'À relancer' }).click();
  await page.waitForTimeout(200);
  ok(page.url().includes('statut=stale'), 'L13-01 : filtre gardé dans l’URL');
  ok((await page.locator('.l13-table tbody tr').count()) === 8, 'L13-01 : filtre À relancer');
  ok((await page.locator('.l13-table .st-badge.relance').count()) === 8, 'L13-01 : badges À relancer (texte et icône)');
  ok(await page.getByRole('button', { name: 'Relancer les 8' }).isVisible(), 'L13-01 : « Relancer les n » en tête de carte');

  // Recherche
  await page.getByRole('searchbox', { name: /Rechercher un apprenant/ }).fill('dsi-ml');
  await page.waitForTimeout(500);
  ok((await page.locator('.l13-table tbody tr').count()) === 2, 'L13-01 : recherche par e-mail');
  await page.getByRole('searchbox', { name: /Rechercher un apprenant/ }).fill('');
  await page.waitForTimeout(500);

  // Tri par nom
  await page.getByRole('button', { name: 'Apprenant', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('th[aria-sort]')?.textContent === 'Apprenant');
  const firstName = await page.locator('.l13-table tbody tr:first-child .l13-name').textContent();
  ok(
    firstName === 'Adam Fictif' &&
      (await page.locator('th[aria-sort]').getAttribute('aria-sort')) === 'ascending' &&
      page.url().includes('tri=name'),
    'L13-01 : tri par colonne (aria-sort)',
  );

  // Sélection et relance (72 h)
  await page.getByRole('checkbox', { name: 'Sélectionner Léa Exemple' }).check();
  await page.getByRole('checkbox', { name: 'Sélectionner Hugo Test' }).check();
  ok((await page.locator('.l13-sel').textContent()).includes('2 apprenants sélectionnés'), 'L13-01 : bandeau de sélection');
  await page.locator('.l13-sel').getByRole('button', { name: 'Relancer' }).click();
  await page.waitForTimeout(400);
  const toast = await page.locator('.mk-toasts').textContent();
  ok(/1 apprenant\. 1 déjà relancé/.test(toast), 'L13-01 : relance préparée, déjà relancé dans les 72 h écarté');
  ok(!!state.learners.learners.find((l) => l.id === 'l-1').lastReminder, 'L13-01 : relance enregistrée (record_reminders)');

  // Fiche (tiroir) : focus, source d'identification, Échap et retour du focus
  await page.getByRole('button', { name: 'Léa Exemple', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Léa Exemple' });
  await drawer.waitFor();
  ok(await page.evaluate(() => document.activeElement?.id === 'l13-dr-t'), 'L13-02 : focus initial sur le titre');
  ok((await drawer.textContent()).includes('identifié par lien personnalisé'), 'L13-02 : source affichée (lien personnalisé)');
  ok((await drawer.locator('.l13-mods li').count()) === 2, 'L13-02 : une ligne par formation suivie');
  ok((await drawer.textContent()).includes('Module « Fiches usagers » ouvert'), 'L13-02 : frise d’activité');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  ok(
    (await drawer.count()) === 0 &&
      (await page.evaluate(() => document.activeElement?.textContent)) === 'Léa Exemple',
    'L13-02 : Échap ferme et rend le focus à la ligne',
  );

  // Accorder une tentative (quiz épuisé) depuis le menu ⋯
  await page.getByRole('button', { name: 'Actions pour Camille Exemple' }).click();
  await page.getByRole('menuitem', { name: 'Accorder une tentative' }).click();
  await page.waitForTimeout(300);
  ok(
    state.learners.learners.find((l) => l.id === 'l-4').modules.find((m) => m.demoId === 'm-quiz').max === 4,
    'L13-02 : tentative accordée (grant_quiz_attempt)',
  );

  // Export CSV : séparateur point-virgule, colonnes, trace
  await page.getByRole('button', { name: 'Exporter CSV' }).click();
  const ex = page.getByRole('dialog', { name: 'Exporter en CSV' });
  await ex.waitFor();
  ok((await ex.getByRole('button', { name: /^Exporter \d+ lignes?$/ }).textContent()).includes('8 lignes'), 'L13-04 : bouton compté (filtre)');
  await ex.getByRole('checkbox', { name: /Détail par module/ }).check();
  const [dl] = await Promise.all([page.waitForEvent('download'), ex.getByRole('button', { name: /^Exporter 8 lignes$/ }).click()]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  const head = csv.replace(/^﻿/, '').split('\r\n')[0];
  ok(head.startsWith('Nom;E-mail;Structure;Identifié par;Formations;') && head.includes('Logiciel métier · Quiz final'), 'L13-04 : CSV UTF-8, point-virgule, détail par module');
  ok(csv.split('\r\n').length === 9, 'L13-04 : une ligne par apprenant filtré');
  ok(state.audit?.some((a) => a.action === 'learners.export' && a.rows === 8), 'L13-04 : export tracé (log_learners_export)');

  // Suppression RGPD : confirmation par l'e-mail
  await page.getByRole('button', { name: 'Léa Exemple', exact: true }).click();
  await page.getByRole('button', { name: 'Supprimer ses données' }).click();
  const rg = page.getByRole('alertdialog', { name: /Supprimer les données de Léa Exemple/ });
  await rg.waitFor();
  const del = rg.getByRole('button', { name: 'Supprimer définitivement' });
  ok(await del.isDisabled(), 'L13-05 : désactivé tant que la saisie ne correspond pas');
  await rg.getByRole('textbox').fill('lea.exemple@mission-locale.example');
  ok(await del.isEnabled(), 'L13-05 : activé avec l’e-mail exact');
  await del.click();
  await page.waitForTimeout(500);
  ok(
    !state.learners.learners.some((l) => l.id === 'l-1') && state.audit.some((a) => a.action === 'learner.erase'),
    'L13-05 : données supprimées et tracées',
  );
  ok((await page.locator('.l13-table tbody tr').count()) === 7, 'L13-05 : apprenant retiré de la liste');

  // Vue par formation
  await page.getByRole('tab', { name: 'Par formation' }).click();
  await page.waitForSelector('.fo-grid');
  ok((await page.locator('.fo-card').count()) === 3, 'L13-03 : une carte par formation');
  ok((await page.locator('.fo-card[aria-current="true"] h3').textContent()) === 'Logiciel métier', 'L13-03 : carte choisie');
  ok((await page.locator('.funnel .row').count()) === 4, 'L13-03 : avancement par module');
  ok((await page.locator('.l13 .fd-help').first().textContent()).includes('plus gros décrochage'), 'L13-03 : décrochage signalé');
  await page.getByRole('button', { name: /Voir les apprenants qui n'ont pas validé le module Agenda/ }).click();
  await page.waitForSelector('.l13-table');
  ok(page.url().includes('module=m-agenda') && page.url().includes('formation=p-logiciel'), 'L13-03 : clic sur un module ouvre la liste filtrée');

  // Lecteur : pas de données nominatives
  state.tables.members[0].role = 'viewer';
  await page.goto(`${APP}/#/learners`);
  await page.reload();
  await page.waitForSelector('.fd-alert');
  ok((await page.locator('.l13-table').count()) === 0, 'L13 : lecteur sans accès aux données nominatives');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
