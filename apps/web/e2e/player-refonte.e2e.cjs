/** Lecteur refait d'après refonte/player.html (PLY-01, écarts PY-1 à PY-7). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const manifest = require('./player-maquette.cjs');

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  async function open(viewport, m = manifest) {
    const p = await b.newPage({ viewport });
    await p.route('**/latest.json', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(m),
        headers: { 'access-control-allow-origin': '*' },
      }),
    );
    await p.route('**/assets/a.webp', (r) =>
      r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'fixture.png')) }),
    );
    await p.route('**/rest/v1/rpc/**', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: '"ok"',
        headers: { 'access-control-allow-origin': '*' },
      }),
    );
    await p.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, body: '{}' }));
    await p.goto(`${PLAYER}/#/d/${m.demoId}`);
    await p.waitForSelector('.p-stage');
    await p.waitForTimeout(600);
    return p;
  }
  const next = (p) => p.locator('.p-tip .p-btn-primary').click();

  const p = await open({ width: 1440, height: 900 });
  ok((await p.locator('.p-ws').textContent()) === 'DSI', 'PY-1 : pastille du workspace (sigle)');
  ok(
    (await p.locator('.p-meta').textContent()) === 'DSI Missions Locales · 6 étapes',
    'PY-1 : méta « workspace · n étapes »',
  );
  ok((await p.getByRole('button', { name: 'Chapitres' }).count()) === 1, 'PY-2 : bouton « Chapitres »');
  ok(
    (await p.locator('.p-controls .p-count').textContent()) === '1 / 6',
    'PY-3 : compteur « n / N » dans la pilule',
  );
  ok(
    (await p.locator('.p-tip').getByText('Précédent').count()) === 0,
    'PY-4 : pas de « Précédent » dans la bulle',
  );
  await p.getByRole('button', { name: 'Langue : français' }).click();
  ok(
    (await p.locator('.p-meta').textContent()) === 'DSI Missions Locales · 6 steps',
    'PY-3 : bouton de langue (interface en anglais)',
  );
  await p.getByRole('button', { name: 'Language: English' }).click();
  await next(p);
  await p.waitForTimeout(300);
  await next(p);
  await p.waitForSelector('.p-form');
  ok(
    (await p.locator('.p-form').textContent()).includes('E-mail professionnel'),
    'PY-5 : « E-mail professionnel »',
  );
  ok(
    (await p.locator('.p-privacy').textContent()).includes('Données traitées par DSI Missions Locales.'),
    'PY-5 : « Données traitées par … »',
  );
  ok(
    (await p.locator('.p-top-cta').evaluate((el) => getComputedStyle(el).opacity)) === '1',
    'PY-5 : en-tête non voilé',
  );
  await p.locator('.p-form input[type=email]').fill('lea@example.com');
  await p.locator('.p-form input[type=checkbox]').check();
  await p.locator('.p-form button[type=submit]').click();
  await p.waitForSelector('.p-form', { state: 'detached' });
  for (let i = 0; i < 3; i++) {
    await next(p);
    await p.waitForTimeout(300);
  }
  ok(
    (await p.locator('.p-tip .p-btn-primary').textContent()).trim() === 'Terminer',
    'PY-6 : « Terminer » sur la dernière bulle',
  );
  await next(p);
  await p.waitForSelector('.p-end');
  ok(
    (await p.locator('#p-end-title').textContent()) === 'Tutoriel terminé',
    'PY-6 : carte « Tutoriel terminé »',
  );
  ok(
    (await p.locator('.p-end .p-sub').textContent())
      .replace(/\u202f/g, ' ')
      .includes('les 6 étapes de « Créer une fiche usager »'),
    'PY-6 : récapitulatif',
  );
  ok(
    (await p.locator('.p-end .p-btn-primary').textContent()).includes('Revenir au centre de formation'),
    'PY-6 : CTA de la page',
  );
  await p.getByRole('button', { name: 'Recommencer' }).click();
  ok(
    (await p.locator('.p-controls .p-count').textContent()) === '1 / 6',
    'PY-6 : « Recommencer » revient à l’étape 1',
  );

  // Sans CTA de page : « Recommencer » seul, en secondaire
  const p2 = await open(
    { width: 1440, height: 900 },
    {
      ...manifest,
      cta: null,
      forms: [],
      steps: manifest.steps.slice(0, 1).map((s) => ({ ...s, gateFormId: null })),
    },
  );
  await next(p2);
  await p2.waitForSelector('.p-end');
  ok(
    (await p2.locator('.p-end .p-btn-secondary').count()) === 1 &&
      (await p2.locator('.p-end .p-btn-primary').count()) === 0,
    'PY-6 : sans CTA, « Recommencer » en secondaire',
  );

  // Écran de fin en texte (EDT-09) : carte sur la capture précédente assombrie, CTA + Recommencer
  const endStep = {
    id: 'end',
    kind: 'text',
    title: 'Merci !',
    body: 'Réservez une **démo**',
    hotspots: [],
    cta: { label: 'Réserver une démo', url: 'https://example.com' },
  };
  const p3 = await open(
    { width: 1440, height: 900 },
    { ...manifest, forms: [], steps: [{ ...manifest.steps[0], gateFormId: null }, endStep] },
  );
  await next(p3);
  await p3.waitForSelector('.p-end-text');
  ok((await p3.locator('.p-stage.is-backdrop').count()) === 1, 'EDT-09 : fin sur la capture précédente');
  ok(
    (await p3.locator('.p-end-text .p-btn-primary').textContent()).includes('Réserver une démo') &&
      (await p3.locator('.p-end-text').getByText('Recommencer').count()) === 1 &&
      (await p3.locator('.p-end-text').getByText('Précédent').count()) === 0,
    'EDT-09 : bouton principal + Recommencer, sans Précédent',
  );

  // Mobile : feuille du bas, méta et langue masquées
  const m = await open({ width: 390, height: 844 });
  ok(
    !(await m.locator('.p-meta').isVisible()) && !(await m.locator('.p-lang').isVisible()),
    'PY-7 : méta et langue masquées',
  );
  ok((await m.locator('.p-sheet').count()) === 1, 'PY-7 : bulle en feuille du bas');
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
