# Sandbox v2 : note d'architecture (L60)

Statut : validée par le chef (décisions au §8). Étape 1 livrée : banc et mesure de la v1
(`docs/tech/recettes/sandbox-v2-etape1/mesure-v1.md`). Étape 2 livrée : lecture v2, 89,3 %
d'interaction sur des pages préparées à la main
(`docs/tech/recettes/sandbox-v2-etape2/lecture-v2.md`). Étapes 3 à 6 : à développer.

## 1. Ce que veut le client

Un Sandbox se parcourt comme le vrai site : les menus s'ouvrent, les onglets changent, les listes se
filtrent, un formulaire envoyé fait avancer. Mais rien n'est enregistré : si l'on revient sur le
formulaire, il est vide. Aujourd'hui il constate trois défauts : des pages mal rendues, des pages
absentes du plan, et beaucoup de scripts bloqués sans moyen de les rétablir.

## 2. Pourquoi la v1 ne peut pas y arriver

La v1 capture une **copie inerte** de la page, et c'est un choix de sécurité assumé.

| Étape | Ce que fait la v1 | Conséquence |
|---|---|---|
| Capture (`apps/extension/lib/htmlCapture.ts`) | copie du DOM rendu, CSS et images intégrés au fichier | l'état visible est fidèle au moment de la copie |
| Assainissement (`packages/core/src/htmlSanitize.ts`, puis `html-ingest`) | tous les `script`, les `on*`, les `iframe`, les `action` de formulaire sont retirés ; refus `NOT_INERT` s'il en reste | plus aucun comportement : menus, onglets, validation, routage |
| Réseau | aucune réponse `fetch`/XHR n'est capturée | une page qui charge ses données après coup est vide ou figée |
| Lecteur (`packages/player-core/src/htmlFrame.ts`) | `iframe srcdoc`, `sandbox="allow-scripts"`, CSP `default-src 'none'`, un seul script autorisé (le nôtre) | seuls nos liens entre pages fonctionnent |
| Plan (`sandboxGraph.ts`) | une page n'existe que si elle a été capturée ; un lien vers une page non capturée est un « lien sans page » | les « pages absentes du plan » |
| Scripts bloqués | la liste détaillée n'existe que dans l'écran de vérification de l'extension, sans « Garder » ; le serveur ne garde que des compteurs | impossible de rétablir un script |

La v2 n'est donc pas une retouche : elle change la nature de ce qui est stocké (du code de tiers
exécuté chez nous). Elle doit rester **un mode à part**, activé par démo, à côté du mode inerte qui
reste le défaut.

## 3. Principe de la v2

Une page v2 est un **enregistrement rejouable** :

1. le document et ses ressources (CSS, images, polices), comme en v1 ;
2. **ses scripts**, gardés ou bloqués un par un ;
3. **les réponses réseau lues** pendant la capture (GET), pour les rejouer ;
4. un **environnement factice** injecté avant les scripts de la page : réseau, stockage, navigation.

Dans le lecteur, les scripts de la page s'exécutent, mais dans une boîte sans aucune sortie : ils
croient parler à leur serveur, ils parlent à notre faux réseau.

### 3.1 Capture (extension, option B conservée)

L'extension n'a pas la permission `debugger` dans la version de la boutique : pas de capture réseau
par le protocole de débogage. On s'en passe, sans nouvelle permission (`scripting` suffit) :

- **Scripts** : relevés dans le DOM (`script[src]`, scripts en ligne, modules), téléchargés par le
  service de fond avec la règle existante (`lib/assetPolicy.ts` : https, pas d'hôte privé, 3 Mo par
  ressource, cookies seulement vers l'origine de la page).
- **Réponses réseau** : un petit script injecté dans le monde de la page (`world: 'MAIN'`, au début
  du document) enveloppe `fetch` et `XMLHttpRequest` et copie les réponses **GET** (adresse, statut,
  type, corps). Ce qui a été demandé avant l'injection est retrouvé par la liste des ressources du
  navigateur (`performance.getEntriesByType('resource')`) puis retéléchargé par le service de fond.
- **Jamais stocké** : en-têtes d'authentification, cookies, `Set-Cookie`, corps des requêtes
  d'écriture.
- **Limites** : 1 Mo par réponse, 300 réponses et 10 Mo par page (comme aujourd'hui) ; au-delà, la
  page est gardée et les réponses en trop sont listées « non rejouées ».
- **Données personnelles** : les réponses JSON et texte passent par le même repérage que le DOM
  (`scanNodes`) ; les valeurs repérées sont remplacées avant l'envoi et comptées dans l'écran de
  vérification, nouveau groupe « Réponses du site ».

### 3.2 Découverte des pages

- Pendant la capture, chaque lien du même site et chaque changement de route (applications à page
  unique, déjà détecté) alimente une liste **« Pages liées »** avec son état : capturée, à capturer.
- Action **« Capturer les pages liées »** : l'extension ouvre une à une, dans l'onglet courant, les
  pages du même site non encore capturées (profondeur 1, 20 pages au plus par passe, arrêt à tout
  moment). C'est l'utilisateur qui la lance ; il garde l'écran de vérification avant l'envoi.
- Le plan de l'éditeur affiche une **couverture** (« 14 pages sur 17 liens du site ») et garde les
  actions actuelles : capturer, relier, laisser le message.

### 3.3 Scripts : « Garder / Bloquer »

- Chaque script a une fiche : origine, nom, taille, catégorie (`page`, `tiers`, `mesure d'audience`).
  Les catégories existent déjà (`classifyRemoved`, liste `TRACKERS`).
- Défaut : scripts de la page et de son domaine **gardés** ; mesure d'audience, publicité, widgets
  de discussion **bloqués** ; scripts de tiers inconnus bloqués, avec « Garder ».
- La décision est faite dans l'écran de vérification, puis modifiable dans l'éditeur (panneau
  Sécurité de la page). Elle est stockée par page (`html_meta.scripts[]`) ; le lecteur ne charge que
  les scripts gardés. Changer une décision ne demande pas de recapturer.

### 3.4 Lecture : la boîte

Même enveloppe qu'aujourd'hui (`iframe srcdoc`, `sandbox="allow-scripts"`, **sans**
`allow-same-origin`), donc une origine opaque : aucun accès à l'app, au lecteur, aux cookies ni au
stockage du navigateur. Avant les scripts de la page, notre environnement factice installe :

| Appel de la page | Réponse de la boîte |
|---|---|
| `fetch` / XHR **GET** d'une adresse enregistrée | la réponse capturée (clé : méthode + adresse normalisée, paramètres triés) |
| GET non enregistré | 404 vide, compté dans « non rejoué » (mesure de fidélité) |
| **POST / PUT / PATCH / DELETE** | succès fictif (200 ou 204, corps `{}`), rien n'est transmis ni gardé |
| `WebSocket`, `EventSource`, `sendBeacon` | objets inertes : ouverture réussie, aucun message |
| `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB` | stockage en mémoire, **propre à la visite**, vidé à chaque changement de page de la démo |
| lien, `location`, `history.pushState`, envoi de formulaire | intercepté et transmis au lecteur, qui affiche la page capturée correspondante ; sinon le message actuel « Aucun lien à cet endroit » |

« Un formulaire envoyé avance, et si l'on y revient il est vide » découle de ces règles : l'envoi
reçoit un succès fictif, la page suit sa propre logique (ou notre lien), et le retour recharge
l'enregistrement d'origine avec un stockage neuf.

### 3.5 Sécurité

Exécuter le code d'un site tiers dans le lecteur est le vrai risque. Les règles :

1. **Aucune sortie réseau.** CSP de la page : `default-src 'none'`, `connect-src 'none'`,
   `form-action 'none'`, `frame-src 'none'`, `img-src data:` et notre stockage seulement,
   `script-src` limité aux scripts gardés (par empreinte ou par adresse signée de notre stockage).
2. **Pas de navigation de fuite.** L'iframe n'a ni `allow-top-navigation` ni `allow-popups` ; la
   page du lecteur porte elle-même une CSP `frame-src` qui interdit à l'iframe de se rediriger vers
   une adresse extérieure (seule fuite possible sinon).
3. **Origine opaque** : pas d'accès au lecteur, à la session, aux autres démos.
4. **Rien de réel n'est rejoué** : ni cookies, ni jetons, ni en-têtes d'authentification ; les
   données personnelles des réponses sont remplacées avant l'envoi (3.1).
5. **Ce que tape le visiteur ne sort pas** : écritures neutralisées, stockage en mémoire, aucun
   événement d'analytics ne porte le contenu d'un champ.
6. **Activation** (décision du chef, §8) : réglage **par démo**, activable par un éditeur, autorisé
   par défaut ; garde-fou d'espace (Paramètres › Sécurité, à côté de la capture HTML) qu'un
   administrateur peut fermer. Le mode inerte reste disponible et reste le mode d'une nouvelle démo.
7. **Serveur** : `html-ingest` garde le contrôle `NOT_INERT` pour le mode inerte. Le mode v2 a son
   propre contrôle : scripts acceptés seulement s'ils figurent dans la liste déclarée, tailles,
   types, analyse des adresses (Safe Browsing existant).

Un test automatique prouve la règle 1 : toute requête sortante du lecteur pendant le banc est un
échec.

### 3.6 Stockage et données

- Bucket `html` (privé, écrit par `html-ingest` seulement), un dossier par page :
  `page.html`, `s-<empreinte>.js` (scripts), `r-<empreinte>` (réponses), `replay.json` (index :
  scripts et leur état, réponses et leur clé).
- `steps.html_meta` : `mode` (`inert` | `live`), `scripts[]`, compteurs `replayed` / `unreplayed`.
- Publication : copie dans `published` comme aujourd'hui ; le manifeste ne porte aucune adresse du
  site d'origine (déjà le cas pour les liens).
- Nouvelles migrations seulement (les migrations en place ne changent pas), avec RLS et pgTAP.

## 4. Banc de test et taux de fidélité

Des sites d'essai fictifs, servis en local par les e2e de l'extension :

| Site d'essai | Ce qu'il vérifie |
|---|---|
| Site de plusieurs pages statiques | découverte des pages, plan complet |
| Application à page unique (routes, onglets, menus) | scripts gardés, navigation interceptée |
| Liste chargée par `fetch` avec filtre | réponses GET rejouées |
| Formulaire avec validation et envoi POST | écriture neutralisée, « avance », vide au retour |
| Application qui dépend de `localStorage` | stockage en mémoire par visite |
| Page avec mesure d'audience et widget de tiers | blocage par défaut, « Garder » |

Servis par `apps/extension/e2e/banc/serveur.cjs` (`/site`, `/app`, `/liste`, `/formulaire`,
`/stockage`, `/tiers`, plus `/onglets` et `/menu` du lot L60) ; mesure par `e2e/banc/mesure-sandbox.cjs`.

Mesures, publiées par le banc à chaque passage :

- **Fidélité d'interaction** : part des gestes d'un scénario (clic, saisie, envoi) qui donnent le
  même résultat que sur le site d'essai (texte attendu présent, bonne page). Objectif de la
  première livraison : **90 % sur le banc**.
- **Fidélité visuelle** : écart d'image entre le site et sa reprise, page par page.
- **Réponses rejouées** : `replayed / (replayed + unreplayed)`.
- **Sorties réseau** : doit valoir 0 (échec sinon).

Le même taux est calculé pour chaque démo réelle (réponses rejouées, scripts gardés, pages liées
capturées) et affiché dans le plan : l'auteur voit ce qui manque.

## 5. Limites connues

- Pas de `debugger` (option B) : les échanges faits avant l'injection et non listés par le
  navigateur, les WebSocket et les service workers ne sont pas capturés.
- Les cadres d'un autre domaine, le WebGL et les sites qui refusent d'être relus hors de leur
  domaine (vérification d'origine dans leur code) resteront partiels.
- Une réponse qui dépend de l'heure, d'un jeton ou d'un état serveur est rejouée telle que vue à
  la capture.
- Le rendu « live » est plus lourd qu'une page inerte : limites de taille par page et par démo.

## 6. Découpage proposé

1. **Banc de test** et mesure, sur la v1 (point de départ chiffré).
2. **Lecture v2** : environnement factice (réseau, stockage, navigation) et CSP, avec des pages
   d'essai préparées à la main. Test « aucune sortie réseau ».
3. **Capture v2** : scripts et réponses GET, écran de vérification (scripts, réponses), `html-ingest`.
4. **Pages liées** : liste, capture en série, couverture dans le plan.
5. **Éditeur** : « Garder / Bloquer » par script, taux de fidélité par page.
6. Compatibilité du guide et des bulles (sélecteurs sur un DOM qui bouge), analytics.

Chaque étape est livrable seule et laisse le mode inerte intact.

## 7. Questions pour le chef

1. Mode v2 **désactivé par défaut** et activé par un admin (réglage d'espace) : d'accord ?
2. Injection dans le monde de la page pour lire les réponses : aucune nouvelle permission, mais
   c'est un changement à décrire dans la fiche de la boutique. D'accord ?
3. Objectif de 90 % d'interactions sur le banc pour la première livraison : suffisant pour le
   montrer au client ?
4. Les sites du client qui posent problème aujourd'hui : peut-on avoir leurs adresses (ou une copie
   sans données réelles) pour les ajouter au banc ?

## 8. Décisions du chef

1. **Activation** : réglage Sandbox v2 par démo, activable par un éditeur, autorisé par défaut, avec
   un garde-fou d'espace qu'un administrateur peut fermer (§3.5, règle 6).
2. **Injection dans le monde de la page** : acceptée, sans nouvelle permission. Paragraphe pour la
   fiche du Chrome Web Store (justification de `scripting`), à reprendre tel quel :

   > When you capture a page in Sandbox mode, TutoClick adds a small script to that page so it can
   > copy the data the page loads for itself (read requests only), together with the page's own
   > scripts. This lets the demo behave like the real site when it is replayed. The script runs only
   > in the tab you are capturing, only while a capture is in progress, and only after you start it.
   > It never reads or stores passwords, cookies, authentication headers or anything you send to the
   > site, and personal data found in the copied data is replaced before upload. Replayed demos run
   > in an isolated frame with no network access.

3. **Objectif de fidélité** : 90 % d'interactions réussies sur le banc, suffisant pour la première
   démonstration au client. Les taux de la v1 sont relevés, ce n'est pas un seuil.
4. **Sites du client** : non, on ne touche pas à ses données. Le banc est fait de sites d'essai
   locaux qui reproduisent ses cas (application à page unique, formulaire POST, scripts de tiers,
   onglets chargés en différé, menu au survol).
5. **Critères à 100 %** (besoin exprimé par le client), contrôlés à chaque passage du banc :
   - a) chaque page capturée apparaît dans le plan du Sandbox ;
   - b) aucun script n'est bloqué sans moyen de le réactiver (« Garder » / « Rétablir ») ;
   - c) aucune sortie réseau réelle depuis le lecteur : toute requête est bloquée ou servie
     localement ;
   - d) aucune écriture réelle : toute écriture est neutralisée, avec un succès fictif ;
   - et, pour le banc lui-même : chaque site d'essai est servi, chaque parcours réussit entièrement sur
     le site vivant, chaque site est capturé et mesuré, la mesure est publiée à chaque passage.

   L'étape 1 (v1) contrôle déjà c) et le banc ; a), b) et d) entrent dans les critères de l'étape 2
   (lecture v2) et des suivantes. Mesure de la v1 : interaction 53,6 %, visuel 99,9 %, réponses
   rejouées 0 %, plan 81,3 %, sorties 0
   (`docs/tech/recettes/sandbox-v2-etape1/mesure-v1.md`).

## 9. Étape 3 : découpage

| Livraison | Contenu | État |
|---|---|---|
| 3a. Données et serveur | bucket `html_live`, `steps.html_live_path`, `html_meta.live` (fiches des scripts, sans code), `demos.sandbox.live`, garde-fou `settings.sandboxLive` (`set_sandbox_live`) ; `html-ingest` : seconde requête `{ path, live }` contrôlée (`live.ts`) | livrée |
| 3b. Capture (extension) | enregistreur dans le monde de la page (`world: 'MAIN'`, GET de `fetch` / XHR) et reprise des échanges antérieurs par `performance` ; document source avec CSS et images intégrés, scripts à leur place (marques) ; repérage des données personnelles dans le document et les réponses ; écran de vérification : « Scripts de la page » avec Garder / Bloquer, « Réponses du site » ; envoi de la seconde requête | à faire |
| 3c. Lecture dans l'app | publication (copie de l'enregistrement, manifeste `step.html.live`), lecteur `HtmlStep` en mode vivant (navigation par adresse), aperçu de l'éditeur ; réglage « Sandbox vivant » de la démo | à faire |
| 3d. Banc | capture v2 réelle sur le banc avec l'extension construite, mesure de bout en bout (objectif 90 %) et critères a à d ; recette UX | à faire |
