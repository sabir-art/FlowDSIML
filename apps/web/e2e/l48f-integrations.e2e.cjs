/**
 * Recette L48-F (spec docs/ux/specs/l48f-integrations.md §5). Données fictives (acme.example).
 *  - « Toutes » : 4 groupes, Webhooks seule disponible, les autres « Bientôt » sans focus ni clic ;
 *  - « Connectées » vide puis avec 2 webhooks actifs ; « Connecter » ouvre « Ajouter un webhook » ;
 *  - demande à la DSI (mailto avec sujet) ou « Renseigner le lien du support » ; page Webhooks et détail ;
 *  - 390 px : select « Catégorie », pas de défilement horizontal ; segmenté aux flèches ; axe.
 * Usage : node e2e/l48f-integrations.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';

const hook = (id, state, ws) => ({
  id,
  workspace_id: ws,
  url: `https://hooks.acme.example/${id}`,
  name: null,
  events: ['demo.completed'],
  state,
  failures: state === 'paused_auto' ? 6 : 0,
  secret_hint: 'b58b',
  created_by: null,
  created_at: new Date(Date.now() - 86400_000).toISOString(),
  updated_at: new Date(Date.now() - 86400_000).toISOString(),
});

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (data, path = '/settings/integrations', width = 1440) => {
    const page = await (await b.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR' })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await install(page, data);
    await page.goto(`${APP}/#${path}`);
    return page;
  };
  const axe = async (page, label) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${label} : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
  };

  // ===== Sans webhook, lien du support en mailto =====
  const s = seed();
  s.tables.webhooks = [];
  s.tables.workspaces[0].settings = {
    ...(s.tables.workspaces[0].settings ?? {}),
    helpContact: 'dsi@acme.example',
  };
  const p = await open(s);
  await p.locator('.int-list').first().waitFor();
  ok(
    JSON.stringify(await p.locator('.int-group__t').allTextContents()) ===
      JSON.stringify(['Automatisation', 'Communication', 'Mesure d’audience', 'Relation usagers']) ||
      (await p.locator('.int-group__t').count()) === 4,
    '« Toutes » : 4 groupes',
  );
  const rows = p.locator('.int-list > li');
  const soon = p.locator('.int-list > li .int-soon');
  ok(
    (await rows.count()) === 11 && (await soon.count()) === 10,
    `11 lignes dont 10 « Bientôt » (${await rows.count()})`,
  );
  ok(
    (await p.locator('.int-list > li[aria-disabled="true"]').count()) === 9,
    'lignes « Bientôt » aria-disabled (hors e-mailing)',
  );
  ok(
    (await p
      .locator('.int-list > li[aria-disabled="true"] a, .int-list > li[aria-disabled="true"] button')
      .count()) === 0,
    'lignes « Bientôt » : rien de focalisable',
  );
  ok((await p.locator('.int-list .badge').count()) === 0, 'aucun badge');
  const wh = rows.first();
  ok((await wh.innerText()).startsWith('Webhooks'), 'Webhooks en tête d’Automatisation');
  // Connecter : la boîte « Ajouter un webhook »
  await wh.getByRole('button', { name: 'Connecter' }).click();
  await p.getByRole('dialog', { name: 'Ajouter un webhook' }).waitFor();
  ok(true, '« Connecter » ouvre « Ajouter un webhook »');
  await p.keyboard.press('Escape');
  // Demande à la DSI
  const href = await p.getByRole('link', { name: 'Faire une demande à la DSI' }).getAttribute('href');
  ok(href === 'mailto:dsi@acme.example?subject=Demande%20de%20connexion', `demande à la DSI : ${href}`);
  // Connectées, vide
  await p.getByRole('radio', { name: 'Connectées' }).click();
  await p.waitForURL(/categorie=connectees/);
  await p.getByText('Aucune connexion active').waitFor();
  ok(true, '« Connectées » : état vide');
  ok(
    (await p.getByRole('button', { name: 'Ajouter un webhook' }).count()) === 1,
    '« Connectées » : « Ajouter un webhook »',
  );
  // Clavier : flèches dans le segmenté
  await p.getByRole('radio', { name: 'Connectées' }).focus();
  await p.keyboard.press('ArrowRight');
  await p.waitForURL(/categorie=communication/);
  await p.locator('.int-list > li', { hasText: 'Slack' }).waitFor();
  ok(
    (await p.getByRole('radio', { name: 'Communication' }).evaluate((el) => el === document.activeElement)) &&
      (await p.locator('.int-group__t').count()) === 0,
    'flèche droite : Communication, sans titre de groupe',
  );
  await axe(p, 'Intégrations (aucune connexion)');
  await p.context().close();

  // ===== Avec webhooks, sans lien du support =====
  const s2 = seed();
  const ws = s2.tables.workspaces[0].id;
  s2.tables.webhooks = [
    hook('wh-1', 'active', ws),
    hook('wh-2', 'active', ws),
    hook('wh-3', 'paused_auto', ws),
  ];
  s2.tables.workspaces[0].settings = { ...(s2.tables.workspaces[0].settings ?? {}), helpContact: null };
  const q = await open(s2, '/settings/integrations?categorie=connectees');
  await q.locator('.int-list').waitFor();
  const line = q.locator('.int-list > li');
  ok(
    (await line.count()) === 1 && /2 actifs/.test(await line.innerText()),
    '« Connectées » : Webhooks · 2 actifs',
  );
  ok(/1 en pause après des échecs/.test(await line.innerText()), '1 en pause après des échecs');
  await q.getByRole('link', { name: 'Renseigner le lien du support' }).click();
  await q.waitForURL(/settings\/workspace/);
  await q.waitForTimeout(300);
  ok(
    await q.evaluate(() => document.activeElement?.id === 'ws-help'),
    '« Renseigner le lien du support » : focus sur le champ',
  );
  await q.goto(`${APP}/#/settings/integrations`);
  await q.locator('.int-row--link').click();
  await q.waitForURL(/settings\/integrations\/webhooks$/);
  await q.locator('.l23 tbody tr').first().waitFor();
  ok((await q.locator('.l23 tbody tr').count()) === 3, 'page Webhooks : la liste');
  ok(
    (await q.locator('.st-crumb').innerText()).includes('Intégrations') &&
      (await q.getByRole('heading', { level: 1 }).innerText()) === 'Webhooks',
    'page Webhooks : fil « … › Intégrations », titre « Webhooks »',
  );
  ok(
    (await q.locator('.l23 tbody .badge-success, .l23 tbody .badge-warning').count()) === 0,
    'état en texte avec un point (T4)',
  );
  await axe(q, 'page Webhooks');
  await q.goto(`${APP}/#/settings/integrations/wh-1`);
  await q.locator('.st-crumb').getByRole('link', { name: 'Webhooks' }).waitFor();
  ok(true, 'détail : fil « … › Intégrations › Webhooks »');
  await q.goto(`${APP}/#/settings/integrations#webhooks`);
  await q.waitForURL(/settings\/integrations\/webhooks$/);
  ok(true, 'ancien lien #webhooks : page Webhooks');
  await q.context().close();

  // ===== 390 px =====
  const m = await open(seed(), '/settings/integrations', 390);
  await m.locator('.int-list').first().waitFor();
  ok(await m.getByRole('combobox', { name: 'Catégorie' }).isVisible(), '390 px : select « Catégorie »');
  ok(
    await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    '390 px : pas de défilement horizontal',
  );
  await m.getByRole('combobox', { name: 'Catégorie' }).selectOption('audience');
  await m.waitForURL(/categorie=mesure/);
  await m.locator('.int-list > li', { hasText: 'Matomo' }).waitFor();
  ok((await m.locator('.int-list > li').count()) === 2, '390 px : Mesure d’audience, 2 lignes');
  await axe(m, '390 px');
  await m.context().close();

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})();
