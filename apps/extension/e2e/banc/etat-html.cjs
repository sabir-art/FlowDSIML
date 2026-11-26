/**
 * L60 : état des lieux de la capture HTML / Sandbox sur le banc (serveur.cjs), avec l'extension
 * construite et chargée. Pour chaque cas : le parcours d'un utilisateur, ce qui est capturé, puis la
 * relecture de chaque page copiée comme dans le lecteur (scripts retirés) pour juger sa fidélité.
 * Prérequis : node e2e/mock-supabase.cjs, node e2e/banc/serveur.cjs, build WXT_E2E=1.
 * Usage : node e2e/banc/etat-html.cjs [SHOTS_DIR=…]   (écrit un rapport JSON sur la sortie)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WS = '11111111-1111-1111-1111-111111111111';
const BANC = 'http://localhost:54410';
const SHOTS = process.env.SHOTS_DIR;
const ext = path.resolve(__dirname, '../../.output/chrome-mv3');

/** Chaque cas : départ, gestes (avec « ajouter » = bouton « Capturer cette page »), états attendus. */
const CAS = [
  {
    id: 'spa',
    nom: 'Application à page unique',
    depart: '/app',
    pret: (p) => p.getByRole('heading', { name: 'Accueil' }).waitFor(),
    gestes: async (p, x) => {
      await p.getByRole('link', { name: 'Clients' }).click();
      await p.getByRole('link', { name: 'Atelier Durand' }).waitFor();
      await x.pages(2);
      await p.getByRole('link', { name: 'Atelier Durand' }).click();
      await p.getByRole('heading', { name: 'Atelier Durand' }).waitFor();
      await x.pages(3);
    },
    attendus: [
      ['Accueil', 'Bienvenue dans ExempleCRM.'],
      ['Liste des clients (chargée en différé)', 'Maison Leroy'],
      ['Fiche du client (bouton lisible)', 'Ajouter une note'],
      ['Ville seule lisible', 'Ville : Lyon'],
    ],
  },
  {
    id: 'formulaire',
    nom: 'Formulaire envoyé (POST)',
    depart: '/formulaire',
    pret: (p) => p.getByRole('heading', { name: 'Demande de contact' }).waitFor(),
    gestes: async (p, x) => {
      await p.locator('#nom').fill('Camille Durand');
      await p.getByRole('button', { name: 'Envoyer la demande' }).click();
      await p.getByRole('heading', { name: 'Demande envoyée' }).waitFor();
      await x.pages(2);
    },
    attendus: [
      ['Formulaire', 'Envoyer la demande'],
      ['Confirmation après envoi', 'votre demande n° 1042'],
    ],
  },
  {
    id: 'tiers',
    nom: 'Scripts de tiers (mesure d’audience, chat)',
    depart: '/tiers',
    pret: (p) => p.locator('#chat-tiers').waitFor(),
    gestes: async (p, x) => {
      await p.getByRole('button', { name: 'Ajouter une vente' }).click();
      await p.locator('#total', { hasText: '13' }).waitFor();
      await x.ajouter();
      await x.pages(2);
    },
    attendus: [
      ['Tableau de bord', 'Ventes du mois : 12'],
      ['Après « Ajouter une vente »', 'Ventes du mois : 13'],
    ],
  },
  {
    id: 'onglets',
    nom: 'Onglets chargés en différé',
    depart: '/onglets',
    pret: (p) => p.getByRole('tab', { name: 'Résumé' }).waitFor(),
    gestes: async (p, x) => {
      await p.getByRole('tab', { name: 'Tarifs' }).click();
      await p.getByText('19 € par mois').waitFor();
      await x.pages(2);
      await p.getByRole('tab', { name: 'Avis' }).click();
      await p.getByText('Très bon outil').waitFor();
      await x.pages(3);
    },
    attendus: [
      ['Onglet Résumé', 'livré en 48 h'],
      ['Onglet Tarifs', '19 € par mois'],
      ['Onglet Avis', 'Très bon outil'],
    ],
  },
  {
    id: 'menu',
    nom: 'Menu ouvert au survol',
    depart: '/menu',
    pret: (p) => p.getByRole('heading', { name: 'Catalogue' }).waitFor(),
    gestes: async (p, x) => {
      await p.getByRole('button', { name: 'Produits' }).hover();
      await p.getByRole('link', { name: 'Logiciels' }).waitFor();
      await x.ajouter();
      await x.pages(2);
      await p.getByRole('button', { name: 'Produits' }).hover();
      await p.getByRole('link', { name: 'Logiciels' }).click();
      await p.getByRole('heading', { name: 'Logiciels' }).waitFor();
      await x.pages(3);
    },
    attendus: [
      ['Catalogue', 'Survolez « Produits »'],
      ['Menu ouvert (liens visibles)', '__MENU_OUVERT__'],
      ['Page Logiciels', 'ExempleCRM, ExempleFacture.'],
    ],
  },
  {
    id: 'donnees',
    nom: 'Données personnelles et commandes',
    depart: '/donnees',
    pret: (p) => p.getByRole('heading', { name: 'Fiche contact' }).waitFor(),
    gestes: async () => {},
    attendus: [
      ['Commandes lisibles (bouton et lien)', 'Modifier la fiche'],
      ['Lien lisible', 'Voir l’historique'],
      ['Libellés de rôle lisibles', 'Interlocutrice'],
      ['Libellé « Client » lisible, nom remplacé', 'Client :'],
      ['Statut lisible dans le tableau', 'Active'],
      ['Tableau sans thead : en-tête et rôles lisibles', 'Cheffe de projet'],
    ],
    // Ce qui ne doit PAS rester lisible dans la copie
    interdits: [
      'Camille Durand',
      'camille.durand@acme.example',
      'Léa Martin',
      'Hugo Bernard',
      'Inès Petit',
      'Moreau',
      'Julie Roux',
      // Tableau sans thead (th dans la première ligne) : noms d'un seul mot remplacés
      'Durand',
      'Martin',
    ],
  },
  {
    id: 'piege',
    nom: 'Page piège (aucune donnée personnelle)',
    depart: '/piege',
    pret: (p) => p.getByRole('heading', { name: 'Offres' }).waitFor(),
    gestes: async () => {},
    // Tout doit rester lisible : aucun remplacement
    attendus: [
      ['En-têtes du tableau', 'Statut'],
      ['Mots collés', 'NomStatutActions'],
      ['En-têtes en blocs', 'Actions'],
      ['Ville seule lisible', 'Ville : Lyon'],
      ['Avis signé', 'Camille D.'],
      ['Lignes du tableau', 'Offre essentielle'],
      ['Rôle tenu par un service', 'Responsable : Service RH'],
      ['Colonne « Client » sans nom', 'Brouillon'],
      ['Champ « Type de client »', 'Entreprise'],
      ['Tableau sans thead, ligne sans nom', 'Projet Alpha'],
    ],
    remplacements: 0,
  },
];

async function capturer(cas, apres) {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-banc-')), {
    headless: true,
    locale: 'fr-FR',
    channel: 'chromium',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage();
  await page.goto(BANC + cas.depart);
  await cas.pret(page);
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.fill('#email', 'a@b.c');
  await popup.fill('#password', 'x');
  await popup.click('button[form=login]');
  await popup.waitForSelector('#setup:not([hidden])');
  const tabId = await popup.evaluate(async (u) => (await chrome.tabs.query({ url: u + '/*' }))[0].id, BANC);
  await popup.evaluate(
    (a) =>
      chrome.runtime.sendMessage({
        type: 'fd:start',
        workspaceId: a.WS,
        title: a.t,
        tabId: a.tabId,
        mode: 'html',
      }),
    { tabId, WS, t: cas.nom },
  );
  await page.bringToFront();
  const steps = () =>
    popup.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'fd:status' })).steps);
  const manques = [];
  const x = {
    // Attente sur l'état réel (compteur du service), 8 s : au-delà, la capture automatique n'a pas eu lieu
    pages: async (n) => {
      const fin = Date.now() + 8000;
      while (Date.now() < fin) {
        if ((await steps()) >= n) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      manques.push(n);
      return false;
    },
    ajouter: () => popup.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'fd:html-capture' }), tabId),
  };
  await x.pages(1);
  let erreur = null;
  try {
    await cas.gestes(page, x);
  } catch (e) {
    erreur = String(e.message).split('\n')[0];
  }
  const reviewP = ctx.waitForEvent('page', (p) => p.url().includes('/html-review.html'), { timeout: 20000 });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'fd:stop' }));
  let groupes = [];
  let pages = [];
  try {
    const review = await reviewP;
    await review.waitForSelector('section.grp, .empty, main', { timeout: 15000 });
    pages = await review.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('fd-html', 1);
          r.onsuccess = () => {
            const g = r.result.transaction('pages').objectStore('pages').getAll();
            g.onsuccess = () => res(g.result);
          };
        }),
    );
    groupes = await review.evaluate(() =>
      [...document.querySelectorAll('section.grp')].map((s) => ({
        titre: s.querySelector('h2, h3')?.textContent.trim(),
        lignes: s.querySelectorAll('li').length,
        garder: [...s.querySelectorAll('button')].filter((b) => /Garder/.test(b.textContent)).length,
      })),
    );
    if (SHOTS) await review.screenshot({ path: `${SHOTS}/banc-${cas.id}-verification.png`, fullPage: true });
    // Lot B : suite du parcours dans l'écran de vérification (envoi), avant de fermer le navigateur
    if (apres) await apres(review, ctx);
  } catch (e) {
    erreur = erreur || `vérification : ${String(e.message).split('\n')[0]}`;
  }
  await ctx.close();
  return { pages, groupes, manques, erreur };
}

/** Relit une page copiée comme le lecteur (sans aucun script) et juge ce qu'on y voit. */
async function relire(b, cas, pages) {
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  const vues = [];
  for (const p of pages) {
    const page = await ctx.newPage();
    await page.setContent(p.html, { waitUntil: 'load' });
    const m = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const img = document.querySelector('header img');
      const sm = document.querySelector('.sous-menu');
      return {
        texte: document.body.innerText,
        h1: h1 ? getComputedStyle(h1).color : null,
        entete: document.querySelector('header')
          ? getComputedStyle(document.querySelector('header')).backgroundColor
          : null,
        police: getComputedStyle(document.body).fontFamily,
        logo: img ? img.complete && img.naturalWidth > 0 : null,
        menuOuvert: sm ? getComputedStyle(sm).display !== 'none' : null,
        chat: !!document.querySelector('#chat-tiers'),
        scripts: document.querySelectorAll('script').length,
      };
    });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/banc-${cas.id}-page${p.order}.png` });
    vues.push({
      order: p.order,
      url: new URL(p.url).pathname,
      titre: p.title,
      nom: p.heading ?? null,
      lien: p.clickLabel ?? null,
      octets: p.html.length,
      ...m,
    });
    await page.close();
  }
  await ctx.close();
  return vues;
}

async function principal() {
  // Règle de l'espace fictif : capture HTML autorisée (faux Supabase)
  await fetch('http://localhost:54400/__html-capture', {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  const b = await chromium.launch();
  const rapport = [];
  for (const cas of CAS) {
    const { pages, groupes, manques, erreur } = await capturer(cas);
    const vues = await relire(b, cas, pages);
    const etats = cas.attendus.map(([nom, texte]) => {
      const v = vues.find((x) =>
        texte === '__MENU_OUVERT__' ? x.menuOuvert === true : x.texte.includes(texte),
      );
      return { nom, capture: !!v, page: v?.order ?? null };
    });
    const fidele = vues.every(
      (v) => v.h1 === 'rgb(163, 25, 91)' && v.entete === 'rgb(23, 50, 77)' && v.logo !== false,
    );
    rapport.push({
      cas: cas.id,
      nom: cas.nom,
      pagesCapturees: pages.length,
      etatsAttendus: etats.length,
      etatsCaptures: etats.filter((e) => e.capture).length,
      etats,
      capturesAutoManquees: manques,
      rendu: fidele ? 'styles, couleurs et logo conformes' : 'écart de rendu',
      liens: vues.map((v) => v.lien),
      titres: vues.map((v) => v.titre),
      noms: vues.map((v) => v.nom),
      chatTiersDansLaCopie: vues.map((v) => v.chat),
      scriptsDansLaCopie: vues.map((v) => v.scripts),
      verification: groupes,
      erreur,
      fuites: (cas.interdits ?? []).filter((t) => vues.some((v) => v.texte.includes(t))),
      // Nombre de remplacements faits dans les copies (données personnelles repérées)
      remplacements: pages.reduce((n, p) => n + (p.security?.piiReplaced ?? 0), 0),
      remplacementsAttendus: cas.remplacements ?? null,
      vues: vues.map(({ texte, ...v }) => v),
    });
    console.error(
      `${cas.id} : ${pages.length} page(s), ${etats.filter((e) => e.capture).length}/${etats.length} états${erreur ? `, erreur : ${erreur}` : ''}`,
    );
  }
  await b.close();
  console.log(JSON.stringify(rapport, null, 2));
  // Critère du lot A : tous les états retrouvés, rendu conforme, aucune donnée personnelle lisible
  for (const r of rapport) {
    // Nom de chaque écran : lisible (ni vide ni technique)
    const nomsOk = r.noms.every((n) => n && !/[#>{}]|:has\(/.test(n));
    const ok =
      r.etatsCaptures === r.etatsAttendus &&
      !r.erreur &&
      r.rendu.startsWith('styles') &&
      !r.fuites.length &&
      nomsOk &&
      (r.remplacementsAttendus === null || r.remplacements === r.remplacementsAttendus) &&
      // Gêne lot B : la page menu fermé mène d'office à l'état menu ouvert, par « Produits »
      (r.cas !== 'menu' || r.liens[0] === 'Produits');
    console.error(
      `${ok ? 'ok' : 'NOT OK'} - ${r.nom} : ${r.etatsCaptures}/${r.etatsAttendus} états, ${r.rendu}${r.fuites.length ? `, données lisibles : ${r.fuites.join(', ')}` : ''}${r.remplacementsAttendus !== null ? `, ${r.remplacements} remplacement(s) (${r.remplacementsAttendus} attendu)` : ''}${nomsOk ? '' : `, noms d’écran à revoir : ${JSON.stringify(r.noms)}`}${r.cas === 'menu' ? `, liens ${JSON.stringify(r.liens)}` : ''}${r.erreur ? `, ${r.erreur}` : ''}`,
    );
    if (!ok) process.exitCode = 1;
  }
}

module.exports = { CAS, capturer, relire };
if (require.main === module)
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
