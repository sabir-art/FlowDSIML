/**
 * Test e2e L26-06 à L26-08 : visiteurs récurrents. Analytics (KPI, carte « Nouveaux et
 * récurrents », badges Sessions et Temps réel, critère de segment), modale « Mesure des visites »
 * (admin et lecteur), Paramètres › Confidentialité, lecteur (identifiant propre à l'espace, refus,
 * GPC, mesure désactivée). Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/visiteurs-recurrents.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000002';
const WS = 'ws-1';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
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
  // Sessions fictives (le faux Supabase en tire une par lead)
  for (const [i, who] of ['lea', 'marc', 'nora', 'paul'].entries())
    state.tables.leads.push({
      ...state.tables.leads[0],
      id: `lead-rec-${i}`,
      email: `${who}@globex.example`,
      fields: {},
    });
  await install(page, state);
  const shot = async (name) => {
    if (!SHOTS) return;
    await page.mouse.move(1430, 890);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1440, height: Math.max(900, h) });
    await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
  };

  // ===== L26-06 : vue d'ensemble =====
  await page.goto(`${APP}/#/analytics`);
  // L48-D : widget « Nouveaux et récurrents » (plus d'indicateur en onglet)
  const card = page.locator('section.an-w', {
    has: page.getByRole('heading', { name: 'Nouveaux et récurrents' }),
  });
  await card.locator('.an-nr').waitFor();
  ok(
    (await page.locator('.kpi-tab', { hasText: 'Visiteurs récurrents' }).count()) === 0,
    'pas d’onglet « Visiteurs récurrents »',
  );
  // Chiffres cohérents avec la vue d'ensemble : même population que « Visiteurs »
  const num = (x) => Number(sp(x).replace(/\D/g, ''));
  const uniq = num(await page.locator('.kpi-tab').nth(1).locator('.kpi-tab__v').innerText());
  const n = Math.round(uniq * 0.34);
  ok(sp(await card.innerText()).includes('revenu après plus de 30 minutes'), 'définition (30 min)');
  const nums = card.locator('.an-nr__nums b');
  ok(
    num(await nums.nth(0).innerText()) === uniq - n && num(await nums.nth(1).innerText()) === n,
    'nouveaux et récurrents sur les vraies données',
  );
  await shot('l26-06-vue');

  // ===== L26-08 : modale « Mesure des visites » =====
  await page
    .getByRole('button', { name: 'Comment c’est mesuré' })
    .or(page.getByRole('button', { name: "Comment c'est mesuré" }))
    .click();
  const dlg = page.getByRole('dialog', { name: 'Mesure des visites' });
  await dlg.waitFor();
  const sw = dlg.getByRole('switch', { name: 'Reconnaître les visiteurs qui reviennent' });
  ok(await sw.isChecked(), 'activée par défaut');
  ok(await dlg.getByRole('radio', { name: '30 minutes (par défaut)' }).isChecked(), '30 minutes par défaut');
  ok(sp(await dlg.innerText()).includes('À faire valider par votre DPO'), 'alerte CNIL et DPO');
  ok(sp(await dlg.innerText()).includes('Ne pas mesurer mes visites'), 'refus côté lecteur expliqué');
  if (SHOTS) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/l26-08-mesure${sfx}.png` });
  }
  await dlg.getByRole('radio', { name: '24 heures' }).check();
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await dlg.waitFor({ state: 'detached' });
  ok(state.tables.workspaces[0].visit_gap_minutes === 1440, 'écart de 24 h enregistré');
  // L48-D : « Mesure des visites » passe dans le menu « Plus »
  await page.locator('.an-more').click();
  await page.getByRole('menuitem', { name: 'Mesure des visites' }).click();
  await dlg.waitFor();
  await sw.uncheck();
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await dlg.waitFor({ state: 'detached' });
  ok(state.tables.workspaces[0].visit_measure === false, 'mesure désactivée');
  await page.waitForTimeout(500);
  ok(
    sp(await card.innerText()).includes('La mesure des visites est désactivée'),
    'bloc : « mesure désactivée »',
  );
  state.tables.workspaces[0].visit_measure = true;
  state.tables.workspaces[0].visit_gap_minutes = 30;
  await page.reload();

  // ===== L26-07 : sessions et temps réel =====
  await page.goto(`${APP}/#/analytics?tab=sessions`);
  await page.locator('.an-visit').first().waitFor();
  ok((await page.locator('.an-visit', { hasText: /^Nouveau$/ }).count()) > 0, 'sessions : badge « Nouveau »');
  ok(
    (await page.locator('.an-visit', { hasText: /Récurrent · visite n° 2/ }).count()) > 0,
    'sessions : badge « Récurrent · visite n° n »',
  );
  await shot('l26-07-sessions');
  state.live = {
    kpis: { live: 2, views30: 9, ctaToday: 1, leadsToday: 0 },
    stepsTotal: 6,
    more: 0,
    visitors: [
      {
        key: 'k1',
        lastAt: new Date().toISOString(),
        since: new Date(Date.now() - 60000).toISOString(),
        stepIndex: 2,
        stepTitle: 'Nouveau rapport',
        device: 'desktop',
        country: 'FR',
        lastType: 'step_view',
        identity: null,
      },
      {
        key: 'k2',
        lastAt: new Date().toISOString(),
        since: new Date(Date.now() - 30000).toISOString(),
        stepIndex: 0,
        stepTitle: 'Bienvenue',
        device: 'mobile',
        country: 'BE',
        lastType: 'step_view',
        identity: null,
      },
    ],
  };
  state.liveVisits = { k1: 3, k2: 1 };
  await page.goto(`${APP}/#/analytics?tab=live`);
  await page.locator('.an-visit').first().waitFor();
  ok(
    (await page.locator('.an-visit').allTextContents()).map(sp).join('|') ===
      'Récurrent · visite n° 3|Nouveau',
    'temps réel : nouveau ou récurrent',
  );

  // ===== Segment : critère disponible =====
  await page.goto(`${APP}/#/analytics?tab=segments`);
  await page.getByRole('button', { name: 'Ajouter un filtre' }).click();
  const fd = page.getByRole('dialog', { name: 'Ajouter un filtre' });
  const crit = fd.getByLabel('Critère de la condition 1');
  ok(
    (await crit.locator('option:not([disabled])', { hasText: 'Visiteur récurrent' }).count()) === 1 &&
      !(await crit.locator('option[disabled]').allTextContents()).some((x) => /Nouveau ou récurrent/.test(x)),
    'segment : « Visiteur récurrent » sans « Bientôt »',
  );
  await page.keyboard.press('Escape');

  // ===== Paramètres › Confidentialité =====
  await page.goto(`${APP}/#/settings/privacy`);
  await page.getByRole('heading', { level: 1, name: 'Confidentialité' }).waitFor();
  ok(
    sp(await page.locator('.setting').first().innerText()).includes('nouvelle visite après 30 minutes'),
    'Confidentialité : état',
  );
  // 171 : durée de conservation des leads, celle du plan (Pro : 365 jours)
  ok(
    sp(await page.locator('.setting').nth(1).innerText()).includes(
      'Les leads sont supprimés après 365 jours.',
    ),
    'Confidentialité : conservation des leads',
  );
  await page.getByRole('button', { name: 'Modifier' }).click();
  await dlg.waitFor();
  ok(true, 'Confidentialité : ouvre la modale');
  await page.keyboard.press('Escape');

  // Lecteur (rôle viewer) : lecture seule
  state.tables.members[0].role = 'viewer';
  await page.goto(`${APP}/#/analytics`);
  await page.reload();
  // L48-D : « Mesure des visites » passe dans le menu « Plus »
  await page.locator('.an-more').click();
  await page.getByRole('menuitem', { name: 'Mesure des visites' }).click();
  await dlg.waitFor();
  ok(
    (await sw.isDisabled()) && (await dlg.getByRole('button', { name: 'Enregistrer' }).count()) === 0,
    'lecteur : modale en lecture seule',
  );
  await page.keyboard.press('Escape');
  state.tables.members[0].role = 'owner';

  // ===== Lecteur : identifiant, refus, GPC, mesure désactivée =====
  const manifest = {
    schemaVersion: 1,
    demoId: DEMO,
    versionId: '0b5c1f0e-0000-4000-8000-0000000000aa',
    workspaceId: WS,
    title: 'Créer un rapport',
    locale: 'fr',
    publishedAt: '2026-11-14T10:00:00Z',
    theme: {},
    allowedEmbedOrigins: [],
    steps: [{ id: 's1', kind: 'text', title: 'Bienvenue', body: 'Commençons.' }],
  };
  const open = async ({ measure = true, gpc = false } = {}) => {
    const c = await themedContext(b, { viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
    if (gpc)
      await c.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const sent = [];
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest, visitMeasure: measure }),
      }),
    );
    await p.route('**/rest/v1/rpc/track_events', (r) => {
      try {
        sent.push(JSON.parse(r.request().postData() || '{}'));
      } catch {}
      return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '1' });
    });
    await p.route('**/functions/v1/track', (r) => {
      try {
        sent.push(JSON.parse(r.request().postData() || '{}'));
      } catch {}
      return r.fulfill({ status: 200, headers: cors, body: '{}' });
    });
    await p.goto(`${PLAYER}/#/d/${DEMO}`);
    await p.getByRole('heading', { name: 'Bienvenue' }).waitFor();
    return { p, c, sent };
  };
  const stored = (p) =>
    p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));

  {
    const { p, c } = await open();
    const ls = await stored(p);
    ok(
      !!ls[`fd.vid.${WS}`] && /"at":\d+/.test(ls[`fd.vid.${WS}`]),
      'lecteur : identifiant propre à l’espace, daté',
    );
    ok(!('fd.vid' in ls), 'lecteur : plus d’identifiant global');
    await p.getByRole('button', { name: 'Informations' }).click();
    const info = p.getByRole('dialog', { name: 'Informations' });
    await info.waitFor();
    ok(sp(await info.innerText()).includes('13 mois au plus'), 'informations : explication de l’identifiant');
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/l26-08-lecteur${sfx}.png` });
    await info.getByRole('button', { name: 'Ne pas mesurer mes visites' }).click();
    const after = await stored(p);
    ok(
      !after[`fd.vid.${WS}`] && after['fd.nomeasure'] === '1',
      'refus : identifiant supprimé, drapeau gardé',
    );
    ok(
      (await info.getByRole('button', { name: 'Mesurer à nouveau mes visites' }).count()) === 1,
      'refus : « Mesurer à nouveau mes visites »',
    );
    await c.close();
  }
  {
    const { p, c } = await open({ gpc: true });
    const ls = await stored(p);
    ok(!Object.keys(ls).some((k) => k.startsWith('fd.vid')), 'GPC : aucun identifiant gardé');
    await p.getByRole('button', { name: 'Informations' }).click();
    const info = p.getByRole('dialog', { name: 'Informations' });
    ok(
      sp(await info.innerText()).includes('Global Privacy Control') &&
        (await info.getByRole('button', { name: 'Ne pas mesurer mes visites' }).count()) === 0,
      'GPC : expliqué, pas de bouton',
    );
    await c.close();
  }
  {
    const { p, c } = await open({ measure: false });
    const ls = await stored(p);
    ok(!Object.keys(ls).some((k) => k.startsWith('fd.vid')), 'mesure désactivée : aucun identifiant créé');
    ok(
      (await p.getByRole('button', { name: 'Informations' }).count()) === 0,
      'mesure désactivée : pas de bouton',
    );
    await c.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})();
