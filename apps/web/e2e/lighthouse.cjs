/**
 * L31 : audit Lighthouse (mobile) sur les builds de production servis localement, avec le faux Supabase
 * (session connectée, données fictives). Pages : connexion, tableau de bord, éditeur, lecteur.
 * Prérequis : `vite build` puis `vite preview` du web (WEB_URL) et du lecteur (PLAYER_URL).
 * Usage : WEB_URL=http://localhost:4173 PLAYER_URL=http://localhost:4174 OUT=dossier node e2e/lighthouse.cjs
 */
const { chromium } = require('playwright');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { install, seed } = require('./fake-supabase.cjs');

const WEB = process.env.WEB_URL || 'http://localhost:4173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:4174';
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'lh-'));
const PORT = 9333;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const manifest = require('./player-ux.manifest.cjs');
const png = fs.readFileSync(path.join(__dirname, '../public/icon-192.png'));

const PAGES = [
  { name: 'connexion', url: `${WEB}/#/login`, auth: false },
  { name: 'tableau-de-bord', url: `${WEB}/#/`, auth: true },
  { name: 'editeur', url: `${WEB}/#/demos/${DEMO}/edit`, auth: true },
  { name: 'lecteur', url: `${PLAYER}/#/d/${manifest.demoId}`, auth: false, player: true },
];

(async () => {
  const results = [];
  for (const p of PAGES) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-profile-'));
    const ctx = await chromium.launchPersistentContext(dir, {
      args: [`--remote-debugging-port=${PORT}`],
    });
    const state = seed();
    if (!p.auth) state.signedOut = true;
    if (p.player) {
      await ctx.route('**/functions/v1/open-demo', (r) =>
        r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', manifest }) }),
      );
      await ctx.route('**/assets/a.webp', (r) => r.fulfill({ contentType: 'image/png', body: png }));
      await ctx.route('**/functions/v1/track', (r) => r.fulfill({ status: 200, body: '{}' }));
    } else {
      // BrowserContext offre route et addInitScript comme Page : les onglets ouverts par Lighthouse en profitent
      await install(ctx, state);
    }
    const json = path.join(OUT, `${p.name}.json`);
    try {
      // Asynchrone : les routes du faux Supabase sont servies par ce processus pendant l'audit
      await run(
        'npx',
        [
          '-y',
          'lighthouse@12.8.2',
          p.url,
          `--port=${PORT}`,
          '--only-categories=performance,accessibility',
          '--disable-storage-reset',
          '--output=json',
          `--output-path=${json}`,
          '--quiet',
          '--locale=fr',
        ],
        { timeout: 300_000, maxBuffer: 64 * 1024 * 1024 },
      );
      const r = JSON.parse(fs.readFileSync(json, 'utf8'));
      const score = (c) => Math.round((r.categories[c]?.score ?? 0) * 100);
      const fails = Object.values(r.audits)
        .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative')
        .filter((a) =>
          r.categories.accessibility.auditRefs.some((x) => x.id === a.id) ? true : a.score < 0.5,
        )
        .map((a) => `${a.id}${a.displayValue ? ` (${a.displayValue})` : ''}`);
      results.push({ page: p.name, perf: score('performance'), a11y: score('accessibility'), fails });
    } catch (e) {
      results.push({ page: p.name, error: String(e.message).slice(0, 200) });
    }
    await ctx.close();
  }
  for (const r of results)
    console.log(
      r.error
        ? `${r.page} : ERREUR ${r.error}`
        : `${r.page} : performance ${r.perf}, accessibilité ${r.a11y}${r.fails.length ? `\n    à revoir : ${r.fails.join(', ')}` : ''}`,
    );
  console.log(`Rapports JSON : ${OUT}`);
})();
