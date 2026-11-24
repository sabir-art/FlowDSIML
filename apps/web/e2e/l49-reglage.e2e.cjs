/**
 * Recette L49 P1 (docs/ux/specs/l49-securite-html.md §2, §6, §7). Données fictives (example).
 *  - Paramètres › Sécurité › Captures HTML : 3 radios, domaines (invalide refusé, joker, retrait), mention,
 *    «\u202fEnregistrer\u202f» désactivé tant que rien n'a changé, RPC et journal ;
 *  - lecture seule pour un éditeur («\u202fModifiable par un admin\u202f») ;
 *  - désactivées : Démo HTML et Sandbox visibles, désactivés, avec la raison, dans «\u202fNouvelle démo\u202f» ;
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
    // Une fenêtre qui s'ouvre en fondu fausse la mesure des contrastes : on attend la fin des animations
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    // En cas d'échec : l'élément et la mesure, pour corriger sans relancer
    const detail = bad
      .map(
        (v) => `${v.id} → ${v.nodes.map((n) => `${n.target.join(' ')} (${n.failureSummary})`).join(' ; ')}`,
      )
      .join(' | ');
    ok(bad.length === 0, `axe ${label} : ${detail || '0 violation grave'}`);
  };

  // ===== Propriétaire : réglage =====
  const s = seed();
  const ws = s.tables.workspaces[0];
  const p = await open(s, '/settings/security');
  const card = p.locator('.hc-card');
  await card.waitFor();
  ok((await card.locator('h2').innerText()) === 'Captures HTML', 'section «\u202fCaptures HTML\u202f»');
  ok(
    (await p.locator('.st-wrap section').first().getAttribute('class')).includes('hc-card'),
    'première section de Sécurité',
  );
  const radio = (name) => card.getByRole('radio', { name: new RegExp(`^${name}`) });
  // Le réglage arrive après la carte : on attend l'état réel avant de le lire (aucun délai fixe)
  const settled = (loc) => loc.waitFor().catch(() => {});
  const until = async (fn) => {
    for (const end = Date.now() + 15000; Date.now() < end;) {
      if (fn()) return;
      await new Promise((r) => setImmediate(r));
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    }
  };
  await settled(card.getByRole('radio', { name: /^Autorisées/, checked: true }));
  await settled(p.locator('.fd-page-header').getByRole('button', { name: 'Enregistrer', disabled: true }));
  ok(await radio('Autorisées').isChecked(), 'par défaut : Autorisées');
  ok(
    await p.locator('.fd-page-header').getByRole('button', { name: 'Enregistrer' }).isDisabled(),
    '«\u202fEnregistrer\u202f» désactivé sans changement',
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
    'pied «\u202fAppliqué par…\u202f»',
  );

  await radio('Seulement sur ces domaines').check();
  const input = card.getByLabel('Ajouter un domaine');
  await input.fill('https://crm.partenaire.example/chemin');
  await card.getByRole('button', { name: 'Ajouter le domaine' }).click();
  ok(
    (await card.getByRole('alert').innerText()).includes('sans «\u202fhttps://\u202f» ni chemin'),
    'domaine invalide refusé avec un message',
  );
  await input.fill('  App.Example.com ');
  await input.press('Enter');
  await input.fill('*.outils.example');
  await input.press('Enter');
  await input.fill('vieux.example.org');
  await input.press('Enter');
  await settled(card.locator('.hc-chip').nth(2));
  ok(
    JSON.stringify(await card.locator('.hc-chip .hc-chip__name').allInnerTexts()) ===
      JSON.stringify(['app.example.com', '*.outils.example', 'vieux.example.org']),
    'pastilles : minuscules, joker',
  );
  await card.getByRole('button', { name: 'Retirer vieux.example.org' }).click();
  await card
    .locator('.hc-chip')
    .nth(2)
    .waitFor({ state: 'detached' })
    .catch(() => {});
  ok((await card.locator('.hc-chip').count()) === 2, '«\u202fRetirer vieux.example.org\u202f»');
  await p.locator('.fd-page-header').getByRole('button', { name: 'Enregistrer' }).click();
  await p.waitForFunction(
    () => document.querySelector('.fd-page-header .fd-btn--primary')?.disabled === true,
  );
  // L'enregistrement est lu côté serveur (faux Supabase) : on attend qu'il y soit
  await until(() => ws.settings?.htmlCapture?.mode === 'domains');
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
  await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
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
  await p.locator('.fd-page-header').getByRole('button', { name: 'Enregistrer' }).click();
  await p.waitForFunction(
    () => document.querySelector('.fd-page-header .fd-btn--primary')?.disabled === true,
  );
  await until(() => ws.settings?.htmlCapture?.mode === 'disabled');
  ok(ws.settings.htmlCapture.mode === 'disabled', 'désactivées : enregistré');
  await p.goto(`${APP}/#/`);
  await p.getByRole('button', { name: 'Nouvelle démo' }).first().click();
  await nd.waitFor();
  // Les types HTML se désactivent une fois le réglage de l'espace chargé
  await settled(nd.locator('.nd-type.is-off').nth(1));
  await settled(nd.getByRole('radio', { name: /captures/, checked: true }));
  for (const name of ['Démo HTML', 'Sandbox']) {
    const r = nd.getByRole('radio', { name: new RegExp(name) });
    ok(
      (await r.isVisible()) &&
        (await r.isDisabled()) &&
        (await nd.locator('.nd-type.is-off', { hasText: name }).innerText()).includes(
          'Désactivé par un admin (Sécurité > Captures HTML)',
        ),
      `désactivées : «\u202f${name}\u202f» visible, désactivé, avec la raison`,
    );
  }
  ok(
    await nd.getByRole('radio', { name: /captures/ }).isChecked(),
    'désactivées : «\u202fDémo par captures\u202f» choisie',
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
    'éditeur : «\u202fModifiable par un admin\u202f»',
  );
  // Le réglage arrive après la carte : on attend le choix enregistré avant de lire les autres
  await c2
    .getByRole('radio', { name: /^Seulement sur ces domaines/, checked: true })
    .waitFor()
    .catch(() => {});
  ok(
    (await c2.getByRole('radio', { name: /^Seulement sur ces domaines/ }).isChecked()) &&
      (await c2.getByRole('radio', { name: /^Désactivées/ }).getAttribute('aria-disabled')) === 'true',
    'éditeur : mêmes valeurs, radios en lecture seule',
  );
  ok(
    (await c2.getByRole('button', { name: 'Enregistrer' }).count()) === 0 &&
      (await c2.getByRole('button', { name: /^Retirer/ }).count()) === 0 &&
      (await c2.locator('.hc-chip').innerText()).includes('app.example.com'),
    'éditeur : ni «\u202fEnregistrer\u202f» ni «\u202fRetirer\u202f», domaines affichés',
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
  await m
    .locator('.hc-card')
    .getByRole('radio', { checked: true })
    .first()
    .waitFor()
    .catch(() => {});
  const sw = await m.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(sw <= 1, `390 px : pas de défilement horizontal (${sw})`);
  await m.context().close();

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`);
  await b.close();
})();
