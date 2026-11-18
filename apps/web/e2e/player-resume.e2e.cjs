/** L13 : reprise « Bon retour » dans le lecteur (lien personnalisé, learner_resume). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const manifest = require('./player-maquette.cjs');
const SHOTS = process.env.SHOTS_DIR;

const RESUME = {
  firstName: 'Alex',
  module: { demoId: manifest.demoId, seen: 3, total: manifest.steps.length, status: 'in_progress' },
  path: {
    title: 'Logiciel métier',
    ordered: true,
    modules: [
      { title: 'Prise en main', status: 'validated', seen: 8, total: 8, current: false },
      { title: 'Fiches usagers', status: 'in_progress', seen: 3, total: manifest.steps.length, current: true },
      { title: 'Agenda', status: null, seen: null, total: null, current: false },
    ],
  },
};

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  async function open(resume, viewport = { width: 1440, height: 900 }) {
    const p = await b.newPage({ viewport, locale: 'fr-FR' });
    const calls = [];
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    await p.route('**/rest/v1/rpc/**', (r) => {
      const fn = new URL(r.request().url()).pathname.split('/').pop();
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      calls.push({ fn, body: JSON.parse(r.request().postData() || '{}') });
      const body =
        fn === 'resolve_share_link'
          ? { demoId: manifest.demoId, linkId: 'link-1', variables: { first_name: 'Alex' } }
          : fn === 'learner_resume'
            ? resume
            : 'ok';
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: cors });
    });
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', manifest }), headers: cors }),
    );
    await p.route('**/assets/a.webp', (r) =>
      r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'fixture.png')) }),
    );
    await p.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}', headers: cors }));
    await p.goto(`${PLAYER}/#/l/jeton-exemple`);
    return { p, calls };
  }

  // Reprise proposée
  const { p, calls } = await open(RESUME);
  const card = p.getByRole('dialog', { name: 'Bon retour, Alex' });
  await card.waitFor();
  ok(
    calls.some((c) => c.fn === 'learner_resume' && c.body.p_link_token === 'jeton-exemple' && c.body.p_demo === manifest.demoId),
    'L13 : learner_resume appelée avec le jeton du lien et la démo',
  );
  ok(await p.evaluate(() => document.activeElement?.id === 'p-rs-t'), 'L13 : focus sur le titre');
  ok((await card.textContent()).includes('l’étape 4 sur 6 du module « Fiches usagers »'), 'L13 : étape où reprendre');
  ok((await card.locator('.p-resume-steps span.on').count()) === 4, 'L13 : barre d’étapes');
  ok((await card.locator('li').nth(2).textContent()).includes('Après le module 2'), 'L13 : module suivant verrouillé (ordre imposé)');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l13-resume.png` });
  await card.getByRole('button', { name: 'Reprendre à l’étape 4' }).click();
  await p.waitForSelector('.p-stage');
  await p.waitForTimeout(400);
  ok(/4\s*\/\s*6|Étape 4|4 sur 6/.test(await p.locator('.p-root').textContent()), 'L13 : lecteur ouvert à l’étape 4');
  await p.close();

  // Recommencer
  const r2 = await open(RESUME);
  await r2.p.getByRole('button', { name: 'Recommencer le module' }).click();
  await r2.p.waitForSelector('.p-stage');
  await r2.p.waitForTimeout(400);
  ok((await r2.p.getByRole('dialog', { name: /Bon retour/ }).count()) === 0, 'L13 : Recommencer ouvre le lecteur');
  await r2.p.close();

  // Réponse vide (lien invalide, démo non publiée…) : pas de carte, lecteur direct
  const r3 = await open({});
  await r3.p.waitForSelector('.p-stage');
  ok((await r3.p.getByRole('dialog', { name: /Bon retour/ }).count()) === 0, 'L13 : réponse vide, pas de reprise');
  await r3.p.close();

  // Module terminé : pas de reprise
  const r4 = await open({ ...RESUME, module: { ...RESUME.module, seen: 6, status: 'validated' } });
  await r4.p.waitForSelector('.p-stage');
  ok((await r4.p.getByRole('dialog', { name: /Bon retour/ }).count()) === 0, 'L13 : module terminé, pas de reprise');
  await r4.p.close();

  // Mobile
  const r5 = await open(RESUME, { width: 390, height: 844 });
  await r5.p.getByRole('dialog', { name: 'Bon retour, Alex' }).waitFor();
  if (SHOTS) await r5.p.screenshot({ path: `${SHOTS}/l13-resume-mobile.png` });
  const overflow = await r5.p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!overflow, 'L13 : pas de défilement horizontal sur mobile');
  await b.close();
})();
