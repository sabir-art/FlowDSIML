/** Test e2e F1 (parcours guidés) : Spotlight, étape pop-up, menu de choix, checklist, autoplay. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));
const DEMO = '0b5c1f0e-0000-4000-8000-0000000000f1';
const img = { url: 'assets/a.webp', width: 1100, height: 750 };
const hs = (id, extra) => ({
  id,
  x: 0.12,
  y: 0.3,
  w: 0.3,
  h: 0.12,
  title: 'Ouvrez le pipeline',
  body: 'Toutes les opportunités en cours, par étape de vente.',
  placement: 'auto',
  action: { type: 'next' },
  ...extra,
});
const manifest = {
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000f2',
  workspaceId: 'w',
  title: 'Prise en main du CRM',
  locale: 'fr',
  publishedAt: '2026-11-17T10:00:00Z',
  theme: {},
  checklist: { title: 'Votre progression', position: 'right' },
  autoplay: { enabled: true, delayMs: 1500 },
  chapters: [
    { id: 'c1', title: 'Découverte' },
    { id: 'c2', title: 'Parcours conseiller' },
    { id: 'c3', title: 'Parcours gestionnaire' },
  ],
  steps: [
    { id: 's1', chapterId: 'c1', kind: 'image', image: img, hotspots: [hs('h1', { style: 'spotlight' })] },
    {
      id: 's2',
      chapterId: 'c1',
      kind: 'text',
      title: 'Quel est votre rôle\u202f?',
      body: 'Choisissez le parcours qui correspond à votre poste.',
      options: {
        display: 'popup',
        variant: 'instruction',
        choices: [
          { label: 'Je suis conseiller', action: { type: 'goto', stepId: 's3' } },
          { label: 'Je suis gestionnaire', action: { type: 'chapter', chapterId: 'c3' } },
          { label: 'Plus tard', action: { type: 'end' } },
        ],
      },
    },
    {
      id: 's3',
      chapterId: 'c2',
      kind: 'image',
      image: img,
      hotspots: [hs('h3', { action: { type: 'goto', stepId: 's5' } })],
    },
    {
      id: 's4',
      chapterId: 'c3',
      kind: 'text',
      title: 'Vue gestionnaire',
      body: 'Suivez l’activité de votre équipe.',
    },
    {
      id: 's5',
      chapterId: 'c2',
      kind: 'text',
      title: 'Bravo\u202f!',
      body: 'Vous avez terminé le parcours.',
    },
  ],
};

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  const tracked = [];
  await page.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', manifest: manifest }),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    }),
  );
  await page.route('**/assets/a.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
  await page.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
  page.on('request', (req) => {
    if (!req.url().includes('/functions/v1/track') && !req.url().includes('track_events')) return;
    try {
      const body = JSON.parse(req.postData() || '{}');
      tracked.push(...((body.p_batch ?? body).events ?? []));
    } catch {}
  });
  await page.goto(`${PLAYER}/#/d/${DEMO}`);
  await page.waitForSelector('.p-stage');

  // Spotlight : zone éclairée, pas de pastille, bulle hors de la zone
  ok((await page.locator('.p-spotlight').count()) === 1, 'Spotlight : zone éclairée affichée');
  ok((await page.locator('.p-beacon').count()) === 0, 'Spotlight : pas de pastille');
  // Pause immédiate pour les captures, puis vérification de l'avance automatique
  const play = page.locator('.p-play');
  ok((await play.getAttribute('aria-pressed')) === 'true', 'autoplay actif au chargement');
  await play.click();
  ok((await play.getAttribute('aria-label')) === 'Lecture automatique', 'autoplay en pause');
  await page.waitForTimeout(900);
  const spot = await page.locator('.p-spotlight').boundingBox();
  const tip = await page.locator('.p-stage > .p-tip').boundingBox();
  const overlap = !(
    tip.x >= spot.x + spot.width ||
    tip.x + tip.width <= spot.x ||
    tip.y >= spot.y + spot.height ||
    tip.y + tip.height <= spot.y
  );
  ok(!overlap, 'Spotlight : la bulle ne recouvre pas la zone');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f1-spotlight.png` });
  await page.waitForTimeout(1800);
  ok((await page.locator('.p-spotlight').count()) === 1, 'en pause : pas d’avance');
  await play.click();
  await page.waitForSelector('.p-popup', { timeout: 4000 });
  ok(true, 'autoplay : passage à l’étape suivante');

  // Pop-up : fond assombri = écran précédent, badge Consigne, choix
  ok((await page.locator('.p-dim').count()) === 1, 'pop-up : écran précédent assombri');
  ok((await page.locator('.p-variant').textContent()).includes('Consigne'), 'pop-up : badge Consigne');
  ok((await page.locator('.p-choice').count()) === 3, 'menu de choix : 3 choix');
  ok(
    (await page.locator('.p-stage.is-backdrop').count()) === 1,
    'pop-up : fond « capture floutée » (écran précédent)',
  );
  await page.waitForTimeout(2000);
  ok((await page.locator('.p-popup').count()) === 1, 'autoplay arrêté sur un menu de choix');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f1-popup-choix.png` });

  // Checklist à 1280 : pas de place à côté de la capture → pilule dans l'en-tête (F1-3)
  ok(
    (await page.locator('.p-top .p-checklist--docked .p-checklist-pill').count()) === 1,
    'checklist : pilule dans l’en-tête à 1280',
  );
  ok((await page.locator('.p-checklist-card').count()) === 0, 'checklist : ne recouvre pas la capture');
  await page.locator('.p-checklist-pill').click();
  ok((await page.locator('.p-checklist-item').count()) === 3, 'checklist : 3 chapitres');
  ok(
    (await page.locator('.p-checklist-progress').textContent()) === '0 sur 3 terminées',
    'checklist : rien de coché tant qu’on n’a pas quitté la dernière étape du chapitre (F1-4)',
  );
  ok(
    (await page.locator('.p-checklist-item.is-current').textContent()).includes('Découverte'),
    'checklist : chapitre en cours mis en avant',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f1-checklist.png` });
  await page.getByRole('button', { name: 'Replier' }).click();
  ok((await page.locator('.p-checklist-pill').count()) === 1, 'checklist : repliée en pilule');

  // Branching : gestionnaire → s4 (autoplay en pause : l'envoi groupé n'est plus repoussé)
  await play.click();
  await page.getByRole('button', { name: 'Je suis gestionnaire' }).click();
  await page.waitForSelector('text=Vue gestionnaire');
  ok(
    (await page.locator('.p-count').textContent()).trim() === '4 / 5',
    'choix : saut vers le chapitre gestionnaire',
  );
  await page.locator('.p-checklist-pill').click();
  ok(
    (await page.locator('.p-checklist-item.is-done').count()) === 1,
    'checklist : Découverte cochée une fois quittée',
  );
  await page.waitForTimeout(3500); // envoi groupé, 2 s après le dernier événement
  ok(
    tracked.some((e) => e.type === 'hotspot_click' && e.props?.choice === 'Je suis gestionnaire'),
    'choix : clic enregistré dans les analytics',
  );

  // Choix « Fin de la démo »
  await page.locator('.p-checklist-item', { hasText: 'Découverte' }).click();
  await page.waitForTimeout(300);
  await page.locator('.p-controls [aria-label="Étape suivante"]').click();
  await page.waitForSelector('.p-choice');
  await page.getByRole('button', { name: 'Plus tard' }).click();
  ok((await page.locator('#p-end-title').textContent()) === 'Tutoriel terminé', 'choix : fin de la démo');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f1-fin.png` });

  // Grand écran : carte à côté de la capture, sans la recouvrir
  const wide = await b.newPage({ viewport: { width: 1920, height: 900 } });
  await wide.route('**/functions/v1/open-demo', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', manifest: manifest }),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    }),
  );
  await wide.route('**/assets/a.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
  await wide.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
  await wide.goto(`${PLAYER}/#/d/${DEMO}`);
  await wide.waitForSelector('.p-stage');
  await wide.waitForSelector('.p-checklist-card');
  const card = await wide.locator('.p-checklist-card').boundingBox();
  const st = await wide.locator('.p-stage').boundingBox();
  ok(card.x >= st.x + st.width, 'grand écran : carte à droite de la capture, sans recouvrement');

  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
