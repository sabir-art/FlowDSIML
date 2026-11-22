/** L23-01 à 07 : Paramètres > Intégrations (webhooks). Données fictives (acme.example, tcsec_EXEMPLE…). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const delivery = (hook, type, status, code, min, extra = {}) => ({
  id: `d-${type}-${min}-${hook.slice(0, 4)}`,
  workspace_id: 'ws-1',
  webhook_id: hook,
  event_id: `e-${min}`,
  event_type: type,
  payload: { id: `e-${min}`, type, created_at: ago(min), data: { demo_id: 'demo-exemple' } },
  status,
  attempt: 1,
  next_attempt_at: ago(-4),
  response_status: code,
  response_body: code && code >= 400 ? 'Service Unavailable' : 'ok',
  duration_ms: 180,
  error: code && code >= 400 ? `HTTP ${code}` : null,
  replay_of: null,
  created_at: ago(min),
  finished_at: ago(min),
  ...extra,
});

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  /** Capture après la fin des animations (modales, toasts). */
  const shot = async (name) => {
    if (!SHOTS) return;
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await page.screenshot({ path: `${SHOTS}/l23-${name}${sfx}.png` });
  };
  const closeToasts = async () => {
    for (const b of await page.locator('.toast button').all()) await b.click().catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.toast'));
  };
  const state = seed();
  state.tables.webhooks = [];
  state.tables.webhook_deliveries = [];
  await install(page, state);
  const t = state.tables;

  // L23-02 : vide, onglet « Intégrations » pour un propriétaire
  // L48-F §2 : la liste des webhooks a sa page
  await page.goto(`${BASE}/#/settings/integrations/webhooks`);
  await page.waitForSelector('.l23 .fd-empty');
  ok(
    (await page.locator('.st-nav').getByRole('link', { name: 'Intégrations' }).count()) === 1,
    'L23 : onglet Intégrations (propriétaire)',
  );
  ok(/Aucun webhook/.test(await page.textContent('.l23 .fd-empty')), 'L23-02 : état vide');
  await shot('02-vide');

  // L23-03 : créer (erreur d'adresse, événements, rappel RGPD)
  await page.locator('.l23 .fd-empty').getByRole('button', { name: 'Ajouter un webhook' }).click();
  const dlg = page.getByRole('dialog', { name: 'Ajouter un webhook' });
  await dlg.waitFor();
  const url = dlg.getByLabel('Adresse de réception');
  ok(await url.evaluate((el) => el === document.activeElement), 'L23-03 : focus sur l’adresse');
  await url.fill('http://hooks.acme.example/tutoclick');
  await dlg.getByLabel('Nom').focus();
  ok(
    (await url.getAttribute('aria-invalid')) === 'true',
    'L23-03 : http refusé (aria-invalid, message relié)',
  );
  ok(
    (await dlg.getByRole('button', { name: 'Créer le webhook' }).getAttribute('aria-disabled')) === 'true',
    'L23-03 : aucun événement : bouton aria-disabled',
  );
  await dlg.getByLabel('Nom').fill('CRM interne');
  await dlg.getByRole('checkbox', { name: /Nouveau lead/ }).check();
  await dlg.getByRole('checkbox', { name: /Démo terminée/ }).check();
  ok(
    /données personnelles à un tiers/.test(await dlg.textContent()),
    'L23-03 : rappel RGPD avec lead.created',
  );
  ok(
    !(await dlg.getByRole('checkbox', { name: /Alerte déclenchée/ }).isDisabled()),
    'L23-03 : alert.triggered actif (L19)',
  );
  await shot('03-creer');
  await url.fill('https://10.0.0.1/hook');
  await dlg.getByRole('button', { name: 'Créer le webhook' }).click();
  ok((await url.getAttribute('aria-invalid')) === 'true', 'L23-03 : IP privée refusée');
  await url.fill('https://hooks.acme.example/tutoclick');
  await dlg.getByRole('button', { name: 'Créer le webhook' }).click();

  // L23-04 : secret affiché une seule fois
  const sec = page.getByRole('alertdialog');
  await sec.waitFor();
  ok(/^tcsec_/.test(await sec.locator('code').textContent()), 'L23-04 : secret tcsec_ en clair une fois');
  ok(
    await sec.getByRole('button', { name: 'Copier' }).evaluate((el) => el === document.activeElement),
    'L23-04 : focus sur Copier',
  );
  ok(
    (await sec.getByRole('button', { name: 'Terminé' }).getAttribute('aria-disabled')) === 'true',
    'L23-04 : Terminé inactif avant la case',
  );
  await page.keyboard.press('Escape');
  ok((await sec.count()) === 1, 'L23-04 : Échap ne ferme pas');
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  ok(
    await page.evaluate(() => {
      const modal = document.querySelector('[role="alertdialog"]');
      const r = modal.getBoundingClientRect();
      // Points répartis sur la modale : l'élément au premier plan doit toujours lui appartenir.
      const pts = [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((x) =>
        [0.2, 0.5, 0.8].map((y) => [r.left + r.width * x, r.top + r.height * y]),
      );
      return pts.every(([x, y]) => modal.contains(document.elementFromPoint(x, y)));
    }),
    'L23-04 : la modale est au premier plan (aucune carte au-dessus)',
  );
  await shot('04-secret');
  await sec.getByRole('checkbox', { name: /J’ai copié le secret/ }).check();
  await sec.getByRole('button', { name: 'Terminé' }).click();
  await page.waitForSelector('.l23 table');
  const hook = t.webhooks[0];
  ok(
    hook.url === 'https://hooks.acme.example/tutoclick' &&
      hook.name === 'CRM interne' &&
      hook.events.length === 2,
    'L23-03 : webhook créé',
  );

  // Données de démonstration pour la liste, le journal et la pause
  t.webhooks.push(
    {
      ...hook,
      id: 'wh-pause',
      url: 'https://automate.acme.example/hook/42',
      name: 'Tableur des inscriptions',
      events: ['learner.module_validated'],
      state: 'paused_auto',
      failures: 6,
      created_at: ago(3000),
      updated_at: ago(600),
    },
    {
      ...hook,
      id: 'wh-off',
      url: 'https://test.acme.example/ping',
      name: 'Essais',
      events: ['demo.published'],
      state: 'paused',
      failures: 0,
      created_at: ago(4000),
    },
  );
  t.webhook_deliveries.push(
    delivery(hook.id, 'lead.created', 'success', 200, 300),
    delivery(hook.id, 'demo.completed', 'success', 200, 120),
    delivery(hook.id, 'learner.module_validated', 'pending', 500, 20, { attempt: 2 }),
    delivery(hook.id, 'lead.created', 'dead', 503, 12, { attempt: 6 }),
    delivery('wh-pause', 'learner.module_validated', 'dead', 503, 600, { attempt: 6 }),
  );
  await page.reload();
  await page.waitForSelector('.l23 table tbody tr:nth-child(3)');
  ok((await page.locator('.l23 tbody tr').count()) === 3, 'L23-01 : 3 webhooks');
  ok(
    /En pause/.test(await page.locator('.l23 tbody tr').nth(1).textContent()) &&
      /6 échecs/.test(await page.locator('.l23 tbody tr').nth(1).textContent()),
    'L23-01 : « En pause » et « 6 échecs »',
  );
  ok(
    (await page.getByRole('button', { name: 'Actions pour hooks.acme.example' }).count()) === 1,
    'L23-01 : menu nommé par l’hôte',
  );
  await shot('01-liste');

  // L23-05 : détail, journal, panneau, rejeu
  await page.getByRole('link', { name: 'https://hooks.acme.example/tutoclick' }).click();
  await page.waitForSelector('.wh-detail');
  ok(/tcsec_•+/.test(await page.textContent('.l23 .secret code')), 'L23-05 : secret masqué');
  ok((await page.getByRole('button', { name: /Afficher/ }).count()) === 0, 'L23-05 : pas de bouton Afficher');
  const rows = page.locator('.l23-log tbody tr');
  ok((await rows.count()) === 4, 'L23-05 : journal');
  const deadRow = rows.filter({ hasText: '503' });
  await deadRow.focus();
  await page.keyboard.press('Enter');
  ok(
    (await deadRow.getAttribute('aria-selected')) === 'true',
    'L23-05 : ligne sélectionnée au clavier (aria-selected)',
  );
  const panel = page.getByRole('complementary', { name: 'Envoi sélectionné' });
  ok(
    /essai 6 sur 6/.test(await panel.textContent()) && /HTTP 503/.test(await panel.textContent()),
    'L23-05 : panneau de l’envoi',
  );
  ok((await rows.filter({ hasText: 'essai dans' }).count()) === 1, 'L23-05 : « essai dans n min »');
  await shot('05-detail');
  // L23-06 : test en échec
  state.dispatchResult = { status: 404, duration_ms: 210, error: 'HTTP 404' };
  await page.getByRole('button', { name: 'Envoyer un test' }).click();
  const alert = page.locator('.l23 .alert-danger[role="alert"]');
  await alert.waitFor();
  ok(
    /Le test a échoué : HTTP 404 en 210 ms\. L’adresse ne répond pas/.test(
      (await alert.textContent()).replace(/ /g, ' '),
    ),
    'L23-06 : bandeau avec code et conseil',
  );
  ok(
    (await page.locator('.l23-log tbody tr').first().locator('.badge', { hasText: 'Test' }).count()) === 1,
    'L23-06 : ligne ping « Test » en tête',
  );
  ok(t.webhooks[0].failures === 0, 'L23-06 : le test ne compte pas dans les échecs');
  await shot('06-test');
  state.dispatchResult = null;

  // L23-05 (suite) : rejeu immédiat, après la capture du test
  await panel.getByRole('button', { name: 'Rejouer maintenant' }).click();
  await page.waitForSelector('.toast');
  ok(
    /Envoi rejoué · HTTP 200 en 180 ms/.test(await page.textContent('.toast')),
    'L23-05 : rejeu immédiat avec résultat',
  );
  ok(
    t.webhook_deliveries.some((d) => d.replay_of && d.status === 'success'),
    'L23-05 : rejeu enregistré (même event_id)',
  );

  await closeToasts();

  // Renouvellement : confirmation, nouveau secret une fois
  const hint = t.webhooks[0].secret_hint;
  await page.getByRole('button', { name: 'Renouveler' }).click();
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Renouveler le secret' })
    .getByRole('button', { name: 'Renouveler' })
    .click();
  await page.getByRole('alertdialog', { name: /Nouveau secret/ }).waitFor();
  ok(t.webhooks[0].secret_hint !== hint, 'Renouvellement : nouveau secret');
  await page.getByRole('checkbox', { name: /J’ai copié le secret/ }).check();
  await page.getByRole('button', { name: 'Terminé' }).click();

  // L23-07 : pause automatique
  await page.goto(`${BASE}/#/settings/integrations/wh-pause`);
  const pauseBanner = page.locator('.l23 .alert-warning[role="status"]');
  await pauseBanner.waitFor();
  ok(
    /après 6 échecs consécutifs/.test(await pauseBanner.textContent()),
    'L23-07 : bandeau de pause automatique',
  );
  ok(
    (await page.getByRole('button', { name: 'Envoyer un test' }).count()) === 0 &&
      (await page.getByRole('button', { name: 'Désactiver' }).count()) === 0,
    'L23-07 : test et désactiver masqués',
  );
  ok(
    !/échec/.test(await page.locator('.l23-head p.muted').textContent()),
    'L23-07 : en-tête sur une ligne (badge · créé le…), sans le nombre d’échecs',
  );
  await page.locator('.l23-log tbody tr').first().click();
  const attempt = page.locator('.l23 aside .l23-attempt');
  ok(
    /^essai 6 sur 6$/.test((await attempt.textContent()).trim()),
    'L23-07 : « Essai 6 sur 6 » sur sa ligne, sans « · »',
  );
  ok((await page.locator('.toast').count()) === 0, 'L23-07 : aucun toast');
  await shot('07-pause');
  await page.getByRole('button', { name: 'Réactiver' }).click();
  await page.waitForFunction(() => !document.querySelector('.l23 .alert-warning'));
  ok(t.webhooks.find((w) => w.id === 'wh-pause').state === 'active', 'L23-07 : Réactiver');

  // Accès : un éditeur ne voit ni l'onglet ni la page
  t.members[0].role = 'editor';
  await page.goto(`${BASE}/#/settings/workspace`);
  await page.reload();
  await page.waitForSelector('.st-nav');
  ok(
    (await page.getByRole('link', { name: 'Intégrations' }).count()) === 0,
    'Éditeur : pas d’onglet Intégrations',
  );
  await page.goto(`${BASE}/#/settings/integrations`);
  await page.waitForSelector('.stg-empty');
  ok(
    /Vous n’avez pas accès à cette page/.test(await page.textContent('.stg-empty')),
    'Éditeur : accès refusé, retour vers Général',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
