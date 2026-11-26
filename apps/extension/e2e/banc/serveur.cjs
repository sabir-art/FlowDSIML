/**
 * L60 : banc de sites d'essai de la capture (données fictives, servis en local). Cinq cas tirés des
 * retours du client : application à page unique, formulaire envoyé, scripts de tiers, onglets chargés en
 * différé, menu ouvert au survol. Sandbox v2 (étape 1) : site de plusieurs pages, liste filtrée chargée
 * par fetch, panier gardé dans localStorage. Port 54410 (le site) et 54411 (le « tiers » : mesure d'audience, chat).
 * Usage : node e2e/banc/serveur.cjs
 */
const http = require('http');

const CSS = `
  @font-face { font-family: Banc; src: local('Georgia'); }
  body { margin: 0; font: 16px/1.5 Banc, Georgia, serif; color: #1c2430; background: #f6f3ee; }
  header { display: flex; gap: 16px; align-items: center; padding: 12px 24px; background: #17324d; color: #fff; }
  header a, header button { color: #fff; font: inherit; background: none; border: 0; cursor: pointer; text-decoration: none; }
  main { padding: 24px; max-width: 760px; }
  h1 { color: #a3195b; margin: 0 0 16px; }
  .carte { padding: 16px; border: 1px solid #d5cfc4; border-radius: 12px; background: #fff; margin: 0 0 12px; }
  .btn { padding: 8px 16px; border-radius: 10px; border: 0; background: #a3195b; color: #fff; font: inherit; cursor: pointer; }
  .sous-menu { display: none; position: absolute; background: #fff; border: 1px solid #d5cfc4; padding: 8px; border-radius: 8px; }
  .menu:hover .sous-menu, .menu.ouvert .sous-menu { display: block; }
  .sous-menu a { display: block; color: #17324d; padding: 4px 8px; }
  [role=tab][aria-selected=true] { border-bottom: 2px solid #a3195b; font-weight: 700; }
  .erreur { color: #b3261e; }
`;
// Petit logo en SVG (image de la page, même origine)
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#f8bb61"/></svg>`;
const page = (title, body, script = '') => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${title}</title><link rel="stylesheet" href="/banc.css"></head><body>${body}
${script ? `<script>${script}</script>` : ''}</body></html>`;
const entete = `<header><img src="/logo.svg" width="32" height="32" alt="ExempleCRM"><strong>ExempleCRM</strong>`;

/** Page du site statique : barre de navigation commune vers les 4 pages. */
const site4 = (titre, texte) =>
  page(
    titre,
    `${entete}<nav><a href="/site">Accueil</a> <a href="/site/offres">Offres</a> <a href="/site/equipe">Équipe</a> <a href="/site/contact">Contact</a></nav></header>
     <main><h1>${titre}</h1><p class="carte">${texte}</p></main>`,
  );
const PRODUITS = [
  { nom: 'ExempleCRM', prix: '19 € par mois' },
  { nom: 'ExempleFacture', prix: '9 € par mois' },
  { nom: 'ExempleAgenda', prix: '5 € par mois' },
];

const CLIENTS = [
  { id: 1, nom: 'Atelier Durand', ville: 'Lyon' },
  { id: 2, nom: 'Maison Leroy', ville: 'Nantes' },
];

const PAGES = {
  // 1. Application à page unique : routes internes, liste chargée par fetch
  '/app': page(
    'ExempleCRM',
    `${entete}<a href="/app" data-route>Accueil</a><a href="/app/clients" data-route>Clients</a></header><main id="vue"></main>`,
    `const vue = document.getElementById('vue');
     async function rendre() {
       const p = location.pathname;
       if (p === '/app') vue.innerHTML = '<h1>Accueil</h1><p class="carte">Bienvenue dans ExempleCRM.</p>';
       else if (p === '/app/clients') {
         vue.innerHTML = '<h1>Clients</h1><p>Chargement…</p>';
         const l = await (await fetch('/api/clients')).json();
         vue.innerHTML = '<h1>Clients</h1>' + l.map(c => '<p class="carte"><a href="/app/clients/' + c.id + '" data-route>' + c.nom + '</a> · ' + c.ville + '</p>').join('');
       } else {
         const id = p.split('/').pop();
         const l = await (await fetch('/api/clients')).json();
         const c = l.find(x => String(x.id) === id);
         vue.innerHTML = '<h1>' + c.nom + '</h1><p class="carte">Ville : ' + c.ville + '</p><button class="btn" id="note">Ajouter une note</button><p id="notes"></p>';
         document.getElementById('note').onclick = () => (document.getElementById('notes').textContent = 'Note ajoutée');
       }
     }
     document.addEventListener('click', e => { const a = e.target.closest('a[data-route]'); if (!a) return; e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); rendre(); });
     addEventListener('popstate', rendre); rendre();`,
  ),
  // 2. Formulaire : validation côté client, envoi POST, écran de confirmation
  '/formulaire': page(
    'Demande de contact',
    `${entete}</header><main><h1>Demande de contact</h1>
     <form id="f" class="carte" novalidate><label>Nom <input name="nom" id="nom"></label>
     <label>Objet <select name="objet"><option>Devis</option><option>Support</option></select></label>
     <p class="erreur" id="err" hidden>Indiquez votre nom.</p><button class="btn">Envoyer la demande</button></form></main>`,
    `document.getElementById('f').addEventListener('submit', async e => { e.preventDefault();
       const nom = document.getElementById('nom').value.trim();
       if (!nom) { document.getElementById('err').hidden = false; return; }
       const r = await (await fetch('/api/contact', { method: 'POST', body: JSON.stringify({ nom }) })).json();
       document.querySelector('main').innerHTML = '<h1>Demande envoyée</h1><p class="carte">Merci, votre demande n° ' + r.numero + ' est enregistrée.</p><a href="/formulaire">Nouvelle demande</a>'; });`,
  ),
  // 3. Scripts de tiers : mesure d'audience et fenêtre de discussion d'un autre domaine, plus le script de la page
  '/tiers': `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Tableau de bord</title>
    <link rel="stylesheet" href="/banc.css"><script src="http://localhost:54411/analytics.js"></script></head><body>
    ${entete}</header><main><h1>Tableau de bord</h1><p class="carte">Ventes du mois : <b id="total">…</b></p>
    <button class="btn" id="plus">Ajouter une vente</button></main>
    <script>let n = 12; const t = document.getElementById('total'); t.textContent = n; document.getElementById('plus').onclick = () => (t.textContent = ++n);</script>
    <script src="http://localhost:54411/chat.js" async></script></body></html>`,
  // 4. Onglets chargés en différé (même adresse)
  '/onglets': page(
    'Fiche produit',
    `${entete}</header><main><h1>Fiche produit</h1><div role="tablist">
     <button role="tab" aria-selected="true" data-t="resume">Résumé</button><button role="tab" aria-selected="false" data-t="tarifs">Tarifs</button><button role="tab" aria-selected="false" data-t="avis">Avis</button></div>
     <div role="tabpanel" id="panneau" class="carte">Un produit simple, livré en 48 h.</div></main>`,
    `document.querySelectorAll('[role=tab]').forEach(b => b.onclick = async () => {
       document.querySelectorAll('[role=tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
       const p = document.getElementById('panneau'); p.textContent = 'Chargement…';
       p.innerHTML = (await (await fetch('/api/onglet/' + b.dataset.t)).json()).html; });`,
  ),
  // 5. Menu ouvert au survol, liens vers des pages
  '/menu': page(
    'Catalogue',
    `${entete}<div class="menu" id="m"><button aria-haspopup="true">Produits</button><div class="sous-menu"><a href="/menu/logiciels">Logiciels</a><a href="/menu/services">Services</a></div></div></header>
     <main><h1>Catalogue</h1><p class="carte">Survolez « Produits » pour ouvrir le menu.</p></main>`,
    `const m = document.getElementById('m'); m.addEventListener('mouseenter', () => m.classList.add('ouvert')); m.addEventListener('mouseleave', () => m.classList.remove('ouvert'));`,
  ),
  // 6. Fiche avec de vraies données personnelles (fictives) : elles doivent être remplacées, pas les commandes.
  //    Petit lot UX : libellés de rôle (Client, Responsable, Interlocutrice) et nom d'un seul mot sous « Nom »
  '/donnees': page(
    'Fiche contact',
    `${entete}</header><main><h1>Fiche contact</h1>
     <p class="carte"><span>Nom</span> <span id="v-nom">Camille Durand</span></p>
     <p class="carte"><span>E-mail</span> <span id="v-mail">camille.durand@acme.example</span></p>
     <p class="erreur" hidden>Indiquez votre nom.</p>
     <button class="btn">Modifier la fiche</button> <a href="/donnees">Voir l’historique</a>
     <p class="carte" id="v-client">Client : Léa Martin</p>
     <dl class="carte"><dt>Responsable</dt><dd>Hugo Bernard</dd><dt>Interlocutrice</dt><dd>Inès Petit</dd></dl>
     <table class="carte"><thead><tr><th>Nom</th><th>Contact</th><th>Statut</th></tr></thead>
     <tbody><tr><td>Moreau</td><td>Julie Roux</td><td>Active</td></tr></tbody></table>
     <table class="carte" id="sans-thead"><tr><th>Nom</th><th>Rôle</th></tr>
     <tr><td>Durand</td><td>Cheffe de projet</td></tr><tr><td>Martin</td><td>Consultant</td></tr></table></main>`,
  ),
  // 7. Page piège (recette UX du 25/11) : rien de personnel, donc aucune détection attendue. En-têtes
  //    de tableau « Nom / Statut / Actions », les mêmes en mots collés, une ville seule, un avis signé
  //    d'un prénom et d'une initiale, un rôle tenu par un service, une colonne « Client » sans nom, un bouton aux textes collés.
  '/piege': page(
    'Offres',
    `${entete}</header><main><h1>Offres</h1>
     <table class="carte"><thead><tr><th>Nom</th><th>Statut</th><th>Actions</th></tr></thead>
     <tbody><tr><td>Offre essentielle</td><td>Active</td><td><button class="btn">Ouvrir</button></td></tr>
     <tr><td>Offre avancée</td><td>Brouillon</td><td><button class="btn">Ouvrir</button></td></tr></tbody></table>
     <div class="carte" id="colles"><span>Nom</span><span>Statut</span><span>Actions</span></div>
     <div class="carte" id="grille"><div>Nom</div><div>Statut</div><div>Actions</div></div>
     <p class="carte" id="ville">Ville : Lyon</p>
     <p class="carte" id="avis">Avis : « Très bon outil », Camille D.</p>
     <button class="btn" id="colle-btn"><span>Créer une note</span><span>Texte libre</span><span>Ouvrir</span></button>
     <p class="carte" id="role">Responsable : Service RH</p>
     <label class="carte">Type de client <select><option>Entreprise</option><option>Particulier</option></select></label>
     <table class="carte"><thead><tr><th>Client</th><th>Formule</th></tr></thead>
     <tbody><tr><td>Brouillon</td><td>Mensuelle</td></tr><tr><td>Actions</td><td>Annuelle</td></tr></tbody></table>
     <table class="carte" id="piege-sans-thead"><tr><th>Nom</th><th>Statut</th><th>Actions</th></tr>
     <tr><td>Projet Alpha</td><td>Active</td><td>Ouvrir</td></tr></table></main>`,
  ),
  // Sandbox v2, étape 1 : les trois sites d'essai qui manquaient au banc (note sandbox-v2.md §4)
  // 8. Site de plusieurs pages statiques : la page Contact n'est jamais visitée pendant la capture
  '/site': site4('Accueil', 'Bienvenue sur le site d’ExempleCRM.'),
  '/site/offres': site4('Nos offres', 'Essentielle, Avancée, Entreprise.'),
  '/site/equipe': site4('Notre équipe', 'Douze personnes à Lyon et à Nantes.'),
  '/site/contact': site4('Nous écrire', 'Réponse sous 24 h ouvrées.'),
  // 9. Liste chargée par fetch, avec un filtre (chaque frappe interroge le serveur)
  '/liste': page(
    'Produits',
    `${entete}</header><main><h1>Produits</h1>
     <label class="carte">Filtrer <input id="filtre" type="search" placeholder="Nom du produit"></label>
     <div id="liste"><p>Chargement…</p></div></main>`,
    `const liste = document.getElementById('liste');
     async function charger(q) {
       const l = await (await fetch('/api/produits?q=' + encodeURIComponent(q))).json();
       liste.innerHTML = l.length ? l.map(p => '<p class="carte"><b>' + p.nom + '</b> · ' + p.prix + '</p>').join('') : '<p class="carte">Aucun produit.</p>';
     }
     document.getElementById('filtre').addEventListener('input', e => charger(e.target.value)); charger('');`,
  ),
  // 10. Application qui dépend de localStorage : un panier gardé dans le navigateur
  '/stockage': page(
    'Panier',
    `${entete}</header><main><h1>Panier</h1><p class="carte" id="panier">Panier : …</p>
     <button class="btn" id="ajout">Ajouter au panier</button> <button class="btn" id="vider">Vider le panier</button></main>`,
    `const el = document.getElementById('panier');
     const lire = () => Number(localStorage.getItem('panier') || 0);
     const montrer = () => (el.textContent = 'Panier : ' + lire());
     document.getElementById('ajout').onclick = () => { localStorage.setItem('panier', lire() + 1); montrer(); };
     document.getElementById('vider').onclick = () => { localStorage.removeItem('panier'); montrer(); };
     montrer();`,
  ),
  '/menu/logiciels': page(
    'Logiciels',
    `${entete}<a href="/menu">Catalogue</a></header><main><h1>Logiciels</h1><p class="carte">ExempleCRM, ExempleFacture.</p></main>`,
  ),
  '/menu/services': page(
    'Services',
    `${entete}<a href="/menu">Catalogue</a></header><main><h1>Services</h1><p class="carte">Formation, assistance.</p></main>`,
  ),
};
const ONGLETS = {
  resume: 'Un produit simple, livré en 48 h.',
  tarifs: '<b>Tarifs</b> : 19 € par mois, sans engagement.',
  avis: '<b>Avis</b> : « Très bon outil », Camille D.',
};

function site(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const send = (type, body, status = 200) => {
    res.writeHead(status, {
      'content-type': type,
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(body);
  };
  const attendre = (ms, fn) => setTimeout(fn, ms);
  if (u.pathname === '/banc.css') return send('text/css', CSS);
  if (u.pathname === '/logo.svg') return send('image/svg+xml', LOGO);
  if (u.pathname === '/api/clients')
    return attendre(250, () => send('application/json', JSON.stringify(CLIENTS)));
  if (u.pathname === '/api/produits') {
    const q = (u.searchParams.get('q') ?? '').toLowerCase();
    return attendre(150, () =>
      send('application/json', JSON.stringify(PRODUITS.filter((p) => p.nom.toLowerCase().includes(q)))),
    );
  }
  if (u.pathname.startsWith('/api/onglet/'))
    return attendre(350, () =>
      send('application/json', JSON.stringify({ html: ONGLETS[u.pathname.split('/').pop()] ?? '' })),
    );
  if (u.pathname === '/api/contact' && req.method === 'POST')
    return attendre(200, () => send('application/json', JSON.stringify({ numero: 1042 })));
  if (u.pathname.startsWith('/app')) return send('text/html; charset=utf-8', PAGES['/app']);
  if (PAGES[u.pathname]) return send('text/html; charset=utf-8', PAGES[u.pathname]);
  send('text/plain', 'introuvable', 404);
}
function tiers(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const js = {
    // Mesure d'audience fictive : une file d'événements et une image de suivi
    '/analytics.js': `window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'page_view' }); new Image().src = 'http://localhost:54411/collect?p=' + encodeURIComponent(location.pathname);`,
    // Fenêtre de discussion fictive : un bouton flottant ajouté à la page
    '/chat.js': `const b = document.createElement('button'); b.id = 'chat-tiers'; b.textContent = 'Discuter avec nous'; b.style.cssText = 'position:fixed;right:16px;bottom:16px;padding:12px;border-radius:24px;background:#17324d;color:#fff;border:0'; document.body.appendChild(b);`,
  }[u.pathname];
  res.writeHead(js ? 200 : 204, {
    'content-type': 'application/javascript',
    'access-control-allow-origin': '*',
  });
  res.end(js ?? '');
}
http.createServer(site).listen(54410, () => console.log('banc : http://localhost:54410'));
http.createServer(tiers).listen(54411, () => console.log('tiers : http://localhost:54411'));
