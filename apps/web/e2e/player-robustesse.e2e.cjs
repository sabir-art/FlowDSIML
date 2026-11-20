/**
 * Test e2e L36 : robustesse du lecteur public. Réseau coupé puis rétabli, réseau lent, démo supprimée
 * pendant la lecture (captures et statistiques en erreur), vidéo absente, démo de 200 étapes.
 * Données fictives. Usage : node e2e/player-robustesse.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

const DEMO = '0b5c1f0e-0000-4000-8000-0000000000c1';
const imageStep = (n, chapterId = 'c1') => ({
  id: `s${n}`,
  kind: 'image',
  image: { url: `assets/s${n}.png`, width: 1100, height: 750 },
  title: `Étape ${n}`,
  body: '',
  chapterId,
  hotspots: [
    {
      id: `h${n}`,
      x: 0.44,
      y: 0.45,
      w: 0.04,
      h: 0.04,
      title: `Étape ${n}`,
      body: 'Poursuivez le tutoriel.',
      placement: 'auto',
      action: { type: 'next' },
    },
  ],
});
const manifest = (steps, chapters = [{ id: 'c1', title: 'Fiche usager' }]) => ({
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000c2',
  workspaceId: 'w',
  workspaceName: 'Espace exemple',
  title: 'Créer une fiche usager',
  locale: 'fr',
  publishedAt: '2026-11-20T10:00:00Z',
  theme: {},
  variables: [],
  chapters,
  steps,
});
const SMALL = manifest([1, 2, 3, 4].map((n) => imageStep(n)));
const VIDEO = manifest([
  {
    id: 'v1',
    kind: 'video',
    title: 'Saisie de la fiche',
    chapterId: 'c1',
    video: { url: 'assets/absente.webm', durationMs: 12000, cuts: [], pauses: [], captions: [] },
  },
  { id: 'v2', kind: 'text', title: 'Merci', body: '', chapterId: 'c1' },
]);
// 200 étapes réparties en 10 chapitres
const CHAPTERS = Array.from({ length: 10 }, (_, i) => ({ id: `c${i + 1}`, title: `Chapitre ${i + 1}` }));
const LONG = manifest(
  Array.from({ length: 200 }, (_, i) => imageStep(i + 1, `c${Math.floor(i / 20) + 1}`)),
  CHAPTERS,
);

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  /**
   * Ouvre le lecteur. `open` répond à open-demo (par défaut : la démo), `image` aux captures (par défaut :
   * l'image fixe), `track` aux statistiques.
   */
  async function go({ open, image, track, viewport = { width: 1280, height: 860 } } = {}) {
    const ctx = await b.newContext({ viewport, locale: 'fr-FR' });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const calls = { open: 0, track: 0 };
    await p.route('**/functions/v1/open-demo', async (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      calls.open++;
      if (open) return open(r, calls.open);
      return r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest: SMALL }),
      });
    });
    await p.route('**/assets/**', (r) =>
      image ? image(r) : r.fulfill({ contentType: 'image/png', body: png }),
    );
    await p.route('**/functions/v1/track', (r) => {
      calls.track++;
      return track ? track(r) : r.fulfill({ status: 200, headers: cors, body: '{}' });
    });
    await p.route('**/rest/v1/rpc/**', (r) =>
      r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: 'null' }),
    );
    await p.goto(`${PLAYER}/#/d/${DEMO}`);
    return { p, ctx, errors, calls };
  }
  const json = (body) => ({ contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  const live = (p) => p.locator('[aria-live=polite][aria-atomic=true]').first();

  // ===== 1. Réseau coupé à l'ouverture, puis rétabli =====
  {
    let down = true;
    const { p, ctx, errors, calls } = await go({
      open: (r) =>
        down ? r.abort('internetdisconnected') : r.fulfill(json({ status: 'ok', manifest: SMALL })),
    });
    const title = p.getByRole('heading', { name: 'Connexion impossible' });
    await title.waitFor();
    ok(true, 'Réseau coupé : écran « Connexion impossible » (et non « Démo introuvable »)');
    ok((await p.getByText('Démo introuvable').count()) === 0, 'Réseau coupé : pas de « Démo introuvable »');
    const retry = p.getByRole('button', { name: 'Réessayer' });
    ok(await retry.isVisible(), 'Réseau coupé : bouton « Réessayer »');
    // Toujours coupé : nouvel essai, même écran
    await retry.click();
    await title.waitFor();
    ok(calls.open === 2, `Réessayer relance l'ouverture (${calls.open} appels)`);
    // Réseau rétabli : le clic ouvre la démo
    down = false;
    await p.getByRole('button', { name: 'Réessayer' }).click();
    await p.locator('.p-img').waitFor();
    ok(/Étape 1 sur 4/.test(await live(p).textContent()), 'Réseau rétabli + Réessayer : étape 1 affichée');
    ok(errors.length === 0, `Réseau coupé : aucune erreur JavaScript (${errors.join(' | ')})`);
    await ctx.close();
  }
  // Retour du réseau détecté par le navigateur : nouvel essai automatique
  {
    const { p, ctx } = await go({
      open: (r, n) =>
        n === 1 ? r.abort('internetdisconnected') : r.fulfill(json({ status: 'ok', manifest: SMALL })),
    });
    await p.getByRole('heading', { name: 'Connexion impossible' }).waitFor();
    await ctx.setOffline(true);
    await ctx.setOffline(false);
    await p.locator('.p-img').waitFor({ timeout: 5000 });
    ok(true, 'Événement « online » : la démo s’ouvre sans clic');
    await ctx.close();
  }
  // Serveur indisponible (503) : même écran, on peut réessayer
  {
    const { p, ctx } = await go({ open: (r) => r.fulfill({ status: 503, headers: cors, body: '' }) });
    await p.getByRole('heading', { name: 'Connexion impossible' }).waitFor();
    ok(true, 'Serveur indisponible (503) : écran « Connexion impossible »');
    await ctx.close();
  }

  // ===== 2. Réseau lent =====
  {
    const { p, ctx } = await go({
      open: async (r) => {
        await new Promise((res) => setTimeout(res, 6500));
        return r.fulfill(json({ status: 'ok', manifest: SMALL }));
      },
    });
    const status = p.getByRole('status').filter({ hasText: 'Chargement de la démo' });
    await status.waitFor();
    ok(
      (await p.getByText('La connexion est lente').count()) === 0,
      'Réseau lent : pas de message les premières secondes',
    );
    await p.getByText('La connexion est lente, le chargement continue…').waitFor({ timeout: 7000 });
    ok(true, 'Réseau lent : message « La connexion est lente » après 5 s');
    await p.locator('.p-img').waitFor({ timeout: 10000 });
    ok(true, 'Réseau lent : la démo finit par s’ouvrir');
    await ctx.close();
  }
  // Pas de réponse du tout : délai dépassé, écran « Connexion impossible »
  {
    const { p, ctx } = await go({ open: () => new Promise(() => {}) });
    const t0 = Date.now();
    await p.getByRole('heading', { name: 'Connexion impossible' }).waitFor({ timeout: 30000 });
    const s = Math.round((Date.now() - t0) / 1000);
    ok(s <= 25, `Sans réponse : délai dépassé, « Connexion impossible » (${s} s)`);
    await ctx.close();
  }

  // ===== 3. Démo supprimée pendant la lecture =====
  {
    let deleted = false;
    const { p, ctx, errors, calls } = await go({
      image: (r) =>
        deleted && !r.request().url().endsWith('/s1.png')
          ? r.fulfill({ status: 404, body: '' })
          : r.fulfill({ contentType: 'image/png', body: png }),
      track: (r) => r.fulfill({ status: deleted ? 404 : 200, headers: cors, body: '{}' }),
      open: (r) =>
        r.fulfill(deleted ? json({ status: 'not_found' }) : json({ status: 'ok', manifest: SMALL })),
    });
    await p.locator('.p-img').waitFor();
    deleted = true;
    // L'étape 2 a été préchargée avant la suppression : elle s'affiche ; l'étape 3 ne l'a pas été
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(400);
    ok((await p.locator('.p-img').count()) === 1, 'Démo supprimée : capture déjà préchargée affichée');
    await p.keyboard.press('ArrowRight');
    const missing = p.locator('.p-img-missing');
    await missing.waitFor();
    ok(
      (await missing.textContent()).includes('Cette image n’a pas pu être chargée.'),
      'Démo supprimée : message à la place de la capture',
    );
    ok(/Étape 3 sur 4/.test(await live(p).textContent()), 'Démo supprimée : l’étape reste annoncée');
    ok(
      (await p.locator('.p-hotspot, .p-beacon, [class*=hotspot]').count()) > 0,
      'Démo supprimée : pastille encore là',
    );
    // La navigation continue
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(400);
    ok(/Étape 4 sur 4/.test(await live(p).textContent()), 'Démo supprimée : → passe à l’étape 4');
    ok(errors.length === 0, `Démo supprimée : aucune erreur JavaScript (${errors.join(' | ')})`);
    // Les statistiques partent par lot, 2 s après le dernier événement
    await p.waitForTimeout(2600);
    ok(calls.track > 0, `Démo supprimée : statistiques refusées (404) sans blocage (${calls.track} envois)`);
    // Capture de nouveau disponible : Réessayer la recharge
    deleted = false;
    await p.getByRole('button', { name: 'Réessayer' }).click();
    await p.locator('.p-img').waitFor();
    ok((await p.locator('.p-img-missing').count()) === 0, 'Capture rétablie : Réessayer l’affiche');
    await ctx.close();
  }

  // ===== 4. Vidéo absente =====
  {
    const { p, ctx, errors } = await go({
      open: (r) => r.fulfill(json({ status: 'ok', manifest: VIDEO })),
      image: (r) => r.fulfill({ status: 404, body: '' }),
    });
    const alert = p.getByRole('alert').filter({ hasText: 'La vidéo n’a pas pu être chargée.' });
    await alert.waitFor();
    ok(true, 'Vidéo absente : message « La vidéo n’a pas pu être chargée. »');
    ok(
      await alert.getByRole('button', { name: 'Réessayer' }).isVisible(),
      'Vidéo absente : bouton Réessayer',
    );
    await alert.getByRole('button', { name: 'Réessayer' }).click();
    await alert.waitFor();
    ok(true, 'Vidéo toujours absente : le message revient après Réessayer');
    await alert.getByRole('button', { name: 'Suivant' }).click();
    await p.getByRole('heading', { name: 'Merci' }).waitFor();
    ok(true, 'Vidéo absente : « Suivant » passe à l’étape suivante');
    ok(errors.length === 0, `Vidéo absente : aucune erreur JavaScript (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ===== 5. Démo de 200 étapes =====
  for (const viewport of [
    { width: 1280, height: 860 },
    { width: 390, height: 844 },
  ]) {
    const w = viewport.width;
    const t0 = Date.now();
    const { p, ctx, errors } = await go({
      viewport,
      open: (r) => r.fulfill(json({ status: 'ok', manifest: LONG })),
    });
    await p.locator('.p-img').waitFor();
    const open = Date.now() - t0;
    ok(/Étape 1 sur 200/.test(await live(p).textContent()), `200 étapes (${w}) : « Étape 1 sur 200 »`);
    ok(open < 5000, `200 étapes (${w}) : ouverture en ${open} ms`);
    const nodes = await p.evaluate(() => document.querySelectorAll('*').length);
    ok(nodes < 3000, `200 étapes (${w}) : DOM raisonnable (${nodes} nœuds)`);
    // 199 fois → : temps moyen par étape
    const t1 = Date.now();
    for (let i = 0; i < 199; i++) await p.keyboard.press('ArrowRight');
    await p.waitForFunction(
      () =>
        /Étape 200 sur 200/.test(
          document.querySelector('[aria-live=polite][aria-atomic=true]')?.textContent ?? '',
        ),
      null,
      { timeout: 20000 },
    );
    const per = Math.round((Date.now() - t1) / 199);
    ok(per < 60, `200 étapes (${w}) : ${per} ms par étape au clavier, jusqu’à « Étape 200 sur 200 »`);
    const r = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    ok(r.sw <= r.cw + 1, `200 étapes (${w}) : pas de défilement horizontal (${r.sw} / ${r.cw})`);
    const progress = await p.evaluate(() => {
      const el = document.querySelector('[role=progressbar]');
      return el ? { now: el.getAttribute('aria-valuenow'), max: el.getAttribute('aria-valuemax') } : null;
    });
    ok(
      !progress || Number(progress.now) === Number(progress.max) || Number(progress.now) === 100,
      `200 étapes (${w}) : progression au maximum (${JSON.stringify(progress)})`,
    );
    ok(errors.length === 0, `200 étapes (${w}) : aucune erreur JavaScript (${errors.join(' | ')})`);
    await ctx.close();
  }

  await b.close();
})().catch((e) => {
  // Une exception (délai d'attente dépassé…) compte comme un échec visible dans la CI
  console.log(`NOT OK - ${e.message.split('\n')[0]}`);
  process.exit(1);
});
