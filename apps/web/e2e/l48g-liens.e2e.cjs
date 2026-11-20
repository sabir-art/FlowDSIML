/**
 * Recette L48-G §5 : liens sans page du Sandbox (plan, nœuds fantômes, panneau et ses actions, liste
 * de contrôle avant publication). Données fictives (acme.example), faux Supabase.
 * Usage : node e2e/l48g-liens.e2e.cjs
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const ID = (n) => `0b5c1f0e-0000-4000-8000-0000000000f${n}`;
const U = 'https://logiciel.acme.example';
const pages = [
  {
    n: 1,
    title: 'Tableau de bord',
    url: `${U}/`,
    links: [
      ['#menu > a:nth-of-type(2)', `${U}/usagers`, 'Usagers'],
      ['#menu > a:nth-of-type(3)', `${U}/factures`, 'Factures'],
      ['#pied > a', 'https://autre.example/doc', 'Documentation'],
      ['#haut', '#contenu', 'Aller au contenu'],
    ],
  },
  {
    n: 2,
    title: 'Liste des usagers',
    url: `${U}/usagers`,
    links: [
      ['#menu > a:nth-of-type(1)', `${U}/`, 'Accueil'],
      ['#menu > a:nth-of-type(3)', `${U}/factures/`, 'Factures'],
      ['#aide', `${U}/aide`, 'Aide'],
    ],
  },
  { n: 3, title: 'Agenda', url: `${U}/agenda`, links: [['#menu > a:nth-of-type(1)', `${U}/`, 'Accueil']] },
];

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' })).newPage();
  const errors = [];
  p.on('pageerror', (e) => {
    if (!/lacks the 'allow-same-origin' flag/.test(e.message)) errors.push(e.message);
  });
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  const base = state.tables.steps.find((s) => s.demo_id === DEMO);
  const ws = state.tables.workspaces[0].id;
  const demo = state.tables.demos.find((d) => d.id === DEMO);
  demo.title = 'Logiciel métier';
  demo.kind = 'sandbox';
  demo.sandbox = { start: ID(1), autoLink: true, unlinked: 'toast', guide: false, keyPages: [] };
  state.htmlPages = {};
  state.tables.steps = state.tables.steps.filter((s) => s.demo_id !== DEMO);
  for (const pg of pages) {
    const path = `${ws}/${DEMO}/${ID(pg.n)}.html`;
    state.htmlPages[path] =
      `<!doctype html><html><body><nav id="menu"><a href="/">Accueil</a></nav><h1>${pg.title}</h1></body></html>`;
    state.tables.steps.push({
      ...base,
      id: ID(pg.n),
      position: pg.n - 1,
      kind: 'html',
      title: pg.title,
      image_path: null,
      html_path: path,
      html_ops: [],
      html_meta: {
        title: pg.title,
        url: pg.url,
        viewport: { w: 1280, h: 720 },
        links: pg.links.map(([sel, href, label]) => ({ sel, href, label })),
      },
    });
  }
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.frameLocator('.html-stage iframe').locator('h1').waitFor();
  await p
    .getByRole('radiogroup', { name: 'Affichage du canevas' })
    .getByRole('radio', { name: 'Plan' })
    .click();
  const map = p.getByRole('img', { name: /^Plan du sandbox/ });
  await map.waitFor();

  // ===== Plan =====
  ok(
    /3 liens mènent à des pages non capturées/.test((await map.getAttribute('aria-label')) ?? ''),
    'plan décrit : « 3 liens mènent à des pages non capturées »',
  );
  const node = (t) => p.locator('.sbnode', { hasText: t });
  ok(
    (await node('Tableau de bord').locator('.sb-dead').innerText()) === '1 sans page',
    'nœud : « 1 sans page »',
  );
  ok(
    (await node('Liste des usagers').locator('.sb-dead').innerText()) === '2 sans page',
    'nœud : « 2 sans page »',
  );
  ok((await p.locator('.sbnode--ghost').count()) === 2, 'deux nœuds fantômes (factures, aide)');
  ok(
    (await p.locator('.sbnode--ghost').first().innerText()).includes('Page non capturée'),
    'fantôme « Page non capturée »',
  );

  // ===== Panneau =====
  const panel = p.locator('.sb-deadpanel');
  const items = panel.locator('.sb-deadlist:not(.sb-deadlist--left) > li');
  ok((await items.count()) === 3, 'panneau : 3 liens');
  ok((await panel.locator('.sb-deadpanel__n').innerText()) === '3', 'compteur dans l’en-tête');
  ok(!(await panel.innerText()).includes('autre.example'), 'lien externe non compté');
  ok(
    (await panel.innerText()).includes('Cette partie n’est pas disponible dans la démo'),
    'phrase selon le clic non relié',
  );
  const cap = items.first().getByRole('link', { name: 'Capturer cette page' });
  ok(
    (await cap.getAttribute('href')) === `${U}/factures` &&
      (await cap.getAttribute('target')) === '_blank' &&
      /noopener/.test((await cap.getAttribute('rel')) ?? ''),
    'Capturer cette page : l’adresse dans un nouvel onglet',
  );
  await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
    .then((r) => {
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      ok(bad.length === 0, `axe plan : ${bad.map((v) => v.id).join(', ') || '0 violation grave'}`);
    });

  // Relier à une page : « Aide » → Agenda
  const aide = items.filter({ hasText: 'Aide' });
  await aide.getByRole('button', { name: 'Relier à une page : Aide' }).click();
  await p.getByRole('menuitem', { name: 'Agenda' }).click();
  await p.waitForFunction(
    () => document.querySelectorAll('.sb-deadlist:not(.sb-deadlist--left) > li').length === 2,
  );
  ok(true, 'Relier à une page : le lien sort de la liste');
  // Laisser le message : « Factures » depuis le tableau de bord
  await items
    .filter({ hasText: 'Tableau de bord' })
    .getByRole('button', { name: 'Laisser le message' })
    .click();
  await p.waitForFunction(
    () => document.querySelectorAll('.sb-deadlist:not(.sb-deadlist--left) > li').length === 1,
  );
  ok(
    (await node('Tableau de bord').locator('.sb-dead').count()) === 0,
    'Laisser le message : le nœud n’a plus de lien sans page',
  );
  const toggle = panel.getByRole('button', { name: 'Afficher le lien laissé (1)' });
  await toggle.click();
  ok((await toggle.getAttribute('aria-expanded')) === 'true', 'liens laissés affichés');
  await p.waitForTimeout(1500);
  const saved = state.tables.demos.find((d) => d.id === DEMO);
  ok(
    JSON.stringify(saved.sandbox?.ignoredLinks) === JSON.stringify([{ url: `${U}/factures`, from: ID(1) }]),
    'ignoredLinks enregistré (adresse et page d’origine)',
  );
  const linked = state.tables.steps.find((s) => s.id === ID(2)).html_ops;
  ok(
    linked.some((o) => o.op === 'link' && o.sel === '#aide' && o.value === ID(3)),
    'op « link » créée sur la page d’origine',
  );
  await panel.locator('.sb-deadlist--left').getByRole('button', { name: 'Rétablir' }).click();
  await p.waitForFunction(
    () => document.querySelectorAll('.sb-deadlist:not(.sb-deadlist--left) > li').length === 2,
  );
  ok(true, 'Rétablir : le lien revient dans la liste');

  // ===== Liste de contrôle avant publication =====
  await p
    .getByRole('radiogroup', { name: 'Affichage du canevas' })
    .getByRole('radio', { name: 'Page' })
    .click();
  await p
    .getByRole('button', { name: /^Publier/ })
    .first()
    .click();
  const todo = p.locator('.publish-todo');
  await todo.waitFor();
  ok((await todo.innerText()).includes('2 liens mènent à des pages non capturées'), 'à compléter : 2 liens');
  await todo.getByRole('button', { name: 'Voir le plan' }).click();
  await map.waitFor();
  ok(true, '« Voir le plan » ouvre le plan');

  ok(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' / ')}` : ''}`);
  await b.close();
})();
