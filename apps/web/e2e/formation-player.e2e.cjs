/**
 * Test e2e L17 (lecteur) : étape Avant / Après (côte à côte, curseur, bascule imposée sous 640 px),
 * termes du glossaire soulignés (info-bulle, Échap) et tiroir « Glossaire ».
 * Données fictives. Usage : SHOTS_DIR=… [THEME=dark] node e2e/formation-player.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));
const DEMO = '0b5c1f0e-0000-4000-8000-0000000000a7';
const img = { url: 'assets/a.webp', width: 1100, height: 750 };
const before = { url: 'assets/b.webp', width: 1100, height: 750 };
const notes = {
  before: 'Rapports, puis Exporter, puis tableur.',
  after: 'Bouton « Nouveau rapport » en haut à droite.',
};
const ba = (layout) => ({
  layout,
  labels: { before: '', after: '' },
  notes,
  before,
  // Flou sur l'adresse e-mail : le titre de la capture reste lisible
  beforeBlurs: [{ x: 0.8, y: 0.0, w: 0.19, h: 0.07, style: 'blur' }],
});
const manifest = {
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000a8',
  workspaceId: 'w',
  workspaceName: 'Centre de formation Acme',
  title: 'Créer un rapport dans le nouvel outil',
  locale: 'fr',
  publishedAt: '2026-11-19T10:00:00Z',
  theme: {},
  variables: [{ key: 'outil', label: 'Outil', default: 'tableau de bord' }],
  steps: [
    { id: 's1', kind: 'before_after', image: img, beforeAfter: ba('side') },
    { id: 's2', kind: 'before_after', image: img, beforeAfter: ba('slider') },
    {
      id: 's3',
      kind: 'image',
      image: img,
      hotspots: [
        {
          id: 'h1',
          x: 0.82,
          y: 0.08,
          w: 0.12,
          h: 0.06,
          title: 'Créer un rapport',
          body: 'Cliquez sur « Nouveau rapport ». Le rapport apparaît aussitôt dans le tableau de bord de l’équipe, à côté de votre {{outil}}.',
          placement: 'auto',
          action: { type: 'next' },
        },
      ],
      options: { showPrev: true },
    },
    { id: 's4', kind: 'text', title: 'Fin', body: 'Le dossier usager est à jour.' },
  ],
  glossary: [
    {
      term: 'Tableau de bord',
      oldTerm: 'synthèse mensuelle',
      definition: 'Page d’accueil qui regroupe vos indicateurs, mise à jour en continu.',
      forms: [],
    },
    {
      term: 'Dossier usager',
      oldTerm: 'fiche bénéficiaire',
      definition: 'Toutes les informations d’une personne accompagnée, au même endroit.',
      forms: [],
    },
    { term: 'Rendez-vous', oldTerm: null, definition: 'Rencontre prévue.', forms: [] },
  ],
};

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const open = async (viewport) => {
    const page = await (await themedContext(b, { viewport })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await page.route('**/assets/*.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await page.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    await page.goto(`${PLAYER}/#/d/${DEMO}`);
    await page.waitForSelector('.p-ba');
    return page;
  };
  const settle = (page) =>
    page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
  const shot = async (page, name) => {
    await settle(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${sfx}.png` });
  };

  const page = await open({ width: 1280, height: 860 });
  // L17-03 : côte à côte
  ok((await page.locator('.p-ba--side figure').count()) === 2, 'L17-03 : deux captures côte à côte');
  ok(
    (await page.locator('.p-ba-pill--before').first().textContent()) === 'Avant' &&
      (await page.locator('.p-ba-pill--after').first().textContent()) === 'Maintenant',
    'L17-03 : pilules « Avant » et « Maintenant »',
  );
  ok(
    (
      await page.locator('.p-ba-frame.is-old .p-ba-shot').evaluate((e) => getComputedStyle(e).filter)
    ).includes('grayscale'),
    'L17-03 : capture « Avant » désaturée',
  );
  ok(
    (await page.locator('.p-ba-frame.is-old .p-blur').count()) === 1,
    'L17-03 : flou de la capture « Avant »',
  );
  ok((await page.locator('.p-ba-notes').textContent()).includes('Avant : Rapports'), 'L17-03 : notes');
  await shot(page, 'l17-03-cote');

  // L17-04 : curseur
  await page.locator('.p-ba-card').getByRole('button', { name: 'Suivant' }).click();
  const range = page.getByRole('slider', { name: 'Curseur de comparaison Avant / Maintenant' });
  await range.waitFor();
  ok((await range.getAttribute('aria-valuetext')) === '50 % Avant visible', 'L17-04 : valeur annoncée');
  await range.focus();
  await page.keyboard.press('ArrowRight');
  ok((await range.getAttribute('aria-valuetext')) === '55 % Avant visible', 'L17-04 : pas de 5 % au clavier');
  ok(
    (await page.locator('.p-ba-layer.is-old').getAttribute('style')).includes('inset(0px 45% 0px 0px)') ||
      (await page.locator('.p-ba-layer.is-old').getAttribute('style')).includes('inset(0 45% 0 0)'),
    'L17-04 : découpe suit le curseur',
  );
  ok((await page.locator('.p-ba-cmp[role="img"]').count()) === 1, 'L17-04 : comparaison role=img');
  await shot(page, 'l17-04-curseur');

  // L17-09 : terme souligné, info-bulle
  await page.locator('.p-ba-card').getByRole('button', { name: 'Suivant' }).click();
  await page.waitForSelector('.p-term');
  const terms = page.locator('.p-term');
  ok((await terms.count()) === 1, 'L17-09 : première occurrence seulement (et pas dans la variable)');
  await terms.first().focus();
  const tip = page.getByRole('tooltip');
  await tip.waitFor();
  ok(
    (await tip.textContent()).includes('Ancien terme : synthèse mensuelle'),
    'L17-09 : info-bulle avec ancien terme',
  );
  ok((await terms.first().getAttribute('aria-describedby')) === 'p-gloss-tip', 'L17-09 : aria-describedby');
  {
    const tb = await tip.boundingBox();
    const bb = await page.locator('.p-tip').first().boundingBox();
    ok(
      !!tb && !!bb && (tb.y >= bb.y + bb.height || tb.y + tb.height <= bb.y),
      'L17-09 : info-bulle hors de la bulle',
    );
  }
  ok((await page.locator('.p-tip-prev').count()) === 1, 'L17-09 : « Précédent » dans la bulle');
  await shot(page, 'l17-09-terme');
  await page.keyboard.press('Escape');
  ok((await page.getByRole('tooltip').count()) === 0, 'L17-09 : Échap ferme l’info-bulle');

  // L17-10 : tiroir
  await page.getByRole('button', { name: 'Glossaire' }).click();
  const dlg = page.getByRole('dialog', { name: 'Glossaire' });
  await dlg.waitFor();
  ok((await dlg.locator('dt').count()) === 2, 'L17-10 : seuls les termes présents dans la démo (2 sur 3)');
  ok((await dlg.getByRole('status').textContent()) === '2 termes', 'L17-10 : compteur');
  await dlg.getByRole('searchbox', { name: 'Rechercher un terme' }).fill('usager');
  ok((await dlg.locator('dt').count()) === 1, 'L17-10 : recherche');
  await dlg.getByRole('searchbox').fill('');
  await shot(page, 'l17-10-tiroir');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok((await page.getByRole('dialog', { name: 'Glossaire' }).count()) === 0, 'L17-10 : Échap ferme le tiroir');

  // L17-05 : bascule imposée sous 640 px
  const mob = await open({ width: 390, height: 780 });
  ok((await mob.locator('.p-ba--toggle').count()) === 1, 'L17-05 : bascule imposée sous 640 px');
  const seg = mob.getByRole('group', { name: 'Afficher' });
  ok(
    (await seg.getByRole('button', { name: 'Maintenant' }).getAttribute('aria-pressed')) === 'true',
    'L17-05 : « Maintenant » affiché par défaut',
  );
  ok(
    (await mob.getByRole('button', { name: 'Glossaire' }).count()) === 1,
    'L17-05 : bouton nommé « Glossaire »',
  );
  await shot(mob, 'l17-05-bascule');
  await seg.getByRole('button', { name: 'Avant' }).click();
  ok(
    (await seg.getByRole('button', { name: 'Avant' }).getAttribute('aria-pressed')) === 'true' &&
      (await mob.locator('.p-ba-frame.is-old').count()) === 1,
    'L17-05 : « Avant » affiché',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
