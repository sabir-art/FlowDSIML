/**
 * L60 lot B : de bout en bout. Chaque parcours du banc est capturé avec l'extension construite,
 * envoyé depuis l'écran « Vérifier avant l'envoi », puis rouvert dans la vraie app (éditeur, plan du
 * Sandbox, aperçu du lecteur) avec exactement ce que l'extension a envoyé : étapes, noms, liens,
 * pages. On juge ce qu'un utilisateur y voit : chaque page capturée est là, au bon rang, sous son
 * nom, et son contenu est rendu.
 *
 * Le faux serveur ne rejoue pas l'assainissement de html-ingest (testé à part) : les pages sont
 * celles que l'extension envoie, affichées par l'app sans aucun script.
 *
 * Usage : serveurs web et lecteur (APP_URL, PLAYER_URL) et faux Supabase de l'extension lancés, extension construite en
 * mode e2e. SHOTS_DIR=… pour les captures d'écran, RAPPORT=… pour écrire le rapport de recette.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { CAS, capturer } = require('./etat-html.cjs');
const { install, seed } = require('../../../web/e2e/fake-supabase.cjs');

const MOCK = 'http://localhost:54400';
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const RAPPORT = process.env.RAPPORT;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
/** Parcours à plusieurs pages reliées : envoyés en Sandbox pour juger le plan. */
const SANDBOX = new Set(['spa', 'onglets', 'menu']);
const SUIVANT = /suivant/i;

const lignes = [];
const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  lignes.push({ ok: !!c, l });
  if (!c) process.exitCode = 1;
};
const journal = async () => (await fetch(`${MOCK}/__log`)).json();

/** Capture un parcours, l'envoie, et rend ce que l'extension a écrit (démo, étapes, pages). */
async function envoyer(cas) {
  const debut = (await journal()).length;
  const sandbox = SANDBOX.has(cas.id);
  const r = await capturer(cas, async (review) => {
    if (sandbox) await review.click('#kind [data-kind="sandbox"]');
    await review.click('#send');
    // L'écran rend la main à l'app : l'adresse de l'éditeur de la démo créée
    await review.waitForURL(/#\/demos\/[^/]+\/edit/, { timeout: 60000 });
  });
  const log = (await journal()).slice(debut);
  const demo = log.find((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos'));
  const pages = log.filter((l) => l.u.startsWith('/functions/v1/html-ingest') && l.html);
  const steps = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps') && l.body)
    .map((l) => JSON.parse(l.body));
  // Recette du lot B : bulles posées par l'envoi (démo guidée)
  const hotspots = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/hotspots') && l.body)
    .map((l) => JSON.parse(l.body));
  return { capture: r, demo: demo ? JSON.parse(demo.body) : null, pages, steps, hotspots };
}

/** Ouvre l'envoi dans l'app et juge l'éditeur, le plan et l'aperçu. */
async function juger(b, cas, envoi) {
  const { demo, pages, steps, hotspots } = envoi;
  const nom = cas.nom;
  ok(
    !envoi.capture.erreur,
    `${nom} : capture et envoi sans erreur${envoi.capture.erreur ? ` (${envoi.capture.erreur})` : ''}`,
  );
  ok(!!demo && steps.length > 0, `${nom} : l'envoi crée la démo et ${steps.length} étape(s)`);
  if (!demo || !steps.length) return { cas: cas.id, nom, etapes: [] };
  ok(steps.length === pages.length, `${nom} : une étape par page envoyée (${pages.length})`);
  // Lot B (recette UX §3.1) : deux étapes ne portent jamais le même nom
  const titres = steps.map((s) => s.title);
  ok(
    new Set(titres).size === titres.length,
    `${nom} : noms d'étapes tous distincts (${titres.map((t) => `« ${t} »`).join(', ')})`,
  );

  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const baseHot = state.tables.hotspots.find((h) => h.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  const d = state.tables.demos.find((x) => x.id === DEMO);
  d.title = demo.title;
  d.kind = demo.kind;
  d.sandbox = demo.sandbox;
  state.htmlPages = {};
  state.tables.steps = state.tables.steps.filter((s) => s.demo_id !== DEMO);
  state.tables.hotspots = state.tables.hotspots.filter((h) => h.demo_id !== DEMO);
  steps.forEach((s, i) => {
    const chemin = `${ws}/${DEMO}/${s.id}.html`;
    state.htmlPages[chemin] = pages[i].html;
    state.tables.steps.push({
      ...base,
      id: s.id,
      position: s.position,
      kind: 'html',
      title: s.title,
      page_url: s.page_url,
      image_path: null,
      html_path: chemin,
      html_ops: s.html_ops,
      html_meta: s.html_meta,
      options: { ...base.options, ...s.options },
    });
  });
  // Bulles envoyées, rattachées à la démo ouverte (champs absents : ceux du modèle du faux Supabase)
  hotspots.forEach((h, k) =>
    state.tables.hotspots.push({ ...baseHot, body: '', ...h, id: h.id ?? `hb-${k}`, demo_id: DEMO }),
  );
  // Démo guidée : chaque clic capturé entre deux pages devient une bulle sur l'élément cliqué
  const guidee = demo.kind !== 'sandbox' && steps.length > 1;
  const bulle = guidee ? hotspots.find((h) => h.step_id === steps[0].id) : null;
  if (guidee)
    ok(
      !!bulle && !!bulle.sel && /^Cliquez sur « .+ »$/.test(bulle.title),
      `${nom} : le clic capturé devient une bulle sur l'élément cliqué (${bulle ? `« ${bulle.title} », ${bulle.sel}` : 'aucune'})`,
    );

  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) erreurs.push(e.message);
  });
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  const cadre = p.frameLocator('.html-stage iframe');
  await cadre.locator('body').waitFor();
  const rail = p.locator('.rail-list .step');
  await rail.first().waitFor();
  ok((await rail.count()) === steps.length, `${nom} : ${steps.length} étape(s) dans la liste de l'éditeur`);

  // Chaque étape : à son rang, sous son nom, page rendue
  const etapes = [];
  const textes = [];
  const reperes = [];
  const menus = [];
  for (const [i, s] of steps.entries()) {
    await rail.nth(i).click();
    const visible = (await rail.nth(i).innerText()).replace(/\s+/g, ' ').trim();
    // Le début du contenu envoyé doit se lire dans le cadre de l'éditeur
    const repere = await (async () => {
      const t = await b.newContext({ javaScriptEnabled: false });
      const q = await t.newPage();
      await q.setContent(pages[i].html);
      const h = await q.evaluate(() => (document.querySelector('h1, h2')?.textContent ?? '').trim());
      await t.close();
      return h;
    })();
    if (repere) await cadre.getByText(repere, { exact: false }).first().waitFor({ timeout: 15000 });
    const texte = await cadre.locator('body').innerText();
    textes.push(texte);
    reperes.push(repere || s.title);
    // Menu resté ouvert dans la copie (état capturé au survol)
    const sm = cadre.locator('.sous-menu');
    menus.push(
      (await sm.count()) > 0 && (await sm.first().evaluate((e) => getComputedStyle(e).display !== 'none')),
    );
    // Lot B : nom complet en infobulle ; un nom « Écran · Partie » s'affiche sur deux lignes, la partie
    // (ce qui distingue l'étape) toujours lisible, sans coupe nette
    const tip = await rail.nth(i).locator('.rail-name').getAttribute('data-tip');
    const partie = s.title.split(' · ').pop();
    const coupe = await rail
      .nth(i)
      .locator('.rail-name b')
      .evaluate((b) => b.scrollWidth > b.clientWidth + 1);
    const nomOk = tip === s.title && visible.includes(partie) && !coupe;
    const rendu = texte.trim().length > 0 && (!repere || texte.includes(repere));
    ok(nomOk, `${nom} : étape ${i + 1} nommée « ${s.title} » dans la liste`);
    ok(rendu, `${nom} : étape ${i + 1}, page rendue dans l'éditeur${repere ? ` (« ${repere} »)` : ''}`);
    etapes.push({ rang: i + 1, titre: s.title, nomOk, rendu });
    if (SHOTS && i === steps.length - 1) await p.screenshot({ path: `${SHOTS}/b-${cas.id}-editeur.png` });
  }
  // Les états attendus du parcours se lisent dans l'app
  const etats = cas.attendus.map(([n, t]) => ({
    nom: n,
    vu: t === '__MENU_OUVERT__' ? menus.some(Boolean) : textes.some((x) => x.includes(t)),
  }));
  for (const e of etats) ok(e.vu, `${nom} : « ${e.nom} » se lit dans l'éditeur`);

  // Plan du Sandbox : une carte par page, sous son nom
  let plan = null;
  if (demo.kind === 'sandbox') {
    await p
      .getByRole('radiogroup', { name: 'Affichage du canevas' })
      .getByRole('radio', { name: 'Plan' })
      .click();
    const carte = p.getByRole('img', { name: /^Plan du sandbox/ });
    await carte.waitFor();
    const noeuds = await p.locator('.sbnode').allInnerTexts();
    const description = (await carte.getAttribute('aria-label')) ?? '';
    // Un lien vers une page jamais visitée a sa propre carte « Page non capturée » : hors compte
    const absentes = noeuds.filter((n) => n.includes('Page non capturée')).length;
    const cartes = noeuds.length - absentes === steps.length;
    const noms = steps.every((s) => noeuds.some((n) => n.includes(s.title)));
    const depart = (await p.locator('.sbnode.start').innerText()).includes(steps[0].title);
    // Chaque clic capturé relie la page à la suivante
    const liens = steps
      .slice(0, -1)
      .filter((s) => (s.html_ops ?? []).some((o) => o.op === 'link'))
      .map((s, i) => ({ de: s.title, vers: steps[i + 1].title }));
    ok(cartes, `${nom} : plan, une carte par page (${steps.length})`);
    ok(noms, `${nom} : plan, chaque carte porte le nom de sa page`);
    ok(depart, `${nom} : plan, la première page capturée est le départ`);
    ok(/ mène à /.test(description) || !liens.length, `${nom} : plan, les pages sont reliées`);
    // Gêne lot B : une page copiée menu ouvert (survol) est reliée d'office depuis la page menu fermé
    const isoles = await p.getByText(/n’est reliée à aucune page/).count();
    ok(isoles === 0, `${nom} : plan, aucune page isolée (${isoles} alerte)`);
    // Lot B (recette UX §3.2) : « Liens sans page », une ligne par destination, compteur des destinations
    const dests = await p
      .locator('.sb-deadlist:not(.sb-deadlist--left) > li .sb-deadlist__path span[title]')
      .evaluateAll((l) => l.map((e) => e.getAttribute('title')));
    const compteur = (await p.locator('.sb-deadpanel__n').count())
      ? await p.locator('.sb-deadpanel__n').innerText()
      : '(0)';
    ok(
      new Set(dests).size === dests.length && compteur === `(${dests.length})`,
      `${nom} : liens sans page, une ligne par destination (${dests.length}, compteur ${compteur})`,
    );
    plan = { cartes, noms, depart, description, absentes };
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/b-${cas.id}-plan.png` });
    await p
      .getByRole('radiogroup', { name: 'Affichage du canevas' })
      .getByRole('radio', { name: 'Page' })
      .click();
  }

  // Lot B (recette UX §3.4) : le cadre du navigateur affiche le domaine et le chemin de la page
  const adresse = (i) => {
    const u = new URL(steps[i].page_url);
    return `${u.host}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`;
  };
  // Panneau de l'étape : « Adresse affichée » préremplie ; sur le formulaire, on la remplace par une
  // adresse neutre (masquer une adresse interne) et l'aperçu doit afficher celle-ci
  await rail.first().click();
  const champ = p.locator('#st-address');
  ok(
    (await champ.inputValue()) === adresse(0),
    `${nom} : panneau, « Adresse affichée » préremplie (« ${await champ.inputValue()} »)`,
  );
  const masque = cas.id === 'formulaire' ? 'crm.acme.example/demandes' : null;
  if (masque) await champ.fill(masque);
  const montree = (i) => (i === 0 && masque ? masque : adresse(i));
  // Aperçu : le lecteur ouvre la première page
  await rail.first().hover();
  await p.getByRole('button', { name: 'Lire depuis l’étape 1' }).click();
  const lecteur = p.frameLocator('iframe.preview-frame').frameLocator('.p-html-frame iframe');
  await lecteur.locator('body').waitFor({ timeout: 20000 });
  const premier = cas.attendus[0][1];
  const lu = await lecteur
    .getByText(premier, { exact: false })
    .first()
    .waitFor({ timeout: 15000 })
    .then(
      () => true,
      () => false,
    );
  ok(lu, `${nom} : aperçu, le lecteur affiche la première page (« ${premier} »)`);
  const barre = p.frameLocator('iframe.preview-frame').locator('.p-addr').first();
  const lueAdresse = async (i) =>
    barre
      .filter({ hasText: montree(i) })
      .waitFor({ timeout: 10000 })
      .then(
        () => true,
        () => false,
      );
  ok(
    steps[0].options?.address === adresse(0) && (await lueAdresse(0)),
    `${nom} : aperçu, adresse « ${montree(0)} » dans le cadre${demo.kind === 'sandbox' ? ' du Sandbox' : ''}${masque ? ' (modifiée dans l’éditeur)' : ''}`,
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/b-${cas.id}-apercu.png` });
  // Démo guidée : la bulle s'affiche dans l'aperçu, avec son libellé, sur l'élément entouré
  if (bulle) {
    const apercu = p.frameLocator('iframe.preview-frame');
    const vue = await apercu
      .locator('.p-tip-title', { hasText: bulle.title })
      .first()
      .waitFor({ timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    const anneau = (await apercu.locator('.p-gd-ring').count()) > 0;
    ok(vue && anneau, `${nom} : aperçu, la bulle « ${bulle.title} » entoure l'élément cliqué`);
    ok(
      (await apercu.locator('.p-html-nozone').count()) === 0,
      `${nom} : aperçu, pas d'avertissement « Aucune zone cliquable » (la bulle fait avancer)`,
    );
  }
  // Aperçu : on passe à la page suivante comme un visiteur, par le clic capturé : le lien de la page
  // en Sandbox, l'élément de la bulle en démo guidée.
  let suite = null;
  if (steps.length > 1) {
    const lien = demo.kind === 'sandbox' ? (steps[0].html_ops ?? []).find((o) => o.op === 'link') : null;
    const cible = lien ? steps.find((s) => s.id === lien.value) : steps[1];
    const attendu = reperes[steps.indexOf(cible)];
    if (lien) await lecteur.locator(lien.sel).first().click();
    else if (bulle) await lecteur.locator(bulle.sel).first().click();
    else await p.frameLocator('iframe.preview-frame').getByRole('button', { name: SUIVANT }).click();
    suite = await lecteur
      .getByText(attendu, { exact: false })
      .first()
      .waitFor({ timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    // Même titre d'écran avant et après le clic (« Tableau de bord ») : on vérifie aussi que l'étape a
    // changé, la bulle de la première étape n'est plus affichée
    if (bulle && suite)
      suite = await p
        .frameLocator('iframe.preview-frame')
        .locator('.p-tip-title', { hasText: bulle.title })
        .first()
        .waitFor({ state: 'detached', timeout: 15000 })
        .then(
          () => true,
          () => false,
        );
    ok(
      suite,
      `${nom} : aperçu, ${lien || bulle ? 'le clic capturé mène à' : 'la flèche mène à'} « ${cible.title} »`,
    );
    // Sandbox : l'adresse suit la page courante
    if (lien && adresse(steps.indexOf(cible)) !== adresse(0))
      ok(
        await lueAdresse(steps.indexOf(cible)),
        `${nom} : aperçu, l'adresse change avec la page (« ${montree(steps.indexOf(cible))} »)`,
      );
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/b-${cas.id}-apercu-suite.png` });
  }
  ok(erreurs.length === 0, `${nom} : aucune erreur dans l'app${erreurs.length ? ` (${erreurs[0]})` : ''}`);
  await ctx.close();
  return { cas: cas.id, nom, type: demo.kind, titre: demo.title, etapes, etats, plan, apercu: lu, suite };
}

function rapport(res) {
  const oui = (v) => (v ? 'oui' : '**non**');
  const out = [
    '# L60 lot B : captures ouvertes dans l’app (contrôles générés)',
    '',
    'Généré par `apps/extension/e2e/banc/bout-en-bout.cjs` : extension construite, parcours du banc',
    '(pages fictives locales), envoi depuis « Vérifier avant l’envoi », puis ouverture dans l’app',
    'avec exactement les étapes et les pages envoyées. Ne pas modifier à la main.',
    '',
    `Résultat : ${lignes.filter((l) => l.ok).length} contrôles réussis sur ${lignes.length}.`,
    '',
  ];
  for (const r of res) {
    out.push(`## ${r.nom}`, '');
    if (!r.etapes.length) {
      out.push('Envoi sans étape : **échec**.', '');
      continue;
    }
    out.push(`Démo « ${r.titre} », ${r.type === 'sandbox' ? 'Sandbox' : 'démo guidée'}.`, '');
    out.push('| Rang | Nom dans la liste | Nom affiché | Page rendue |', '| --- | --- | --- | --- |');
    for (const e of r.etapes) out.push(`| ${e.rang} | ${e.titre} | ${oui(e.nomOk)} | ${oui(e.rendu)} |`);
    out.push('', 'Ce qu’on doit y lire :', '');
    for (const e of r.etats) out.push(`- ${e.nom} : ${oui(e.vu)}`);
    out.push('');
    if (r.plan)
      out.push(
        `Plan : une carte par page ${oui(r.plan.cartes)}, noms ${oui(r.plan.noms)}, départ ${oui(r.plan.depart)}` +
          `${r.plan.absentes ? `, ${r.plan.absentes} lien(s) vers une page non capturée (signalé)` : ''}.`,
        '',
        `> ${r.plan.description}`,
        '',
      );
    out.push(
      `Aperçu du lecteur sur la première page : ${oui(r.apercu)}` +
        `${r.suite === null ? '' : ` ; passage à la page suivante : ${oui(r.suite)}`}.`,
      '',
    );
  }
  const rates = lignes.filter((l) => !l.ok);
  if (rates.length) out.push('## Contrôles en échec', '', ...rates.map((l) => `- ${l.l}`), '');
  return out.join('\n');
}

(async () => {
  await fetch(`${MOCK}/__html-capture`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const seul = process.argv[2];
  const b = await chromium.launch();
  const res = [];
  for (const cas of CAS.filter((c) => !seul || c.id === seul)) {
    const envoi = await envoyer(cas);
    res.push(await juger(b, cas, envoi));
  }
  await b.close();
  if (RAPPORT) {
    fs.mkdirSync(path.dirname(RAPPORT), { recursive: true });
    fs.writeFileSync(RAPPORT, rapport(res));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
