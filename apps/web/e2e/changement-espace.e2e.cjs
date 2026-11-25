/**
 * Correctif client : changer d'espace dans le sélecteur ramène toujours sur Démos (#/) du nouvel espace,
 * avec un toast discret ; la page de l'ancien espace est abandonnée (données et requêtes). Données fictives.
 * Usage : node e2e/changement-espace.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const state = seed();
  const ws1 = state.tables.workspaces[0];
  state.tables.workspaces.push({ ...ws1, id: 'ws-2', name: 'Antenne Sud', slug: 'antenne-sud' });
  state.tables.members.push({ ...state.tables.members[0], workspace_id: 'ws-2', role: 'owner' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await install(p, state);

  // Les vues d'une démo n'ont plus la barre latérale (§9, §1) : le changement d'espace se fait depuis
  // une page de l'application
  for (const route of ['/#/media', '/#/settings/brand', '/#/learners', '/#/']) {
    await p.goto(`${APP}${route}`);
    await p.waitForTimeout(1200);
    const from = (await p.locator('.ws-switch b').textContent()).trim();
    const to = from === 'Antenne Sud' ? ws1.name : 'Antenne Sud';
    await p.locator('.ws-switch').click();
    await p.getByRole('menuitem', { name: to }).click();
    await p.waitForTimeout(600);
    ok(/#\/$/.test(p.url()), `${route} → Démos du nouvel espace (${p.url().split('#')[1]})`);
    ok((await p.locator('.ws-switch b').textContent()).trim() === to, `espace actif : ${to}`);
    ok(
      (await p.locator('.toasts .toast-text').allTextContents()).some((x) =>
        x.includes(`Vous êtes maintenant dans l’espace ${to}`),
      ),
      'toast « Vous êtes maintenant dans l’espace … »',
    );
    ok(
      await p.evaluate(
        () =>
          !!document.activeElement?.closest('.ws-wrap, #main') || document.activeElement === document.body,
      ),
      'focus sur le sélecteur ou la page, jamais perdu dans un menu fermé',
    );
  }
  // Choisir l'espace déjà actif : rien ne change
  await p.goto(`${APP}/#/settings/brand`);
  await p.waitForTimeout(1000);
  const cur = (await p.locator('.ws-switch b').textContent()).trim();
  await p.locator('.ws-switch').click();
  await p.getByRole('menuitem', { name: cur }).click();
  await p.waitForTimeout(300);
  ok(/settings\/brand/.test(p.url()), 'même espace : on reste sur la page');
  ok(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
