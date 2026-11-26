/**
 * EXT-02 §2 : écran « Vérifier avant l'envoi » de la capture HTML (faux Supabase, mock-supabase.cjs, pages
 * fictives /verif et /verif2). Titre obligatoire prérempli, type en segmenté, bilan, pages copiées
 * (« Retirer », annulable), six groupes à colonnes fixes, « Pourquoi ? » sur chaque ligne, filtre,
 * « Garder » une donnée (texte d'origine rétabli à l'envoi) ou un lien externe (fenêtre, opération
 * extlink), lien gardé refusé par le serveur (bandeau de fin d'envoi). Aucune valeur réelle à l'écran.
 * Usage : comme html.e2e.cjs. SHOTS_DIR pour les captures, THEME=dark pour le sombre.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { AxeBuilder } = require(
  require.resolve('@axe-core/playwright', { paths: [path.resolve(__dirname, '../../web')] }),
);
const WS = '11111111-1111-1111-1111-111111111111';
const MOCK = 'http://localhost:54400';
(async () => {
  const ext = path.resolve(__dirname, '../.output/chrome-mv3');
  const start = (await (await fetch(`${MOCK}/__log`)).json()).length;
  const getLog = async () => (await (await fetch(`${MOCK}/__log`)).json()).slice(start);
  const dark = process.env.THEME === 'dark';
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ext-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    colorScheme: dark ? 'dark' : 'light',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const shot = (p, name) =>
    process.env.SHOTS_DIR &&
    p.screenshot({
      path: `${process.env.SHOTS_DIR}/${name}-${dark ? 'sombre' : 'clair'}.png`,
      fullPage: true,
    });
  const results = [];
  const ok = (cond, label) => results.push([!!cond, label]);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  await fetch(`${MOCK}/__html-capture`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  // Le faux serveur signale cette adresse : le lien gardé sera refusé à l'envoi
  await fetch(`${MOCK}/__blocked`, {
    method: 'POST',
    body: JSON.stringify(['https://legal.example.com/cg']),
  });
  const page = await ctx.newPage();
  await page.goto(`${MOCK}/verif`);
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  const tabId = await popup.evaluate(
    async () => (await chrome.tabs.query({ url: 'http://localhost:54400/*' }))[0].id,
  );
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: '',
        tabId: a.tabId,
        mode: 'html',
      }),
    { tabId, WS },
  );
  await page.bringToFront();
  const status = () => popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:status' }));
  const waitSteps = async (n) => {
    for (let i = 0; i < 60; i++) {
      if ((await status()).steps >= n) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };
  ok(await waitSteps(1), 'page de départ capturée');
  await page.click('#suite');
  await page.waitForURL(/verif2/);
  ok(await waitSteps(2), 'deuxième page capturée');
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/html-review.html'));
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  const v = await reviewP;
  await v.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  v.on('pageerror', (e) => errors.push(e.message));
  v.on('dialog', (d) => {
    errors.push(`fenêtre native : ${d.message()}`);
    void d.dismiss();
  });
  await v.locator('section.grp').first().waitFor();
  const group = (name) => v.getByRole('region', { name, exact: true });
  const sum = async () =>
    Object.fromEntries(
      await v.$$eval('#sumbar > div', (ds) =>
        ds.map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]),
      ),
    );
  const box = (l) =>
    l.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });

  // ----- En-tête, titre et type -----
  ok(
    (await v.title()) === 'Vérifier avant l’envoi' &&
      (await v.locator('h1').innerText()) === 'Vérifier avant l’envoi',
    'titre de la page',
  );
  const title = v.getByLabel('Titre de la démo');
  ok(
    /^Capture du \d{1,2} \S+ \d{4}$/.test(await title.inputValue()),
    `titre prérempli (${await title.inputValue()})`,
  );
  const radios = v.getByRole('radiogroup', { name: 'Type' }).getByRole('radio');
  ok(
    (await radios.allInnerTexts()).join('|') === 'Démo guidée|Sandbox' &&
      (await radios.first().getAttribute('aria-checked')) === 'true',
    'type : segmenté « Démo guidée » / « Sandbox », prérempli',
  );
  await radios.first().focus();
  await v.keyboard.press('ArrowRight');
  ok(
    (await radios.nth(1).getAttribute('aria-checked')) === 'true' &&
      (await v.evaluate(() => document.activeElement?.textContent)) === 'Sandbox',
    'type : → choisit « Sandbox », focus suivi',
  );
  const tb = await box(title);
  const kb = await box(v.getByRole('radiogroup', { name: 'Type' }));
  ok(tb.h === 40 && Math.abs(tb.y - kb.y) <= 1, 'titre et type sur une ligne à 1 440 px');

  // ----- Bilan et groupes -----
  const s0 = await sum();
  ok(
    s0['Pages copiées'] === '2' &&
      s0['Scripts non copiés'] === '4' &&
      s0['Protégés'] === '8' &&
      s0['Gardés par vous'] === '0',
    `bilan (${JSON.stringify(s0)})`,
  );
  ok(
    /^4 scripts ne sont pas copiés \(3 de la page, 1 de suivi\)/.test(await v.locator('#note').innerText()),
    'encart : scripts de la page et de suivi',
  );
  const names = await v.locator('section.grp h2').allInnerTexts();
  ok(
    names.join('|') ===
      'Pages copiées|Scripts de la page|Scripts de suivi|Cadres intégrés|Formulaires|Données personnelles remplacées|Liens externes',
    `groupes dans l’ordre (${names.join(', ')})`,
  );
  ok(
    (await v.locator('section.grp .cnt').allInnerTexts()).join('|') === '2|3|1|1|1|3|3',
    `compteurs sur toutes les pages (${(await v.locator('section.grp .cnt').allInnerTexts()).join(', ')})`,
  );
  ok(
    (await v.locator('section.grp .lst').count()) === 0,
    'groupes repliés par défaut (aucune page trop lourde)',
  );
  ok(
    (await v.getByRole('button', { name: /^Pourquoi \?/ }).count()) === 6 &&
      (await group('Pages copiées')
        .getByRole('button', { name: /^Pourquoi/ })
        .count()) === 0,
    '« Pourquoi ? » sur chacun des six groupes',
  );
  // Colonnes fixes : compteur, « Pourquoi ? » et bouton au même endroit dans chaque en-tête
  const xs = await v.$$eval('section.grp .gh2', (hs) =>
    hs.map((h) =>
      [...h.children]
        .slice(2)
        .map((c) => Math.round(c.getBoundingClientRect().x))
        .join(','),
    ),
  );
  ok(new Set(xs).size === 1, `colonnes alignées d’un groupe à l’autre (${xs[0]})`);
  await shot(v, 'verification-resume');

  // ----- « Pourquoi ? » d'un groupe -----
  const scripts = group('Scripts de la page');
  const gwhy = scripts.getByRole('button', { name: 'Pourquoi ? Scripts de la page' });
  await gwhy.click();
  ok(
    (await gwhy.getAttribute('aria-expanded')) === 'true' &&
      /copie fixe de la page/.test(await scripts.locator('.why').innerText()) &&
      (await v.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ===
        'Pourquoi ? Scripts de la page',
    '« Pourquoi ? » déplie l’explication du groupe, focus gardé',
  );
  await gwhy.click();

  // ----- Données personnelles : rien de réel à l'écran, « Garder » direct -----
  const pii = group('Données personnelles remplacées');
  await pii.getByRole('button', { name: 'Voir : Données personnelles remplacées' }).click();
  const piiRows = pii.locator('li.el2');
  const piiNames = await piiRows.locator('.tx b').allInnerTexts();
  ok(
    piiNames.length === 3 &&
      piiNames.some((n) => /^E-mail · « c••••@••••\.example »$/.test(n)) &&
      piiNames.some((n) => /^Nom · /.test(n)) &&
      piiNames.some((n) => /^Téléphone · /.test(n)),
    `données : type et valeur masquée (${piiNames.join(' | ')})`,
  );
  ok(
    !/Camille|MARTIN|camille\.martin|06 12 34/.test(await v.locator('main').innerText()),
    'aucune valeur réelle à l’écran',
  );
  ok(
    (await piiRows.locator('.st2').allInnerTexts()).every((t) => t === 'Remplacé') &&
      (await piiRows.locator('.tx .mu').allInnerTexts()).some((t) => t === '1. Fiche client') &&
      (await piiRows.locator('.tx .mu').allInnerTexts()).some((t) => t === '2. Agenda'),
    'données : statut « Remplacé », page d’origine en source',
  );
  const mail = piiRows.filter({ hasText: 'E-mail' });
  await mail.getByRole('button', { name: /^Garder : E-mail/ }).click();
  ok(
    (await mail.locator('.st2').innerText()).trim() === 'Gardé' &&
      (await mail.getByRole('button', { name: /^Retirer : E-mail/ }).count()) === 1 &&
      (await v.evaluate(() => document.activeElement?.textContent)) === 'Retirer' &&
      (await sum())['Gardés par vous'] === '1',
    '« Garder » une donnée : statut « Gardé », bouton « Retirer », bilan à 1, focus gardé',
  );
  // « Pourquoi ? » d'une ligne
  const rowWhy = mail.getByRole('button', { name: /^Pourquoi \?/ });
  await rowWhy.click();
  ok(
    (await mail.getByRole('button', { name: /^Pourquoi \?/ }).getAttribute('aria-expanded')) === 'true' &&
      /Vous gardez cette donnée/.test(await pii.locator('.row-why').innerText()),
    '« Pourquoi ? » d’une ligne déplie l’encart sous la ligne',
  );
  // Colonnes des lignes alignées sur celles de l'en-tête
  const cols = await pii.evaluate((g) => {
    const xs = (el) => [...el.children].slice(2).map((c) => Math.round(c.getBoundingClientRect().x));
    return { head: xs(g.querySelector('.gh2')), row: xs(g.querySelector('li.el2')) };
  });
  ok(
    cols.head.join() === cols.row.join(),
    `colonnes des lignes alignées sur l’en-tête (${cols.row.join(', ')})`,
  );
  await shot(v, 'verification-liste');

  // ----- Liens externes : fenêtre de confirmation, http non gardable, filtre -----
  const links = group('Liens externes');
  await links.getByRole('button', { name: 'Voir : Liens externes' }).click();
  const row = (name) => links.locator('li.el2').filter({ hasText: name });
  ok(
    (await row('Ancien site')
      .getByRole('button', { name: /^Garder/ })
      .count()) === 0 &&
      (await row('Ancien site')
        .getByRole('button', { name: /^Pourquoi/ })
        .count()) === 1 &&
      (await row('Ancien site').locator('.st2').innerText()) === 'Désactivé',
    'lien en http : « Désactivé », pas de « Garder », « Pourquoi ? » présent',
  );
  await row('Aide en ligne').getByRole('button', { name: 'Garder : Aide en ligne' }).click();
  const dlg = v.getByRole('dialog', { name: 'Garder ce lien externe ?' });
  await dlg.waitFor();
  ok(
    /« Aide en ligne » mène à aide\.example\.com\. Dans la démo, le visiteur verra d’abord « Vous quittez la démo »/.test(
      await dlg.innerText(),
    ) && (await v.evaluate(() => document.activeElement?.textContent)) === 'Annuler',
    'fenêtre « Garder ce lien externe ? », focus sur « Annuler »',
  );
  await shot(v, 'verification-confirm');
  await dlg.getByRole('button', { name: 'Annuler' }).click();
  ok(
    (await row('Aide en ligne').locator('.st2').innerText()) === 'Désactivé' &&
      (await v.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ===
        'Garder : Aide en ligne',
    '« Annuler » : lien laissé désactivé, focus rendu au bouton',
  );
  for (const name of ['Aide en ligne', 'Conditions générales']) {
    await row(name)
      .getByRole('button', { name: `Garder : ${name}` })
      .click();
    await dlg.getByRole('button', { name: 'Garder le lien' }).click();
  }
  ok(
    (await row('Aide en ligne').locator('.st2').innerText()).trim() === 'Gardé' &&
      (await sum())['Gardés par vous'] === '3',
    'liens gardés : statut « Gardé », bilan à 3',
  );
  await links.getByRole('searchbox', { name: 'Filtrer : Liens externes' }).fill('legal');
  ok(
    (await links.locator('li.el2').count()) === 1 &&
      (await links.locator('.ft2 .mu').innerText()) === '1 sur 1',
    `filtre par source : 1 ligne, « 1 sur 1 » (${await links.locator('li.el2').count()}, ${await links.locator('.ft2').innerText()})`,
  );
  await links.getByRole('searchbox').fill('introuvable');
  ok((await links.locator('.none').innerText()) === 'Aucun élément ne correspond.', 'filtre sans résultat');
  await links.getByRole('searchbox').fill('');

  // ----- Cadres, formulaires, scripts : jamais de « Garder » -----
  for (const name of ['Scripts de la page', 'Scripts de suivi', 'Cadres intégrés', 'Formulaires'])
    await group(name)
      .getByRole('button', { name: `Voir : ${name}` })
      .click();
  ok(
    (await v
      .locator('section.grp')
      .filter({ hasNotText: /Données|Liens|Pages/ })
      .getByRole('button', { name: /^Garder/ })
      .count()) === 0,
    'scripts, cadres et formulaires : pas de « Garder »',
  );
  ok(
    (await group('Cadres intégrés').locator('li.el2 .st2').innerText()) === 'Retiré' &&
      (await group('Cadres intégrés').locator('li.el2 .tx b').innerText()) === 'Cadre fictif' &&
      (await group('Scripts de la page').locator('li.el2 code').allInnerTexts()).includes('spa-suivi.js'),
    'cadre « Retiré » nommé par son titre',
  );
  ok(
    (await group('Scripts de suivi').locator('li.el2 .st2').innerText()) === 'Non copié',
    'script de suivi « Non copié »',
  );

  // ----- Pages copiées : « Retirer », annulable -----
  const pages = group('Pages copiées');
  await pages.getByRole('button', { name: 'Voir : Pages copiées' }).click();
  ok(
    (await pages.locator('li.el2 .tx b').allInnerTexts()).join('|') === '1. Fiche client|2. Agenda' &&
      /^localhost:54400\/verif ·\s\d+\sKo$/.test(await pages.locator('li.el2 .tx .mu').first().innerText()) &&
      (await pages.locator('li.el2 .st2').allInnerTexts()).every((t) => t === 'Prête'),
    'pages : numéro et titre, adresse et poids, « Prête »',
  );
  const th = await box(pages.locator('.pth').first());
  ok(
    th.w === 64 && th.h === 40 && (await pages.locator('.pth iframe').first().getAttribute('sandbox')) === '',
    'vignette de 64 × 40 px, copie inerte (iframe sandbox vide)',
  );
  await pages.getByRole('button', { name: /^Pourquoi \? 1\. Fiche client/ }).click();
  ok(
    /sous la limite de 10\sMo par page/.test(await pages.locator('.row-why').innerText()),
    '« Pourquoi ? » d’une page : limite réelle du serveur',
  );
  await pages.getByRole('button', { name: 'Retirer : Agenda' }).click();
  const toast = v.locator('#toast');
  ok(
    (await toast.innerText()).startsWith('« Agenda » est retirée de la démo.') &&
      (await sum())['Pages copiées'] === '1' &&
      (await group('Données personnelles remplacées').locator('.gh2 .cnt').innerText()) === '2',
    'page retirée : notification, bilan et compteurs recalculés',
  );
  await toast.getByRole('button', { name: 'Annuler' }).click();
  ok(
    (await sum())['Pages copiées'] === '2' &&
      (await pages.locator('li.el2').count()) === 2 &&
      (await toast.isHidden()),
    '« Annuler » remet la page',
  );
  await shot(v, 'verification-pages');

  // ----- Accessibilité, largeur, 390 px -----
  const axe = await new AxeBuilder({ page: v }).analyze();
  const bad = axe.violations.filter((x) => ['serious', 'critical'].includes(x.impact));
  ok(
    bad.length === 0,
    `axe : aucune violation sérieuse (${bad.map((x) => `${x.id} ${x.nodes[0]?.target}`).join(' ; ')})`,
  );
  ok(
    await v.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '1 440 px : pas de défilement horizontal',
  );
  await v.setViewportSize({ width: 390, height: 844 });
  const m = await pii.evaluate((g) => {
    const r = g.querySelector('li.el2');
    const b = (s) => r.querySelector(s).getBoundingClientRect();
    return {
      sameLine: Math.abs(b('.wy').y - b('.ac2').y) < 8,
      below: b('.wy').y > b('.st2').bottom,
      whyLeft: b('.wy').x < b('.ac2').x,
      act: Math.round(b('.ac2').width),
    };
  });
  ok(
    m.sameLine &&
      m.below &&
      m.whyLeft &&
      m.act === 100 &&
      (await v.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
    `390 px : « Pourquoi ? » à gauche et action à droite sur la ligne 2, sans défilement horizontal (${JSON.stringify(m)})`,
  );
  ok(
    (await v.locator('.bar').evaluate((e) => getComputedStyle(e).position)) === 'fixed',
    'barre fixe en bas',
  );
  await shot(v, 'verification-390');
  await v.setViewportSize({ width: 1440, height: 900 });

  // ----- Titre obligatoire -----
  await title.fill('');
  await v.getByRole('button', { name: 'Envoyer' }).click();
  ok(
    (await v.locator('#vt-err').innerText()) === 'Donnez un titre à la démo.' &&
      (await title.getAttribute('aria-invalid')) === 'true' &&
      (await title.getAttribute('aria-describedby')) === 'vt-err' &&
      (await v.evaluate(() => document.activeElement?.id)) === 'vt' &&
      !(await getLog()).some((l) => l.u.startsWith('/functions/v1/html-ingest')),
    'titre vide : message sous le champ, focus rendu, rien n’est envoyé',
  );
  await shot(v, 'verification-titre');
  await title.fill('Fiche client fictive');
  ok(
    (await v.locator('#vt-err').isHidden()) && (await title.getAttribute('aria-invalid')) === null,
    'l’erreur disparaît à la saisie',
  );

  // ----- Envoi : donnée rétablie, lien réactivé, lien refusé par le serveur -----
  await v.getByRole('button', { name: 'Envoyer' }).click();
  const srv = v.locator('#srv');
  await srv.waitFor();
  ok(
    (await srv.getAttribute('role')) === 'status' &&
      /^Démo envoyée\. 1 élément gardé a été retiré par le serveur\./.test(await srv.innerText()) &&
      /Lien « Conditions générales » \(legal\.example\.com\) : adresse signalée comme dangereuse\./.test(
        await srv.innerText(),
      ),
    `bandeau de fin d’envoi (${(await srv.innerText()).replace(/\n/g, ' ')})`,
  );
  const open = srv.getByRole('link', { name: 'Ouvrir la démo' });
  ok(
    // L60 §3 : « ready » fait dire « Démo prête » à l'éditeur
    /22222222-2222-2222-2222-222222222222\/edit(\?ready=\d+)?$/.test(await open.getAttribute('href')) &&
      (await v.getByRole('button', { name: 'Envoyer' }).isDisabled()),
    '« Ouvrir la démo » mène à l’éditeur ; « Envoyer » désactivé',
  );
  await shot(v, 'verification-envoye');
  const log = await getLog();
  const ing = log.filter((l) => l.u.startsWith('/functions/v1/html-ingest'));
  ok(ing.length === 2, 'deux pages envoyées');
  const h1 = ing[0]?.html ?? '';
  ok(
    /Contact : camille\.martin@exemple\.example/.test(h1) &&
      !/Camille MARTIN/.test(h1) &&
      !/06 12 34/.test(ing[1]?.html ?? ''),
    'seule la donnée gardée est rétablie dans la copie envoyée',
  );
  ok(!/data-fd-pii/.test(h1 + (ing[1]?.html ?? '')), 'marques de travail retirées de la copie envoyée');
  ok(
    !/<p id="mail"[^>]*blur/.test(h1) && /<p id="suivi"[^>]*blur\(6px\)/.test(h1),
    'flou retiré de la donnée gardée, gardé sur les autres',
  );
  ok(
    JSON.parse(ing[0].body).security.piiReplaced === 1,
    'compteur des données remplacées ajusté (1 sur la page 1)',
  );
  const demo = JSON.parse(log.find((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos')).body);
  ok(
    demo.title === 'Fiche client fictive' && demo.kind === 'sandbox',
    'démo créée avec le titre et le type choisis',
  );
  const steps = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps'))
    .map((l) => JSON.parse(l.body));
  const ext0 = (steps[0]?.html_ops ?? []).filter((o) => o.op === 'extlink');
  ok(
    ext0.length === 1 &&
      ext0[0].sel === '#aide' &&
      ext0[0].value === 'https://aide.example.com/guide' &&
      ext0[0].scope === 'step',
    `lien gardé : opération extlink (${JSON.stringify(ext0)})`,
  );
  ok(
    !JSON.stringify(steps).includes('legal.example.com/cg"') || ext0.every((o) => !/legal/.test(o.value)),
    'lien signalé : pas réactivé',
  );
  ok(errors.length === 0, `aucune erreur ni fenêtre native (${errors.join(' ; ')})`);
  await fetch(`${MOCK}/__blocked`, { method: 'POST', body: '[]' });
  await ctx.close();
  for (const [c, l] of results) console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (results.some(([c]) => !c)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
