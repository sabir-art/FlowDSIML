/**
 * Test e2e L18 (lecteur) : test A/B. Variante B tirée et mémorisée par visiteur, bulle testée avec le
 * texte de B, événements marqués (props.abt, props.abv) ; variante A pour un autre visiteur.
 * Données fictives. Usage : node e2e/ab-player.e2e.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));
const DEMO = '0b5c1f0e-0000-4000-8000-0000000000ab';
const manifest = {
  schemaVersion: 1,
  demoId: DEMO,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000ac',
  workspaceId: 'w',
  title: 'Créer un rapport',
  locale: 'fr',
  publishedAt: '2026-11-19T10:00:00Z',
  theme: {},
  steps: [
    {
      id: 's1',
      kind: 'image',
      image: { url: 'assets/a.webp', width: 1100, height: 750 },
      hotspots: [
        {
          id: 'h1',
          x: 0.8,
          y: 0.1,
          w: 0.1,
          h: 0.06,
          title: 'Texte A',
          body: 'Version d’origine.',
          placement: 'auto',
        },
      ],
    },
    { id: 's2', kind: 'text', title: 'Fin' },
  ],
  ab: {
    testId: 't-ab',
    hotspotId: 'h1',
    splitB: 50,
    b: { title: 'Texte B', body: 'Nouvelle version.', cta: null },
  },
  trackUrl: null,
};

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const run = async (stored) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
    if (stored) await ctx.addInitScript((v) => localStorage.setItem('tc_ab_t-ab', v), stored);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const events = [];
    await page.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', manifest }),
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
    );
    await page.route('**/assets/*.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await page.route('**/functions/v1/track', (r) => {
      try {
        events.push(...(JSON.parse(r.request().postData() || '{}').events ?? []));
      } catch {}
      return r.fulfill({ status: 200, body: '{}' });
    });
    await page.goto(`${PLAYER}/#/d/${DEMO}`);
    await page.waitForSelector('.p-tip-title');
    const title = await page.locator('.p-tip-title').first().textContent();
    const kept = await page.evaluate(() => localStorage.getItem('tc_ab_t-ab'));
    await page.waitForTimeout(2600);
    await ctx.close();
    return { title, kept, events };
  };

  const B = await run('B');
  ok(B.title === 'Texte B', 'variante B : bulle avec le texte de B');
  ok(
    B.events.length > 0 && B.events.every((e) => e.props?.abt === 't-ab' && e.props?.abv === 'B'),
    'événements marqués B',
  );
  const A = await run('A');
  ok(A.title === 'Texte A', 'variante A : texte d’origine');
  ok(A.events.length > 0 && A.events.every((e) => e.props?.abv === 'A'), 'événements marqués A');
  const fresh = await run(null);
  ok(fresh.kept === 'A' || fresh.kept === 'B', 'nouveau visiteur : variante tirée et mémorisée');
  ok(
    fresh.title === (fresh.kept === 'B' ? 'Texte B' : 'Texte A'),
    'nouveau visiteur : bulle cohérente avec sa variante',
  );

  ok(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
