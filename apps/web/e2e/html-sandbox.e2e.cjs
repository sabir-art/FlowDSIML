/**
 * Test e2e A8 (L20-02) : plan du Sandbox dans l'éditeur (cartes, liens, « Départ », « À relier »,
 * alerte, plan décrit et liste équivalente, réglages, pages clés). Données fictives (faux Supabase).
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/html-sandbox.e2e.cjs
 */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const { sfx, themedContext } = require('./_theme.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR;
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';
const ID = (n) => `0b5c1f0e-0000-4000-8000-0000000000f${n}`;
const U = 'https://logiciel.acme.example';
const pages = [
  {
    n: 1,
    title: 'Tableau de bord',
    url: `${U}/`,
    links: [
      ['#menu > a:nth-of-type(2)', `${U}/usagers`],
      ['#menu > a:nth-of-type(3)', `${U}/agenda`],
    ],
  },
  {
    n: 2,
    title: 'Liste des usagers',
    url: `${U}/usagers`,
    links: [['#menu > a:nth-of-type(1)', `${U}/`]],
    ops: [{ id: 'l1', sel: 'tr:nth-of-type(1) > td > a', op: 'link', value: ID(4), scope: 'step' }],
  },
  { n: 3, title: 'Agenda', url: `${U}/agenda`, links: [['#menu > a:nth-of-type(1)', `${U}/`]] },
  {
    n: 4,
    title: 'Fiche usager',
    url: `${U}/usagers/42`,
    links: [['#menu > a:nth-of-type(2)', `${U}/usagers`]],
  },
  { n: 5, title: 'Paramètres', url: `${U}/parametres`, links: [] },
];

(async () => {
  const b = await chromium.launch();
  const ctx = await themedContext(b, { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
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
      `<!doctype html><html><body><nav id="menu"><a href="${U}/">Accueil</a><a href="${U}/usagers">Usagers</a><a href="${U}/agenda">Agenda</a></nav><h1>${pg.title}</h1></body></html>`;
    state.tables.steps.push({
      ...base,
      id: ID(pg.n),
      position: pg.n - 1,
      kind: 'html',
      title: pg.title,
      image_path: null,
      html_path: path,
      html_ops: pg.ops ?? [],
      html_meta: {
        title: pg.title,
        url: pg.url,
        viewport: { w: 1280, h: 720 },
        links: pg.links.map(([sel, href]) => ({ sel, href })),
      },
    });
  }
  await install(p, state);
  await p.goto(`${APP}/#/demos/${DEMO}/edit`);
  await p.frameLocator('.html-stage iframe').locator('h1').waitFor();
  const view = p.getByRole('radiogroup', { name: 'Affichage du canevas' });
  ok((await view.count()) === 1, 'bascule Page / Plan (démo Sandbox)');
  await view.getByRole('radio', { name: 'Plan' }).click();
  const map = p.getByRole('img', { name: /^Plan du sandbox/ });
  await map.waitFor();
  const label = (await map.getAttribute('aria-label')) ?? '';
  ok(
    /Tableau de bord mène à Liste des usagers et Agenda/.test(label),
    'plan décrit : liens de la page de départ',
  );
  ok(/Liste des usagers mène à .*Fiche usager/.test(label), 'plan décrit : lien « Lier à une étape »');
  ok(/Paramètres n’est reliée à aucune page/.test(label), 'plan décrit : page orpheline');
  ok((await p.locator('.sbnode').count()) === 5, 'une carte par page');
  ok((await p.locator('.sbnode.start').innerText()).includes('Départ'), 'badge « Départ »');
  ok((await p.locator('.sbnode.warn').innerText()).includes('À relier'), 'badge « À relier »');
  ok((await p.locator('.sbmap svg path').count()) >= 6, 'liens tracés');
  ok(
    (await p.getByRole('alert').filter({ hasText: 'n’est reliée à aucune page' }).innerText()).includes(
      'Paramètres',
    ),
    'alerte : page orpheline',
  );
  ok((await p.getByText('5 pages HTML liées').count()) === 1, 'sous-titre : nombre de pages');
  // Pages clés par défaut : toutes les pages reliées
  ok(
    (await p.getByRole('checkbox', { name: 'Paramètres' }).isChecked()) === false,
    'pages clés : orpheline exclue par défaut',
  );
  ok((await p.getByText('Complétion : a vu les 4 pages clés').count()) === 1, 'complétion : 4 pages clés');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/l20-02-sandbox${sfx}.png`, fullPage: true });

  // Réglages enregistrés
  await p.getByLabel('Clic sur un élément non relié').selectOption('highlight');
  await p.getByRole('checkbox', { name: 'Agenda' }).uncheck();
  await p.getByLabel('Page de départ').selectOption(ID(2));
  await p.waitForTimeout(1400);
  ok(demo.sandbox.unlinked === 'highlight', 'clic non relié : mise en évidence');
  ok(demo.sandbox.keyPages.length === 3 && !demo.sandbox.keyPages.includes(ID(3)), 'pages clés choisies');
  ok(demo.sandbox.start === ID(2), 'page de départ changée');
  await p.getByLabel('Lier automatiquement les liens identiques').uncheck();
  await p.waitForTimeout(1400);
  ok(demo.sandbox.autoLink === false, 'liaison automatique désactivée');
  ok((await p.locator('.sbnode.warn').count()) >= 3, 'sans liaison automatique : plus de pages à relier');
  ok(await p.getByLabel(/Ajouter un guide optionnel/).isDisabled(), 'guide optionnel : « Bientôt »');
  ok(
    await p.getByRole('button', { name: /Ajouter une page/ }).isDisabled(),
    'ajouter une page : « Bientôt »',
  );
  // Liste équivalente : ouvrir une page au clavier
  await p.getByRole('button', { name: 'Ouvrir la page Fiche usager' }).focus();
  await p.keyboard.press('Enter');
  await p.frameLocator('.html-stage iframe').locator('h1', { hasText: 'Fiche usager' }).waitFor();
  ok(true, 'liste équivalente : page ouverte au clavier');
  ok(errors.length === 0, `aucune erreur (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
