/**
 * Sandbox v2, étape 4d (docs/tech/sandbox-v2.md §10) : capture EN SÉRIE du site de plusieurs pages du banc,
 * avec l'extension construite et chargée. Partie sans interface : l'enchaînement des pages est celui de la
 * capture en série (fonctions pures linkedPages / nextBatch de l'extension, profondeur 1 par passe, 20 pages
 * au plus, même site seulement, jamais une adresse d'action ni un fichier), joué dans l'onglet capturé comme
 * le fera « Capturer les pages liées » (4c, interface en attente du client).
 *
 * Contrôles :
 *  - passes : 1) Produits, Tarifs, Aide ; 2) ExempleCRM, ExempleFacture, Questions fréquentes ; puis plus rien ;
 *  - aucun piège ouvert (déconnexion, suppression de compte, PDF : 0 visite au serveur) ; ni ancre, ni autre
 *    site, ni adresse e-mail dans une passe ;
 *  - envoi : 7 pages, une étape chacune, enregistrement vivant ; liens relevés (html_meta.links) cohérents ;
 *  - critère a) dans la VRAIE app : chaque page capturée apparaît dans le plan ; « Liens sans page » ne
 *    liste que les pièges du même site ; laissés par l'auteur, la couverture vaut 100 % (coverage()).
 * Prérequis : app (APP_URL), faux Supabase de l'extension, banc (node e2e/banc/serveur.cjs), build WXT_E2E=1.
 * Usage : node e2e/banc/serie.cjs [SHOTS_DIR=…]
 */
const fs = require('node:fs');
const { chromium } = require('playwright');
const { envoyer } = require('./capture-v2.cjs');
const { install, seed } = require('../../../web/e2e/fake-supabase.cjs');
const MOCK = 'http://localhost:54400';
const BANC = 'http://localhost:54410';
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const chemin = (u) => new URL(u).pathname;

(async () => {
  require('node:module').register(
    `data:text/javascript,${encodeURIComponent(
      "export async function resolve(s, c, n) { try { return await n(s, c); } catch (e) { if (s.startsWith('.') && !/\\.\\w+$/.test(s)) return n(s + '.ts', c); throw e; } }",
    )}`,
  );
  const { linkedPages, nextBatch } = await import('../../lib/linkedPages.ts');
  const { coverage, coverageRatio, sandboxGraph } =
    await import('../../../web/src/pages/editor/html/sandboxGraph.ts');
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  await fetch(`${MOCK}/__html-capture`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  await fetch(`${MOCK}/__sandbox-live`, { method: 'POST', body: 'true' });
  await fetch(`${BANC}/__risques?zero`);

  // ===== Capture en série dans l'onglet capturé =====
  const passes = [];
  const vues = [];
  const site = {
    id: 'multi',
    nom: 'Site de plusieurs pages (capture en série)',
    depart: '/multi',
    pret: (p) => p.getByRole('heading', { name: 'Bienvenue' }).waitFor(),
    capture: async (page, x) => {
      const relever = async () =>
        vues.push({
          url: page.url(),
          links: await page.$$eval('a[href]', (as) =>
            as.map((a) => ({ href: a.getAttribute('href'), label: a.textContent.trim() })),
          ),
        });
      await relever();
      for (let passe = 0; passe < 5; passe++) {
        const lot = nextBatch(linkedPages(vues), 20);
        if (!lot.length) break;
        passes.push(lot.map((l) => chemin(l.url)));
        for (const cible of lot) {
          // Comme la série : ouverture dans l'onglet courant, GET seulement
          await page.goto(cible.url);
          await page.locator('h1').waitFor();
          // Une adresse ouverte (pas un clic) : la série demande la capture de la page chargée
          let fait = false;
          for (let essai = 0; essai < 3 && !fait; essai++) {
            await x.ajouter().catch(() => {});
            fait = await x.pages(vues.length + 1);
          }
          if (!fait) throw new Error(`page non capturée : ${cible.url}`);
          await relever();
        }
      }
    },
    parcours: [],
  };
  const e = await envoyer(site);
  const risques = await (await fetch(`${BANC}/__risques`)).json();

  ok(!e.capture.erreur, `capture en série sans erreur (${e.capture.erreur ?? 'aucune'})`);
  ok(
    JSON.stringify(passes) ===
      JSON.stringify([
        ['/multi/produits', '/multi/tarifs', '/multi/aide'],
        ['/multi/produits/crm', '/multi/produits/facture', '/multi/aide/faq'],
      ]),
    `passes de profondeur 1 : ${passes.map((p, i) => `${i + 1}) ${p.join(', ')}`).join(' ; ')}`,
  );
  const toutes = passes.flat();
  ok(
    Object.values(risques).every((n) => n === 0) &&
      !toutes.some((p) => /deconnexion|supprimer|\.pdf/.test(p)) &&
      !toutes.some((p) => p.includes('#') || p.includes('partenaire') || p.includes('mailto')),
    `aucun piège ouvert : déconnexion, suppression, PDF (${JSON.stringify(risques)}) ; ni ancre, ni autre site, ni e-mail`,
  );
  const urls = e.steps.map((s) => chemin(s.html_meta?.url ?? s.page_url ?? ''));
  ok(
    e.steps.length === 7 &&
      new Set(urls).size === 7 &&
      e.lives.length === 7 &&
      e.steps.every((s) => s.html_live_path && s.html_meta?.live) &&
      e.demo?.sandbox?.live === true,
    `envoi : 7 pages, une étape et un enregistrement vivant chacune (${urls.join(', ')})`,
  );
  // Les liens envoyés (html_meta.links) donnent la même liste : plus rien à capturer, seulement les pièges
  const envoyes = e.steps.map((s) => ({ url: s.html_meta.url, links: s.html_meta.links ?? [] }));
  const lies = linkedPages(envoyes);
  ok(
    lies.filter((l) => l.state === 'todo').length === 0 &&
      lies
        .filter((l) => l.state === 'risky')
        .map((l) => chemin(l.url))
        .sort()
        .join(',') === '/multi/compte/supprimer,/multi/deconnexion,/multi/guide.pdf',
    `liens relevés à l’envoi : 7 pages capturées, 3 pièges, rien à capturer (${lies.map((l) => `${chemin(l.url)}:${l.state}`).join(' ')})`,
  );

  // ===== Critère a) dans la vraie app : le plan =====
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
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (x) => {
    if (!/about:srcdoc|allow-same-origin/.test(`${x.stack ?? ''} ${x.message}`)) erreurs.push(x.message);
  });
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.frameLocator('.html-stage iframe').locator('body').waitFor({ timeout: 15000 });
  await p
    .getByRole('radiogroup', { name: 'Affichage du canevas' })
    .getByRole('radio', { name: 'Plan' })
    .click();
  const panel = p.locator('.sb-deadpanel');
  await panel.waitFor({ timeout: 8000 });
  const steps = state.tables.steps.filter((x) => x.demo_id === DEMO);
  const graphe = sandboxGraph(steps, d.sandbox);
  const titres = await p.locator('.sb-scroll').innerText();
  ok(
    graphe.nodes.length === 7 && steps.every((s) => titres.includes(s.title)),
    `a) chaque page capturée apparaît dans le plan (${steps.map((s) => s.title).join(', ')})`,
  );
  const morts = (await panel.locator('.sb-deadlist > li').allInnerTexts()).map((x) => x.replace(/\s+/g, ' '));
  ok(
    morts.length === 3 &&
      ['Se déconnecter', 'Guide (PDF)', 'Supprimer mon compte'].every((l) =>
        morts.some((m) => m.includes(l)),
      ),
    `« Liens sans page » : seulement les 3 pièges du même site (${morts.map((m) => m.slice(0, 40)).join(' | ')})`,
  );
  // Même règle que la série dans le plan : pas de « Capturer cette page » sur les pièges
  ok(
    (await panel.locator('.sb-deadlist > li button', { hasText: 'Capturer cette page' }).count()) === 0 &&
      (await panel.locator('.sb-deadlist__safe', { hasText: 'Jamais ouverte par sécurité' }).count()) === 3,
    'plan : les 3 pièges « Jamais ouverte par sécurité », sans « Capturer cette page »',
  );
  // Spec des pages liées §5 : les pièges refusés ne comptent pas, la couverture est déjà complète
  const c0 = coverage(steps, d.sandbox);
  ok(
    c0.captured === 7 && c0.missing === 0 && c0.refused === 3 && coverageRatio(c0) === 100,
    `couverture à 100 % dès l’envoi : ${c0.captured} pages sur ${c0.captured + c0.missing} liens · ${c0.refused} refusés`,
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/serie-plan.png`, fullPage: true });
  // L'auteur laisse les trois pièges (« Laisser le message »)
  for (const l of ['Se déconnecter', 'Guide (PDF)', 'Supprimer mon compte']) {
    await panel.getByRole('button', { name: `Autres actions pour « ${l} »` }).click();
    await p.getByRole('menuitem', { name: 'Laisser le message' }).click();
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(500);
  const apres = state.tables.demos.find((x) => x.id === DEMO).sandbox;
  const c = coverage(steps, apres);
  ok(
    (await panel.locator('.sb-deadlist > li').count()) === 0 &&
      c.captured === 7 &&
      c.missing === 0 &&
      c.left === 0 &&
      c.refused === 3 &&
      coverageRatio(c) === 100,
    `pièges laissés par l’auteur : toujours refusés, hors du total (${c.captured} pages sur ${c.captured + c.missing} liens · ${c.refused} refusés)`,
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/serie-plan-laisses.png`, fullPage: true });
  ok(erreurs.length === 0, `aucune erreur de l’app (${erreurs.join(' | ').slice(0, 300)})`);
  await b.close();
})().catch((x) => {
  console.error(x);
  process.exit(1);
});
