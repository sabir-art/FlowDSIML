/**
 * ONB-01 (COMP-01 §17, variante B) : la prise en main hors du flux. Bouton « Prise en main 3/7 » avec son
 * anneau dans le PageHeader (aria-expanded), panneau à droite qui partage l'espace (étape suivante en
 * carte, « À faire ensuite », « Terminées » replié), choix gardé, rôles, tiroir modal sous 1 024 px.
 * Et « Apprendre TutoClick » dans l'aide (progression, visite terminée).
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

  // ===== ONB-01 : bouton d'entrée, panneau fermé par défaut =====
  await page.goto(`${BASE}/#/`);
  const toggle = page.getByRole('button', { name: /^Prise en main 2\/6/ });
  await toggle.waitFor();
  const card = page.getByRole('complementary', { name: 'Prise en main' });
  ok(
    (await toggle.getAttribute('aria-expanded')) === 'false' && (await card.count()) === 0,
    'bouton « Prise en main 2/6 » dans le PageHeader (l’extension en « Bientôt » sort du total), panneau fermé par défaut',
  );
  ok(
    sp(await toggle.innerText())
      .replace(/\s+/g, ' ')
      .startsWith('Prise en main 2/6') &&
      (await toggle.locator('svg.onb-ring').count()) === 1 &&
      (await toggle.evaluate((el) => !!el.closest('.fd-page-header__actions'))),
    'libellé « Prise en main 2/6 » avec l’anneau de progression',
  );
  ok((await page.locator('.onb-card').count()) === 0, 'plus de carte dans le flux de la page');
  const gridBefore = await page.locator('.demos-wrap').boundingBox();
  await toggle.click();
  await card.waitFor();
  ok(
    (await toggle.getAttribute('aria-expanded')) === 'true' &&
      (await toggle.getAttribute('aria-controls')) === 'onb-panel',
    'ouvert : aria-expanded et aria-controls',
  );
  const box = await card.boundingBox();
  const wrap = await page.locator('.demos-wrap').boundingBox();
  ok(
    Math.round(box.width) === 360 && Math.round(box.y) === 56 && Math.round(box.x + box.width) === 1440,
    `panneau de 360 px à droite, sous le PageHeader (${Math.round(box.x)},${Math.round(box.y)})`,
  );
  ok(
    Math.round(wrap.x + wrap.width) === Math.round(box.x) && wrap.width < gridBefore.width,
    'le contenu se resserre : il partage la largeur avec le panneau, sans surcouche',
  );
  ok(
    (await card.evaluate((el) => getComputedStyle(el).borderLeftWidth)) === '1px' &&
      (await card.getAttribute('role')) === null,
    'filet à gauche, ni modale ni dialogue',
  );
  ok(/2 étapes sur\s6\. Elles se cochent seules/.test(sp(await card.innerText())), '« 2 étapes sur 6 »');
  const bar = card.getByRole('progressbar');
  ok(sp(await bar.getAttribute('aria-valuetext')) === '2 étapes sur 6', 'progression : aria-valuetext');
  const next = card.locator('.onb-next');
  ok(
    /Prochaine étape/i.test(await next.innerText()) &&
      /Flouter les données sensibles/.test(await next.innerText()),
    'carte « Prochaine étape » : flouter',
  );
  ok(
    !/automatique/.test(await card.innerText()),
    'L48-G écart 7 : aucune mention « automatique » dans la prise en main',
  );
  ok((await next.locator('.fd-btn--primary', { hasText: 'Voir comment' }).count()) === 1, 'bouton principal');
  ok((await card.locator('.fd-btn--primary').count()) === 1, 'une seule action principale dans le panneau');
  ok(
    /À faire ensuite\s*4/.test(sp(await card.locator('.onb-h3').innerText())) &&
      (await card.locator('.onb-rows:not(.onb-rows--done) li').count()) === 4,
    '« À faire ensuite 4 » en lignes compactes',
  );
  const lastRow = card.locator('.onb-rows:not(.onb-rows--done) li').last();
  ok(
    /Installer l’extension/.test(await lastRow.innerText()) &&
      (await lastRow.locator('.onb-soon', { hasText: 'Bientôt' }).count()) === 1 &&
      (await lastRow.locator('button').count()) === 0,
    'l’étape « Bientôt » vient en dernier, en gris, sans action',
  );
  const doneBtn = card.getByRole('button', { name: /^Terminées/ });
  ok(
    (await doneBtn.getAttribute('aria-expanded')) === 'false' &&
      (await card.locator('.onb-rows--done').count()) === 0,
    '« Terminées 2 » replié',
  );
  await doneBtn.click();
  ok(
    (await card.locator('.onb-rows--done li').count()) === 2 &&
      (await card.locator('.onb-rows--done .sr-only', { hasText: 'Fait' }).count()) === 2,
    'déplié : 2 étapes faites (l’extension en « Bientôt » n’est pas cochée), « Fait » pour les lecteurs d’écran',
  );
  await doneBtn.click();
  ok((await page.locator('.gs-banner').count()) === 0, 'remplace « Premiers pas »');
  // Indicateurs en 2 × 2 dans la largeur restante
  ok(
    (await page.locator('.kpi-short').count()) === 0 ||
      (await page
        .locator('.kpi-short')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)) === 2,
    'panneau ouvert : indicateurs en 2 × 2',
  );
  if (SHOTS) {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${SHOTS}/l26-01-prise-en-main${sfx}.png` });
  }
  // Le choix est gardé pour la personne
  await page.reload();
  await card.waitFor();
  ok(true, 'rechargement : le panneau reste ouvert (choix gardé)');
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
    (await ac.locator('li').nth(0).locator('.soon-text', { hasText: 'Bientôt' }).count()) === 1,
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

  // ===== Fermer par la croix, puis reprendre depuis l'aide =====
  await card.getByRole('button', { name: 'Masquer la prise en main' }).click();
  await card.waitFor({ state: 'detached' });
  ok((await toggle.getAttribute('aria-expanded')) === 'false', 'la croix ferme le panneau, le bouton reste');
  await page.reload();
  await toggle.waitFor();
  ok((await card.count()) === 0, 'rechargement : le panneau reste fermé (choix gardé)');
  await page.getByRole('button', { name: 'Aide', exact: true }).first().click();
  await drawer.getByRole('button', { name: /Reprendre la prise en main/ }).click();
  await card.waitFor();
  ok(true, 'aide : « Reprendre la prise en main » rouvre le panneau');

  // ===== Rôles =====
  state.tables.members[0].role = 'editor';
  await page.reload();
  await card.waitFor();
  ok(/1 étape sur\s3/.test(sp(await card.innerText())), 'éditeur : progression sur 3 (étapes 3 à 5)');
  ok(
    (await page.getByRole('button', { name: /^Prise en main 1\/3/ }).count()) === 1,
    'éditeur : bouton « Prise en main 1/3 »',
  );
  state.tables.members[0].role = 'viewer';
  await page.reload();
  await page.getByRole('heading', { name: 'Démos', level: 1 }).waitFor();
  await page.locator('.demo-card, .fd-empty').first().waitFor();
  ok(
    (await card.count()) === 0 && (await page.locator('#onb-toggle').count()) === 0,
    'lecteur : ni bouton ni panneau',
  );

  // ===== 7 sur 7 : le bouton disparaît =====
  state.tables.members[0].role = 'owner';
  state.onboarding = Object.fromEntries(Object.keys(state.onboarding).map((k) => [k, true]));
  state.onboardingDoneAt = new Date(Date.now() - 2 * 864e5).toISOString();
  await page.reload();
  await page.getByRole('heading', { name: 'Démos', level: 1 }).waitFor();
  await page.locator('.demo-card, .fd-empty').first().waitFor();
  ok(
    (await card.count()) === 0 && (await page.locator('#onb-toggle').count()) === 0,
    '7 sur 7 : le bouton et le panneau disparaissent',
  );
  await page.getByRole('button', { name: 'Aide', exact: true }).first().click();
  await drawer.getByRole('button', { name: /Reprendre la prise en main/ }).click();
  await card.waitFor();
  ok(
    /Votre espace est prêt/.test(await card.innerText()),
    '7 sur 7 : l’aide rouvre le panneau, « Votre espace est prêt »',
  );

  // ===== Espace tout neuf : panneau ouvert à la première visite du propriétaire =====
  {
    const nctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
    const n = await nctx.newPage();
    n.on('pageerror', (e) => errors.push(e.message));
    const ns = seed();
    // Aucune étape faite : l'espace vient d'être créé
    ns.onboarding = {
      brand: false,
      extension: false,
      capture: false,
      pii: false,
      publish: false,
      invite: false,
      distribute: false,
    };
    await install(n, ns);
    await n.goto(`${BASE}/#/`);
    const np = n.getByRole('complementary', { name: 'Prise en main' });
    await np.waitFor();
    ok(
      (await n.locator('#onb-toggle').getAttribute('aria-expanded')) === 'true' &&
        /^Prise en main\s*0\/6/.test(await n.locator('#onb-toggle').textContent()),
      'espace neuf (0/6) : panneau ouvert à la première visite du propriétaire',
    );
    await np.getByRole('button', { name: 'Masquer la prise en main' }).click();
    await n.reload();
    await n.locator('#onb-toggle').waitFor();
    ok((await np.count()) === 0, 'espace neuf : une fois fermé, il reste fermé (choix gardé)');
    await nctx.close();
  }

  // ===== Sous 1 024 px : anneau seul de 44 px, tiroir modal par la droite =====
  {
    const mctx = await themedContext(b, { viewport: { width: 390, height: 844 } });
    const m = await mctx.newPage();
    m.on('pageerror', (e) => errors.push(e.message));
    const st = seed();
    st.onboarding = { ...st.onboarding, brand: true, extension: true, capture: true };
    await install(m, st);
    await m.goto(`${BASE}/#/`);
    const ring = m.locator('#onb-toggle');
    await ring.waitFor();
    const rb = await ring.boundingBox();
    ok(
      Math.round(rb.width) === 44 &&
        Math.round(rb.height) === 44 &&
        /^Prise en main\s*2\/6/.test(await ring.textContent()),
      `390 px : bouton réduit à l’anneau de 44 px, nom accessible gardé (${Math.round(rb.width)} × ${Math.round(rb.height)})`,
    );
    await ring.click();
    const dlg = m.getByRole('dialog', { name: 'Prise en main' });
    await dlg.waitFor();
    const db = await dlg.boundingBox();
    ok(
      (await dlg.getAttribute('aria-modal')) === 'true' &&
        Math.round(db.width) === 340 &&
        Math.round(db.x + db.width) === 390,
      `390 px : tiroir modal de 340 px par la droite (${Math.round(db.width)} px)`,
    );
    ok(
      await dlg.evaluate((el) => el.contains(document.activeElement)),
      '390 px : le focus entre dans le tiroir',
    );
    // Focus piégé : Maj + Tab depuis le premier bouton va au dernier
    await m.keyboard.press('Shift+Tab');
    ok(
      await dlg.evaluate((el) => el.contains(document.activeElement)),
      '390 px : focus piégé dans le tiroir',
    );
    await m.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' });
    ok(
      await ring.evaluate((el) => el === document.activeElement),
      '390 px : Échap ferme le tiroir et rend le focus au bouton',
    );
    await mctx.close();
  }

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
