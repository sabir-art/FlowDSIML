# Sandbox v2, étape 2 : lecture v2 (environnement factice et CSP)

Mesure du 26/11 sur le banc local, avec des pages d'essai préparées à la main depuis les sites du banc.
La capture v2 n'existe pas encore (étape 3). Données fictives uniquement.

## Ce qui est livré

`packages/player-core/src/liveFrame.ts` : `buildLiveSrcdoc(page)` construit le document d'une page
« vivante ». Le mode inerte (`buildSrcdoc`) reste le défaut et ne change pas.

| Appel de la page | Réponse de la boîte |
|---|---|
| `fetch` / XHR GET d'une adresse enregistrée | la réponse capturée (méthode + adresse normalisée, paramètres triés) |
| GET non enregistré | 404 vide, compté « non rejoué » |
| POST / PUT / PATCH / DELETE, `sendBeacon`, `WebSocket.send` | succès fictif (200 `{}`, 204 pour DELETE), compté « écriture », rien ne part |
| `WebSocket`, `EventSource` | objets inertes : ouverture réussie, aucun message |
| `localStorage`, `sessionStorage`, `document.cookie` | en mémoire, propres à la visite de la page ; `indexedDB` absent |
| `history.pushState` / `replaceState` / `back` | historique virtuel ; le lecteur reçoit `{ t: 'route', url }` |
| `location` (lecture et affectation), lien, envoi de formulaire | adresse virtuelle ; une navigation est transmise au lecteur (`{ t: 'nav', url }`), qui affiche la page capturée correspondante |

- **CSP** : `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `frame-src`, `worker-src`,
  `media-src` et `object-src` à `'none'`, images et polices en `data:` seulement. `script-src` ne
  contient que des empreintes : l'environnement, le script du cadre et chaque script gardé. Aucune
  adresse, aucun `eval`.
- **Iframe** : inchangée, `sandbox="allow-scripts"` sans `allow-same-origin`, donc une origine opaque.
- **Envoi de formulaire** : sans `allow-forms`, le navigateur bloque l'envoi avant l'évènement
  `submit`. L'environnement reprend le clic sur le bouton d'envoi : contrôle de validité natif, puis
  `submit` envoyé à la page.
- **Script du cadre** (`htmlFrame`) : en mode vivant, il n'empêche plus l'effet des boutons ni des
  envois. Les liens posés par l'auteur, les liens externes et le guide fonctionnent comme avant.
- **Scripts bloqués** : ils restent dans la page préparée (`keep: false`). Les rétablir (`keep: true`)
  les fait s'exécuter, sans recapture.

## Mesure (`apps/extension/e2e/banc/lecture-v2.cjs`)

| Site d’essai | Interaction | Réponses rejouées | Écritures fictives | Scripts bloqués | Sorties |
|---|---|---|---|---|---|
| Site de plusieurs pages statiques | 3/4 | 0/0 | 0 | – | 0 |
| Application à page unique (routes, liste chargée) | 4/4 | 2/2 | 0 | – | 0 |
| Liste chargée par fetch, avec filtre | 3/4 | 3/4 | 0 | – | 0 |
| Formulaire avec validation et envoi POST | 3/3 | 0/0 | 1 | – | 0 |
| Application qui dépend de localStorage | 4/4 | 0/0 | 0 | – | 0 |
| Mesure d’audience et widget de tiers | 3/3 | 0/0 | 0 | localhost:54411 (tracking), localhost:54411 (third) | 0 |
| Onglets chargés en différé (L60) | 2/3 | 2/3 | 0 | – | 0 |
| Menu ouvert au survol (L60) | 3/3 | 0/0 | 0 | – | 0 |
| **Total** | **89.3 %** | **77.8 %** | **1** | | **0** |

### Gestes

- **Site de plusieurs pages statiques** : ✓ Offres · ✓ Équipe · ✗ Contact (page non visitée) · ✓ Retour à l’accueil
- **Application à page unique (routes, liste chargée)** : ✓ Clients (liste chargée) · ✓ Fiche client · ✓ Ajouter une note · ✓ Retour à l’accueil
- **Liste chargée par fetch, avec filtre** : ✓ Liste complète · ✓ Filtre « crm » · ✗ Filtre sans résultat · ✓ Filtre vidé
- **Formulaire avec validation et envoi POST** : ✓ Envoi sans nom : erreur · ✓ Envoi : la page avance · ✓ Retour : formulaire vide
- **Application qui dépend de localStorage** : ✓ Panier vide · ✓ Ajouter · ✓ Ajouter encore · ✓ Vider
- **Mesure d’audience et widget de tiers** : ✓ Tableau de bord · ✓ Ajouter une vente · ✓ Ajouter encore
- **Onglets chargés en différé (L60)** : ✓ Onglet Tarifs · ✓ Onglet Avis · ✗ Onglet Résumé
- **Menu ouvert au survol (L60)** : ✓ Survol de Produits · ✓ Page Logiciels · ✓ Retour au catalogue

### Critères à 100 %

- ✓ Chaque site d’essai est servi
- ✓ Chaque parcours réussit entièrement sur le site vivant
- ✓ c) Aucune sortie réseau depuis la lecture (détecteur vérifié par un témoin)
- ✓ d) Aucune écriture réelle : l’envoi du formulaire reçoit un succès fictif, la page avance
- ✓ b) Un script bloqué se rétablit sans recapture
- ✓ c) Page piège : 16 tentatives de sortie, aucune requête ne part

**Page piège** : un script gardé tente 21 sorties (fetch, XHR, WebSocket, EventSource, sendBeacon,
image, script, iframe, prefetch, feuille de style, CSS, `eval`, `new Function`, `window.open`,
`Worker`, `location`, `window.top`, envoi de formulaire…).
- 7 requêtes sont vues par le navigateur, toutes bloquées par la CSP.
- Le serveur témoin, qui compte ce qui l'atteint vraiment, ne reçoit **rien**.

## Lecture

- **Interaction 89,3 %**, contre 53,6 % en v1. Les 3 gestes manqués sont tous du contenu que
  l'auteur n'a pas capturé : la page Contact jamais visitée, le filtre « zzz » jamais tapé, l'onglet
  Résumé jamais rechargé. Ils relèvent de la capture (étape 3) et des pages liées (étape 4), pas de
  la lecture : tout ce qui a été capturé se rejoue.
- Les critères à 100 % b), c) et d) sont contrôlés à chaque passage, et le script échoue sinon.
  Le critère a) (chaque page capturée est dans le plan) ne peut être contrôlé qu'avec la capture v2
  et l'éditeur (étapes 3 et 4).

## Limites connues

- `window.location` et `document.location` écrits en toutes lettres ne sont pas virtualisés : seul
  `location` seul l'est (portée `with` des scripts classiques, constante en tête d'un module).
- Dans un script classique gardé, `let`, `const` et `class` au niveau le plus haut deviennent locaux
  à ce script (portée `with`). `var` et `function` restent globaux.
- Pas d'`eval` ni de `new Function` : un site qui en dépend reste partiel.
- Les attributs `on*` retirés par l'assainissement ne sont pas rétablis.
- Le lecteur (`apps/player`, `HtmlStep`) n'utilise pas encore `buildLiveSrcdoc`. Le branchement
  viendra avec les données de la capture v2 (`html_meta.mode = 'live'`, `replay.json`, étape 3).
