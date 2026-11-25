/**
 * Recette L48-B (spec docs/ux/specs/l48b-etats-vides.md §4 et §6). Données fictives.
 *  - espace neuf : pas d'indicateurs, prise en main fermée (bouton du PageHeader), pas de barre ; état vide avec une seule action
 *    principale («\u202fNouvelle démo\u202f» au centre, pas dans l'en-tête), sans tuiles, «\u202fVoir un exemple\u202f» désactivé ;
 *  - recherche «\u202fzzz\u202f» avec 2 filtres : variante search annoncée, «\u202fRéinitialiser les filtres\u202f».
 * Usage : node e2e/l48b-vides.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { seedMaquette } = require('./maquette-data.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (data) => {
    const page = await (
      await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, data);
    await page.goto(`${APP}/#/`);
    return page;
  };

  // ===== Espace neuf =====
  const s = seed();
  s.tables.demos = [];
  const p = await open(s);
  const empty = p.locator('.fd-empty');
  await empty.waitFor();
  ok((await p.locator('.kpi-short').count()) === 0, 'pas d’indicateurs avant la première publication');
  ok((await p.locator('.demos-section .list-toolbar').count()) === 0, 'pas de barre de liste sans démo');
  ok(
    (await p.locator('#onb-toggle').getAttribute('aria-expanded')) === 'false' &&
      (await p.locator('#onb-panel, .onb-card').count()) === 0,
    'ONB-01 : prise en main hors du flux (bouton du PageHeader, panneau fermé) au-dessus de l’état vide',
  );
  ok(
    (await empty.getByRole('heading', { level: 2 }).textContent()) === 'Créez votre première démo',
    'titre «\u202fCréez votre première démo\u202f»',
  );
  ok((await empty.locator('.demos-start__tile, .demos-start').count()) === 0, 'B1 : pas de tuiles de départ');
  ok(
    (await p.getByRole('button', { name: 'Nouvelle démo' }).count()) === 1 &&
      (await empty.getByRole('button', { name: 'Nouvelle démo' }).count()) === 1,
    'B2 : une seule action principale, au centre (pas dans l’en-tête)',
  );
  const example = empty.getByRole('link', { name: 'Voir un exemple' });
  ok(
    (await example.getAttribute('aria-disabled')) === 'true' &&
      (await empty.locator('.demos-example .soon-text').textContent()) === 'Bientôt',
    'B3 : «\u202fVoir un exemple\u202f» en lien désactivé, «\u202fBientôt\u202f» en texte',
  );
  await empty.getByRole('button', { name: 'Nouvelle démo' }).click();
  await p.locator('dialog[open]').first().waitFor();
  ok(true, '«\u202fNouvelle démo\u202f» ouvre la création');
  await p.keyboard.press('Escape');
  const axe = await new AxeBuilder({ page: p }).analyze();
  const bad = axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  ok(bad.length === 0, `axe : Démos vide (${bad.map((v) => v.id).join(', ')})`);
  await p.context().close();

  // ===== Recherche sans résultat avec 2 filtres =====
  const q = await open(seedMaquette());
  await q.locator('.demo-card').first().waitFor();
  await q.getByRole('button', { name: /^Publiées/ }).click();
  await q.getByRole('button', { name: /^Créé par\s*: Tous/ }).click();
  await q.getByRole('menuitemradio', { name: /^Moi/ }).click();
  await q.getByRole('searchbox', { name: 'Rechercher une démo' }).fill('zzz');
  const nm = q.locator('.fd-empty--search');
  await nm.waitFor();
  ok(
    (await nm.getAttribute('role')) === 'status' &&
      (await nm.getByRole('heading').textContent()) === 'Aucune démo ne correspond à «\u202fzzz\u202f»' &&
      /2 filtres actifs/.test(await nm.innerText()),
    'recherche : variante search annoncée, saisie et 2 filtres actifs',
  );
  await nm.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await q.waitForTimeout(300);
  ok(
    (await q.locator('.demo-card').count()) > 0 &&
      (await q.getByRole('searchbox', { name: 'Rechercher une démo' }).inputValue()) === '',
    '«\u202fRéinitialiser les filtres\u202f» remet tout',
  );

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
