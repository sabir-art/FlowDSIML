# L48-G : trois types de contenu (captures, HTML, Sandbox)

> Ajout au benchmark de structure (`docs/ux/benchmark-structure.md`), demandé par le chef de projet. TutoClick produit trois types de contenu ; ils doivent être présentés **comme tels** à la création, dans la navigation et sur les cartes.
> **À réaliser avec L48-A** (navigation) ; le dialogue de création peut suivre juste après.
> Maquette : `docs/ux/maquettes/refonte/l48g-types.html`. Captures : `img/l48g-creation.png`, `img/l48g-source.png`, `img/l48g-navigation.png`, `img/l48g-plan.png` et `img/l48g-sombre-mobile.png`.
> Données fictives.

## 1. Constat (code de `claude/dev-mvp`, 0e86ab9)

**Création.**
- « Nouvelle démo » (`NewDemoDialog.tsx`) propose des **sources** : Capturer avec l'extension, Importer des images, Partir d'une démo vide, Générer avec l'IA, Partir d'un modèle.
- Le **type** n'y est pas proposé, et aucune illustration ne l'explique.
- Le choix « Démo guidée / Sandbox » n'existe que dans l'extension, après une capture HTML (`html-review`, champ `kind`).

**Données.**
- `demos.kind` vaut `guided` ou `sandbox`.
- Le format des pages (capture d'écran ou HTML) se lit dans `steps.kind` (`image`, `html`, `video`…).
- La « démo HTML » est donc une démo `guided` dont les étapes sont des pages `html`.

**Sandbox (A8, L20-02), déjà en place.**
- Plan des pages (`SandboxPlan`) et page de départ.
- Liaison automatique des liens identiques (`autoLink`, activée par défaut, via `html_meta.links` et l'adresse de la page).
- Pages « À relier » : aucune autre page ne mène à elles.
- Comportement d'un clic non relié : message, rien, ou mise en évidence des zones cliquables.
- Pages clés pour la complétion.

**Ce qui manque au Sandbox** : les liens qui mènent à une **page non capturée** (même site, aucune page à cette adresse) ne sont signalés nulle part.

**Navigation et listes** : rien ne distingue les trois types, ni dans la barre latérale ni sur les cartes.

## 2. Les trois types

| Type | Données | Une ligne (création, aide, infobulles) | Unité |
|---|---|---|---|
| **Démo par captures** | `kind = guided`, étapes `image` (et `video`, `before_after`) | Un parcours guidé, une capture d'écran par étape, avec une bulle à chaque clic. | étapes |
| **Démo HTML** | `kind = guided`, étapes `html` en majorité | Un parcours guidé sur de vraies pages HTML : textes et données modifiables, net sur tous les écrans. | étapes |
| **Sandbox** | `kind = sandbox` | Des pages HTML reliées entre elles : le visiteur explore librement, sans étapes imposées. | pages |

- Une fonction `contentType(demo, steps)` partagée (app, lecteur, Analytics) renvoie `captures`, `html` ou `sandbox` :
  - `sandbox` si `kind = sandbox` ;
  - sinon `html` si plus de la moitié des étapes sont `html` ;
  - sinon `captures`.
- **Vocabulaire fixe** : « Démo par captures », « Démo HTML », « Sandbox ». Sur une carte ou un badge court : « Captures », « HTML », « Sandbox ».
- **Icônes Lucide** : `image` (captures), `code` (HTML), `map` (Sandbox).

## 3. Création : « Nouvelle démo » en deux étapes

**Étape 1 sur 2, « Type de contenu »**
- Modale de 880 px. Un `fieldset` « Que voulez-vous créer ? » contient 3 cartes radio de même hauteur.
- **Contenu de chaque carte** :
  - une **illustration schématique** en SVG (16:9, couleurs des tokens, sans capture réelle) ;
  - le nom (16 px, graisse 700) ;
  - la ligne d'explication du §2 ;
  - deux points forts :
    - Captures : « Le plus rapide à créer » et « Idéal pour une procédure pas à pas » ;
    - HTML : « Textes modifiables sans recapturer » et « Données fictives faciles à remplacer » ;
    - Sandbox : « S'entraîner sans risque » et « Liens reliés automatiquement ».
- **Sélection** : bordure `primary` de 2 px, fond `primary-soft`. Le radio natif est dans le coin, et les flèches parcourent les cartes.
- **Par défaut** : Démo par captures, ou le dernier type choisi par l'utilisateur.
- **Pied** : « Étape suivante : la source (extension, images, modèle…) », Annuler, Continuer.

**Étape 2 sur 2, « Source »** : titre « Nouvelle démo par captures », « Nouvelle démo HTML » ou « Nouveau Sandbox », avec le badge du type. On y retrouve le nom, le dossier et les sources **filtrées par type** :

| Source | Captures | HTML | Sandbox |
|---|---|---|---|
| Capturer avec l'extension (recommandé) | oui (mode captures) | oui (mode HTML, type « guidé » prérempli) | oui (mode HTML, type « Sandbox » prérempli) |
| Importer des images | oui | — | — |
| Partir d'un modèle | oui | si un modèle HTML existe, sinon « Bientôt » | « Bientôt » tant qu'aucun modèle Sandbox n'existe |
| Générer avec l'IA | oui (selon les réglages IA) | — | — |
| Partir d'une démo vide | oui | — | — |

- « Retour » ramène à l'étape 1 sans perdre la saisie.
- L'extension reçoit le type choisi. Dans `html-review`, le choix « guidée / Sandbox » est **prérempli** avec ce type, et reste modifiable.
- **Clavier et lecteur d'écran** : titre annoncé « Nouvelle démo, étape 1 sur 2 » ; les illustrations sont `aria-hidden`.

## 4. Navigation et listes

- **Barre latérale (L48-A §1), groupe Contenus** : Démos (`layout-grid`), **Sandbox** (`map`), Parcours de formation, Analytics.
  - Démos regroupe les deux types guidés (captures et HTML) : même éditeur, mêmes étapes, même publication.
  - Le Sandbox a sa propre entrée : il se crée, se lit et se mesure autrement (pages, plan, exploration libre).
- **Page Démos** :
  - filtre **« Type : Tous · Captures · HTML »** (segmenté de 40 px, L40), après Statut ;
  - badge de type sur chaque carte (coin haut gauche de la vignette, fond `surface`, icône de 13 px et libellé) et dans la vue liste (colonne Type).
- **Page Sandbox** (`/sandbox`) :
  - même barre de liste et même colonne Dossiers que Démos (L48-A §2), filtrées sur `kind = sandbox` ;
  - cartes avec « n pages », plus « n liens sans page » en `danger` s'il y en a (§5) ;
  - « Nouveau Sandbox » ouvre le dialogue directement à l'étape 2, type Sandbox.
- **Ailleurs** :
  - le type apparaît dans le filtre Démo d'Analytics, dans Parcours (ajout d'un contenu) et dans les résultats de recherche ;
  - la liste des pages du Sandbox dit « pages » et non « étapes ».

## 5. Sandbox : liens sans page

Ce qui existe est conservé : liaison automatique, plan, page de départ, « À relier », clic non relié, pages clés. On y **ajoute le signalement des liens morts**.

- **Définition** : un lien de `html_meta.links` dont l'adresse est sur le **même site** que la page, mais ne correspond à **aucune page capturée** (même normalisation que `resolveLinks`), et qui n'est pas relié à la main (`op: 'link'`). Les liens externes (autre domaine) et les ancres (`#…`) ne sont pas comptés.
- **Plan** :
  - le nœud d'une page qui contient de tels liens affiche « n sans page » en `danger` (texte, et non une seule couleur) ;
  - un nœud fantôme en pointillé « Page non capturée », avec l'adresse, est relié par un trait pointillé `danger` ;
  - le `role="img"` du plan l'annonce : « 2 liens mènent à des pages non capturées ».
- **Panneau « Liens sans page »** à droite du plan (320 px) :
  - compteur dans l'en-tête ;
  - phrase : « Ces liens mènent à des pages que vous n'avez pas capturées. Au clic, le visiteur voit « Cette partie n'est pas disponible dans la démo ». » (selon le réglage du clic non relié) ;
  - pour chaque lien : texte du lien, page d'origine → adresse, puis trois actions :
    - **Capturer cette page** : ouvre l'extension sur l'adresse en mode HTML, rattachée à ce Sandbox ;
    - **Relier à une page** : choix d'une page existante, qui crée un lien `op: 'link'` ;
    - **Laisser le message** : le lien est marqué comme volontaire et sort de la liste ; il reste visible dans « Afficher les liens laissés ».
- **Publication** : si des liens sans page restent non traités, la publication n'est pas bloquée. La liste de contrôle avant publication affiche « 2 liens mènent à des pages non capturées » avec « Voir le plan ».
- **Données** : la liste « laissés volontairement » est stockée dans `demos.sandbox.ignoredLinks` (adresse et page d'origine).

## 6. Recette

- Dialogue :
  - 3 types avec illustration, ligne et points forts ;
  - sources filtrées par type ;
  - Retour conservé ;
  - « Bientôt » pour les modèles qui n'existent pas ;
  - clair, sombre, 390 px (cartes en liste, illustration de 96 px à gauche).
- Création d'un Sandbox depuis l'app : l'extension s'ouvre avec le type Sandbox prérempli dans `html-review`.
- Barre latérale : Démos et Sandbox séparés. Démos ne montre pas de Sandbox ; Sandbox ne montre que des Sandbox.
- Filtre Type et badges : une démo à étapes `image` affiche « Captures », une démo à étapes `html` affiche « HTML ».
- Liens sans page :
  - avec une page dont le menu pointe vers une adresse non capturée, le nœud affiche « 1 sans page » et le panneau liste le lien ;
  - chaque action produit le bon effet ;
  - un lien externe n'est pas compté.
- e2e : `sandbox` (plan, liens sans page), `new-demo` (deux étapes), `l40-barres` (filtre Type).
