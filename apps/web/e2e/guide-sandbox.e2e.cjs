/**
 * Test e2e A8 : guide optionnel du Sandbox, lecteur (spec a8-guide-sandbox, recette 1 à 6 et 9).
 * Sandbox de 3 pages, guide de 4 étapes (2 sur la page de départ) : bulle à l'ouverture, « Suivant »,
 * avance au clic sur un lien relié, pause hors du chemin, Échap, « Explorer sans guide », fin, état
 * gardé pour la session, feuille du bas à 390 px, guide qui commence sur une autre page. Données fictives.
 * Usage : SHOTS_DIR=… [THEME=dark] node e2e/guide-sandbox.e2e.cjs
 */
const { chromium } = require('playwright');
const PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const SHOTS = process.env.SHOTS_DIR;
const { sfx, themedContext } = require('./_theme.cjs');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const S1 = '0b5c1f0e-0000-4000-8000-0000000000e1';
const S2 = '0b5c1f0e-0000-4000-8000-0000000000e2';
const S3 = '0b5c1f0e-0000-4000-8000-0000000000e3';
const page = (title, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body{margin:0;font:16px system-ui,sans-serif;color:#1c1917;background:#f5f5f4}
  nav{display:flex;gap:16px;padding:14px 24px;background:#a3195b}nav a{color:#fff;font-weight:600}
  main{padding:24px}.kpi{display:inline-block;margin:0 16px 16px 0;padding:16px 20px;border-radius:12px;background:#fff}
  </style></head><body>
  <nav id="menu"><a href="https://app.acme.example/">Accueil</a><a href="https://app.acme.example/agenda">Agenda</a><a href="https://app.acme.example/stats">Statistiques</a></nav>
  <main>${body}</main></body></html>`;
const pages = {
  'g1.html': page('Accueil', '<h1>Tableau de bord</h1><div class="kpi">Rendez-vous : 48</div>'),
  'g2.html': page(
    'Agenda',
    '<h1>Agenda</h1><p>Mardi : atelier CV</p><button id="new">Nouveau rendez-vous</button>',
  ),
  // Recette 11 : page plus haute que la fenêtre, élément visé tout en bas
  'g3.html': page(
    'Statistiques',
    '<h1>Statistiques</h1><div style="height:1600px"></div><button id="bas">Exporter le rapport</button>',
  ),
};
const hs = (id, title, sel, rect = { x: 0.02, y: 0.1, w: 0.2, h: 0.1 }) => ({
  id,
  ...rect,
  title,
  body: `Texte de la bulle ${title}.`,
  placement: 'auto',
  action: { type: 'next' },
  cta: null,
  pulse: true,
  style: 'beacon',
  sel,
});
const links = {
  [S1]: [
    { sel: '#menu > a:nth-of-type(2)', step: S2 },
    { sel: '#menu > a:nth-of-type(3)', step: S3 },
  ],
  [S2]: [
    { sel: '#menu > a:nth-of-type(1)', step: S1 },
    { sel: '#menu > a:nth-of-type(3)', step: S3 },
  ],
  [S3]: [
    { sel: '#menu > a:nth-of-type(1)', step: S1 },
    { sel: '#menu > a:nth-of-type(2)', step: S2 },
  ],
};
const step = (id, file, title, hotspots) => ({
  id,
  kind: 'html',
  title,
  hotspots,
  html: { url: `assets/${file}`, title, viewport: { w: 1280, h: 720 }, ops: [], links: links[id] },
});
const steps = [
  step(S1, 'g1.html', 'Accueil', [
    hs('h1', 'Vos rendez-vous', 'div.kpi'),
    hs('h2', 'Ouvrez l’agenda', '#menu > a:nth-of-type(2)'),
  ]),
  // h3 sans sélecteur : rect de secours
  step(S2, 'g2.html', 'Agenda', [
    hs('h3', 'La semaine', null, { x: 0.02, y: 0.12, w: 0.3, h: 0.1 }),
    hs('h4', 'Créez un rendez-vous', '#new'),
  ]),
  step(S3, 'g3.html', 'Statistiques', [
    hs('h5', 'Exportez le rapport', '#bas'),
    // Sélecteur hostile : il n'est jamais évalué autrement que par querySelector (aucun HTML injecté)
    hs(
      'h6',
      'Sélecteur hostile',
      "img[src=x]\"><img src=x onerror=\"parent.postMessage({fd:1,t:'go'},'*')\">",
      {
        x: 0.4,
        y: 0.3,
        w: 0.2,
        h: 0.1,
      },
    ),
  ]),
];
const base = (id, guideSteps) => ({
  schemaVersion: 1,
  demoId: id,
  versionId: '0b5c1f0e-0000-4000-8000-0000000000ef',
  workspaceId: 'w',
  title: 'Créer un rendez-vous',
  locale: 'fr',
  publishedAt: '2026-11-21T10:00:00Z',
  theme: {},
  kind: 'sandbox',
  sandbox: { start: S1, autoLink: true, unlinked: 'toast', guide: true, keyPages: [S1, S2], guideSteps },
  steps,
});
const MAIN = '0b5c1f0e-0000-4000-8000-0000000000f1';
const LATE = '0b5c1f0e-0000-4000-8000-0000000000f2';
const TALL = '0b5c1f0e-0000-4000-8000-0000000000f3';
const manifests = {
  [MAIN]: base(MAIN, [
    { page: S1, hotspot: 'h1', advance: 'next' },
    { page: S1, hotspot: 'h2', advance: 'click' },
    { page: S2, hotspot: 'h3', advance: 'next' },
    // bulle supprimée : ignorée
    { page: S2, hotspot: 'zz', advance: 'next' },
    { page: S2, hotspot: 'h4', advance: 'click' },
  ]),
  // Le guide commence sur la page Agenda
  [LATE]: base(LATE, [{ page: S2, hotspot: 'h3', advance: 'next' }]),
  [TALL]: base(TALL, [
    { page: S3, hotspot: 'h5', advance: 'next' },
    { page: S3, hotspot: 'h6', advance: 'next' },
  ]),
};

(async () => {
  const b = await chromium.launch();
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const errors = [];
  const tracked = [];
  const open = async (id, vp) => {
    const ctx = await themedContext(b, { viewport: vp, locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/functions/v1/open-demo', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ status: 'ok', manifest: manifests[id] }),
      }),
    );
    await p.route('**/assets/*.html', (r) =>
      r.fulfill({ contentType: 'text/html', headers: cors, body: pages[r.request().url().split('/').pop()] }),
    );
    await p.route('**/functions/v1/track', (r) => {
      try {
        tracked.push(...(JSON.parse(r.request().postData() || '{}').events ?? []));
      } catch {}
      return r.fulfill({ status: 200, headers: cors, body: '{}' });
    });
    await p.goto(`${PLAYER}/#/d/${id}`);
    await p.waitForSelector('.p-html-frame iframe');
    return p;
  };
  const frame = (p) => p.frameLocator('.p-html-frame iframe');
  const bubble = (p) => p.locator('.p-gd[role="dialog"]');
  const pill = (p) => p.locator('.p-gd-pill');
  const onPage = (p, title) =>
    p.waitForFunction(
      (t) => (document.querySelector('.p-html-frame iframe')?.getAttribute('title') ?? '').includes(t),
      title,
    );

  // ===== 1. Ouverture : bulle 1, « Étape 1 sur 4 », « Explorer sans guide » =====
  const p = await open(MAIN, { width: 1440, height: 900 });
  await bubble(p).waitFor();
  const t1 = await bubble(p).innerText();
  ok(
    /Vos rendez-vous/.test(t1) && /Étape 1 sur\s4/.test(t1),
    'recette 1 : bulle 1 avec « Étape 1 sur 4 » (bulle supprimée ignorée)',
  );
  ok(/Explorer sans guide/.test(t1), 'recette 1 : « Explorer sans guide »');
  ok((await bubble(p).getAttribute('aria-modal')) === 'false', 'bulle : dialogue non modal');
  ok(
    await p.evaluate(() => !document.activeElement?.closest('.p-gd')),
    'recette 9 : le focus n’est pas pris par la bulle',
  );
  ok(
    (await p.getByRole('button', { name: 'Guide, étape 1 sur 4', exact: true }).count()) === 1,
    'recette 9 : pastille nommée « Guide, étape 1 sur 4 »',
  );
  ok((await pill(p).getAttribute('aria-haspopup')) === 'menu', 'pastille : aria-haspopup="menu"');
  ok(/Guide · 1\/4/.test(await pill(p).innerText()), 'pastille « Guide · 1/4 »');
  ok(
    /Étape 1 sur\s4 du guide : Vos rendez-vous/.test(
      await p
        .locator('p.sr-only[aria-live="polite"]')
        .allInnerTexts()
        .then((x) => x.join(' ')),
    ),
    'recette 9 : aria-live annonce l’étape',
  );
  // Anneau posé sur l'élément visé (sélecteur)
  await p.locator('.p-gd-ring').waitFor();
  const ring = await p.locator('.p-gd-ring').boundingBox();
  const kpi = await frame(p).locator('div.kpi').boundingBox();
  ok(
    ring && kpi && Math.abs(ring.x - kpi.x) < 3 && Math.abs(ring.y - kpi.y) < 3,
    `ancrage par sélecteur : la zone suit l’élément (${ring && Math.round(ring.x)},${ring && Math.round(ring.y)} / ${kpi && Math.round(kpi.x)},${kpi && Math.round(kpi.y)})`,
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/a8-guide-01${sfx}.png` });

  // ===== 3. Étape « Suivant » : la zone n'avance pas ; « Suivant » avance =====
  await frame(p).locator('div.kpi').click();
  await p.waitForTimeout(300);
  ok(
    /Étape 1 sur\s4/.test(await bubble(p).innerText()),
    'recette 3 : clic dans la zone, l’étape « next » ne change pas',
  );
  await bubble(p).getByRole('button', { name: 'Suivant' }).click();
  await p.waitForFunction(() => /Étape 2 sur\s4/.test(document.querySelector('.p-gd')?.textContent ?? ''));
  ok(
    !(await bubble(p).getByRole('button', { name: 'Suivant' }).count()),
    'étape au clic : pas de « Suivant »',
  );

  // ===== 2. Clic dans la zone, sur un lien relié : la page change, bulle 3 =====
  await frame(p).locator('#menu > a:nth-of-type(2)').click();
  await onPage(p, 'Agenda');
  await p.waitForFunction(() => /Étape 3 sur\s4/.test(document.querySelector('.p-gd')?.textContent ?? ''));
  ok(/La semaine/.test(await bubble(p).innerText()), 'recette 2 : page Agenda, bulle 3');
  await p.locator('.p-gd-ring').waitFor();
  const r3 = await p.locator('.p-gd-ring').boundingBox();
  const f3 = await p.locator('.p-html-frame').boundingBox();
  ok(
    r3 && f3 && Math.abs(r3.x - (f3.x + 0.02 * f3.width)) < 4 && Math.abs(r3.width - 0.3 * f3.width) < 4,
    'bulle sans sélecteur : rect de secours',
  );

  // ===== 4. Hors du chemin : pause, pastille « Revenir à l'étape 3 », retour =====
  await frame(p).locator('#menu > a:nth-of-type(3)').click();
  await onPage(p, 'Statistiques');
  await p.waitForTimeout(200);
  ok(!(await bubble(p).count()), 'recette 4 : hors du chemin, plus de bulle');
  ok(
    (await pill(p).innerText()).includes('Guide en pause · Revenir à l’étape 3'),
    'recette 4 : pastille en pause',
  );
  await pill(p).click();
  await onPage(p, 'Agenda');
  await bubble(p).waitFor();
  ok(/Étape 3 sur\s4/.test(await bubble(p).innerText()), 'recette 4 : retour à l’étape 3 avec sa bulle');

  // ===== 9. Échap : pause, focus sur la pastille =====
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok(!(await bubble(p).count()), 'recette 9 : Échap ferme la bulle');
  ok(
    await p.evaluate(() => document.activeElement?.classList.contains('p-gd-pill')),
    'recette 9 : le focus revient sur la pastille',
  );
  await pill(p).click();
  await bubble(p).waitFor();

  // ===== 6. Dernière étape, fin =====
  await bubble(p).getByRole('button', { name: 'Suivant' }).click();
  await p.waitForFunction(() => /Étape 4 sur\s4/.test(document.querySelector('.p-gd')?.textContent ?? ''));
  await frame(p).locator('#new').click();
  await p.waitForFunction(() => /Guide terminé/.test(document.querySelector('.p-gd')?.textContent ?? ''));
  await p.waitForTimeout(300);
  ok(
    (await p.locator('.p-html-toast').innerText()).trim() === '' &&
      (await p.locator('.p-html-miss').innerText()).trim() === '',
    'clic qui fait avancer le guide (élément non relié) : pas de « Aucun lien à cet endroit »',
  );
  ok(
    (await bubble(p).innerText()).includes('Guide terminé. Continuez à explorer librement.'),
    'recette 6 : bulle de fin',
  );
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/a8-guide-fin${sfx}.png` });
  await bubble(p).getByRole('button', { name: 'Fermer' }).click();
  ok(!(await bubble(p).count()) && !(await pill(p).count()), 'recette 6 : plus de bulle ni de pastille');
  await p.waitForTimeout(2600); // envoi des événements par lots (2 s) avant de recharger
  await p.reload();
  await p.waitForSelector('.p-html-frame iframe');
  await p.waitForTimeout(800);
  ok(!(await pill(p).count()) && !(await bubble(p).count()), 'état gardé pour la session : guide terminé');

  // ===== 5. « Explorer sans guide », puis reprise à l'étape courante =====
  const q = await open(MAIN, { width: 1440, height: 900 });
  await bubble(q).waitFor();
  await bubble(q).getByRole('button', { name: 'Suivant' }).click();
  await q.waitForFunction(() => /Étape 2 sur\s4/.test(document.querySelector('.p-gd')?.textContent ?? ''));
  await bubble(q).getByRole('button', { name: 'Explorer sans guide' }).click();
  ok(!(await bubble(q).count()), 'recette 5 : aucune bulle');
  ok((await pill(q).innerText()).includes('Reprendre le guide'), 'recette 5 : « Reprendre le guide »');
  await pill(q).click();
  await bubble(q).waitFor();
  ok(/Étape 2 sur\s4/.test(await bubble(q).innerText()), 'recette 5 : reprise à l’étape courante');
  // Menu de la pastille : Quitter le guide
  await pill(q).click();
  ok(
    (await q.getByRole('menu').getByRole('menuitem').allInnerTexts()).join('|') ===
      'Reprendre à l’étape 2|Recommencer le guide|Quitter le guide',
    'menu : reprendre, recommencer, quitter',
  );
  await q.getByRole('menuitem', { name: 'Quitter le guide' }).click();
  ok((await pill(q).innerText()).includes('Reprendre le guide'), 'Quitter le guide : « Reprendre le guide »');

  // ===== 4.5 Petit écran : feuille du bas, pastille courte =====
  const m = await open(MAIN, { width: 390, height: 844 });
  await bubble(m).waitFor();
  ok(/p-gd--sheet/.test((await bubble(m).getAttribute('class')) ?? ''), '390 px : bulle en feuille du bas');
  {
    // Feuille collée en bas de la fenêtre, au-dessus de la barre du lecteur, sans couvrir l'élément visé
    await m.waitForTimeout(300);
    const sh = await bubble(m).boundingBox();
    const el = await frame(m).locator('div.kpi').boundingBox();
    const bar = await m.locator('.p-controls').boundingBox();
    const vh = 844;
    ok(
      sh && sh.y + sh.height > vh * 0.6 && (!bar || sh.y + sh.height <= bar.y + 1),
      `390 px : feuille en bas de la fenêtre, au-dessus de la barre (${sh && Math.round(sh.y)}–${sh && Math.round(sh.y + sh.height)}, barre ${bar && Math.round(bar.y)})`,
    );
    ok(
      sh && el && (el.y + el.height <= sh.y || el.y >= sh.y + sh.height),
      '390 px : la feuille ne couvre pas l’élément visé',
    );
  }
  ok(/Guide 1\/4/.test(await pill(m).innerText()), '390 px : pastille « Guide 1/4 »');
  ok(
    await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '390 px : pas de défilement horizontal',
  );
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/a8-guide-390${sfx}.png` });

  // ===== 4.1 Le guide commence sur une autre page =====
  const l = await open(LATE, { width: 1440, height: 900 });
  await bubble(l).waitFor();
  ok(
    (await bubble(l).innerText()).includes('Le guide commence sur la page « Agenda ».'),
    'départ ailleurs : « Le guide commence sur la page « Agenda ». »',
  );
  await bubble(l).getByRole('button', { name: 'Y aller' }).click();
  await onPage(l, 'Agenda');
  await l.waitForFunction(() => /La semaine/.test(document.querySelector('.p-gd')?.textContent ?? ''));
  ok(true, '« Y aller » : page Agenda, bulle 1');

  // ===== Recette 11 : élément en bas d'une page plus haute que la fenêtre ; sélecteur hostile =====
  const tl = await open(TALL, { width: 1440, height: 900 });
  await bubble(tl).waitFor();
  await bubble(tl).getByRole('button', { name: 'Y aller' }).click();
  await onPage(tl, 'Statistiques');
  await tl.waitForFunction(() =>
    /Exportez le rapport/.test(document.querySelector('.p-gd')?.textContent ?? ''),
  );
  await tl.locator('.p-gd-ring').waitFor();
  {
    const ring = await tl.locator('.p-gd-ring').boundingBox();
    const btn = await frame(tl).locator('#bas').boundingBox();
    const box = await tl.locator('.p-html-frame').boundingBox();
    ok(
      ring &&
        btn &&
        box &&
        Math.abs(ring.y - btn.y) < 3 &&
        btn.y >= box.y &&
        btn.y + btn.height <= box.y + box.height,
      'recette 11 : élément du bas ramené dans la vue, la zone le suit',
    );
  }
  await frame(tl)
    .locator('body')
    .evaluate(() => window.scrollTo(0, 0));
  await tl.waitForTimeout(300);
  {
    const ring = await tl.locator('.p-gd-ring').boundingBox();
    const btn = await frame(tl).locator('#bas').boundingBox();
    ok(ring && btn && Math.abs(ring.y - btn.y) < 3, 'recette 11 : la zone suit le défilement de la page');
  }
  await bubble(tl).getByRole('button', { name: 'Suivant' }).click();
  await tl.waitForFunction(() =>
    /Sélecteur hostile/.test(document.querySelector('.p-gd')?.textContent ?? ''),
  );
  await tl.waitForTimeout(400);
  ok(
    (await frame(tl).locator('img').count()) === 0 &&
      (await bubble(tl).getByRole('button', { name: 'Suivant' }).count()) === 1,
    'sélecteur hostile : rien d’injecté, bulle sur le rect de secours avec « Suivant »',
  );
  ok(
    (await tl.locator('iframe').getAttribute('title'))?.includes('Statistiques'),
    'sélecteur hostile : aucune navigation',
  );

  // ===== Événements =====
  await l.waitForTimeout(2600); // envoi par lots (2 s)
  await q.waitForTimeout(100);
  const types = tracked.map((e) => e.type);
  ok(
    types.includes('guide_step') && tracked.some((e) => e.type === 'guide_step' && e.props?.index === 2),
    'guide_step avec props.index',
  );
  ok(types.includes('guide_done'), 'guide_done');
  ok(
    tracked.some((e) => e.type === 'guide_skip' && e.props?.at === 'skip') &&
      tracked.some((e) => e.type === 'guide_skip' && e.props?.at === 'quit'),
    'guide_skip avec props.at (skip, quit)',
  );
  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await b.close();
})();
