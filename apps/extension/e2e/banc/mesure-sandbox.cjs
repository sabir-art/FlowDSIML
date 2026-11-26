/**
 * Sandbox v2, étape 1 (docs/tech/sandbox-v2.md §4 et §6) : mesure de la v1 sur le banc, point de départ
 * chiffré. Pour chaque site d'essai : capture avec l'extension construite et chargée, puis relecture de
 * chaque page copiée EXACTEMENT comme le lecteur (srcdoc de player-core : même CSP, même script, iframe
 * sandbox="allow-scripts", liens automatiques « même adresse capturée → même page »), et le même parcours
 * joué sur le site vivant et sur la reprise.
 *
 * Mesures publiées à chaque passage :
 *  - fidélité d'interaction : part des gestes du parcours qui donnent le même résultat que sur le site ;
 *  - fidélité visuelle : part des pixels identiques entre le site (au moment de la capture) et la reprise ;
 *  - réponses rejouées : replayed / (replayed + unreplayed), GET lus par la page (fetch, XHR) ;
 *  - couverture du plan : pages capturées sur pages du site liées ;
 *  - sorties réseau de la reprise : doit valoir 0.
 * Critères de l'étape 1 (à 100 %) : chaque site est servi, chaque parcours passe entièrement sur le site
 * vivant (le banc lui-même est juste), chaque site est capturé et mesuré, aucune sortie réseau. Les taux
 * de la v1 sont relevés, pas exigés.
 *
 * Prérequis : node e2e/mock-supabase.cjs, node e2e/banc/serveur.cjs, build WXT_E2E=1.
 * Usage : node e2e/banc/mesure-sandbox.cjs [RAPPORT=fichier.md] [SHOTS_DIR=…]   (JSON sur la sortie)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { CAS, capturer } = require('./etat-html.cjs');
const BANC = 'http://localhost:54410';
const SHOTS = process.env.SHOTS_DIR;
const RAPPORT = process.env.RAPPORT;
const VIEW = { width: 1280, height: 800 };

const cas = (id) => CAS.find((c) => c.id === id);
const clic = (role, name) => (c) => c.getByRole(role, { name, exact: true }).first().click();

/**
 * Les sites d'essai de la note (§4), plus les deux cas du lot L60 qui posaient problème au client.
 * capture : gestes de l'auteur pendant la capture (API de capturer) ; parcours : gestes du visiteur.
 * Un geste : { nom, faire?(cible), texte?, absent?, vide? (sélecteur d'un champ qui doit être vide) }.
 */
const SITES = [
  {
    id: 'site',
    nom: 'Site de plusieurs pages statiques',
    depart: '/site',
    pret: (p) => p.getByRole('heading', { name: 'Accueil' }).waitFor(),
    capture: async (p, x) => {
      await clic('link', 'Offres')(p);
      await p.getByRole('heading', { name: 'Nos offres' }).waitFor();
      await x.pages(2);
      await clic('link', 'Équipe')(p);
      await p.getByRole('heading', { name: 'Notre équipe' }).waitFor();
      await x.pages(3);
    },
    parcours: [
      { nom: 'Offres', faire: clic('link', 'Offres'), texte: 'Essentielle, Avancée' },
      { nom: 'Équipe', faire: clic('link', 'Équipe'), texte: 'Douze personnes' },
      { nom: 'Contact (page non visitée)', faire: clic('link', 'Contact'), texte: 'Réponse sous 24 h' },
      { nom: 'Retour à l’accueil', faire: clic('link', 'Accueil'), texte: 'Bienvenue sur le site' },
    ],
  },
  {
    id: 'spa',
    nom: 'Application à page unique (routes, liste chargée)',
    depart: '/app',
    pret: cas('spa').pret,
    capture: cas('spa').gestes,
    parcours: [
      { nom: 'Clients (liste chargée)', faire: clic('link', 'Clients'), texte: 'Maison Leroy' },
      { nom: 'Fiche client', faire: clic('link', 'Atelier Durand'), texte: 'Ville : Lyon' },
      { nom: 'Ajouter une note', faire: clic('button', 'Ajouter une note'), texte: 'Note ajoutée' },
      { nom: 'Retour à l’accueil', faire: clic('link', 'Accueil'), texte: 'Bienvenue dans ExempleCRM.' },
    ],
  },
  {
    id: 'liste',
    nom: 'Liste chargée par fetch, avec filtre',
    depart: '/liste',
    pret: (p) => p.getByText('ExempleAgenda').waitFor(),
    capture: async (p, x) => {
      await p.locator('#filtre').fill('crm');
      await p.getByText('ExempleFacture').waitFor({ state: 'detached' });
      await x.ajouter();
      await x.pages(2);
    },
    parcours: [
      { nom: 'Liste complète', texte: 'ExempleAgenda' },
      {
        nom: 'Filtre « crm »',
        faire: (c) => c.locator('#filtre').fill('crm'),
        texte: 'ExempleCRM',
        absent: 'ExempleFacture',
      },
      {
        nom: 'Filtre sans résultat',
        faire: (c) => c.locator('#filtre').fill('zzz'),
        texte: 'Aucun produit.',
      },
      { nom: 'Filtre vidé', faire: (c) => c.locator('#filtre').fill(''), texte: 'ExempleFacture' },
    ],
  },
  {
    id: 'formulaire',
    nom: 'Formulaire avec validation et envoi POST',
    depart: '/formulaire',
    pret: cas('formulaire').pret,
    capture: cas('formulaire').gestes,
    parcours: [
      {
        nom: 'Envoi sans nom : erreur',
        faire: clic('button', 'Envoyer la demande'),
        texte: 'Indiquez votre nom.',
      },
      {
        nom: 'Envoi : la page avance',
        faire: async (c) => {
          await c.locator('#nom').fill('Camille Durand');
          await clic('button', 'Envoyer la demande')(c);
        },
        texte: 'Demande envoyée',
      },
      {
        nom: 'Retour : formulaire vide',
        faire: clic('link', 'Nouvelle demande'),
        texte: 'Demande de contact',
        vide: '#nom',
      },
    ],
  },
  {
    id: 'stockage',
    nom: 'Application qui dépend de localStorage',
    depart: '/stockage',
    pret: (p) => p.getByText('Panier : 0').waitFor(),
    capture: async (p, x) => {
      await clic('button', 'Ajouter au panier')(p);
      await p.getByText('Panier : 1').waitFor();
      await x.ajouter();
      await x.pages(2);
    },
    parcours: [
      { nom: 'Panier vide', texte: 'Panier : 0' },
      { nom: 'Ajouter', faire: clic('button', 'Ajouter au panier'), texte: 'Panier : 1' },
      { nom: 'Ajouter encore', faire: clic('button', 'Ajouter au panier'), texte: 'Panier : 2' },
      { nom: 'Vider', faire: clic('button', 'Vider le panier'), texte: 'Panier : 0' },
    ],
  },
  {
    id: 'tiers',
    nom: 'Mesure d’audience et widget de tiers',
    depart: '/tiers',
    pret: cas('tiers').pret,
    capture: cas('tiers').gestes,
    parcours: [
      { nom: 'Tableau de bord', texte: 'Ventes du mois : 12' },
      { nom: 'Ajouter une vente', faire: clic('button', 'Ajouter une vente'), texte: 'Ventes du mois : 13' },
      { nom: 'Ajouter encore', faire: clic('button', 'Ajouter une vente'), texte: 'Ventes du mois : 14' },
    ],
  },
  {
    id: 'onglets',
    nom: 'Onglets chargés en différé (L60)',
    depart: '/onglets',
    pret: cas('onglets').pret,
    capture: cas('onglets').gestes,
    parcours: [
      { nom: 'Onglet Tarifs', faire: clic('tab', 'Tarifs'), texte: '19 € par mois' },
      { nom: 'Onglet Avis', faire: clic('tab', 'Avis'), texte: 'Très bon outil' },
      { nom: 'Onglet Résumé', faire: clic('tab', 'Résumé'), texte: 'livré en 48 h' },
    ],
  },
  {
    id: 'menu',
    nom: 'Menu ouvert au survol (L60)',
    depart: '/menu',
    pret: cas('menu').pret,
    capture: cas('menu').gestes,
    parcours: [
      {
        nom: 'Survol de Produits',
        faire: (c) => c.getByRole('button', { name: 'Produits' }).hover(),
        texte: 'Services',
      },
      { nom: 'Page Logiciels', faire: clic('link', 'Logiciels'), texte: 'ExempleCRM, ExempleFacture.' },
      { nom: 'Retour au catalogue', faire: clic('link', 'Catalogue'), texte: 'Survolez' },
    ],
  },
];

/** Attend (3 s au plus) que le résultat attendu d'un geste soit visible ; rend vrai ou faux. */
async function verifier(c, g) {
  const fin = Date.now() + 3000;
  for (;;) {
    try {
      const t = await c.locator('body').innerText({ timeout: 500 });
      const vide = g.vide ? (await c.locator(g.vide).inputValue({ timeout: 500 })) === '' : true;
      if ((!g.texte || t.includes(g.texte)) && (!g.absent || !t.includes(g.absent)) && vide) return true;
    } catch {
      /* page en cours de chargement */
    }
    if (Date.now() > fin) return false;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Parcours sur le site vivant : valide le banc, compte les GET lus par la page. */
async function vivant(b, s) {
  const ctx = await b.newContext({ viewport: VIEW, locale: 'fr-FR' });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  const gets = new Set();
  page.on('request', (r) => {
    if (['fetch', 'xhr'].includes(r.resourceType()) && r.method() === 'GET') gets.add(r.url());
  });
  await page.goto(BANC + s.depart);
  await s.pret(page);
  const res = [];
  for (const g of s.parcours) {
    let ok = false;
    try {
      if (g.faire) await g.faire(page);
      ok = await verifier(page, g);
    } catch {
      ok = false;
    }
    res.push(ok);
  }
  await ctx.close();
  return { res, gets: gets.size };
}

/** Liens automatiques du lecteur : un lien dont l'adresse est celle d'une page capturée mène à cette page. */
function liensAuto(p, pages) {
  const out = [];
  const chemin = (u) => {
    try {
      return new URL(u, p.url).pathname;
    } catch {
      return null;
    }
  };
  for (const m of p.html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    const cible = pages.find((x) => new URL(x.url).pathname === chemin(m[1]));
    if (cible && !out.some((o) => o.sel === `a[href="${m[1]}"]`))
      out.push({ sel: `a[href="${m[1]}"]`, step: String(cible.order) });
  }
  return out;
}

/** Pages du même site liées depuis les pages capturées (pour la couverture du plan). */
function pagesLiees(pages) {
  const set = new Set(pages.map((p) => new URL(p.url).pathname));
  for (const p of pages)
    for (const m of p.html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
      try {
        const u = new URL(m[1], p.url);
        if (u.origin === new URL(p.url).origin) set.add(u.pathname);
      } catch {
        /* adresse invalide */
      }
    }
  return set;
}

const HOTE = `<!doctype html><html><head><style>html,body{margin:0}iframe{border:0;width:${VIEW.width}px;height:${VIEW.height}px;display:block}</style></head>
<body><iframe id="f" sandbox="allow-scripts"></iframe><script>
  window.__go = []; window.__ready = 0;
  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.fd !== 1) return;
    if (d.t === 'ready') window.__ready++;
    if (d.t === 'go') window.__go.push(d.step);
  });
</script></body></html>`;

/** Reprise comme le lecteur, et le même parcours ; compte les sorties réseau. */
async function reprise(b, s, pages, buildSrcdoc, vues) {
  const ctx = await b.newContext({ viewport: VIEW, locale: 'fr-FR' });
  ctx.setDefaultTimeout(1500);
  const sorties = [];
  ctx.on('request', (r) => {
    if (!/^(data|about|blob):/.test(r.url())) sorties.push(r.url());
  });
  const page = await ctx.newPage();
  await page.setContent(HOTE);
  const docs = new Map();
  for (const p of pages) docs.set(String(p.order), await buildSrcdoc(p.html));
  const charger = async (order) => {
    const p = pages.find((x) => String(x.order) === order);
    const avant = await page.evaluate(() => window.__ready);
    await page.evaluate((d) => (document.getElementById('f').srcdoc = d), docs.get(order));
    await page.waitForFunction((n) => window.__ready > n, avant, { timeout: 5000 });
    await page.evaluate(
      (a) =>
        document
          .getElementById('f')
          .contentWindow.postMessage(
            { fd: 1, t: 'init', mode: 'player', ops: [], autoLinks: a, unlinked: 'toast' },
            '*',
          ),
      liensAuto(p, pages),
    );
    await page.waitForTimeout(150);
  };
  const c = page.frameLocator('#f');
  // Fidélité visuelle : chaque page copiée contre la vue du site au moment de sa capture
  const visuel = [];
  for (const p of pages) {
    await charger(String(p.order));
    const png = await page.screenshot();
    if (SHOTS) fs.writeFileSync(`${SHOTS}/mesure-${s.id}-reprise${p.order}.png`, png);
    const vu = vues.get(p.order);
    if (vu) visuel.push(await similitude(b, vu, png));
  }
  await charger(String(pages[0].order));
  const res = [];
  for (const g of s.parcours) {
    let ok = false;
    try {
      if (g.faire) await g.faire(c);
      await page.waitForTimeout(250);
      const go = await page.evaluate(() => window.__go.splice(0));
      if (go.length) await charger(go[go.length - 1]);
      ok = await verifier(c, g);
    } catch {
      ok = false;
    }
    res.push(ok);
  }
  // Témoin : une requête volontaire de la page hôte doit être vue par le détecteur (sinon « 0 sortie »
  // ne prouverait rien) ; elle est retirée du compte
  await page.evaluate((u) => fetch(u).catch(() => null), `${BANC}/banc.css?temoin`);
  await page.waitForTimeout(300);
  const temoin = sorties.some((u) => u.endsWith('?temoin'));
  await ctx.close();
  return { res, visuel, sorties: sorties.filter((u) => !u.endsWith('?temoin')), temoin };
}

let comparateur = null;
/** Part des pixels identiques (écart de couleur ≤ 48 sur la somme des canaux) entre deux captures. */
async function similitude(b, a, c) {
  if (!comparateur) comparateur = await (await b.newContext()).newPage();
  return comparateur.evaluate(
    async ([x, y]) => {
      const img = async (s) => {
        const i = new Image();
        i.src = `data:image/png;base64,${s}`;
        await i.decode();
        return i;
      };
      const [i1, i2] = [await img(x), await img(y)];
      const w = Math.min(i1.width, i2.width);
      const h = Math.min(i1.height, i2.height);
      const lire = (i) => {
        const cv = new OffscreenCanvas(w, h);
        const g = cv.getContext('2d');
        g.drawImage(i, 0, 0);
        return g.getImageData(0, 0, w, h).data;
      };
      const [d1, d2] = [lire(i1), lire(i2)];
      let same = 0;
      for (let k = 0; k < d1.length; k += 4)
        if (Math.abs(d1[k] - d2[k]) + Math.abs(d1[k + 1] - d2[k + 1]) + Math.abs(d1[k + 2] - d2[k + 2]) <= 48)
          same++;
      return same / (w * h);
    },
    [a.toString('base64'), c.toString('base64')],
  );
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 100);

async function principal() {
  const { buildSrcdoc } = await import('../../../../packages/player-core/src/htmlFrame.ts');
  await fetch('http://localhost:54400/__html-capture', {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  const b = await chromium.launch();
  const rapport = [];
  for (const s of SITES) {
    // Le site est-il servi ?
    const servi = (await fetch(BANC + s.depart).catch(() => null))?.ok === true;
    const v = servi ? await vivant(b, s) : { res: [], gets: 0 };
    const vues = new Map();
    const cap = servi
      ? await capturer({ ...s, gestes: s.capture }, null, {
          vu: async (p, n) => {
            // Vue du site seul : l'interface de capture (barre, anneau) est masquée le temps de la photo
            await p.addStyleTag({ content: '[data-fd-ui]{visibility:hidden!important}' });
            vues.set(n, await p.screenshot());
            await p.evaluate(() => document.querySelector('style:last-of-type')?.remove());
            if (SHOTS) fs.writeFileSync(`${SHOTS}/mesure-${s.id}-site${n}.png`, vues.get(n));
          },
        })
      : { pages: [], erreur: 'site non servi' };
    const pages = [...cap.pages].sort((x, y) => x.order - y.order);
    const r = pages.length
      ? await reprise(b, s, pages, buildSrcdoc, vues)
      : { res: [], visuel: [], sorties: [], temoin: false };
    const liees = pagesLiees(pages);
    const capturees = new Set(pages.map((p) => new URL(p.url).pathname));
    const ligne = {
      site: s.id,
      nom: s.nom,
      servi,
      banc: { gestes: s.parcours.length, reussis: v.res.filter(Boolean).length },
      pages: pages.length,
      erreurCapture: cap.erreur ?? null,
      interaction: {
        reussis: r.res.filter(Boolean).length,
        gestes: s.parcours.length,
        detail: s.parcours.map((g, i) => ({
          geste: g.nom,
          site: v.res[i] ?? false,
          reprise: r.res[i] ?? false,
        })),
      },
      visuel: r.visuel.length
        ? Math.round((r.visuel.reduce((a, x) => a + x, 0) / r.visuel.length) * 1000) / 10
        : null,
      // La v1 ne garde aucune réponse : tout GET lu par la page est « non rejoué »
      reponses: { replayed: 0, unreplayed: v.gets },
      couverture: { capturees: [...liees].filter((x) => capturees.has(x)).length, liees: liees.size },
      sorties: r.sorties,
      temoin: r.temoin === true,
    };
    rapport.push(ligne);
    console.error(
      `${s.id} : banc ${ligne.banc.reussis}/${ligne.banc.gestes}, ${pages.length} page(s), interaction ${ligne.interaction.reussis}/${ligne.interaction.gestes}, visuel ${ligne.visuel ?? '–'} %, réponses ${ligne.reponses.replayed}/${ligne.reponses.replayed + ligne.reponses.unreplayed}, plan ${ligne.couverture.capturees}/${ligne.couverture.liees}, sorties ${r.sorties.length}`,
    );
  }
  await b.close();
  const tot = (f) => rapport.reduce((a, x) => a + f(x), 0);
  const total = {
    interaction: pct(
      tot((x) => x.interaction.reussis),
      tot((x) => x.interaction.gestes),
    ),
    visuel:
      Math.round(
        (rapport.filter((x) => x.visuel !== null).reduce((a, x) => a + x.visuel, 0) /
          rapport.filter((x) => x.visuel !== null).length) *
          10,
      ) / 10,
    reponses: pct(
      tot((x) => x.reponses.replayed),
      tot((x) => x.reponses.replayed + x.reponses.unreplayed),
    ),
    couverture: pct(
      tot((x) => x.couverture.capturees),
      tot((x) => x.couverture.liees),
    ),
    sorties: tot((x) => x.sorties.length),
  };
  console.log(JSON.stringify({ total, sites: rapport }, null, 2));

  // Critères de l'étape 1, à 100 %
  const criteres = [
    ['Chaque site d’essai est servi', rapport.every((x) => x.servi)],
    [
      'Chaque parcours passe entièrement sur le site vivant',
      rapport.every((x) => x.banc.reussis === x.banc.gestes),
    ],
    [
      'Chaque site est capturé sans erreur et mesuré',
      rapport.every((x) => x.pages > 0 && !x.erreurCapture && x.visuel !== null),
    ],
    [
      'Aucune sortie réseau de la reprise (détecteur vérifié par un témoin)',
      total.sorties === 0 && rapport.every((x) => x.temoin),
    ],
  ];
  for (const [nom, ok] of criteres) {
    console.error(`${ok ? 'ok' : 'NOT OK'} - ${nom}`);
    if (!ok) process.exitCode = 1;
  }
  if (RAPPORT) fs.writeFileSync(RAPPORT, markdown(total, rapport, criteres));
}

function markdown(total, rapport, criteres) {
  const l = [];
  l.push('| Site d’essai | Pages | Interaction | Visuel | Réponses rejouées | Plan | Sorties |');
  l.push('|---|---|---|---|---|---|---|');
  for (const x of rapport)
    l.push(
      `| ${x.nom} | ${x.pages} | ${x.interaction.reussis}/${x.interaction.gestes} | ${x.visuel ?? '–'} % | ${x.reponses.replayed}/${x.reponses.replayed + x.reponses.unreplayed} | ${x.couverture.capturees}/${x.couverture.liees} | ${x.sorties.length} |`,
    );
  l.push(
    `| **Total** | ${rapport.reduce((a, x) => a + x.pages, 0)} | **${total.interaction} %** | **${total.visuel} %** | **${total.reponses} %** | **${total.couverture} %** | **${total.sorties}** |`,
  );
  l.push('', '### Gestes', '');
  for (const x of rapport) {
    l.push(
      `- **${x.nom}** : ${x.interaction.detail.map((d) => `${d.reprise ? '✓' : '✗'} ${d.geste}`).join(' · ')}`,
    );
  }
  l.push('', '### Critères de l’étape 1 (100 %)', '');
  for (const [nom, ok] of criteres) l.push(`- ${ok ? '✓' : '✗'} ${nom}`);
  return `${l.join('\n')}\n`;
}

module.exports = { SITES };
if (require.main === module)
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
