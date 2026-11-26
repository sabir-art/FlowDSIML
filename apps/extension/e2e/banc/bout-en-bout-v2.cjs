/**
 * Sandbox v2, étape 3d : de bout en bout. Chaque site du banc est capturé en Sandbox avec l'extension
 * construite et chargée, envoyé depuis « Vérifier avant l'envoi », puis rouvert dans la VRAIE app avec
 * exactement ce que l'extension a envoyé (copies inertes, enregistrements vivants, étapes, réglages) :
 * éditeur (réglage « Sandbox vivant » activé), puis aperçu du lecteur, où le parcours du visiteur est joué
 * comme sur le site. Mesure la fidélité d'interaction dans le vrai lecteur et vérifie qu'aucune requête
 * de la page ne sort.
 * Prérequis : app et lecteur (APP_URL, PLAYER_URL), faux Supabase de l'extension, banc, build WXT_E2E=1.
 * Usage : node e2e/banc/bout-en-bout-v2.cjs [RAPPORT=…] [SHOTS_DIR=…]
 */
const fs = require('node:fs');
const { chromium } = require('playwright');
const { SITES, verifier } = require('./mesure-sandbox.cjs');
const { envoyer } = require('./capture-v2.cjs');
const { install, seed } = require('../../../web/e2e/fake-supabase.cjs');
const MOCK = 'http://localhost:54400';
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const RAPPORT = process.env.RAPPORT;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const lignes = [];
const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  lignes.push({ ok: !!c, l });
  if (!c) process.exitCode = 1;
};
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 100);

/** Ouvre l'envoi dans l'app, vérifie le réglage, joue le parcours dans l'aperçu du lecteur. */
async function juger(b, s, e) {
  const state = seed();
  const base = state.tables.steps.find((x) => x.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  const d = state.tables.demos.find((x) => x.id === DEMO);
  d.title = e.demo.title;
  d.kind = e.demo.kind;
  d.sandbox = e.demo.sandbox;
  state.htmlPages = {};
  state.livePages = {};
  state.tables.steps = state.tables.steps.filter((x) => x.demo_id !== DEMO);
  e.steps.forEach((st, i) => {
    const html = `${ws}/${DEMO}/${st.id}.html`;
    const live = st.html_live_path ? `${ws}/${DEMO}/${st.id}.json` : null;
    state.htmlPages[html] = e.pages[i];
    if (live) state.livePages[live] = e.lives[i];
    state.tables.steps.push({
      ...base,
      id: st.id,
      position: st.position,
      kind: 'html',
      title: st.title,
      page_url: st.page_url,
      image_path: null,
      html_path: html,
      html_live_path: live,
      html_ops: st.html_ops,
      html_meta: st.html_meta,
      options: { ...base.options, ...st.options },
    });
  });

  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  ctx.setDefaultTimeout(4000);
  const p = await ctx.newPage();
  const erreurs = [];
  // Erreurs de l'app seulement : celles du script de la page rejouée (cadre about:srcdoc, par exemple une
  // lecture non capturée qui reçoit 404) font partie de la page et sont comptées dans la fidélité
  const dePage = [];
  p.on('pageerror', (x) => {
    if (/lacks the 'allow-same-origin' flag/.test(x.message)) return;
    (/about:srcdoc/.test(x.stack ?? '') ? dePage : erreurs).push(x.message);
  });
  // Sorties : requêtes de la PAGE rejouée (cadre du lecteur), hors celles que la CSP bloque
  const vues = new Set();
  const csp = new Set();
  ctx.on('request', (r) => {
    if (/^(data|about|blob):/.test(r.url())) return;
    const f = r.frame();
    if (f && f.parentFrame() && f.parentFrame().parentFrame()) vues.add(r);
  });
  ctx.on('requestfailed', (r) => /csp/i.test(r.failure()?.errorText ?? '') && csp.add(r));
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.frameLocator('.html-stage iframe').locator('body').waitFor({ timeout: 15000 });
  await p
    .getByRole('radiogroup', { name: 'Affichage du canevas' })
    .getByRole('radio', { name: 'Plan' })
    .click();
  const reglage = p.getByLabel('Sandbox vivant', { exact: true });
  const reglageOk = await reglage
    .waitFor({ timeout: 8000 })
    .then(() => reglage.isChecked())
    .catch(() => false);
  ok(reglageOk, `${s.nom} : éditeur, « Sandbox vivant » activé pour la démo envoyée`);

  await p.getByRole('radio', { name: 'Aperçu' }).click();
  const c = p.frameLocator('iframe.preview-frame').frameLocator('.p-html-frame iframe');
  await c.locator('body').waitFor({ timeout: 15000 });
  await p.waitForTimeout(800);
  const res = [];
  for (const g of s.parcours) {
    let r = false;
    try {
      if (g.faire) await g.faire(c);
      await p.waitForTimeout(500);
      r = await verifier(c, g);
    } catch {
      r = false;
    }
    res.push(r);
  }
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/v2-${s.id}-apercu.png` });
  const sorties = [...vues].filter((r) => !csp.has(r)).map((r) => r.url());
  ok(sorties.length === 0, `${s.nom} : aucune requête de la page vers l'extérieur (${sorties.join(', ')})`);
  ok(erreurs.length === 0, `${s.nom} : aucune erreur de l'app (${erreurs.join(' | ').slice(0, 300)})`);
  await ctx.close();
  return res;
}

(async () => {
  await fetch(`${MOCK}/__html-capture`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  await fetch(`${MOCK}/__sandbox-live`, { method: 'POST', body: 'true' });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch();
  const tableau = [];
  for (const s of SITES) {
    const e = await envoyer(s);
    ok(
      !e.capture.erreur && e.lives.length === e.steps.length && e.demo?.sandbox?.live === true,
      `${s.nom} : capturé en Sandbox, ${e.lives.length}/${e.steps.length} pages vivantes envoyées`,
    );
    const res = await juger(b, s, e);
    tableau.push({ nom: s.nom, res, gestes: s.parcours.map((g) => g.nom) });
    console.error(`${s.id} : ${res.filter(Boolean).length}/${res.length} gestes dans le vrai lecteur`);
  }
  await b.close();
  const reussis = tableau.reduce((n, x) => n + x.res.filter(Boolean).length, 0);
  const total = tableau.reduce((n, x) => n + x.res.length, 0);
  console.error(`Fidélité d'interaction dans le lecteur (de bout en bout) : ${pct(reussis, total)} %`);
  if (RAPPORT) {
    const l = [
      '| Site d’essai | Gestes réussis dans l’aperçu du lecteur |',
      '|---|---|',
      ...tableau.map((x) => `| ${x.nom} | ${x.res.filter(Boolean).length}/${x.res.length} |`),
      `| **Total** | **${pct(reussis, total)} %** |`,
      '',
      ...tableau.map(
        (x) => `- **${x.nom}** : ${x.gestes.map((g, i) => `${x.res[i] ? '✓' : '✗'} ${g}`).join(' · ')}`,
      ),
      '',
      `Contrôles : ${lignes.filter((x) => x.ok).length}/${lignes.length} réussis.`,
      ...lignes.filter((x) => !x.ok).map((x) => `- ✗ ${x.l}`),
    ];
    fs.writeFileSync(RAPPORT, `${l.join('\n')}\n`);
  }
})().catch((x) => {
  console.error(x);
  process.exit(1);
});
