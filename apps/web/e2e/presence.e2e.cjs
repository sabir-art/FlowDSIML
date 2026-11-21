/**
 * L22-08 : présence sur une démo. Le transport Realtime est remplacé (développement seulement) par
 * un faux qui enregistre ce que l'app envoie et injecte les autres personnes.
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { openTool } = require('./editor-rail.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const MARIE = '0b5c1f0e-0000-4000-8000-0000000000b1';
const SACHA = '0b5c1f0e-0000-4000-8000-0000000000b2';

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    window.__fdPresence = {
      join(topic, me, onSync) {
        window.__pres = { topic, me, onSync, tracked: [] };
        return {
          track(p) {
            window.__pres.tracked.push(JSON.parse(JSON.stringify(p)));
          },
          leave() {},
        };
      },
    };
    window.__setOthers = (list) => window.__pres.onSync(Object.fromEntries(list.map((p) => [p.u, [p]])));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (cond, label) => {
    console.log(`${cond ? 'ok' : 'NOT OK'} - ${label}`);
    if (!cond) process.exitCode = 1;
  };
  const state = seed();
  state.tables.members.push(
    { workspace_id: 'ws-1', user_id: MARIE, role: 'editor', created_at: '2026-01-02' },
    { workspace_id: 'ws-1', user_id: SACHA, role: 'editor', created_at: '2026-01-02' },
  );
  state.memberDirectory = {
    [MARIE]: { full_name: 'Marie Durand', email: 'marie@example.com' },
    [SACHA]: { full_name: 'Sacha Durand', email: 'sacha@example.com' },
  };
  await install(page, state);

  await page.goto(`${BASE}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('.canvas-frame img');
  await page.waitForFunction(() => window.__pres?.tracked.some((p) => p.s));
  const pres = await page.evaluate(() => ({
    topic: window.__pres.topic,
    last: window.__pres.tracked.at(-1),
  }));
  ok(pres.topic === `demo:${DEMO}`, 'L22-08 : canal privé « demo:<uuid> »');
  ok(
    JSON.stringify(Object.keys(pres.last).sort()) === JSON.stringify(['a', 'c', 'e', 's', 't', 'u']) &&
      pres.last.s === 's1',
    'Condition 3 : charge utile limitée à identifiants, étape, activité, instants, curseur (aucun nom, aucun texte)',
  );

  const now = await page.evaluate(() => Date.now());
  const others = (extra = {}) => [
    { u: MARIE, s: 's1', a: 'bubble', t: now, c: [0.4, 0.3], e: null, ...extra },
    { u: SACHA, s: 's2', a: null, t: now - 3.5 * 60_000, c: null, e: null },
  ];
  await page.evaluate((l) => window.__setOthers(l), others());

  const stackBtn = page.locator('.pr-stack');
  await stackBtn.waitFor();
  ok(
    (await stackBtn.getAttribute('aria-label')) ===
      '2 autres personnes sur cette démo : Marie Durand, Sacha Durand',
    'L22-08 : bouton « 2 autres personnes sur cette démo : … »',
  );
  ok(
    (await stackBtn.locator('.pr-av.is-idle').count()) === 1,
    'L22-08 : point gris pour la personne inactive',
  );
  const banner = page.locator('.co-banner-slot[role="status"]');
  ok(
    /Marie Durand modifie aussi cette étape \(texte de la bulle\)\. Vos changements sont fusionnés champ par champ\./.test(
      await banner.textContent(),
    ),
    'L22-08 : bandeau même étape (role=status)',
  );
  ok(
    (await page.locator('.rail-li').nth(0).locator('.rail-who .pr-av').count()) === 1,
    'L22-08 : avatar sur la vignette de l’étape 1',
  );
  ok(
    /Sacha Durand/.test(await page.locator('.rail-li').nth(1).locator('.rail-who').getAttribute('title')),
    'L22-08 : avatar sur la vignette de l’étape 2 (title)',
  );
  const cursor = page.locator('.canvas-frame .rcursor');
  ok(
    (await cursor.count()) === 1 && (await cursor.textContent()) === 'Marie',
    'L22-08 : curseur distant au prénom',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l22-08-presence${sfx}.png` });

  await stackBtn.click();
  const pop = page.getByRole('dialog', { name: 'Sur cette démo' });
  await pop.waitFor();
  const rows = (await pop.locator('li').allTextContents()).map((x) => x.replace(/\s+/g, ' ').trim());
  ok(rows[0].includes('Vous') && rows[0].includes('Étape 1'), 'L22-08 : « Vous » en premier');
  ok(
    rows.some((r) => /Marie Durand.*Étape 1 · modifie le texte de la bulle/.test(r)),
    'L22-08 : étape et activité',
  );
  ok(
    rows.some((r) => /Sacha Durand.*Étape 2 · inactif depuis 3 min/.test(r)),
    'L22-08 : « inactif depuis 3 min »',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l22-08-panneau${sfx}.png` });
  await pop.getByRole('button', { name: /Sacha Durand/ }).click();
  await page.waitForFunction(() => /Étape 2/.test(document.querySelector('.stage-head')?.textContent ?? ''));
  ok(true, 'L22-08 : un clic sur une personne affiche son étape');
  // Envoi limité à un message toutes les 120 ms
  ok(
    await page
      .waitForFunction(() => window.__pres.tracked.at(-1).s === 's2', null, { timeout: 2000 })
      .then(() => true)
      .catch(() => false),
    'L22-08 : ma présence suit l’étape affichée',
  );

  // Réglages : masquer les curseurs
  await page.locator('.rail-li').nth(0).locator('button.step').click();
  await openTool(page, 'settings');
  await page.getByLabel('Afficher les curseurs').uncheck();
  ok(
    (await page.locator('.canvas-frame .rcursor').count()) === 0,
    'L22-08 : « Afficher les curseurs » masque les curseurs',
  );
  await page.getByLabel('Afficher les curseurs').check();
  await openTool(page, 'step');

  // Activité envoyée : focus sur le titre de l'étape
  await page.locator('#st-title').focus();
  await page.waitForFunction(() => window.__pres.tracked.at(-1).a === 'title');
  ok(true, 'L22-08 : activité envoyée (titre), sans le texte');

  // Même champ : la dernière modification l'emporte, toast pour l'autre personne
  await page.fill('#st-title', 'Titre local');
  await page.waitForTimeout(3300);
  const myStamp = await page.evaluate(() => window.__pres.tracked.at(-1).e);
  ok(
    myStamp?.tb === 'steps' && myStamp.id === 's1' && myStamp.f === 'title' && !('v' in myStamp),
    'L22-08 : tampon de modification sans valeur',
  );
  state.tables.steps.find((s) => s.id === 's1').title = 'Titre de Marie';
  const later = await page.evaluate(() => Date.now());
  await page.evaluate(
    (l) => window.__setOthers(l),
    others({ t: later, e: { tb: 'steps', id: 's1', f: 'title', at: later } }),
  );
  await page.waitForFunction(() => document.querySelector('#st-title')?.textContent === 'Titre de Marie');
  ok(true, 'L22-08 : modification de l’autre personne fusionnée');
  await page.waitForSelector('.toast');
  ok(
    /Marie Durand a modifié ce champ/.test(await page.textContent('.toast')),
    'L22-08 : toast « Marie Durand a modifié ce champ »',
  );

  // Départ des autres : plus rien
  await page.evaluate(() => window.__setOthers([]));
  ok(
    (await page.locator('.pr-stack').count()) === 0 && (await page.locator('.co-banner').count()) === 0,
    'L22-08 : départ des autres personnes',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
