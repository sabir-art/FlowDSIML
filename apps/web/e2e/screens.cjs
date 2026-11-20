/** Génère les captures de tous les écrans (faux Supabase) dans docs/tech/captures/finition. */
const path = require('path');
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
// THEME=dark : mêmes captures en thème sombre, dans finition/sombre/
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const OUT = path.resolve(__dirname, '../../../docs/tech/captures/finition', THEME === 'dark' ? 'sombre' : '');
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const DEMO2 = '0b5c1f0e-0000-4000-8000-000000000002';

(async () => {
  const b = await chromium.launch();
  require('fs').mkdirSync(OUT, { recursive: true });
  const newPage = async (opts) => {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('fd.theme', t);
      } catch {
        /* stockage indisponible */
      }
    }, THEME);
    return ctx.newPage();
  };
  const state = seed();
  const shot = async (page, name, full = false) =>
    page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

  const anon = await newPage({ viewport: { width: 1280, height: 820 } });
  await anon.goto(`${APP}/#/login`);
  await anon.waitForSelector('form');
  await shot(anon, '01-connexion');
  await anon.goto(`${APP}/#/signup`);
  await anon.click('button[type=submit]');
  await anon.fill('#password', 'Correct-Horse-9');
  await shot(anon, '02-inscription-validation');

  const p = await newPage({ viewport: { width: 1440, height: 900 } });
  await install(p, state);
  await p.goto(`${APP}/#/onboarding`);
  await p.waitForSelector('#ws-name');
  await shot(p, '02b-onboarding');
  const go = async (route, sel) => {
    await p.goto(`${APP}/#${route}`);
    await p.waitForSelector(sel);
    await p.waitForTimeout(400);
  };
  await go('/', '.demo-card');
  await shot(p, '03-demos');
  await p.getByRole('button', { name: 'Actions pour Démo CRM' }).click();
  await shot(p, '04-demos-menu');
  await go(`/demos/${DEMO}/edit`, '.canvas-frame img');
  await shot(p, '05-editeur');
  await p.getByRole('tab', { name: 'Design' }).click();
  await shot(p, '06-editeur-design');
  await p.getByRole('tab', { name: 'Réglages' }).click();
  await shot(p, '07-editeur-reglages');
  await p.getByRole('tab', { name: 'Étape' }).click();
  await p.locator('.canvas-hotspot').first().click();
  await p.waitForSelector('#hs-title');
  await shot(p, '08-editeur-hotspot');
  await p.getByRole('button', { name: 'Publier' }).click();
  // F1 : confirmation RGPD avant la publication publique
  const gdpr = p.locator('dialog.gdpr-dialog[open]');
  await gdpr.waitFor();
  await gdpr.getByLabel(/J’ai relu|J'ai relu/).check();
  await gdpr.getByLabel(/fictives ou floutées/).check();
  await gdpr.getByRole('button', { name: 'Publier en public' }).click();
  await p.waitForURL(/share/);
  await p.waitForTimeout(500);
  await shot(p, '09-partage', true);
  await go(`/demos/${DEMO2}/analytics`, '.kpi-tab');
  await shot(p, '10-analytics-demo', true);
  await go('/analytics', '.fd-table tbody tr');
  await shot(p, '11-analytics-workspace');
  await go('/leads', '.fd-table');
  await shot(p, '12-leads');
  await go('/settings/members', '.fd-table');
  await shot(p, '13-membres');
  await go('/settings/workspace', '#ws-name');
  await shot(p, '14-parametres', true);
  await go('/settings/plans', '.plan-card');
  await shot(p, '15b-plans', true);
  await go('/settings/profile', '#fn');
  await shot(p, '15-profil');

  const pl = await newPage({ viewport: { width: 1280, height: 820 } });
  await install(pl, state);
  await pl.goto(`${PLAYER}/#/d/${DEMO}?company=Acme`);
  await pl.waitForSelector('.p-tip');
  await shot(pl, '16-player');
  const m = await newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
  await install(m, state);
  await m.goto(`${PLAYER}/#/d/${DEMO}`);
  await m.waitForSelector('.p-sheet');
  await shot(m, '17-player-mobile');
  const ex = await newPage({ viewport: { width: 390, height: 780 } });
  await install(ex, state);
  await ex.goto(`${PLAYER}/#/l/inconnu123`);
  await ex.waitForSelector('.p-sys-card h1');
  await shot(ex, '18-player-lien-expire');
  const mm = await newPage({ viewport: { width: 390, height: 780 } });
  await install(mm, state);
  await mm.goto(`${APP}/#/`);
  await mm.waitForSelector('.demo-card');
  await shot(mm, '19-demos-mobile');
  await mm.goto(`${APP}/#/demos/${DEMO}/edit`);
  await mm.waitForSelector('main h1');
  await shot(mm, '20-editeur-ecran-etroit');
  await b.close();
  console.log('captures écrites dans', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
