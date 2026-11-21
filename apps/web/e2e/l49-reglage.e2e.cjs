/**
 * Recette L49 P1 (docs/ux/specs/l49-securite-html.md §2, §6, §7). Données fictives (example).
 *  - Paramètres › Sécurité › Captures HTML : 3 radios, domaines (invalide refusé, joker, retrait), mention,
 *    « Enregistrer » désactivé tant que rien n'a changé, RPC et journal ;
 *  - lecture seule pour un éditeur (« Modifiable par un admin ») ;
 *  - désactivées : Démo HTML et Sandbox visibles, désactivés, avec la raison, dans « Nouvelle démo » ;
 *  - autorisées : mention d'autorisation à l'étape 2 des types HTML ; axe ; 390 px sans défilement.
 * Usage : node e2e/l49-reglage.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const NOTICE = 'Capturez uniquement des logiciels que vous êtes autorisé à reproduire.';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const open = async (data, path, width = 1440) => {
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

  // ===== Propriétaire : réglage =====
  const s = seed();
  const ws = s.tables.workspaces[0];
  const p = await open(s, '/settings/security');
  const card = p.locator('.hc-card');
  await card.waitFor();
  ok((await card.locator('h3').innerText()) === 'Captures HTML', 'section « Captures HTML »');
  ok(
    (await p.locator('.st-body section.card').first().getAttribute('class')).includes('hc-card'),
    'première section de Sécurité',
  );
  const radio = (name) => card.getByRole('radio', { name: new RegExp(`^${name}`) });
  ok(await radio('Autorisées').isChecked(), 'par défaut : Autorisées');
  ok(
    await card.getByRole('button', { name: 'Enregistrer' }).isDisabled(),
    '« Enregistrer » désactivé sans changement',
  );
  ok((await card.locator('.hc-notice').innerText()).includes(NOTICE), 'mention d’autorisation, sans encadré');
  ok(
    (await card
      .locator('.hc-notice')
      .evaluate((el) => getComputedStyle(el).borderTopStyle + getComputedStyle(el).backgroundColor)) ===
      'nonergba(0, 0, 0, 0)',
    'mention : ni bordure ni fond',
  );
  ok(
    (await card.innerText()).includes('Appliqué par l’app, l’extension et le serveur.'),
    'pied « Appliqué par… »',
  );

  await radio('Seulement sur ces domaines').check();
  const input = card.getByLabel('Ajouter un domaine');
  await input.fill('https://crm.partenaire.example/chemin');
  await card.getByRole('button', { name: 'Ajouter', exact: true }).click();
  ok(
    (await card.getByRole('alert').innerText()).includes('sans « https:// » ni chemin'),
    'domaine invalide refusé avec un message',
  );
  await input.fill('  App.Example.com ');
  await input.press('Enter');
  await input.fill('*.outils.example');
  await input.press('Enter');
  await input.fill('vieux.example.org');
  await input.press('Enter');
  ok(
    JSON.stringify(await card.locator('.hc-chip .t-mono').allInnerTexts()) ===
      JSON.stringify(['app.example.com', '*.outils.example', 'vieux.example.org']),
    'pastilles : minuscules, joker',
  );
  await card.getByRole('button', { name: 'Retirer vieux.example.org' }).click();
  ok((await card.locator('.hc-chip').count()) === 2, '« Retirer vieux.example.org »');
  await card.getByRole('button', { name: 'Enregistrer' }).click();
  await p.waitForFunction(() => document.querySelector('.hc-card .fd-btn--primary')?.disabled === true);
  ok(
    JSON.stringify(ws.settings.htmlCapture) ===
      JSON.stringify({ mode: 'domains', domains: ['app.example.com', '*.outils.example'] }),
    'enregistré par set_html_capture',
  );
  ok(
    (s.tables.audit_log || []).some(
      (l) => l.action === 'settings.html_capture' && l.meta.old.mode === 'allowed',
    ),
    'journal : ancienne et nouvelle valeur',
  );
  await axe(p, 'Sécurité › Captures HTML');

  // Autorisées sur des domaines : la mention à l'étape 2 des types HTML (L49 §6)
  await p.goto(`${APP}/#/`);
  await p.locator('.page-head__actions').getByRole('button', { name: 'Nouvelle démo' }).click();
  const nd = p.locator('dialog.new-demo-dialog[open]');
  await nd.waitFor();
  await nd.getByRole('radio', { name: /Démo HTML/ }).check();
  await nd.getByRole('button', { name: 'Continuer', exact: true }).click();
  ok(
    (await nd.locator('.hc-notice').innerText()).includes(NOTICE),
    'Nouvelle démo HTML : mention sous les sources',
  );
  await p.keyboard.press('Escape');

  // ===== Désactivées : types HTML visibles et désactivés, avec la raison =====
  await p.goto(`${APP}/#/settings/security`);
  await card.waitFor();
  await radio('Désactivées').check();
  await card.getByRole('button', { name: 'Enregistrer' }).click();
  await p.waitForFunction(() => document.querySelector('.hc-card .fd-btn--primary')?.disabled === true);
  ok(ws.settings.htmlCapture.mode === 'disabled', 'désactivées : enregistré');
  await p.goto(`${APP}/#/`);
  await p.locator('.page-head__actions').getByRole('button', { name: 'Nouvelle démo' }).click();
  await nd.waitFor();
  for (const name of ['Démo HTML', 'Sandbox']) {
    const r = nd.getByRole('radio', { name: new RegExp(name) });
    ok(
      (await r.isVisible()) &&
        (await r.isDisabled()) &&
        (await nd.locator('.nd-type.is-off', { hasText: name }).innerText()).includes(
          'Désactivé par un admin (Sécurité > Captures HTML)',
        ),
      `désactivées : « ${name} » visible, désactivé, avec la raison`,
    );
  }
  ok(
    await nd.getByRole('radio', { name: /captures/ }).isChecked(),
    'désactivées : « Démo par captures » choisie',
  );
  await axe(p, 'Nouvelle démo (types HTML désactivés)');
  await p.context().close();

  // ===== Éditeur : lecture seule =====
  const e = seed();
  e.tables.members = e.tables.members.map((m) => ({ ...m, role: 'editor' }));
  e.tables.workspaces[0].settings = {
    ...(e.tables.workspaces[0].settings ?? {}),
    htmlCapture: { mode: 'domains', domains: ['app.example.com'] },
  };
  const q = await open(e, '/settings/security');
  const c2 = q.locator('.hc-card');
  await c2.waitFor();
  ok(
    (await c2.locator('.hc-ro').innerText()) === 'Modifiable par un admin',
    'éditeur : « Modifiable par un admin »',
  );
  ok(
    (await c2.getByRole('radio', { name: /^Seulement sur ces domaines/ }).isChecked()) &&
      (await c2.getByRole('radio', { name: /^Désactivées/ }).getAttribute('aria-disabled')) === 'true',
    'éditeur : mêmes valeurs, radios en lecture seule',
  );
  ok(
    (await c2.getByRole('button', { name: 'Enregistrer' }).count()) === 0 &&
      (await c2.getByRole('button', { name: /^Retirer/ }).count()) === 0 &&
      (await c2.locator('.hc-chip').innerText()).includes('app.example.com'),
    'éditeur : ni « Enregistrer » ni « Retirer », domaines affichés',
  );
  await c2.getByRole('radio', { name: /^Désactivées/ }).click({ force: true });
  ok(
    await c2.getByRole('radio', { name: /^Seulement sur ces domaines/ }).isChecked(),
    'éditeur : un clic ne change rien',
  );
  await q.context().close();

  // ===== 390 px =====
  const m = await open(seed(), '/settings/security', 390);
  await m.locator('.hc-card').waitFor();
  const sw = await m.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(sw <= 1, `390 px : pas de défilement horizontal (${sw})`);
  await m.context().close();

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})();
