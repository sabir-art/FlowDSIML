/**
 * L26-01 : « Prise en main de votre espace » (7 étapes, prochaine étape, réduire, masquer et reprendre,
 * rôles, « Votre espace est prêt ») et « Apprendre TutoClick » dans l'aide (progression, visite terminée).
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/prise-en-main.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const sp = (s) => (s || '').replace(/[  ]/g, ' ');

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
  state.onboarding = {
    brand: true,
    extension: true,
    capture: true,
    pii: false,
    publish: false,
    invite: false,
    distribute: false,
  };
  state.tables.learn_progress.push({
    user_id: 'u-alice',
    module: 'modifier',
    done_at: '2026-11-18T10:00:00Z',
  });
  await install(page, state);

  // ===== L26-01 : carte =====
  await page.goto(`${BASE}/#/`);
  const card = page.getByRole('region', { name: 'Prise en main de votre espace' });
  await card.waitFor();
  ok(/3 étapes sur 7\. Elles se cochent seules/.test(sp(await card.innerText())), '« 3 étapes sur 7 »');
  const bar = card.getByRole('progressbar');
  ok(sp(await bar.getAttribute('aria-valuetext')) === '3 étapes sur 7', 'progression : aria-valuetext');
  ok((await card.locator('li.done').count()) === 3, '3 étapes cochées (barrées)');
  ok(
    (await card.locator('li.done .sr-only', { hasText: 'Fait' }).count()) === 3,
    '« Fait » pour les lecteurs d’écran',
  );
  const next = card.locator('li.next');
  ok(/Flouter les données sensibles/.test(await next.innerText()), 'prochaine étape : flouter');
  ok(
    !/automatique/.test(await card.innerText()),
    'L48-G écart 7 : aucune mention « automatique » dans la prise en main',
  );
  ok((await next.locator('.fd-btn--primary', { hasText: 'Voir comment' }).count()) === 1, 'bouton principal');
  ok((await card.locator('li:not(.next) .fd-btn--primary').count()) === 0, 'autres boutons discrets');
  ok((await page.locator('.gs-banner').count()) === 0, 'remplace « Premiers pas »');
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${SHOTS}/l26-01-prise-en-main${sfx}.png` });
  }
  // Réduire
  const collapse = card.getByRole('button', { name: 'Réduire la prise en main' });
  await collapse.click();
  ok(
    (await card.getByRole('button', { name: 'Afficher la prise en main' }).getAttribute('aria-expanded')) ===
      'false',
    'réduire : aria-expanded',
  );
  ok((await card.locator('li').count()) === 0, 'réduite : liste masquée');
  await card.getByRole('button', { name: 'Afficher la prise en main' }).click();
  // Lecteur simulé : reçoit le manifeste puis signale la dernière étape vue
  await page.route('https://demos.tutoclick.example/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<script>addEventListener('message', (e) => { if (e.data && e.data.type === 'fd:preview')
        parent.postMessage({ type: 'flowdsiml:event', event: 'demo_complete' }, '*'); });
        parent.postMessage({ type: 'fd:preview-ready' }, '*');</script>`,
    }),
  );
  // « Voir comment » : visite guidée du floutage
  await next.getByRole('button', { name: 'Voir comment' }).click();
  const how = page.getByRole('dialog', { name: 'Flouter les données' });
  await how.waitFor();
  ok(true, '« Voir comment » : visite guidée du floutage');
  await page.keyboard.press('Escape');
  await how.waitFor({ state: 'detached' }).catch(() => undefined);

  // ===== « Apprendre TutoClick » (modules disponibles seulement) =====
  await page.getByRole('button', { name: 'Aide', exact: true }).first().click();
  const drawer = page.getByRole('complementary', { name: 'Aide' });
  const ac = drawer.getByRole('region', { name: 'Apprendre TutoClick' });
  await ac.waitFor();
  await ac.locator('li.done').first().waitFor();
  ok(
    sp(await ac.getByRole('progressbar').getAttribute('aria-valuetext')) === '1 module sur 5',
    'parcours : 1 sur 5 (modules disponibles)',
  );
  ok(
    (await ac.locator('li').nth(0).locator('.fd-status', { hasText: 'Bientôt' }).count()) === 1,
    'sans démo : badge « Bientôt »',
  );
  ok(/Revoir/.test(await ac.locator('li').nth(1).innerText()), 'module fait : « Revoir »');
  ok(/Commencer/.test(await ac.locator('li').nth(2).innerText()), 'prochain : « Commencer »');
  ok(/\d+ étapes/.test(await ac.locator('li').nth(3).innerText()), 'les autres : « n étapes »');
  ok(!/min/.test(await ac.innerText()), 'pas de durée affichée');
  if (SHOTS) {
    await drawer.getByRole('searchbox').focus();
    await page.screenshot({ path: `${SHOTS}/l26-02-aide-parcours${sfx}.png` });
  }
  // Visite terminée (dernière étape vue, relayée par le lecteur)
  await ac.getByRole('button', { name: /Commencer : Flouter les données/ }).click();
  const tour = page.getByRole('dialog', { name: 'Flouter les données' });
  await tour.waitFor();
  await ac.locator('li.done').nth(1).waitFor({ timeout: 5000 });
  ok(
    state.tables.learn_progress.some((r) => r.module === 'flouter'),
    'dernière étape vue : module terminé et enregistré',
  );
  await page.keyboard.press('Escape');
  await tour.waitFor({ state: 'detached' }).catch(() => undefined);
  ok(
    sp(await ac.getByRole('progressbar').getAttribute('aria-valuetext')) === '2 modules sur 5',
    'parcours : 2 sur 5',
  );
  await page.keyboard.press('Escape');

  // ===== Masquer, puis reprendre depuis l'aide =====
  await card.getByRole('button', { name: 'Masquer la prise en main' }).click();
  await card.waitFor({ state: 'detached' });
  ok(
    state.tables.onboarding_prefs.some((p) => p.hidden_at),
    'masquée pour la personne',
  );
  await page.getByRole('button', { name: 'Aide', exact: true }).first().click();
  await drawer.getByRole('button', { name: /Reprendre la prise en main/ }).click();
  await card.waitFor();
  ok(true, 'aide : « Reprendre la prise en main »');

  // ===== Rôles =====
  state.tables.members[0].role = 'editor';
  await page.reload();
  await card.waitFor();
  ok((await card.locator('li').count()) === 3, 'éditeur : étapes 3 à 5');
  ok(/1 étape sur 3/.test(sp(await card.innerText())), 'éditeur : progression sur 3');
  state.tables.members[0].role = 'viewer';
  await page.reload();
  await page.getByRole('heading', { name: 'Démos', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  ok((await card.count()) === 0, 'lecteur : rien');

  // ===== 7 sur 7 =====
  state.tables.members[0].role = 'owner';
  state.onboarding = Object.fromEntries(Object.keys(state.onboarding).map((k) => [k, true]));
  state.onboardingDoneAt = new Date(Date.now() - 2 * 864e5).toISOString();
  await page.reload();
  const ready = page.getByRole('region', { name: 'Votre espace est prêt' });
  await ready.waitFor();
  ok(true, '7 sur 7 : « Votre espace est prêt »');
  state.onboardingDoneAt = new Date(Date.now() - 8 * 864e5).toISOString();
  await page.reload();
  await page.getByRole('heading', { name: 'Démos', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  ok((await ready.count()) === 0, 'après 7 jours : la carte disparaît');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
